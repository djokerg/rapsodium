"""Offline evaluation protocol: leave-one-out split + top-N ranking metrics.

These functions are pure (no database, no algorithm imports) so they can be unit
tested on hand-built DataFrames, mirroring how the algorithms themselves are tested.

**Leave-one-out (LOO).** For every user we hold out a single *positive* song — by
default their most-recently **saved** track — as the ground-truth relevant item.
All of that user's interactions with that song are removed from the training set
(not just the save), otherwise the song would still count as "seen" and every
recommender would be structurally unable to surface it.

**Metric note.** With exactly one held-out relevant item per user:

    Recall@K   == Hit Rate@K          (relevant set has size 1)
    Precision@K == Hit Rate@K / K     (at most one hit among K slots)

so Hit Rate@K is the headline number; Precision/Recall are reported for
completeness (and because the roadmap calls for all three).
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from uuid import UUID

import pandas as pd

DEFAULT_POSITIVE_EVENTS: frozenset[str] = frozenset({"save"})


@dataclass(frozen=True)
class EvalResult:
    """Aggregated metrics for one algorithm at a given cutoff ``k``."""

    algorithm: str
    k: int
    users_evaluated: int
    users_with_recs: int
    precision: float
    recall: float
    hit_rate: float


def select_holdouts(
    interactions: pd.DataFrame,
    positive_events: frozenset[str] = DEFAULT_POSITIVE_EVENTS,
) -> dict[UUID, UUID]:
    """Pick one held-out positive song per user.

    The latest positive interaction (by ``created_at``) is chosen, with ties
    broken on ``song_id`` for deterministic output. Users with no positive
    interaction are omitted — they have no ground truth to score against.
    """
    if interactions.empty or "created_at" not in interactions.columns:
        return {}

    positives = interactions[interactions["event_type"].isin(positive_events)]
    if positives.empty:
        return {}

    ordered = positives.sort_values(
        by=["created_at", "song_id"],
        ascending=[False, True],
        kind="mergesort",
    )

    holdouts: dict[UUID, UUID] = {}
    for row in ordered.itertuples(index=False):
        if row.user_id not in holdouts:
            holdouts[row.user_id] = row.song_id
    return holdouts


def make_training_set(
    interactions: pd.DataFrame,
    holdouts: dict[UUID, UUID],
) -> pd.DataFrame:
    """Return ``interactions`` minus every (user, held-out song) row."""
    if interactions.empty or not holdouts:
        return interactions

    pairs = set(holdouts.items())
    keep = [
        (user_id, song_id) not in pairs
        for user_id, song_id in zip(
            interactions["user_id"], interactions["song_id"], strict=True
        )
    ]
    return interactions[keep]


def precision_at_k(
    recommended: Sequence[UUID], relevant: set[UUID], k: int
) -> float:
    """Fraction of the top-``k`` recommendations that are relevant."""
    if k <= 0:
        return 0.0
    top_k = recommended[:k]
    hits = sum(1 for song_id in top_k if song_id in relevant)
    return hits / k


def recall_at_k(
    recommended: Sequence[UUID], relevant: set[UUID], k: int
) -> float:
    """Fraction of relevant items that appear in the top-``k``."""
    if not relevant:
        return 0.0
    top_k = recommended[:k]
    hits = sum(1 for song_id in top_k if song_id in relevant)
    return hits / len(relevant)


def hit_rate_at_k(
    recommended: Sequence[UUID], relevant: set[UUID], k: int
) -> float:
    """1.0 if any relevant item is in the top-``k``, else 0.0."""
    if k <= 0:
        return 0.0
    return 1.0 if any(song_id in relevant for song_id in recommended[:k]) else 0.0
