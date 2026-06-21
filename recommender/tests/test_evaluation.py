from __future__ import annotations

from uuid import UUID

import pandas as pd

from rapsodium_recommender.evaluation import (
    evaluate_all,
    hit_rate_at_k,
    make_training_set,
    precision_at_k,
    recall_at_k,
    select_holdouts,
)

S1 = UUID("00000000-0000-0000-0000-000000000001")
S2 = UUID("00000000-0000-0000-0000-000000000002")
S3 = UUID("00000000-0000-0000-0000-000000000003")
S4 = UUID("00000000-0000-0000-0000-000000000004")

U1 = UUID("11111111-1111-1111-1111-111111111111")
U2 = UUID("22222222-2222-2222-2222-222222222222")

TS = pd.Timestamp("2026-01-01T00:00:00Z")


def _interactions(rows: list[tuple[UUID, UUID, str, int]]) -> pd.DataFrame:
    # rows: (user_id, song_id, event_type, day_offset)
    return pd.DataFrame(
        [
            {
                "user_id": u,
                "song_id": s,
                "event_type": e,
                "created_at": TS + pd.Timedelta(days=d),
            }
            for u, s, e, d in rows
        ]
    )


def _songs() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"id": sid, "title": f"T{i}", "artist": f"A{i}", "genre": "rock",
             "tempo": 120.0, "energy": 0.5, "danceability": 0.5, "valence": 0.5}
            for i, sid in enumerate((S1, S2, S3, S4), start=1)
        ]
    )


# --- metric functions ----------------------------------------------------------


def test_precision_at_k() -> None:
    assert precision_at_k([S1, S2, S3], {S2}, 3) == 1 / 3
    assert precision_at_k([S1, S2, S3], {S4}, 3) == 0.0
    assert precision_at_k([S1], {S1}, 0) == 0.0


def test_recall_and_hit_rate_match_for_single_relevant() -> None:
    # With one held-out item, recall == hit rate by construction.
    assert recall_at_k([S1, S2], {S2}, 2) == 1.0
    assert hit_rate_at_k([S1, S2], {S2}, 2) == 1.0
    assert recall_at_k([S1, S2], {S3}, 2) == 0.0
    assert hit_rate_at_k([S1, S2], {S3}, 2) == 0.0


def test_hit_rate_respects_cutoff() -> None:
    # Relevant item sits at rank 3, so it's a miss at K=2.
    assert hit_rate_at_k([S1, S2, S3], {S3}, 2) == 0.0
    assert hit_rate_at_k([S1, S2, S3], {S3}, 3) == 1.0


# --- split logic ---------------------------------------------------------------


def test_select_holdouts_picks_latest_positive() -> None:
    interactions = _interactions(
        [
            (U1, S1, "save", 0),
            (U1, S2, "play", 1),
            (U1, S3, "save", 5),  # newest save -> held out
            (U2, S2, "save", 2),
        ]
    )
    holdouts = select_holdouts(interactions)

    assert holdouts == {U1: S3, U2: S2}


def test_select_holdouts_ignores_non_positive_only_users() -> None:
    interactions = _interactions([(U1, S1, "play", 0), (U1, S2, "skip", 1)])
    assert select_holdouts(interactions) == {}


def test_make_training_set_removes_all_rows_for_held_out_song() -> None:
    interactions = _interactions(
        [
            (U1, S3, "play", 4),  # same song as the held-out save -> must also go
            (U1, S3, "save", 5),
            (U1, S1, "save", 0),
        ]
    )
    holdouts = {U1: S3}
    train = make_training_set(interactions, holdouts)

    assert len(train) == 1
    assert set(train["song_id"]) == {S1}


# --- end-to-end ----------------------------------------------------------------


def test_evaluate_all_returns_one_result_per_algorithm_in_range() -> None:
    interactions = _interactions(
        [
            (U1, S1, "save", 0),
            (U1, S2, "save", 1),
            (U1, S3, "save", 5),  # held out for U1
            (U2, S1, "save", 0),
            (U2, S2, "save", 5),  # held out for U2
        ]
    )

    results = evaluate_all(interactions, _songs(), k=3)

    assert [r.algorithm for r in results] == ["popularity", "content", "collaborative"]
    for r in results:
        assert r.users_evaluated == 2
        assert 0.0 <= r.precision <= 1.0
        assert 0.0 <= r.recall <= 1.0
        assert 0.0 <= r.hit_rate <= 1.0
        # Single held-out item => precision == hit_rate / k.
        assert r.precision == r.hit_rate / r.k
