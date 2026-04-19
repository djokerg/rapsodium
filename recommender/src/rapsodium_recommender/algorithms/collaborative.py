"""Collaborative filtering recommender (item-based).

Builds a weighted user-song matrix from interactions, computes cosine
similarity between items (columns), and predicts a user's score for a song as
the dot product of their interaction vector with the song's similarity column.

Item-item CF was chosen over user-user because:

- Item neighbourhoods are more stable over time than user neighbourhoods
  (a song's co-occurrence pattern shifts slowly; a user's profile changes
  faster as they interact more).
- It scales better when users > items, which is the typical regime.
- It yields an intuitive explanation: "you liked X, so we're showing Y
  because people who saved X also saved Y."

Event weights chosen to reflect signal strength, not simple counts:

- save = 1.0 (explicit positive intent)
- play = 0.3 (implicit, low-confidence positive)
- skip = -0.3 (mild negative — the user actively moved on)

A save and a skip on the same song cancel out, which matches the intuition
that noisy users shouldn't poison the item vectors.
"""

from __future__ import annotations

from uuid import UUID

import numpy as np
import pandas as pd
from numpy.typing import NDArray
from sklearn.metrics.pairwise import cosine_similarity

from .popularity import ScoredSong

EVENT_WEIGHTS: dict[str, float] = {
    "save": 1.0,
    "play": 0.3,
    "skip": -0.3,
}


class CollaborativeRecommender:
    """Item-based collaborative filter with cosine-similarity predictions."""

    def __init__(self, interactions: pd.DataFrame, songs: pd.DataFrame) -> None:
        self._songs = songs.reset_index(drop=True)
        self._interactions = interactions
        self._matrix, self._user_ids, self._song_ids = self._build_matrix(interactions, self._songs)
        # (n_songs, n_songs) — self-similarity on the diagonal; symmetric.
        self._similarity = self._compute_item_similarity(self._matrix)

    @staticmethod
    def _build_matrix(
        interactions: pd.DataFrame, songs: pd.DataFrame
    ) -> tuple[NDArray[np.float64], NDArray[np.object_], NDArray[np.object_]]:
        """Return ``(matrix, user_ids, song_ids)``.

        Matrix shape is ``(n_users, n_songs)``. Songs with no interactions keep
        an all-zero column so the output dimensions match the full catalogue —
        that way the genre filter in ``recommend`` can index directly by row.
        Users with no interactions are omitted (they can't participate in CF
        anyway).
        """
        song_ids = songs["id"].to_numpy()

        if interactions.empty or "user_id" not in interactions.columns:
            return (
                np.zeros((0, len(song_ids)), dtype=np.float64),
                np.array([], dtype=object),
                song_ids,
            )

        weighted = interactions.assign(
            weight=interactions["event_type"].map(EVENT_WEIGHTS).fillna(0.0)
        )
        # Multiple events for the same (user, song) sum — a save after two
        # plays reads as stronger positive than a naked save.
        aggregated = (
            weighted.groupby(["user_id", "song_id"], as_index=False)["weight"]
            .sum()
            .rename(columns={"weight": "score"})
        )

        user_ids = np.array(aggregated["user_id"].unique(), dtype=object)
        user_index = {uid: i for i, uid in enumerate(user_ids)}
        song_index = {sid: i for i, sid in enumerate(song_ids)}

        matrix = np.zeros((len(user_ids), len(song_ids)), dtype=np.float64)
        for row in aggregated.itertuples(index=False):
            u = user_index.get(row.user_id)
            s = song_index.get(row.song_id)
            if u is not None and s is not None:
                matrix[u, s] = float(row.score)

        return matrix, user_ids, song_ids

    @staticmethod
    def _compute_item_similarity(
        matrix: NDArray[np.float64],
    ) -> NDArray[np.float64]:
        if matrix.size == 0:
            n_songs = matrix.shape[1]
            return np.zeros((n_songs, n_songs), dtype=np.float64)
        # cosine_similarity on zero-norm columns returns zeros without warning
        # in modern sklearn, so untouched songs simply have zero similarity.
        return np.asarray(cosine_similarity(matrix.T), dtype=np.float64)

    def recommend(
        self,
        *,
        user_id: UUID,
        genres: list[str] | None = None,
        limit: int = 20,
    ) -> list[ScoredSong]:
        """Top ``limit`` songs for ``user_id`` by predicted affinity.

        Cold-start users (no interactions on record) receive an empty list.
        """
        if limit <= 0 or self._matrix.size == 0:
            return []

        user_index = {uid: i for i, uid in enumerate(self._user_ids)}
        if user_id not in user_index:
            return []

        user_vec = self._matrix[user_index[user_id]]
        # Predicted affinity = weighted sum of item similarities, weighted by
        # the user's own interaction scores. Items the user has engaged with
        # heavily bring their neighbours up the ranking.
        raw_scores = user_vec @ self._similarity

        seen_mask = user_vec != 0.0

        scored = pd.DataFrame(
            {
                "song_id": self._song_ids,
                "genre": self._songs["genre"].to_numpy(),
                "score": raw_scores,
            }
        )
        # Exclude anything the user has touched (save/play/skip). Same
        # rationale as popularity — this is a discovery feed.
        scored = scored[~seen_mask]
        if genres:
            scored = scored[scored["genre"].isin(genres)]

        scored = scored.sort_values(
            by=["score", "song_id"], ascending=[False, True], kind="mergesort"
        ).head(limit)

        return [
            ScoredSong(song_id=row.song_id, score=float(row.score))
            for row in scored.itertuples(index=False)
        ]
