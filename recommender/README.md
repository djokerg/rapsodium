# Rapsodium Recommender

Python service that generates music recommendations for the Rapsodium app.

Three algorithms (popularity-based, content-based, collaborative filtering) will be exposed via a FastAPI HTTP layer that the NestJS backend calls from `recommendations.service.ts`.

## Stack

- Python 3.12, Poetry
- FastAPI + uvicorn
- psycopg 3 (Postgres driver)
- pandas, numpy, scikit-learn
- Pydantic settings
- ruff (lint + format), mypy --strict (type check), pytest

## Setup

```bash
cd recommender
cp .env.example .env      # set DATABASE_URL to match backend/.env
poetry install
```

## Run

```bash
poetry run dev            # hot-reload dev server on :8000
```

Then:

```bash
curl http://localhost:8000/health
# { "status": "ok", "songs_count": 482, "interactions_count": 5534 }

# Interactive API docs: http://localhost:8000/docs
```

## Quality checks

```bash
poetry run ruff check src tests      # lint
poetry run ruff format src tests     # format
poetry run mypy                      # strict type check
poetry run pytest                    # tests
```
