from uuid import UUID

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    songs_count: int
    interactions_count: int


class PopularityRequest(BaseModel):
    user_id: UUID | None = Field(
        default=None,
        description="Exclude songs this user has already interacted with.",
    )
    genres: list[str] | None = Field(
        default=None,
        description="Restrict recommendations to songs in any of these genres.",
    )
    limit: int = Field(default=20, ge=1, le=100)


class Recommendation(BaseModel):
    song_id: UUID
    score: float


class PopularityResponse(BaseModel):
    algorithm: str = "popularity"
    recommendations: list[Recommendation]
