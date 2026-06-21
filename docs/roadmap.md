# Roadmap

## Phase 1 — Project Setup

Lock down the project foundation before any implementation begins.

- [x] Finalize project title
- [x] Finalize scope document
- [x] Set up monorepo structure
- [x] Choose data model and define schema

---

## Phase 2 — Dataset and Database

Prepare the song dataset and implement the database layer.

- [x] Curate a dataset of ~500 songs with metadata (title, artist, album, genre, duration, preview URL, cover URL)
- [x] Write a seed script to populate the database
- [x] Define all tables using Drizzle ORM schema definitions
- [x] Run initial migrations and verify data integrity

---

## Phase 3 — Backend Core

Build the NestJS backend with all essential API routes.

- [x] Initialize NestJS application structure (modules, controllers, services)
- [x] Implement user authentication (register, login, JWT tokens)
- [x] Implement users endpoints (GET /users/me, PUT /users/preferences)
- [x] Implement songs endpoints (list with pagination, search, detail)
- [x] Implement interactions endpoint (record play, skip, like, dislike, save)
- [x] Implement favorites route (derived from `interactions` where `event_type = 'save'`)
- [x] Implement history route (derived from `interactions` where `event_type = 'play'`)

---

## Phase 4 — Mobile App Core

Build the React Native / Expo mobile application with all core screens.

- [x] Initialize Expo project with Expo Router
- [x] Set up Zustand for local state management (auth token, player state)
- [x] Set up TanStack Query for API data fetching
- [x] Set up API client with JWT interceptor (token attach, 401 handling)
- [x] Implement authentication flow (register, login, token storage)
- [x] Implement onboarding screen (genre selection)
- [x] Implement home screen (song feed)
- [x] Implement search screen
- [x] Implement song detail screen with audio preview player (Expo Audio, play/pause, progress)
- [x] Track `listened_seconds` on the client and report to backend on pause/complete/skip
- [x] Implement favorites screen
- [x] Implement history screen

---

## Phase 5 — Synthetic Interaction Data

Generate synthetic user interactions so the recommendation algorithms and evaluation have sufficient data to work with. This must happen before building the recommenders.

- [x] Write a script to create synthetic users with varied genre preferences
- [x] Generate realistic interaction patterns (plays, likes, skips, saves) across the song catalog
- [x] Verify data volume is sufficient for collaborative filtering and evaluation metrics

---

## Phase 6 — Recommendation Systems

Implement the three recommendation algorithms in Python.

- [x] Initialize Python project (dependencies: pandas, scikit-learn, numpy)
- [x] Set up communication layer between NestJS and Python (FastAPI microservice or subprocess)
- [x] **Popularity-based** — recommend globally popular songs (based on play count, like count)
- [x] **Content-based** — recommend songs similar to user's liked songs (using song metadata features)
- [x] **Collaborative filtering** — recommend songs based on similar users' interaction patterns
- [x] Expose recommendation results via backend API endpoint (GET /recommendations)
- [x] Connect recommendations to mobile app home screen

---

## Phase 7 — Conversational Assistant

Add a chat-based control layer over the recommendation engine: the user describes what
they're doing or the vibe they want (in natural language), and recommendations adapt in
real time; the same chat lets the user fine-tune the algorithm (boost a genre, exclude an
artist, push toward less mainstream). See [assistant.md](./assistant.md) for the detailed design.

- [x] Backend `assistant` module — stateless `POST /assistant/message` (no DB tables)
- [x] OpenAI integration (`openai` SDK, structured output) — NL → `VibeProfile` patch
- [x] `mergeVibeProfile` patch-merge logic + `clampProfile` (clamp/sanitize) + unit tests
- [x] Recommender `contextual` endpoint (vibe ⊕ taste, filters, genre boosts, mainstream skew)
- [x] Mobile chat screen — in-memory VibeProfile, live recommendation strip + filter chips

---

## Phase 8 — Listening Insights

Give the user an overview of their listening over time: most-played artists and songs,
when and how they listen, and how their taste is shifting. All stats are **derived from the
existing `interactions` table** via aggregation queries — no new tables, consistent with the
"favorites and history are derived, not stored" design decision. See
[insights.md](./insights.md) for the detailed design.

- [x] Backend `insights` module — `GET /insights?days=` (aggregations over `interactions`)
- [x] Headline totals (plays, unique songs/artists, saves, listening minutes)
- [x] Top artists, top songs, top genres (with share of plays)
- [x] Listening patterns — plays bucketed by hour of day and day of week
- [x] Taste shift — rising/falling genres (recent vs. previous half of the window) + unit tests
- [x] Mobile Insights tab — range selector, stat cards, bar charts, taste-shift list

---

## Phase 9 — Evaluation

Evaluate and compare the recommendation algorithms. Run this **in parallel with (or before)
writing the thesis** — these results feed directly into the thesis's experiments chapter.
Harness lives in the recommender (`evaluation/` + `poetry run evaluate`); see
[evaluation.md](./evaluation.md).

- [x] Implement train/test split on interaction data (leave-one-out, one positive per user)
- [x] Calculate Precision@10 for each algorithm
- [x] Calculate Recall@10 for each algorithm
- [x] Calculate Hit Rate@10 for each algorithm
- [x] Generate comparison charts and result tables (`--csv`, `--chart`)
- [x] Run on the full dataset and document findings and analysis (see [evaluation.md](./evaluation.md))

---

## Phase 10 — Master's Thesis

Write the thesis document based on the implemented system. The theoretical chapters (introduction, background) can be started alongside implementation phases.

- [ ] Introduction — problem statement and motivation
- [ ] Theoretical background — recommendation systems, algorithms, evaluation metrics
- [ ] System architecture — technical design and decisions
- [ ] Implementation — key implementation details and code walkthrough
- [ ] Experiments — evaluation results, comparison, analysis
- [ ] Conclusion — summary, limitations, future work
