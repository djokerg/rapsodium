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


class FeatureTargets(BaseModel):
    """Target audio-feature vector. 0..1, except ``tempo`` (BPM). All optional."""

    energy: float | None = None
    valence: float | None = None
    danceability: float | None = None
    tempo: float | None = None


class ContextualRequest(BaseModel):
    """A conversational ``VibeProfile`` from the assistant (docs/assistant.md §8)."""

    user_id: UUID = Field(description="Target user — for taste fallback and seen-filtering.")
    feature_targets: FeatureTargets = Field(default_factory=FeatureTargets)
    genre_boosts: dict[str, float] = Field(
        default_factory=dict,
        description="Multiplicative ranking boosts per genre (>1 boost, <1 suppress).",
    )
    artists: list[str] = Field(
        default_factory=list,
        description="Artists the user wants to hear — strongly surfaced if in the catalogue.",
    )
    seed_artists: list[str] = Field(
        default_factory=list,
        description="Artists to find SIMILAR music to — ranking anchors on their feature centroid.",
    )
    excluded_artists: list[str] = Field(default_factory=list)
    excluded_genres: list[str] = Field(default_factory=list)
    mainstream: float = Field(
        default=0.0,
        ge=-1.0,
        le=1.0,
        description="-1 underground .. +1 chart hits. Skews popularity weighting.",
    )
    base_algorithm: str = Field(default="content")
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


class ContextualResponse(BaseModel):
    algorithm: str = "contextual"
    recommendations: list[Recommendation]
