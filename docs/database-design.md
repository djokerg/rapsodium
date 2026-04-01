# Database Design

## Data Model Overview

For the MVP version, the database should remain as simple as possible.  
The goal is for the model to cover the core functionalities of the application and the recommender system, without unnecessary complexity in the first development phase.

The core model is based on the following tables:

- `users`
- `user_preferences`
- `songs`
- `interactions`

---

## Entity Relationship Diagram

```
┌──────────────┐       ┌───────────────────┐
│    users     │       │  user_preferences  │
├──────────────┤       ├───────────────────┤
│ id (PK)      │──┐    │ id (PK)           │
│ email        │  │    │ user_id (FK)      │──→ users.id
│ password_hash│  │    │ genre             │
│ created_at   │  │    │ weight            │
└──────────────┘  │    └───────────────────┘
                  │
                  │    ┌───────────────────┐
                  │    │   interactions     │
                  │    ├───────────────────┤
                  ├───→│ id (PK)           │
                       │ user_id (FK)      │──→ users.id
                       │ song_id (FK)      │──→ songs.id
                       │ event_type        │
                       │ listened_seconds  │
                       │ created_at        │
                       └───────────────────┘

┌──────────────────┐
│      songs       │
├──────────────────┤
│ id (PK)          │
│ title            │
│ artist           │
│ album            │
│ genre            │
│ duration_sec     │
│ preview_url      │
│ cover_url        │
│ tempo            │
│ energy           │
│ danceability     │
│ valence          │
└──────────────────┘
```

---

## 1. Required Tables

### 1.1 `users`

Stores basic information about application users.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique user identifier |
| `email` | `VARCHAR(255)` | `UNIQUE, NOT NULL` | User email address |
| `password_hash` | `TEXT` | `NOT NULL` | Hashed password (bcrypt) |
| `created_at` | `TIMESTAMP` | `NOT NULL, DEFAULT now()` | Account creation timestamp |

**Note:**  
For the MVP, no additional profile data is needed beyond what is required for authentication and user identification.

---

### 1.2 `user_preferences`

Stores user preferences collected during onboarding.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique preference record identifier |
| `user_id` | `UUID` | `NOT NULL, FOREIGN KEY → users.id` | Reference to the user |
| `genre` | `VARCHAR(100)` | `NOT NULL` | Genre name (e.g., "rock", "hip-hop") |
| `weight` | `REAL` | `NOT NULL, DEFAULT 1.0` | Preference weight for this genre |

**Purpose:**

- Store the user's favorite genres
- Allow different genres to have different weights (indicating preference strength)

**Note:**  
Mood is not introduced in the first version of the system.

---

### 1.3 `songs`

Stores basic information about songs displayed in the application and used by the recommendation system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique song identifier |
| `deezer_id` | `BIGINT` | `NOT NULL, UNIQUE INDEX` | External Deezer API identifier |
| `title` | `VARCHAR(255)` | `NOT NULL` | Song title |
| `artist` | `VARCHAR(255)` | `NOT NULL` | Artist name |
| `album` | `VARCHAR(255)` | | Album name |
| `genre` | `VARCHAR(100)` | `NOT NULL` | Primary genre |
| `duration_sec` | `INTEGER` | `NOT NULL` | Full song duration in seconds |
| `preview_url` | `TEXT` | | URL to the audio preview clip |
| `cover_url` | `TEXT` | | URL to the album/song cover image |

**Optional columns** (for content-based recommendation):

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `tempo` | `REAL` | | Tempo in BPM |
| `energy` | `REAL` | | Energy score (0.0 - 1.0) |
| `danceability` | `REAL` | | Danceability score (0.0 - 1.0) |
| `valence` | `REAL` | | Positivity/mood score (0.0 - 1.0) |

**Note:**  
The optional columns should only be added if they will actually be used in the content-based recommendation model.

---

### 1.4 `interactions`

The central table for recording user behavior.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique interaction identifier |
| `user_id` | `UUID` | `NOT NULL, FOREIGN KEY → users.id` | Reference to the user |
| `song_id` | `UUID` | `NOT NULL, FOREIGN KEY → songs.id` | Reference to the song |
| `event_type` | `VARCHAR(20)` | `NOT NULL` | Type of interaction |
| `listened_seconds` | `INTEGER` | | Seconds listened (for `play` events) |
| `created_at` | `TIMESTAMP` | `NOT NULL, DEFAULT now()` | When the interaction occurred |

**Possible values for `event_type`:**

| Value | Description |
|-------|-------------|
| `play` | User played the song preview |
| `skip` | User skipped the song |
| `like` | User liked the song |
| `dislike` | User disliked the song |
| `save` | User saved the song to favorites |

**Purpose:**

- Track user actions on songs
- Serve as the basis for generating recommendations
- Power the favorites and history views
- Enable evaluation of the recommender system

---

## 2. Favorites and History

### 2.1 Favorites

A separate `favorites` table is **not necessary**.

Favorites can be derived directly from the `interactions` table by querying:

```sql
SELECT song_id FROM interactions
WHERE user_id = ? AND event_type = 'save'
ORDER BY created_at DESC;
```

### 2.2 History

A separate `history` table is **not necessary**.

Listening history can be derived from:

```sql
SELECT song_id FROM interactions
WHERE user_id = ? AND event_type = 'play'
ORDER BY created_at DESC;
```

This keeps the model simpler and more maintainable, with a single table covering multiple functionalities.

---

## 3. Optional Extensions (Future Phases)

### 3.1 `recommendations_log`

This table can be added later to record:

- Which recommendations were shown to a user
- Which algorithm generated them
- When they were displayed

Not required for the MVP.

### 3.2 `experiments`

A dedicated experiments table is not necessary in the initial version.

Experiment results and evaluation data can be stored outside the database as:

- CSV files
- JSON files
- Jupyter notebook outputs

This approach is sufficient for the first research cycle and simplifies the initial implementation.

---

## 4. Summary

The MVP database model consists of just four core tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts and authentication |
| `user_preferences` | Genre preferences from onboarding |
| `songs` | Song catalog with metadata |
| `interactions` | All user-song interactions (play, skip, like, dislike, save) |

This approach enables:

- Simpler implementation
- Easier maintenance
- Sufficient data for the application to function
- Sufficient data for implementing and evaluating the recommender system

Additional tables and more advanced modeling can be introduced later, once the core version of the system is stable.
