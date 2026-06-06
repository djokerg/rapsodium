from __future__ import annotations

from uuid import UUID

import pandas as pd

from rapsodium_recommender.algorithms.contextual import ContextualRecommender

SONG_CALM = UUID("00000000-0000-0000-0000-00000000000a")  # low energy
SONG_MID = UUID("00000000-0000-0000-0000-00000000000b")  # mid energy
SONG_HYPE = UUID("00000000-0000-0000-0000-00000000000c")  # high energy
SONG_POP = UUID("00000000-0000-0000-0000-00000000000d")  # high energy, popular pop

USER_1 = UUID("11111111-1111-1111-1111-111111111111")


def _songs_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"id": SONG_CALM, "artist": "Nils", "genre": "ambient",
             "tempo": 70.0, "energy": 0.1, "danceability": 0.2, "valence": 0.3},
            {"id": SONG_MID, "artist": "Midd", "genre": "rock",
             "tempo": 110.0, "energy": 0.5, "danceability": 0.5, "valence": 0.5},
            {"id": SONG_HYPE, "artist": "Loud", "genre": "rock",
             "tempo": 150.0, "energy": 0.95, "danceability": 0.7, "valence": 0.6},
            {"id": SONG_POP, "artist": "Star", "genre": "pop",
             "tempo": 145.0, "energy": 0.9, "danceability": 0.85, "valence": 0.9},
        ]
    )


def _interactions(rows: list[tuple[UUID, UUID, str]]) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(columns=["user_id", "song_id", "event_type"])
    return pd.DataFrame([{"user_id": u, "song_id": s, "event_type": e} for u, s, e in rows])


def test_high_energy_vibe_ranks_energetic_songs_first() -> None:
    rec = ContextualRecommender(_songs_df(), _interactions([]))

    result = rec.recommend(
        user_id=USER_1,
        feature_targets={"energy": 0.95, "tempo": 150.0, "danceability": 0.7, "valence": 0.6},
        limit=10,
    )
    ids = [s.song_id for s in result]

    assert ids[0] == SONG_HYPE
    assert ids[-1] == SONG_CALM  # the calm track is furthest from the vibe


def test_calm_vibe_ranks_calm_first() -> None:
    rec = ContextualRecommender(_songs_df(), _interactions([]))

    result = rec.recommend(
        user_id=USER_1,
        feature_targets={"energy": 0.1, "tempo": 70.0, "danceability": 0.2, "valence": 0.3},
        limit=10,
    )

    assert result[0].song_id == SONG_CALM


def test_requested_artist_surfaces_to_top() -> None:
    # Even with a calm-vibe target (closest to SONG_CALM), explicitly asking for
    # the artist behind SONG_HYPE should lift their song above the vibe match.
    rec = ContextualRecommender(_songs_df(), _interactions([]))

    result = rec.recommend(
        user_id=USER_1,
        feature_targets={"energy": 0.1, "tempo": 70.0},
        artists=["loud"],  # case-insensitive; SONG_HYPE's artist
        limit=10,
    )

    assert result[0].song_id == SONG_HYPE


def test_requested_artist_absent_from_catalogue_is_noop() -> None:
    rec = ContextualRecommender(_songs_df(), _interactions([]))

    result = rec.recommend(
        user_id=USER_1,
        feature_targets={"energy": 0.95},
        artists=["Nonexistent Band"],
        limit=10,
    )

    # No matching artist -> falls back to pure vibe ranking, still returns songs.
    assert result[0].song_id == SONG_HYPE
    assert len(result) == 4


def test_seed_artist_anchors_ranking_on_their_sound() -> None:
    # "more like" the artist behind SONG_CALM: with no explicit feature targets,
    # ranking should anchor on that artist's calm centroid, so the closest other
    # song (SONG_MID) leads and the high-energy ones trail.
    rec = ContextualRecommender(_songs_df(), _interactions([]))

    result = rec.recommend(user_id=USER_1, seed_artists=["nils"], limit=10)
    ids = [s.song_id for s in result]

    assert ids[0] == SONG_MID
    assert ids.index(SONG_MID) < ids.index(SONG_HYPE)


