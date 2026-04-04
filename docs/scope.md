# Scope

## Project Title

Mobile application for music recommendation with implementation and comparison of multiple recommendation systems.

## Project Goal

The goal of this project is to develop a mobile application that allows users to browse songs, listen to short audio previews, record interactions, and view personalized recommendations.  
In addition to the application itself, the project aims to compare multiple recommendation system approaches through defined evaluation metrics.

---

## In Scope

### 1. Mobile Application

The application includes the following features:

- User registration and login
- Onboarding with favorite genre selection
- Song list browsing
- Song search
- Song detail view
- Short audio preview playback
- Like / dislike / skip interactions
- Favorites
- Listening history
- Recommendations screen

### 2. Backend

The backend covers:

- User authentication (JWT-based)
- Song management (CRUD + search)
- Recording user interactions
- Serving recommendations to the mobile app

### 3. Database

For the MVP version, the system uses the following core entities:

- `users`
- `user_preferences`
- `songs`
- `interactions`

Favorites and history are derived from user interactions, without dedicated tables in the first version.

### 4. Recommendation Systems

The following algorithms are implemented as part of the project:

- **Popularity-based recommender** — recommends globally popular songs
- **Content-based recommender** — recommends songs similar to what the user has liked (based on song metadata/features)
- **Collaborative filtering recommender** — recommends songs based on behavior patterns of similar users

### 5. Evaluation

The following metrics are used to evaluate the recommendation systems:

- **Precision@10** — of the top 10 recommended songs, how many are relevant
- **Recall@10** — of all relevant songs, how many appear in the top 10
- **Hit Rate@10** — proportion of users who received at least one relevant recommendation in their top 10

### 6. Dataset

The system uses a dataset of approximately 500 songs with metadata required for display in the application and for the recommendation algorithms.

### 7. Technology Stack

| Layer | Technologies |
|-------|-------------|
| Mobile | React Native, Expo, Expo Router, Expo Audio, TanStack Query, Zustand |
| Backend | NestJS, PostgreSQL, Drizzle ORM, JWT auth |
| Recommender | Python, pandas, scikit-learn, numpy |
| Dev / Deploy | GitHub |

---

## Out of Scope

The following items are **not** part of the required first version:

- Hybrid recommender as a mandatory component
- Mood-based recommendations
- "Reason for recommendation" explanations
- `recommendations_log` table
- `experiments` table in the database
- Audio feature extraction from the raw audio signal
- Online reranking
- Advanced UI polish beyond basic functional level

---

## Relevance Definition

A song is considered **relevant** for a user if:

- The user gives it a **like**
- Or the user listens to a **sufficiently large portion** of the preview

Relevance in the experimental section of the thesis will be based on a combination of `like` and `long listen` interactions.

---

## Key Deliverables

The project should deliver:

1. A functional mobile application
2. A backend service supporting authentication, songs, interactions, and recommendations
3. At least three implemented recommendation approaches
4. Evaluation and comparison of the algorithms
5. A documented system serving as the foundation for the master's thesis

---

## MVP Boundary

The minimum viable version of the project is considered complete when:

- [ ] User can register and log in
- [ ] User can select favorite genres (onboarding)
- [ ] User can browse and search songs
- [ ] User can play a song preview
- [ ] User can like / dislike / skip
- [ ] User can view favorites and history
- [ ] User can receive recommendations from at least one algorithm
- [ ] Basic evaluation of recommendation results exists

---

## Note

The hybrid recommender and additional extensions remain an optional part of the project and will only be implemented if the core scope is completed and stable on time.
