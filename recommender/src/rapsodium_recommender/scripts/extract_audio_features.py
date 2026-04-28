"""Extract real audio features from Deezer preview MP3s using Essentia.

Spotify's ``/audio-features`` endpoint was deprecated for new applications in
late 2024, so we cannot pull pre-computed Spotify-style features. Instead we
analyze the 30-second preview MP3s we already store on every song and compute
open-source analogues with Essentia (UPF Barcelona).

Pipeline per song::

    download preview to cache → MonoLoader (44.1 kHz mono) → algorithms
        ├── RhythmExtractor2013 → tempo (BPM)
        ├── RMS → loudness in dB → linear [0, 1] energy
        ├── Danceability (Streich & Herrera 2005) → [0, 1] danceability
        └── KeyExtractor + spectral centroid → composite valence proxy

Thesis-defensibility notes (write these into the methodology section):

* The 30-second clip is a chorus-region sample, not the full track. Tempo, key,
  and danceability are stable across a song; valence and energy are estimates
  for that one segment.
* "Energy" here is RMS-derived loudness mapped through a fixed dB window. It
  is corpus-independent and reproducible — but it is not Spotify's energy,
  which is a proprietary blend.
* "Valence" is a composite (``0.5 · mode_major + 0.5 · normalized_brightness``)
  grounded in MIR mood-cue literature (Saari & Eerola, 2014). It is the open
  analogue of Spotify's proprietary valence model — name it as such in the
  thesis, do not claim equivalence.
* Songs whose preview is unreachable, decodable to silence, or otherwise
  malformed are left with their existing values (NULL or synthetic). The
  content-based recommender already imputes NULLs by column median.

Run::

    poetry run extract-audio-features                 # fills NULLs only
    poetry run extract-audio-features --force         # re-extract every song
    poetry run extract-audio-features --limit 5       # process at most 5 (smoke test)
    poetry run extract-audio-features --workers 4     # parallelize (default 4)
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

import essentia.standard as es
import numpy as np
from numpy.typing import NDArray

from ..db import get_connection

# --- Audio / extraction constants -----------------------------------------

SAMPLE_RATE = 44100
DOWNLOAD_TIMEOUT_S = 20.0
DEEZER_TRACK_ENDPOINT = "https://api.deezer.com/track/{deezer_id}"
DEFAULT_CACHE_DIR = Path.home() / ".cache" / "rapsodium" / "previews"

# RMS-loudness → energy mapping. -50 dB is "near silence", -5 dB is "very loud
# mastered chorus". Values outside this window are clipped. The window is
# fixed (not corpus-dependent) so reruns produce identical numbers.
ENERGY_DB_MIN = -50.0
ENERGY_DB_MAX = -5.0

# Spectral-centroid range used for the brightness component of valence. Music
# centroids typically fall in 500-5000 Hz; we map to [0, 1] over [500, 4000]
# Hz, which empirically separates dark (e.g. classical, slow R&B) from bright
# (e.g. pop, electronic) content without saturating either end.
CENTROID_HZ_MIN = 500.0
CENTROID_HZ_MAX = 4000.0

# Danceability outputs are roughly in [0, 3]; the algorithm has no firm upper
# bound. Empirically 1.0-2.5 covers the bulk of music. Divide by 3 then clip.
DANCEABILITY_DIVISOR = 3.0

# Output clip: keep features off the exact 0/1 endpoints so cosine similarity
# never gets a true zero vector. Mirrors the convention in seed_audio_features.
FEATURE_FLOOR = 0.05
FEATURE_CEIL = 0.99

DB_BATCH_SIZE = 50

log = logging.getLogger("extract_audio_features")


# --- Feature container ----------------------------------------------------


@dataclass(frozen=True)
class AudioFeatures:
    tempo: float
    energy: float
    danceability: float
    valence: float


# --- Math helpers ---------------------------------------------------------


def _clip(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _clip_unit(x: float) -> float:
    return _clip(x, FEATURE_FLOOR, FEATURE_CEIL)


# --- Per-song extraction --------------------------------------------------


def _fresh_preview_url(deezer_id: int, timeout: float) -> str | None:
    """Fetch a freshly-signed preview URL from Deezer's track endpoint.

    The ``preview`` URL stored in our DB carries an HMAC signature that
    becomes invalid (HTTP 403) some time after seeding. The track endpoint
    returns a fresh, currently-valid URL each time it is called.
    """
    url = DEEZER_TRACK_ENDPOINT.format(deezer_id=deezer_id)
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        log.warning("track lookup failed for deezer_id=%s: %s", deezer_id, exc)
        return None

    preview = payload.get("preview")
    if not isinstance(preview, str) or not preview:
        log.warning("no preview available for deezer_id=%s", deezer_id)
        return None
    return preview


def _download_preview(deezer_id: int, cache_path: Path, timeout: float) -> bool:
    """Cache a preview MP3 locally. Returns True iff a usable file is on disk."""
    if cache_path.exists() and cache_path.stat().st_size > 0:
        return True
    preview_url = _fresh_preview_url(deezer_id, timeout)
    if preview_url is None:
        return False
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with (
            urllib.request.urlopen(preview_url, timeout=timeout) as response,
            cache_path.open("wb") as fh,
        ):
            fh.write(response.read())
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        log.warning("download failed (deezer_id=%s): %s", deezer_id, exc)
        cache_path.unlink(missing_ok=True)
        return False
    return True


def _energy_from_audio(audio: NDArray[np.float32]) -> float:
    rms_sq = float(np.mean(audio.astype(np.float64) ** 2))
    if rms_sq <= 0.0:
        return FEATURE_FLOOR
    db = 10.0 * float(np.log10(rms_sq))
    normalized = (db - ENERGY_DB_MIN) / (ENERGY_DB_MAX - ENERGY_DB_MIN)
    return _clip_unit(normalized)


def _valence_from_audio(audio: NDArray[np.float32], scale: str) -> float:
    """0.5 · mode_indicator + 0.5 · normalized_brightness.

    Brightness is the time-averaged spectral centroid in Hz, linearly mapped
    over ``[CENTROID_HZ_MIN, CENTROID_HZ_MAX]``. Mode is 1.0 for major, 0.0
    for minor. Composition follows Saari & Eerola (2014) on mood cues.
    """
    spectrum = es.Spectrum()
    centroid = es.Centroid(range=SAMPLE_RATE / 2.0)
    centroids: list[float] = []
    for frame in es.FrameGenerator(audio, frameSize=2048, hopSize=1024):
        centroids.append(float(centroid(spectrum(frame))))
    if not centroids:
        return 0.5
    mean_centroid_hz = float(np.mean(centroids))
    brightness = (mean_centroid_hz - CENTROID_HZ_MIN) / (CENTROID_HZ_MAX - CENTROID_HZ_MIN)
    brightness = _clip(brightness, 0.0, 1.0)
    mode = 1.0 if scale == "major" else 0.0
    return _clip_unit(0.5 * mode + 0.5 * brightness)


def _extract_features(audio_path: Path) -> AudioFeatures | None:
    """Run all four feature extractors. Returns None on decode failure."""
    try:
        audio: NDArray[np.float32] = es.MonoLoader(
            filename=str(audio_path), sampleRate=SAMPLE_RATE
        )()
    except RuntimeError as exc:
        log.warning("decode failed (%s): %s", audio_path.name, exc)
        return None

    if audio.size == 0 or float(np.max(np.abs(audio))) == 0.0:
        log.warning("silent or empty audio (%s)", audio_path.name)
        return None

    bpm, _, _, _, _ = es.RhythmExtractor2013(method="multifeature")(audio)
    _key, scale, _strength = es.KeyExtractor()(audio)
    danceability_raw, _dfa = es.Danceability()(audio)

    return AudioFeatures(
        tempo=float(bpm),
        energy=_energy_from_audio(audio),
        danceability=_clip_unit(float(danceability_raw) / DANCEABILITY_DIVISOR),
        valence=_valence_from_audio(audio, scale),
    )


def _process_song(
    song_id: UUID, deezer_id: int, cache_dir: Path
) -> tuple[UUID, AudioFeatures | None]:
    cache_path = cache_dir / f"{song_id}.mp3"
    if not _download_preview(deezer_id, cache_path, DOWNLOAD_TIMEOUT_S):
        return song_id, None
    return song_id, _extract_features(cache_path)


# --- DB I/O ---------------------------------------------------------------


def _fetch_targets(force: bool, limit: int | None) -> list[tuple[UUID, int]]:
    sql = "SELECT id, deezer_id FROM songs WHERE deezer_id IS NOT NULL"
    if not force:
        sql += " AND (tempo IS NULL OR energy IS NULL OR danceability IS NULL OR valence IS NULL)"
    sql += " ORDER BY id"
    if limit is not None:
        sql += f" LIMIT {int(limit)}"

    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(sql)
        return [(row[0], int(row[1])) for row in cur.fetchall()]


def _flush_updates(updates: list[tuple[float, float, float, float, UUID]]) -> None:
    if not updates:
        return
    with get_connection() as conn, conn.cursor() as cur:
        cur.executemany(
            "UPDATE songs SET tempo = %s, energy = %s, "
            "danceability = %s, valence = %s WHERE id = %s",
            updates,
        )
        conn.commit()


# --- CLI ------------------------------------------------------------------


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract real audio features from Deezer previews via Essentia."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-extract for every song (default: only fill NULLs).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Process at most N songs (useful for smoke tests).",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="Concurrent extraction workers (default 4).",
    )
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=DEFAULT_CACHE_DIR,
        help=f"Where to cache downloaded preview MP3s (default {DEFAULT_CACHE_DIR}).",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Print per-song progress.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(message)s",
    )

    targets = _fetch_targets(force=args.force, limit=args.limit)
    if not targets:
        print("Nothing to extract. Use --force to re-process existing rows.")
        return 0

    print(f"Extracting features for {len(targets)} song(s) with {args.workers} workers...")
    args.cache_dir.mkdir(parents=True, exist_ok=True)

    pending: list[tuple[float, float, float, float, UUID]] = []
    successes = 0
    failures = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [
            pool.submit(_process_song, song_id, deezer_id, args.cache_dir)
            for song_id, deezer_id in targets
        ]
        for fut in as_completed(futures):
            song_id, feats = fut.result()
            if feats is None:
                failures += 1
                continue
            pending.append(
                (feats.tempo, feats.energy, feats.danceability, feats.valence, song_id)
            )
            successes += 1
            if args.verbose:
                log.info(
                    "%s tempo=%.1f energy=%.2f danceability=%.2f valence=%.2f",
                    song_id,
                    feats.tempo,
                    feats.energy,
                    feats.danceability,
                    feats.valence,
                )
            if len(pending) >= DB_BATCH_SIZE:
                _flush_updates(pending)
                pending.clear()

    _flush_updates(pending)

    print(f"Updated {successes} song(s); {failures} skipped.")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
