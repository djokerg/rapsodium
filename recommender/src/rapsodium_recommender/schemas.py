from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    songs_count: int
    interactions_count: int
