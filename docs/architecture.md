# Architecture

## System Overview

Rapsodium is a three-tier system consisting of a mobile client, a backend API, and a Python-based recommendation engine. All components communicate over REST APIs, with PostgreSQL as the shared data store.

```
┌─────────────────────────────┐
│   Mobile App (React Native) │
│   Expo / Expo Router        │
└─────────────┬───────────────┘
              │ REST API (HTTPS)
              v
┌─────────────────────────────┐
│   Backend (NestJS)          │
│   Authentication, Songs,    │
│   Interactions, Recommendations
└──────┬──────────────┬───────┘
       │              │
       v              v
┌────────────┐  ┌─────────────────┐
│ PostgreSQL │  │ Python           │
│ (Drizzle)  │  │ Recommender      │
└────────────┘  └─────────────────┘
```

---

## Mobile App

### Technology

| Library | Purpose |
|---------|---------|
| React Native | Cross-platform mobile framework |
| Expo | Build toolchain, managed workflow |
| Expo Router | File-based routing (React Navigation under the hood) |
| Expo Audio | Audio preview playback |
| TanStack Query | Server state management and caching |
| Zustand | Lightweight client-side state |

### Screen Structure

```
app/
├── _layout.tsx              # Root layout (Stack navigator)
├── index.tsx                # Home / recommendations feed
├── assistant.tsx            # Muse — conversational assistant (vibe chat)
├── (auth)/
│   ├── login.tsx
│   └── register.tsx
├── onboarding.tsx           # Genre selection
├── search.tsx               # Song search
├── song/[id].tsx            # Song detail + audio player
├── favorites.tsx            # Saved songs
├── history.tsx              # Listening history
└── insights.tsx             # Listening insights / stats overview
```

### State Management

- **TanStack Query** handles all server data: song lists, search results, recommendations, user profile. Provides caching, background refetching, and optimistic updates for interactions.
- **Zustand** manages local UI state: audio player state (current track, playing/paused, progress), auth token storage, onboarding flow state.

### Data Flow

1. User opens the app -> checks stored JWT token -> redirects to auth or home
2. TanStack Query fetches song feed / recommendations from backend
3. User interactions (like, dislike, skip, play) are sent to the backend via mutation
4. Audio player tracks `listened_seconds` and reports to the backend on pause/complete/skip

---

## Backend

### Technology

| Library | Purpose |
|---------|---------|
| NestJS | Node.js framework (modular, decorator-based) |
| Drizzle ORM | Type-safe SQL query builder and schema definition |
| PostgreSQL | Relational database |
| JWT (jsonwebtoken) | Stateless authentication |

### Module Structure

```
src/
├── main.ts                  # Bootstrap
├── app.module.ts            # Root module
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts   # POST /auth/register, POST /auth/login
│   ├── auth.service.ts      # Password hashing, JWT generation
│   └── auth.guard.ts        # JWT verification guard
├── users/
│   ├── users.module.ts
│   ├── users.service.ts     # User CRUD, preference management
│   └── users.controller.ts  # GET /users/me, PUT /users/preferences
├── songs/
│   ├── songs.module.ts
│   ├── songs.controller.ts  # GET /songs, GET /songs/:id, GET /songs/search
│   └── songs.service.ts     # Song queries, search logic
├── interactions/
│   ├── interactions.module.ts
│   ├── interactions.controller.ts  # POST /interactions
│   └── interactions.service.ts     # Record events, query favorites/history
├── recommendations/
│   ├── recommendations.module.ts
│   ├── recommendations.controller.ts  # GET /recommendations
│   └── recommendations.service.ts     # Calls Python recommender, returns results
├── assistant/
│   ├── assistant.module.ts
│   ├── assistant.controller.ts        # POST /assistant/message
│   ├── assistant.service.ts           # Orchestrates LLM + recommender (stateless)
│   ├── llm.service.ts                 # OpenAI structured output + tool calling
│   ├── vibe-merge.ts                  # Patch-merge/clamp the VibeProfile
│   └── types.ts                       # VibeProfile, message contracts
├── insights/
│   ├── insights.module.ts
│   ├── insights.controller.ts         # GET /insights
│   ├── insights.service.ts            # Aggregates interactions into listening stats
│   └── insights.util.ts               # Pure helpers (bucket filling, taste shift)
└── database/
    ├── database.module.ts   # Drizzle connection setup
    └── schema.ts            # Drizzle table definitions
```

### Authentication Flow

