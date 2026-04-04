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
- [ ] Implement users endpoints (GET /users/me, PUT /users/preferences)
- [ ] Implement songs endpoints (list, search, detail)
- [ ] Implement interactions endpoint (record play, skip, like, dislike, save)
- [ ] Implement favorites route (derived from `interactions` where `event_type = 'save'`)
- [ ] Implement history route (derived from `interactions` where `event_type = 'play'`)

---

## Phase 4 — Mobile App Core

Build the React Native / Expo mobile application with all core screens.

- [ ] Initialize Expo project with Expo Router
- [ ] Set up API client with JWT interceptor (axios/fetch wrapper, token attach, 401 handling)
- [ ] Implement authentication flow (register, login, token storage)
- [ ] Implement onboarding screen (genre selection)
- [ ] Implement home screen (song feed / recommendations)
- [ ] Implement search screen
- [ ] Implement song detail screen
- [ ] Implement favorites screen
- [ ] Implement history screen
- [ ] Set up TanStack Query for API data fetching
- [ ] Set up Zustand for local state management

---

## Phase 5 — Audio Preview Player

Add audio playback functionality and tracking.

- [ ] Implement audio player component using Expo Audio
- [ ] Add play/pause controls and progress indicator
- [ ] Track `listened_seconds` on the client
- [ ] Send `listened_seconds` to the backend when playback ends or is interrupted

---

## Phase 6 — Recommendation Systems

Implement the three recommendation algorithms in Python.

- [ ] **Popularity-based** — recommend globally popular songs (based on play count, like count)
- [ ] **Content-based** — recommend songs similar to user's liked songs (using song metadata features)
- [ ] **Collaborative filtering** — recommend songs based on similar users' interaction patterns
- [ ] Expose recommendation results via a backend API endpoint

---

## Phase 6.5 — Synthetic Interaction Data

Generate synthetic user interactions so the recommendation algorithms and evaluation have sufficient data to work with.

- [ ] Write a script to create synthetic users with varied genre preferences
- [ ] Generate realistic interaction patterns (plays, likes, skips, saves) across the song catalog
- [ ] Verify data volume is sufficient for collaborative filtering and evaluation metrics

---

## Phase 7 — Evaluation

Evaluate and compare the recommendation algorithms.

- [ ] Implement train/test split on interaction data
- [ ] Calculate Precision@10 for each algorithm
- [ ] Calculate Recall@10 for each algorithm
- [ ] Calculate Hit Rate@10 for each algorithm
- [ ] Generate comparison charts and result tables
- [ ] Document findings and analysis

---

## Phase 8 — Optional Extensions

Only pursue if the core scope (Phases 1-7) is stable and complete.

- [ ] Hybrid recommender (combine multiple approaches)
- [ ] "Why this recommendation" explanations
- [ ] UI/UX polish and refinements

---

## Phase 9 — Master's Thesis

Write the thesis document based on the implemented system.

- [ ] Introduction — problem statement and motivation
- [ ] Theoretical background — recommendation systems, algorithms, evaluation metrics
- [ ] System architecture — technical design and decisions
- [ ] Implementation — key implementation details and code walkthrough
- [ ] Experiments — evaluation results, comparison, analysis
- [ ] Conclusion — summary, limitations, future work
