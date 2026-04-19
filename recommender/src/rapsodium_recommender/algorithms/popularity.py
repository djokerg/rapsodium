"""Popularity-based recommender.

Ranks songs by a weighted sum of interaction events across all users:

    score = 3 * saves + 1 * plays - 1 * skips

Songs the target user has already interacted with are excluded (pure
"discover new" mode — the classic top-N popularity baseline).
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

import pandas as pd

EVENT_WEIGHTS: dict[str, float] = {
    "save": 3.0,
    "play": 1.0,
    "skip": -1.0,
}


@dataclass(frozen=True)
class ScoredSong:
    song_id: UUID
    score: float


class PopularityRecommender:
    """Compute popularity scores from a DataFrame of interactions and songs.

    The scores are computed once in ``__init__`` so repeated ``recommend``
    calls with different filters stay cheap.
    """

    def __init__(self, interactions: pd.DataFrame, songs: pd.DataFrame) -> None:
        self._interactions = interactions
        self._songs = songs
        self._scores = self._compute_scores(interactions, songs)

    @staticmethod
    def _compute_scores(interactions: pd.DataFrame, songs: pd.DataFrame) -> pd.DataFrame:
        """Return a DataFrame with columns: song_id, score, genre.

        Songs with zero interactions still appear, with score 0.0.
        """
        if interactions.empty:
            scored = songs[["id", "genre"]].rename(columns={"id": "song_id"}).copy()
            scored["score"] = 0.0
            return scored

        weighted = interactions.assign(
            weight=interactions["event_type"].map(EVENT_WEIGHTS).fillna(0.0)
        )
        totals = (
            weighted.groupby("song_id", as_index=False)["weight"]
            .sum()
            .rename(columns={"weight": "score"})
        )

        catalogue = songs[["id", "genre"]].rename(columns={"id": "song_id"})
        scored = catalogue.merge(totals, on="song_id", how="left")
        scored["score"] = scored["score"].fillna(0.0)
        return scored

    def recommend(
        self,
        *,
        user_id: UUID | None = None,
        genre: str | None = None,
        limit: int = 20,
    ) -> list[ScoredSong]:
        """Return the top ``limit`` songs by popularity, respecting filters."""
        if limit <= 0:
            return []

        df = self._scores
        if genre is not None:
            df = df[df["genre"] == genre]

        if user_id is not None and not self._interactions.empty:
            seen_mask = self._interactions["user_id"] == user_id
            seen_song_ids = self._interactions.loc[seen_mask, "song_id"].unique()
            df = df[~df["song_id"].isin(seen_song_ids)]

        # Sort by score desc, break ties deterministically on song_id so that
        # tests and clients see stable ordering.
        df = df.sort_values(
            by=["score", "song_id"],
            ascending=[False, True],
            kind="mergesort",
        ).head(limit)

        return [
            ScoredSong(song_id=row.song_id, score=float(row.score))
            for row in df.itertuples(index=False)
        ]
