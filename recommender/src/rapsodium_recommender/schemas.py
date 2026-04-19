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


class PersonalizedRequest(BaseModel):
    """Common request shape for algorithms that require a user identity."""

    user_id: UUID = Field(description="Target user — required for personalization.")
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


class ContentResponse(BaseModel):
    algorithm: str = "content"
    recommendations: list[Recommendation]


class CollaborativeResponse(BaseModel):
    algorithm: str = "collaborative"
    recommendations: list[Recommendation]
