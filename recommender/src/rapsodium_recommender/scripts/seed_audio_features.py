"""Populate synthetic tempo/energy/danceability/valence on every song.

We don't have access to Spotify's audio-feature API, so we sample each song's
features from a genre-conditioned Gaussian. The means are informed by commonly
cited ranges for each genre; variance is wide enough that songs within a genre
don't collapse to identical vectors (the content-based recommender would have
nothing to separate them).

Run once before exercising content-based recommendations::

    poetry run seed-audio-features                # fills NULLs only
    poetry run seed-audio-features --force        # overwrite all rows
    poetry run seed-audio-features --seed 1337    # deterministic reroll
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass

import numpy as np

from ..db import get_connection


@dataclass(frozen=True)
class GenreProfile:
    tempo: float  # BPM
    energy: float  # 0-1
    danceability: float  # 0-1
    valence: float  # 0-1 — positive/happy feel


GENRE_PROFILES: dict[str, GenreProfile] = {
    "classical": GenreProfile(tempo=90, energy=0.30, danceability=0.30, valence=0.50),
    "country": GenreProfile(tempo=110, energy=0.55, danceability=0.60, valence=0.70),
    "electronic": GenreProfile(tempo=125, energy=0.80, danceability=0.85, valence=0.60),
    "hip hop": GenreProfile(tempo=95, energy=0.70, danceability=0.85, valence=0.55),
    "jazz": GenreProfile(tempo=120, energy=0.40, danceability=0.50, valence=0.60),
    "latin": GenreProfile(tempo=115, energy=0.75, danceability=0.90, valence=0.80),
    "metal": GenreProfile(tempo=140, energy=0.95, danceability=0.50, valence=0.35),
    "pop": GenreProfile(tempo=120, energy=0.70, danceability=0.75, valence=0.70),
    "r&b": GenreProfile(tempo=100, energy=0.55, danceability=0.70, valence=0.60),
    "rock": GenreProfile(tempo=120, energy=0.80, danceability=0.60, valence=0.55),
}

DEFAULT_PROFILE = GenreProfile(tempo=110, energy=0.60, danceability=0.60, valence=0.60)

# Standard deviations for the per-feature noise.
TEMPO_STD = 15.0
UNIT_STD = 0.12


def _clip(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def sample_features(genre: str, rng: np.random.Generator) -> tuple[float, float, float, float]:
    profile = GENRE_PROFILES.get(genre.lower(), DEFAULT_PROFILE)
    tempo = _clip(profile.tempo + float(rng.normal(0, TEMPO_STD)), 60.0, 200.0)
    energy = _clip(profile.energy + float(rng.normal(0, UNIT_STD)), 0.05, 0.99)
    danceability = _clip(profile.danceability + float(rng.normal(0, UNIT_STD)), 0.05, 0.99)
    valence = _clip(profile.valence + float(rng.normal(0, UNIT_STD + 0.03)), 0.05, 0.99)
    return tempo, energy, danceability, valence


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed synthetic audio features per genre.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed (default 42).")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing feature values (default: only fill NULLs).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    rng = np.random.default_rng(args.seed)

    select_sql = "SELECT id, genre FROM songs"
    if not args.force:
        select_sql += (
            " WHERE tempo IS NULL OR energy IS NULL " "OR danceability IS NULL OR valence IS NULL"
        )

    with get_connection() as conn, conn.cursor() as cur:
        cur.execute(select_sql)
        rows = cur.fetchall()

        if not rows:
            print("All songs already have features. Use --force to reroll.")
            return 0

        updates: list[tuple[float, float, float, float, object]] = []
        for song_id, genre in rows:
            tempo, energy, danceability, valence = sample_features(genre or "", rng)
            updates.append((tempo, energy, danceability, valence, song_id))

        cur.executemany(
            "UPDATE songs SET tempo = %s, energy = %s, "
            "danceability = %s, valence = %s WHERE id = %s",
            updates,
        )
        conn.commit()

    print(f"Updated {len(updates)} song(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
