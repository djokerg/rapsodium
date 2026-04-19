from fastapi import FastAPI

from .algorithms import PopularityRecommender
from .config import get_settings
from .data import load_interactions_df, load_songs_df
from .db import get_connection
from .schemas import (
    HealthResponse,
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

    Filters: optional ``genre`` narrows the pool; optional ``user_id`` hides
    songs the user has already interacted with.
    """
    interactions = load_interactions_df()
    songs = load_songs_df()
    recommender = PopularityRecommender(interactions=interactions, songs=songs)

    scored = recommender.recommend(
        user_id=request.user_id,
        genre=request.genre,
        limit=request.limit,
    )
    return PopularityResponse(
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
