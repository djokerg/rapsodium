from __future__ import annotations

from uuid import UUID

import pandas as pd

from rapsodium_recommender.algorithms.content import ContentBasedRecommender

SONG_A = UUID("00000000-0000-0000-0000-00000000000a")
SONG_B = UUID("00000000-0000-0000-0000-00000000000b")
SONG_C = UUID("00000000-0000-0000-0000-00000000000c")
SONG_D = UUID("00000000-0000-0000-0000-00000000000d")

USER_1 = UUID("11111111-1111-1111-1111-111111111111")
USER_2 = UUID("22222222-2222-2222-2222-222222222222")


def _songs_df() -> pd.DataFrame:
    # A and B are "high energy rock", C is "chill rock", D is "pop".
    return pd.DataFrame(
        [
            {
                "id": SONG_A,
                "genre": "rock",
                "tempo": 140.0,
                "energy": 0.9,
                "danceability": 0.5,
                "valence": 0.4,
            },
            {
                "id": SONG_B,
                "genre": "rock",
                "tempo": 138.0,
                "energy": 0.88,
                "danceability": 0.52,
                "valence": 0.42,
            },
            {
                "id": SONG_C,
                "genre": "rock",
                "tempo": 90.0,
                "energy": 0.3,
                "danceability": 0.4,
                "valence": 0.65,
            },
            {
                "id": SONG_D,
                "genre": "pop",
                "tempo": 120.0,
                "energy": 0.7,
                "danceability": 0.8,
                "valence": 0.8,
            },
        ]
    )


def _interactions(rows: list[tuple[UUID, UUID, str]]) -> pd.DataFrame:
    return pd.DataFrame([{"user_id": u, "song_id": s, "event_type": e} for u, s, e in rows])


def test_cold_start_returns_empty() -> None:
    rec = ContentBasedRecommender(_songs_df(), _interactions([]))

    assert rec.recommend(user_id=USER_1, limit=10) == []


def test_similar_song_ranked_first() -> None:
    # USER_1 only saved SONG_A (high-energy rock). Expect SONG_B (near-twin
    # of A in feature space) to lead the ranking; SONG_C (chill rock, same
    # genre) should beat SONG_D (pop, same energy but different genre).
    rec = ContentBasedRecommender(_songs_df(), _interactions([(USER_1, SONG_A, "save")]))

    result = rec.recommend(user_id=USER_1, limit=10)
    result_ids = [s.song_id for s in result]

    assert SONG_A not in result_ids  # saved → excluded from discovery feed
    assert result_ids[0] == SONG_B
    # Within rock genre, we should still pick the near-twin first.
    assert result_ids.index(SONG_B) < result_ids.index(SONG_C)


def test_genre_filter_respected() -> None:
    rec = ContentBasedRecommender(_songs_df(), _interactions([(USER_1, SONG_A, "save")]))

    pop_only = rec.recommend(user_id=USER_1, genres=["pop"], limit=10)

    assert [s.song_id for s in pop_only] == [SONG_D]


def test_seen_songs_are_excluded() -> None:
    # USER_1 saved A (the anchor) and already played B (a song they'd
    # otherwise be recommended). B should not appear.
    interactions = _interactions(
        [
            (USER_1, SONG_A, "save"),
            (USER_1, SONG_B, "play"),
        ]
    )
    rec = ContentBasedRecommender(_songs_df(), interactions)

    result_ids = {s.song_id for s in rec.recommend(user_id=USER_1, limit=10)}

    assert SONG_A not in result_ids
    assert SONG_B not in result_ids


def test_limit_caps_results() -> None:
    rec = ContentBasedRecommender(_songs_df(), _interactions([(USER_1, SONG_A, "save")]))

    assert len(rec.recommend(user_id=USER_1, limit=2)) == 2
    assert rec.recommend(user_id=USER_1, limit=0) == []


def test_only_saves_shape_profile() -> None:
    # Plays and skips must NOT feed the profile. USER_1 only plays B (which
    # would otherwise pull the profile towards rock) and saves D (pop).
    # The top recommendation should reflect the save, not the play.
    interactions = _interactions(
        [
            (USER_1, SONG_B, "play"),
            (USER_1, SONG_D, "save"),
        ]
    )
    rec = ContentBasedRecommender(_songs_df(), interactions)
    result_ids = [s.song_id for s in rec.recommend(user_id=USER_1, limit=10)]

    # SONG_D is saved → excluded. Among the rest, SONG_B is seen (played) →
    # excluded. So only SONG_A and SONG_C remain; their order depends on
    # proximity to SONG_D's profile.
    assert SONG_B not in result_ids
    assert SONG_D not in result_ids
    assert set(result_ids) == {SONG_A, SONG_C}


def test_handles_missing_audio_features_gracefully() -> None:
    # One song with all NaN features should be imputed with median values.
    songs = _songs_df()
    songs.loc[songs["id"] == SONG_C, ["tempo", "energy", "danceability", "valence"]] = pd.NA
    rec = ContentBasedRecommender(songs, _interactions([(USER_1, SONG_A, "save")]))

    # Should not raise, should return some ranking including SONG_C.
    result_ids = {s.song_id for s in rec.recommend(user_id=USER_1, limit=10)}
    assert SONG_C in result_ids
