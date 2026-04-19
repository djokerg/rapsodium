from __future__ import annotations

from uuid import UUID

import pandas as pd
import pytest

from rapsodium_recommender.algorithms.collaborative import (
    EVENT_WEIGHTS,
    CollaborativeRecommender,
)

SONG_A = UUID("00000000-0000-0000-0000-00000000000a")
SONG_B = UUID("00000000-0000-0000-0000-00000000000b")
SONG_C = UUID("00000000-0000-0000-0000-00000000000c")
SONG_D = UUID("00000000-0000-0000-0000-00000000000d")

ALICE = UUID("11111111-1111-1111-1111-111111111111")
BOB = UUID("22222222-2222-2222-2222-222222222222")
CAROL = UUID("33333333-3333-3333-3333-333333333333")
DAVE = UUID("44444444-4444-4444-4444-444444444444")


def _songs_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"id": SONG_A, "genre": "rock"},
            {"id": SONG_B, "genre": "rock"},
            {"id": SONG_C, "genre": "rock"},
            {"id": SONG_D, "genre": "pop"},
        ]
    )


def _interactions(rows: list[tuple[UUID, UUID, str]]) -> pd.DataFrame:
    return pd.DataFrame([{"user_id": u, "song_id": s, "event_type": e} for u, s, e in rows])


def test_event_weights_match_documented_formula() -> None:
    assert EVENT_WEIGHTS == {"save": 1.0, "play": 0.3, "skip": -0.3}


def test_cold_start_user_returns_empty() -> None:
    interactions = _interactions(
        [
            (ALICE, SONG_A, "save"),
            (BOB, SONG_A, "save"),
        ]
    )
    rec = CollaborativeRecommender(interactions, _songs_df())

    assert rec.recommend(user_id=CAROL, limit=10) == []


def test_neighbours_of_saved_song_rank_highest() -> None:
    # ALICE and BOB both save A and B — A and B are neighbours in item space.
    # BOB also saves C, which ALICE hasn't heard. C should be recommended
    # to ALICE because BOB (her neighbour) saves it, and C co-occurs with A
    # and B in BOB's taste.
    interactions = _interactions(
        [
            (ALICE, SONG_A, "save"),
            (ALICE, SONG_B, "save"),
            (BOB, SONG_A, "save"),
            (BOB, SONG_B, "save"),
            (BOB, SONG_C, "save"),
        ]
    )
    rec = CollaborativeRecommender(interactions, _songs_df())

    result = rec.recommend(user_id=ALICE, limit=10)
    result_ids = [s.song_id for s in result]

    assert SONG_A not in result_ids  # seen
    assert SONG_B not in result_ids  # seen
    assert SONG_C in result_ids  # predicted from co-occurrence
    assert result_ids[0] == SONG_C
    # SONG_D has zero interactions -> zero similarity -> ranked below C.
    if SONG_D in result_ids:
        assert result_ids.index(SONG_C) < result_ids.index(SONG_D)


def test_seen_songs_excluded_regardless_of_event_type() -> None:
    interactions = _interactions(
        [
            (ALICE, SONG_A, "save"),
            (ALICE, SONG_B, "play"),
            (ALICE, SONG_C, "skip"),
            (BOB, SONG_A, "save"),
            (BOB, SONG_D, "save"),
        ]
    )
    rec = CollaborativeRecommender(interactions, _songs_df())

    result_ids = {s.song_id for s in rec.recommend(user_id=ALICE, limit=10)}

    # ALICE touched A (save), B (play), C (skip) — all must be filtered out.
    assert SONG_A not in result_ids
    assert SONG_B not in result_ids
    assert SONG_C not in result_ids
    assert SONG_D in result_ids


def test_skip_penalises_item_similarity() -> None:
    # CAROL saves A, DAVE saves A. But DAVE skips D heavily while CAROL
    # doesn't touch D. The negative weight on DAVE's D should pull D's
    # score for ALICE (who saves A and resembles both CAROL and DAVE)
    # below C (which BOB co-saves with A).
    interactions = _interactions(
        [
            (ALICE, SONG_A, "save"),
            (BOB, SONG_A, "save"),
            (BOB, SONG_C, "save"),
            (CAROL, SONG_A, "save"),
            (DAVE, SONG_A, "save"),
            (DAVE, SONG_D, "skip"),
            (DAVE, SONG_D, "skip"),
            (DAVE, SONG_D, "skip"),
        ]
    )
    rec = CollaborativeRecommender(interactions, _songs_df())

    result = rec.recommend(user_id=ALICE, limit=10)
    scores = {s.song_id: s.score for s in result}

    # SONG_C should score positive, SONG_D should score negative because D
    # co-occurs with A only through skips.
    assert scores[SONG_C] > 0.0
    assert scores[SONG_D] < 0.0


def test_genre_filter_respected() -> None:
    interactions = _interactions(
        [
            (ALICE, SONG_A, "save"),
            (BOB, SONG_A, "save"),
            (BOB, SONG_C, "save"),
            (BOB, SONG_D, "save"),
        ]
    )
    rec = CollaborativeRecommender(interactions, _songs_df())

    pop_only = rec.recommend(user_id=ALICE, genres=["pop"], limit=10)

    assert {s.song_id for s in pop_only} == {SONG_D}


def test_limit_caps_results_and_zero_limit_returns_nothing() -> None:
    interactions = _interactions(
        [
            (ALICE, SONG_A, "save"),
            (BOB, SONG_A, "save"),
            (BOB, SONG_B, "save"),
            (BOB, SONG_C, "save"),
            (BOB, SONG_D, "save"),
        ]
    )
    rec = CollaborativeRecommender(interactions, _songs_df())

    assert len(rec.recommend(user_id=ALICE, limit=2)) == 2
    assert rec.recommend(user_id=ALICE, limit=0) == []


def test_empty_interaction_set_returns_empty() -> None:
    rec = CollaborativeRecommender(_interactions([]), _songs_df())

    assert rec.recommend(user_id=ALICE, limit=10) == []


def test_weights_aggregate_additively_for_duplicate_events() -> None:
    # A save + two plays on SONG_A for BOB sums to 1.0 + 0.3 + 0.3 = 1.6,
    # vs a plain single save (1.0) in the baseline. The amplified signal
    # should strengthen BOB's A column and thus increase the similarity
    # between A and C (which BOB also saves), raising ALICE's predicted
    # score for C.
    amplified = _interactions(
        [
            (ALICE, SONG_A, "save"),
            (BOB, SONG_A, "save"),
            (BOB, SONG_A, "play"),
            (BOB, SONG_A, "play"),
            (BOB, SONG_C, "save"),
        ]
    )
    baseline = _interactions(
        [
            (ALICE, SONG_A, "save"),
            (BOB, SONG_A, "save"),
            (BOB, SONG_C, "save"),
        ]
    )

    rec_amplified = CollaborativeRecommender(amplified, _songs_df())
    rec_baseline = CollaborativeRecommender(baseline, _songs_df())

    amplified_top = rec_amplified.recommend(user_id=ALICE, limit=1)[0]
    baseline_top = rec_baseline.recommend(user_id=ALICE, limit=1)[0]

    assert amplified_top.song_id == SONG_C
    assert baseline_top.song_id == SONG_C
    assert amplified_top.score > baseline_top.score
    assert amplified_top.score == pytest.approx(1.6 / (3.56**0.5), abs=1e-6)
