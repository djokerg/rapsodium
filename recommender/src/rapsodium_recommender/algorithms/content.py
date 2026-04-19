"""Content-based recommender.

Represents each song as a vector in a feature space built from min-max-scaled
audio features (``tempo``, ``energy``, ``danceability``, ``valence``) and a
one-hot encoding of ``genre``. A user's profile is the centroid of the songs
they have explicitly saved; recommendations are ranked by cosine similarity
between the profile and every other song.

The genre one-hot is included so users who save exclusively within a genre
don't get pulled cross-genre by similar audio profiles. Audio features give
within-genre discrimination ("I like the fast, dark metal" vs "the slower,
melodic metal").

Scale note: cosine similarity against a multi-dimensional profile typically
falls in ``[0.0, 1.0]``. Popularity scores are unbounded above, so don't
compare magnitudes across algorithms — each has its own scoring range.
"""

from __future__ import annotations

from uuid import UUID

import numpy as np
import pandas as pd
from numpy.typing import NDArray
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler

from .popularity import ScoredSong

NUMERIC_FEATURES: tuple[str, ...] = ("tempo", "energy", "danceability", "valence")


class ContentBasedRecommender:
    """Cosine-similarity recommender over audio features + one-hot genre."""

    def __init__(self, songs: pd.DataFrame, interactions: pd.DataFrame) -> None:
        # Keep a stable ordering so feature rows and DataFrame rows align.
        self._songs = songs.reset_index(drop=True)
        self._interactions = interactions
        self._features = self._build_features(self._songs)

    @staticmethod
    def _build_features(songs: pd.DataFrame) -> NDArray[np.float64]:
        """Return a (n_songs, n_features) matrix combining audio + one-hot genre.

        Missing audio features are imputed with the column median so songs with
        partial data are not silently dropped. Numeric features are scaled to
        ``[0, 1]`` so tempo (60-200) and valence (0-1) contribute on equal
        footing.
        """
        if songs.empty:
            return np.zeros((0, 0), dtype=np.float64)

        numeric = songs[list(NUMERIC_FEATURES)].astype(float)
        # Median is robust to the occasional outlier; mean would shift with
        # extreme tempos (e.g. 200 BPM metal tracks).
        numeric = numeric.fillna(numeric.median(numeric_only=True))
        # In the degenerate case where every value in a column is NaN, median
        # is still NaN and fillna leaves NaN; replace with 0 to keep cosine
        # similarity defined.
        numeric = numeric.fillna(0.0)

        scaled = MinMaxScaler().fit_transform(numeric.to_numpy())

        genre_ohe = pd.get_dummies(songs["genre"]).astype(float).to_numpy()

        return np.hstack([scaled, genre_ohe])

    def recommend(
        self,
        *,
        user_id: UUID,
        genres: list[str] | None = None,
        limit: int = 20,
    ) -> list[ScoredSong]:
        """Top ``limit`` songs by cosine similarity to the user's saves centroid.

        Returns an empty list for cold-start users (zero saves) — the caller is
        expected to surface an empty-state UI rather than cross-fall back.
        """
        if limit <= 0 or self._features.size == 0:
            return []

        if self._interactions.empty or "user_id" not in self._interactions.columns:
            return []

        saves_mask = (self._interactions["user_id"] == user_id) & (
            self._interactions["event_type"] == "save"
        )
        saved_song_ids = self._interactions.loc[saves_mask, "song_id"].unique()
        if len(saved_song_ids) == 0:
            return []

        # Locate saved songs in the feature matrix.
        saved_song_set = set(saved_song_ids)
        song_ids = self._songs["id"].to_numpy()
        saved_indices = [i for i, song_id in enumerate(song_ids) if song_id in saved_song_set]
        if not saved_indices:
            return []

        profile = self._features[saved_indices].mean(axis=0, keepdims=True)
        if not np.any(profile):
            # Zero vector -> cosine_similarity is undefined. Bail out instead
            # of returning misleading all-zero scores.
            return []

        similarities = cosine_similarity(profile, self._features)[0]

        seen_mask = self._interactions["user_id"] == user_id
        seen_ids = set(self._interactions.loc[seen_mask, "song_id"].unique())

        scored = pd.DataFrame(
            {
                "song_id": song_ids,
                "genre": self._songs["genre"].to_numpy(),
                "score": similarities,
            }
        )
        scored = scored[~scored["song_id"].isin(seen_ids)]
        if genres:
            scored = scored[scored["genre"].isin(genres)]

        scored = scored.sort_values(
            by=["score", "song_id"], ascending=[False, True], kind="mergesort"
        ).head(limit)

        return [
            ScoredSong(song_id=row.song_id, score=float(row.score))
            for row in scored.itertuples(index=False)
        ]
