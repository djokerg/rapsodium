"""Contextual ("vibe") recommender.

Drives recommendations from a conversational ``VibeProfile`` produced by the
assistant (see ``docs/assistant.md``). Instead of ranking by similarity to the
user's *saves*, it ranks by closeness to an explicit **target vibe** — a point
in audio-feature space (``energy``, ``valence``, ``danceability``, ``tempo``) —
then applies genre boosts, artist/genre exclusions, and a popularity skew.

Pipeline (docs/assistant.md §8):
  1. Build a target vector from ``feature_targets``; for any feature the user
     left unspecified, fall back to the user's content profile (mean of saved
     songs) or, for cold-start users, the catalogue median.
  2. Filter out excluded artists / genres.
  3. Score by proximity to the target (``1 / (1 + euclidean_distance)`` in the
     min-max-scaled feature space, so all four features contribute equally).
  4. Multiply by per-genre boosts.
  5. Add a popularity term weighted by ``mainstream`` (negative favors deep cuts).
  6. Drop songs the user has already seen; return the top ``limit``.

Scores are not comparable across algorithms — each has its own range.
"""

from __future__ import annotations

from uuid import UUID

import numpy as np
import pandas as pd
from numpy.typing import NDArray
from sklearn.preprocessing import MinMaxScaler

from .popularity import EVENT_WEIGHTS, ScoredSong

NUMERIC_FEATURES: tuple[str, ...] = ("tempo", "energy", "danceability", "valence")

# How strongly `mainstream` pulls toward (or away from) popular songs. The
# proximity score sits in (0, 1], so a weight of 0.5 lets a strong mainstream
# preference meaningfully reorder near-ties without overwhelming the vibe match.
MAINSTREAM_WEIGHT = 0.5

# Multiplier applied to songs by an explicitly-requested artist. Large enough to
# lift them above pure vibe matches, while still ranking the requested artist's
# own songs among themselves by how well they fit the vibe.
ARTIST_BOOST = 10.0


