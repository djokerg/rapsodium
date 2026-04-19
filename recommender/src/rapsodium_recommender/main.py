from fastapi import FastAPI

from .config import get_settings
from .db import get_connection
from .schemas import HealthResponse

app = FastAPI(
    title="Rapsodium Recommender",
    version="0.1.0",
    description="Music recommendation service (popularity, content-based, collaborative filtering).",
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


def run_dev() -> None:
    """Entry point for `poetry run dev` (hot-reload uvicorn)."""
    import uvicorn

    uvicorn.run(
        "rapsodium_recommender.main:app",
        host="0.0.0.0",  # noqa: S104 - local dev only
        port=get_settings().port,
        reload=True,
    )