1. **Register:** Client sends `email` + `password` -> backend hashes password (bcrypt) -> stores in `users` table -> returns JWT
2. **Login:** Client sends `email` + `password` -> backend verifies hash -> returns JWT
3. **Protected routes:** Client sends `Authorization: Bearer <token>` header -> `AuthGuard` validates JWT -> extracts `user_id`

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | No | Create account |
| `POST` | `/auth/login` | No | Authenticate and get JWT |
| `GET` | `/users/me` | Yes | Get current user profile |
| `PUT` | `/users/preferences` | Yes | Update genre preferences |
| `GET` | `/songs` | Yes | List songs (paginated) |
| `GET` | `/songs/search` | Yes | Search songs by title/artist |
| `GET` | `/songs/:id` | Yes | Get song details |
| `POST` | `/interactions` | Yes | Record an interaction (play, skip, like, dislike, save) |
| `GET` | `/interactions/favorites` | Yes | Get user's saved songs |
| `GET` | `/interactions/history` | Yes | Get user's listening history |
| `GET` | `/recommendations` | Yes | Get personalized recommendations |
| `POST` | `/assistant/message` | Yes | Conversational vibe/algorithm tuning (stateless) |
| `GET` | `/insights` | Yes | Listening insights over a time window (aggregated from interactions) |

---

## Recommendation Engine

### Technology

| Library | Purpose |
|---------|---------|
| Python 3 | Language |
| pandas | Data manipulation and analysis |
| scikit-learn | ML utilities (cosine similarity, TF-IDF, etc.) |
| numpy | Numerical operations |

### Algorithms

#### 1. Popularity-Based

The simplest baseline. Recommends songs that are globally popular across all users.

- **Input:** All interactions from the `interactions` table
- **Signal:** Weighted combination of play count and like count
- **Output:** Top-N songs ranked by popularity score
- **Personalization:** None (same list for all users, optionally filtered by user's preferred genres)

#### 2. Content-Based

Recommends songs with similar attributes to what the user has liked.

- **Input:** Songs the user has liked + song metadata (genre, tempo, energy, danceability, valence)
- **Method:** Build a user profile vector from liked songs' features, compute cosine similarity against all candidate songs
- **Output:** Top-N most similar songs the user hasn't interacted with
- **Personalization:** High (based on individual taste)

#### 3. Collaborative Filtering

Recommends songs that similar users have enjoyed.

- **Input:** User-song interaction matrix (all users, all songs)
- **Method:** User-based or item-based collaborative filtering using cosine similarity on the interaction matrix
- **Output:** Top-N songs from similar users that the current user hasn't seen
- **Personalization:** High (based on community behavior)

#### 4. Contextual ("Vibe")

Powers the conversational assistant (see [assistant.md](./assistant.md)). Ranks songs by
closeness to an explicit **target vibe** derived from natural-language chat, rather than to the
user's past saves.

- **Input:** A `VibeProfile` (feature targets, genre boosts, requested/seed artists, exclusions,
  mainstream skew) produced by the backend assistant from the user's message
- **Method:** Proximity in min-max-scaled audio-feature space, then genre boosts, artist/genre
  filters, and a popularity skew; cold-start features fall back to the user's taste profile
- **Output:** Top-N songs matching the requested context, exposed via `POST /recommend/contextual`
- **Personalization:** High (per-message, real-time)

### Integration with Backend

The Python recommender runs as a separate process. The backend communicates with it in one of two ways (to be decided during implementation):

**Option A — HTTP microservice:**
- Python exposes a Flask/FastAPI endpoint (e.g., `GET /recommend?user_id=X&algorithm=Y`)
- NestJS backend calls this endpoint from `recommendations.service.ts`

**Option B — Script invocation:**
- NestJS spawns a Python subprocess with arguments
- Python reads from the database, computes recommendations, outputs JSON to stdout
- NestJS parses the output

Option A is preferred for production-like architecture. Option B is simpler for early development.

---

## Database Layer

PostgreSQL is the single source of truth, accessed by both the NestJS backend (via Drizzle ORM) and the Python recommender (via direct connection or SQLAlchemy).

See [Database Design](./database-design.md) for the full schema specification.

### Key Design Decisions

- **UUIDs as primary keys** — avoids sequential ID enumeration, works well for distributed systems
- **Single `interactions` table** — favorites and history are derived via queries rather than separate tables, keeping the model normalized
- **Optional song features** — `tempo`, `energy`, `danceability`, `valence` are nullable and only populated if used by the content-based recommender

---

## Communication Patterns

```
Mobile App                    Backend                     Recommender
    │                            │                            │
    │── POST /auth/login ───────>│                            │
    │<── JWT token ──────────────│                            │
    │                            │                            │
    │── GET /songs ─────────────>│                            │
    │<── Song list ──────────────│                            │
    │                            │                            │
    │── POST /interactions ─────>│                            │
    │<── 201 Created ────────────│                            │
    │                            │                            │
    │── GET /recommendations ───>│── GET /recommend ─────────>│
    │                            │<── Ranked song IDs ────────│
    │<── Recommended songs ──────│                            │
```

---

## Deployment

For development and thesis purposes:

- **Backend:** Runs locally on `localhost:3000`
- **Database:** Local PostgreSQL instance (or Docker container)
- **Recommender:** Local Python process
- **Mobile:** Expo Go on a physical device or emulator, connecting to the local backend

No cloud deployment is required for the MVP. The system is designed to run entirely on a local development machine.