class ContextualRecommender:
    """Vibe-target proximity recommender with boosts, filters and popularity skew."""

    def __init__(self, songs: pd.DataFrame, interactions: pd.DataFrame) -> None:
        self._songs = songs.reset_index(drop=True)
        self._interactions = interactions

        self._numeric = self._impute(self._songs)  # (n, 4) absolute units
        self._median = self._column_median(self._numeric)
        if len(self._numeric) > 0:
            self._scaler: MinMaxScaler | None = MinMaxScaler().fit(self._numeric)
            self._scaled = self._scaler.transform(self._numeric)
        else:
            self._scaler = None
            self._scaled = np.zeros((0, len(NUMERIC_FEATURES)), dtype=np.float64)
        self._popularity = self._norm_popularity(self._songs, interactions)

    @staticmethod
    def _impute(songs: pd.DataFrame) -> NDArray[np.float64]:
        """Return the (n, 4) audio-feature matrix, median-imputing missing values."""
        if songs.empty:
            return np.zeros((0, len(NUMERIC_FEATURES)), dtype=np.float64)
        numeric = songs[list(NUMERIC_FEATURES)].astype(float)
        numeric = numeric.fillna(numeric.median(numeric_only=True)).fillna(0.0)
        return np.asarray(numeric.to_numpy(), dtype=np.float64)

    @staticmethod
    def _column_median(numeric: NDArray[np.float64]) -> dict[str, float]:
        if numeric.size == 0:
            return {feat: 0.0 for feat in NUMERIC_FEATURES}
        medians = np.median(numeric, axis=0)
        return {feat: float(medians[i]) for i, feat in enumerate(NUMERIC_FEATURES)}

    @staticmethod
    def _norm_popularity(songs: pd.DataFrame, interactions: pd.DataFrame) -> dict[UUID, float]:
        """Per-song popularity in [0, 1] (min-max of the weighted event score)."""
        if songs.empty:
            return {}
        ids = songs["id"].to_numpy()
        if interactions.empty:
            return {song_id: 0.0 for song_id in ids}

        weighted = interactions.assign(
            weight=interactions["event_type"].map(EVENT_WEIGHTS).fillna(0.0)
        )
        totals = weighted.groupby("song_id")["weight"].sum()
        raw = np.array([float(totals.get(song_id, 0.0)) for song_id in ids])

        lo, hi = raw.min(), raw.max()
        norm = (raw - lo) / (hi - lo) if hi > lo else np.zeros_like(raw)
        return {song_id: float(norm[i]) for i, song_id in enumerate(ids)}

    def recommend(
        self,
        *,
        user_id: UUID,
        feature_targets: dict[str, float] | None = None,
        genre_boosts: dict[str, float] | None = None,
        artists: list[str] | None = None,
        seed_artists: list[str] | None = None,
        excluded_artists: list[str] | None = None,
        excluded_genres: list[str] | None = None,
        mainstream: float = 0.0,
        base_algorithm: str = "content",
        limit: int = 20,
    ) -> list[ScoredSong]:
        """Return the top ``limit`` songs matching the vibe context."""
        if limit <= 0 or self._scaled.size == 0 or self._scaler is None:
            return []

        # "more like X": anchor the target on the seed artists' feature centroid.
        seed_profile = self._artists_profile(seed_artists or [])
        target_scaled = self._target_vector(user_id, feature_targets or {}, seed_profile)
        distances = np.linalg.norm(self._scaled - target_scaled, axis=1)
        proximity = 1.0 / (1.0 + distances)

        scored = pd.DataFrame(
            {
                "song_id": self._songs["id"].to_numpy(),
                "artist": self._songs["artist"].to_numpy(),
                "genre": self._songs["genre"].to_numpy(),
                "score": proximity,
            }
        )

        scored = self._apply_exclusions(scored, excluded_artists, excluded_genres)
        # "more like X" means similar OTHER artists — drop the seeds themselves.
        scored = self._apply_exclusions(scored, seed_artists, None)
        scored = self._apply_genre_boosts(scored, genre_boosts or {})
        scored = self._apply_artist_boost(scored, artists or [])
        scored = self._apply_mainstream(scored, mainstream)
        scored = self._drop_seen(scored, user_id)

        scored = scored.sort_values(
            by=["score", "song_id"], ascending=[False, True], kind="mergesort"
        ).head(limit)

        return [
            ScoredSong(song_id=row.song_id, score=float(row.score))
            for row in scored.itertuples(index=False)
        ]

    # --- internals -----------------------------------------------------------

    def _target_vector(
        self,
        user_id: UUID,
        feature_targets: dict[str, float],
        seed_profile: dict[str, float] | None = None,
    ) -> NDArray[np.float64]:
        """Build the target row in absolute units, then scale it like the catalogue.

        Per-feature fallback priority for any feature the user didn't set
        explicitly: seed-artist centroid → user's content profile → catalogue
        median (cold start).
        """
        profile = seed_profile if seed_profile is not None else self._user_profile(user_id)
        target_abs = np.array(
            [
                feature_targets.get(feat)
                if feature_targets.get(feat) is not None
                else (profile[feat] if profile is not None else self._median[feat])
                for feat in NUMERIC_FEATURES
            ],
            dtype=np.float64,
        )
        assert self._scaler is not None
        return np.asarray(
            self._scaler.transform(target_abs.reshape(1, -1)), dtype=np.float64
        )

    def _artists_profile(self, artists: list[str]) -> dict[str, float] | None:
        """Mean audio features (absolute units) over songs by the given artists."""
        if not artists:
            return None
        wanted = {a.casefold() for a in artists}
        artist_col = self._songs["artist"].astype(str)
        indices = [i for i, a in enumerate(artist_col) if a.casefold() in wanted]
        if not indices:
            return None
        means = self._numeric[indices].mean(axis=0)
        return {feat: float(means[i]) for i, feat in enumerate(NUMERIC_FEATURES)}

    def _user_profile(self, user_id: UUID) -> dict[str, float] | None:
        """Mean audio features (absolute units) over the user's saved songs."""
        if self._interactions.empty or "user_id" not in self._interactions.columns:
            return None
        saves_mask = (self._interactions["user_id"] == user_id) & (
            self._interactions["event_type"] == "save"
        )
        saved_ids = set(self._interactions.loc[saves_mask, "song_id"].unique())
        if not saved_ids:
            return None

        song_ids = self._songs["id"].to_numpy()
        indices = [i for i, song_id in enumerate(song_ids) if song_id in saved_ids]
        if not indices:
            return None

        means = self._numeric[indices].mean(axis=0)
        return {feat: float(means[i]) for i, feat in enumerate(NUMERIC_FEATURES)}

    @staticmethod
    def _apply_exclusions(
        scored: pd.DataFrame,
        excluded_artists: list[str] | None,
        excluded_genres: list[str] | None,
    ) -> pd.DataFrame:
        if excluded_artists:
            blocked = {a.casefold() for a in excluded_artists}
            scored = scored[~scored["artist"].str.casefold().isin(blocked)]
        if excluded_genres:
            blocked = {g.casefold() for g in excluded_genres}
            scored = scored[~scored["genre"].str.casefold().isin(blocked)]
        return scored

    @staticmethod
    def _apply_genre_boosts(
        scored: pd.DataFrame, genre_boosts: dict[str, float]
    ) -> pd.DataFrame:
        if not genre_boosts:
            return scored
        # Case-insensitive: the LLM may capitalize genres ("Metal") that the
        # catalogue stores differently ("metal").
        boosts = {genre.casefold(): weight for genre, weight in genre_boosts.items()}
        factors = scored["genre"].str.casefold().map(boosts).fillna(1.0)
        return scored.assign(score=scored["score"] * factors)

    @staticmethod
    def _apply_artist_boost(scored: pd.DataFrame, artists: list[str]) -> pd.DataFrame:
        """Strongly lift songs by an explicitly-requested artist (if in catalogue)."""
        if not artists:
            return scored
        wanted = {a.casefold() for a in artists}
        is_wanted = scored["artist"].str.casefold().isin(wanted)
        factors = np.where(is_wanted, ARTIST_BOOST, 1.0)
        return scored.assign(score=scored["score"] * factors)

    def _apply_mainstream(self, scored: pd.DataFrame, mainstream: float) -> pd.DataFrame:
        if not mainstream:
            return scored
        pop = scored["song_id"].map(self._popularity).fillna(0.0)
        return scored.assign(score=scored["score"] + mainstream * MAINSTREAM_WEIGHT * pop)

    def _drop_seen(self, scored: pd.DataFrame, user_id: UUID) -> pd.DataFrame:
        if self._interactions.empty or "user_id" not in self._interactions.columns:
            return scored
        seen_mask = self._interactions["user_id"] == user_id
        seen_ids = set(self._interactions.loc[seen_mask, "song_id"].unique())
        return scored[~scored["song_id"].isin(seen_ids)]
