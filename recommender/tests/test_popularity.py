from __future__ import annotations

from uuid import UUID

import pandas as pd
import pytest

from rapsodium_recommender.algorithms.popularity import (
    EVENT_WEIGHTS,
    PopularityRecommender,
)

# Fixed UUIDs make assertions on ordering readable.
SONG_A = UUID("00000000-0000-0000-0000-00000000000a")
SONG_B = UUID("00000000-0000-0000-0000-00000000000b")
SONG_C = UUID("00000000-0000-0000-0000-00000000000c")
SONG_D = UUID("00000000-0000-0000-0000-00000000000d")

USER_1 = UUID("11111111-1111-1111-1111-111111111111")
USER_2 = UUID("22222222-2222-2222-2222-222222222222")


def _songs_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"id": SONG_A, "genre": "rock"},
            {"id": SONG_B, "genre": "rock"},
            {"id": SONG_C, "genre": "pop"},
            {"id": SONG_D, "genre": "pop"},
        ]
    )


def _interactions_df(rows: list[tuple[UUID, UUID, str]]) -> pd.DataFrame:
    return pd.DataFrame([{"user_id": u, "song_id": s, "event_type": e} for u, s, e in rows])


def test_weighting_matches_documented_formula() -> None:
    assert EVENT_WEIGHTS == {"save": 3.0, "play": 1.0, "skip": -1.0}


def test_ranks_by_weighted_score() -> None:
    interactions = _interactions_df(
        [
            # SONG_A: 1 save + 2 plays = 5
            (USER_1, SONG_A, "save"),
            (USER_1, SONG_A, "play"),
            (USER_2, SONG_A, "play"),
            # SONG_B: 2 plays - 1 skip = 1
            (USER_1, SONG_B, "play"),
            (USER_2, SONG_B, "play"),
            (USER_2, SONG_B, "skip"),
            # SONG_C: 1 save - 2 skips = 1 (tie with SONG_B, SONG_B wins by id order)
            (USER_1, SONG_C, "save"),
            (USER_1, SONG_C, "skip"),
            (USER_2, SONG_C, "skip"),
            # SONG_D: 0 interactions = 0
        ]
    )
    rec = PopularityRecommender(interactions, _songs_df())

    result = rec.recommend(limit=4)

    assert [s.song_id for s in result] == [SONG_A, SONG_B, SONG_C, SONG_D]
    assert [s.score for s in result] == [5.0, 1.0, 1.0, 0.0]


def test_genre_filter_narrows_pool() -> None:
    interactions = _interactions_df(
        [
            (USER_1, SONG_A, "save"),  # rock
            (USER_1, SONG_C, "save"),  # pop
            (USER_1, SONG_D, "play"),  # pop
        ]
    )
    rec = PopularityRecommender(interactions, _songs_df())

    pop_only = rec.recommend(genre="pop", limit=10)

    assert {s.song_id for s in pop_only} == {SONG_C, SONG_D}
    assert pop_only[0].song_id == SONG_C  # higher score first


def test_user_id_excludes_all_seen_songs() -> None:
    interactions = _interactions_df(
        [
            # USER_1 has touched A (save) and B (skip) — both must be hidden from them.
            (USER_1, SONG_A, "save"),
            (USER_1, SONG_B, "skip"),
            (USER_2, SONG_A, "play"),
            (USER_2, SONG_C, "save"),
        ]
    )
    rec = PopularityRecommender(interactions, _songs_df())

    result = rec.recommend(user_id=USER_1, limit=10)
    result_ids = {s.song_id for s in result}

    assert SONG_A not in result_ids
    assert SONG_B not in result_ids
    assert result_ids == {SONG_C, SONG_D}


def test_limit_caps_result_size() -> None:
    interactions = _interactions_df(
        [
            (USER_1, SONG_A, "save"),
            (USER_1, SONG_B, "save"),
            (USER_1, SONG_C, "save"),
        ]
    )
    rec = PopularityRecommender(interactions, _songs_df())

    assert len(rec.recommend(limit=2)) == 2
    assert rec.recommend(limit=0) == []


def test_empty_interactions_returns_catalogue_with_zero_scores() -> None:
    rec = PopularityRecommender(_interactions_df([]), _songs_df())

    result = rec.recommend(limit=10)

    assert len(result) == 4
    assert all(s.score == 0.0 for s in result)
    # Deterministic order falls back to song_id asc on ties.
    assert [s.song_id for s in result] == [SONG_A, SONG_B, SONG_C, SONG_D]


def test_unknown_event_type_contributes_zero() -> None:
    interactions = _interactions_df(
        [
            (USER_1, SONG_A, "save"),
            (USER_1, SONG_A, "mystery"),  # not in EVENT_WEIGHTS
        ]
    )
    rec = PopularityRecommender(interactions, _songs_df())

    top = rec.recommend(limit=1)

    assert top[0].song_id == SONG_A
    assert top[0].score == pytest.approx(3.0)