def test_seed_artist_absent_falls_back_to_median() -> None:
    rec = ContextualRecommender(_songs_df(), _interactions([]))

    # Unknown seed artist -> no centroid -> still returns a full ranking.
    result = rec.recommend(user_id=USER_1, seed_artists=["Nobody"], limit=10)
    assert len(result) == 4


def test_excluded_artist_is_removed() -> None:
    rec = ContextualRecommender(_songs_df(), _interactions([]))

    result = rec.recommend(
        user_id=USER_1,
        feature_targets={"energy": 0.95},
        excluded_artists=["loud"],  # case-insensitive
        limit=10,
    )

    assert SONG_HYPE not in {s.song_id for s in result}


def test_excluded_genre_is_removed() -> None:
    rec = ContextualRecommender(_songs_df(), _interactions([]))

    result = rec.recommend(
        user_id=USER_1,
        feature_targets={"energy": 0.5},
        excluded_genres=["rock"],
        limit=10,
    )
    ids = {s.song_id for s in result}

    assert SONG_MID not in ids
    assert SONG_HYPE not in ids


def test_genre_boost_reorders_near_ties() -> None:
    songs = _songs_df()
    # Make the two high-energy songs near-identical in features so the boost decides.
    rec = ContextualRecommender(songs, _interactions([]))

    boosted = rec.recommend(
        user_id=USER_1,
        feature_targets={"energy": 0.92, "tempo": 147.0, "danceability": 0.78, "valence": 0.75},
        genre_boosts={"pop": 2.0},
        limit=10,
    )

    assert boosted[0].song_id == SONG_POP


def test_negative_mainstream_favors_deep_cuts() -> None:
    # SONG_HYPE and SONG_POP are both energetic; SONG_POP is far more popular.
    # A negative mainstream preference should push the popular one down.
    interactions = _interactions(
        [(UUID(int=i), SONG_POP, "save") for i in range(1, 11)]  # SONG_POP is a hit
    )
    rec = ContextualRecommender(_songs_df(), interactions)

    result = rec.recommend(
        user_id=USER_1,
        feature_targets={"energy": 0.92, "tempo": 147.0, "danceability": 0.78, "valence": 0.75},
        mainstream=-1.0,
        limit=10,
    )
    ids = [s.song_id for s in result]

    assert ids.index(SONG_HYPE) < ids.index(SONG_POP)


def test_seen_songs_excluded() -> None:
    rec = ContextualRecommender(_songs_df(), _interactions([(USER_1, SONG_HYPE, "play")]))

    result_ids = {
        s.song_id
        for s in rec.recommend(
            user_id=USER_1, feature_targets={"energy": 0.95}, limit=10
        )
    }

    assert SONG_HYPE not in result_ids


def test_cold_start_uses_targets_only() -> None:
    # No interactions at all: should still rank by the target vibe, not error.
    rec = ContextualRecommender(_songs_df(), _interactions([]))

    result = rec.recommend(user_id=USER_1, feature_targets={"energy": 0.95}, limit=10)

    assert len(result) == 4
    assert result[0].song_id == SONG_HYPE


def test_limit_caps_results() -> None:
    rec = ContextualRecommender(_songs_df(), _interactions([]))

    assert len(rec.recommend(user_id=USER_1, feature_targets={"energy": 0.5}, limit=2)) == 2
    assert rec.recommend(user_id=USER_1, feature_targets={"energy": 0.5}, limit=0) == []


def test_no_targets_falls_back_to_taste_profile() -> None:
    # User saved the calm song; with no explicit targets, the calm song's
    # neighbours should rank above the high-energy ones.
    rec = ContextualRecommender(_songs_df(), _interactions([(USER_1, SONG_CALM, "save")]))

    result = rec.recommend(user_id=USER_1, feature_targets={}, limit=10)
    ids = [s.song_id for s in result]

    # SONG_CALM is saved -> excluded; the next-closest to it should lead.
    assert SONG_CALM not in ids
    assert ids[0] == SONG_MID
