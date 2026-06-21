"""Run the leave-one-out evaluation across the recommendation algorithms.

Builds each recommender on the LOO **training** split (catalogue unchanged), asks
it for the top-``k`` songs per user, and scores those rankings against each user's
held-out song. See ``protocol.py`` for the split and metric definitions.

The contextual ("vibe") recommender is intentionally excluded: it ranks toward a
chat-derived ``VibeProfile`` rather than past behaviour, so there is no offline
ground truth to score it against without simulating conversations.
"""

from __future__ import annotations

from uuid import UUID

import pandas as pd

from ..algorithms import (
    CollaborativeRecommender,
    ContentBasedRecommender,
    PopularityRecommender,
)
from .protocol import (
    DEFAULT_POSITIVE_EVENTS,
    EvalResult,
    hit_rate_at_k,
    make_training_set,
    precision_at_k,
    recall_at_k,
    select_holdouts,
)

DEFAULT_ALGORITHMS: tuple[str, ...] = ("popularity", "content", "collaborative")

Recommender = (
    PopularityRecommender | ContentBasedRecommender | CollaborativeRecommender
)


def build_recommender(
    algorithm: str, train: pd.DataFrame, songs: pd.DataFrame
) -> Recommender:
    """Instantiate one recommender on the training interactions."""
    if algorithm == "popularity":
        return PopularityRecommender(interactions=train, songs=songs)
    if algorithm == "content":
        return ContentBasedRecommender(songs=songs, interactions=train)
    if algorithm == "collaborative":
        return CollaborativeRecommender(interactions=train, songs=songs)
    raise ValueError(f"unknown algorithm: {algorithm!r}")


def evaluate_algorithm(
    algorithm: str,
    train: pd.DataFrame,
    songs: pd.DataFrame,
    holdouts: dict[UUID, UUID],
    k: int,
) -> EvalResult:
    """Score one algorithm over every user's held-out song."""
    recommender = build_recommender(algorithm, train, songs)

    precision_sum = 0.0
    recall_sum = 0.0
    hit_sum = 0.0
    users_with_recs = 0

    for user_id, target in holdouts.items():
        scored = recommender.recommend(user_id=user_id, limit=k)
        recommended_ids = [item.song_id for item in scored]
        if recommended_ids:
            users_with_recs += 1

        relevant = {target}
        precision_sum += precision_at_k(recommended_ids, relevant, k)
        recall_sum += recall_at_k(recommended_ids, relevant, k)
        hit_sum += hit_rate_at_k(recommended_ids, relevant, k)

    n = len(holdouts)
    return EvalResult(
        algorithm=algorithm,
        k=k,
        users_evaluated=n,
        users_with_recs=users_with_recs,
        precision=precision_sum / n if n else 0.0,
        recall=recall_sum / n if n else 0.0,
        hit_rate=hit_sum / n if n else 0.0,
    )


def evaluate_all(
    interactions: pd.DataFrame,
    songs: pd.DataFrame,
    *,
    k: int = 10,
    algorithms: tuple[str, ...] = DEFAULT_ALGORITHMS,
    positive_events: frozenset[str] = DEFAULT_POSITIVE_EVENTS,
) -> list[EvalResult]:
    """Run the full leave-one-out evaluation and return one result per algorithm."""
    holdouts = select_holdouts(interactions, positive_events)
    train = make_training_set(interactions, holdouts)
    return [
        evaluate_algorithm(algorithm, train, songs, holdouts, k)
        for algorithm in algorithms
    ]
