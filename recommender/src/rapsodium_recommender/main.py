from fastapi import FastAPI

from .algorithms import (
    CollaborativeRecommender,
    ContentBasedRecommender,
    ContextualRecommender,
    PopularityRecommender,
)
from .config import get_settings
from .data import load_interactions_df, load_songs_df
from .db import get_connection
from .schemas import (
    CollaborativeResponse,
    ContentResponse,
    ContextualRequest,
    ContextualResponse,
    HealthResponse,
    PersonalizedRequest,
    PopularityRequest,
    PopularityResponse,
    Recommendation,
)

app = FastAPI(
    title="Rapsodium Recommender",
    version="0.1.0",
    description="Music recommendation service (popularity, content-based, collaborative).",
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Verify DB connectivity and return catalog/interaction counts."""
    with get_connection() as conn, conn.cursor() as cur:
        cur.execute("SELECT count(*)::int FROM songs")
        songs_row = cur.fetchone()
        cur.execute("SELECT count(*)::int FROM interactions")
        interactions_row = cur.fetchone()

    songs_count = int(songs_row[0]) if songs_row else 0
    interactions_count = int(interactions_row[0]) if interactions_row else 0

    return HealthResponse(
        status="ok",
        songs_count=songs_count,
        interactions_count=interactions_count,
    )


@app.post("/recommend/popularity", response_model=PopularityResponse)
def recommend_popularity(request: PopularityRequest) -> PopularityResponse:
    """Top-N songs by weighted popularity (3*save + 1*play - 1*skip).

    Filters: optional ``genres`` narrows the pool to songs in any of them;
    optional ``user_id`` hides songs the user has already interacted with.
    """
    interactions = load_interactions_df()
    songs = load_songs_df()
    recommender = PopularityRecommender(interactions=interactions, songs=songs)

    scored = recommender.recommend(
        user_id=request.user_id,
        genres=request.genres,
        limit=request.limit,
    )
    return PopularityResponse(
        recommendations=[Recommendation(song_id=item.song_id, score=item.score) for item in scored],
    )


@app.post("/recommend/content", response_model=ContentResponse)
def recommend_content(request: PersonalizedRequest) -> ContentResponse:
    """Songs similar (in audio features + genre) to the user's saved songs.

    Returns an empty list for cold-start users (no saves on record).
    """
    interactions = load_interactions_df()
    songs = load_songs_df()
    recommender = ContentBasedRecommender(songs=songs, interactions=interactions)

    scored = recommender.recommend(
        user_id=request.user_id,
        genres=request.genres,
        limit=request.limit,
    )
    return ContentResponse(
        recommendations=[Recommendation(song_id=item.song_id, score=item.score) for item in scored],
    )


@app.post("/recommend/collaborative", response_model=CollaborativeResponse)
def recommend_collaborative(request: PersonalizedRequest) -> CollaborativeResponse:
    """Item-based collaborative filter.

    Songs scored by aggregate similarity to what the target user has already
    engaged with. Returns an empty list for users not present in the training
    interactions.
    """
    interactions = load_interactions_df()
    songs = load_songs_df()
    recommender = CollaborativeRecommender(interactions=interactions, songs=songs)

    scored = recommender.recommend(
        user_id=request.user_id,
        genres=request.genres,
        limit=request.limit,
    )
    return CollaborativeResponse(
        recommendations=[Recommendation(song_id=item.song_id, score=item.score) for item in scored],
    )


@app.post("/recommend/contextual", response_model=ContextualResponse)
def recommend_contextual(request: ContextualRequest) -> ContextualResponse:
    """Vibe-driven recommendations from a conversational VibeProfile.

    Ranks songs by closeness to a target audio-feature vibe, then applies genre
    boosts, artist/genre exclusions and a popularity skew. Unspecified features
    fall back to the user's taste profile (or the catalogue median for cold-start
    users). See docs/assistant.md §8.
    """
    interactions = load_interactions_df()
    songs = load_songs_df()
    recommender = ContextualRecommender(songs=songs, interactions=interactions)

    scored = recommender.recommend(
        user_id=request.user_id,
        feature_targets=request.feature_targets.model_dump(exclude_none=True),
        genre_boosts=request.genre_boosts,
        artists=request.artists,
        seed_artists=request.seed_artists,
        excluded_artists=request.excluded_artists,
        excluded_genres=request.excluded_genres,
        mainstream=request.mainstream,
        base_algorithm=request.base_algorithm,
        limit=request.limit,
    )
    return ContextualResponse(
        recommendations=[Recommendation(song_id=item.song_id, score=item.score) for item in scored],
    )


def run_dev() -> None:
    """Entry point for `poetry run dev` (hot-reload uvicorn)."""
    import uvicorn

    uvicorn.run(
        "rapsodium_recommender.main:app",
        host="0.0.0.0",
        port=get_settings().port,
        reload=True,
    )
