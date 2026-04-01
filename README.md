# Rapsodium

A mobile application for music recommendation with a React Native client, NestJS backend, and Python-based recommendation engine. Built as a practical foundation for a master's thesis, with a focus on implementing and comparing multiple recommendation systems.

---

## Tech Stack

### Mobile
- React Native
- Expo
- Expo Router
- Expo Audio
- TanStack Query
- Zustand

### Backend
- NestJS
- PostgreSQL
- Drizzle ORM
- JWT Auth
- Swagger

### Recommender
- Python
- pandas
- scikit-learn
- numpy

---

## Architecture

```
┌─────────────────────────────┐
│   Mobile App (React Native) │
└─────────────┬───────────────┘
              │ REST API
              v
┌─────────────────────────────┐
│      NestJS Backend API     │
└──────┬──────────────┬───────┘
       │              │
       v              v
┌────────────┐  ┌─────────────────┐
│ PostgreSQL │  │ Python           │
│            │  │ Recommender      │
└────────────┘  └─────────────────┘
```

The mobile app communicates with the NestJS backend over REST. The backend handles authentication, song management, and interaction recording. For recommendations, the backend calls the Python recommender service which runs the actual algorithms.

---

## Project Structure

```
rapsodium/
├── backend/          # NestJS API server
├── mobile/           # React Native / Expo app
├── recommender/      # Python recommendation engine
└── docs/             # Project documentation
    ├── scope.md          # Project scope and MVP definition
    ├── database-design.md # Database schema and design decisions
    ├── architecture.md    # System architecture details
    └── roadmap.md         # Development phases and task tracking
```

---

## Getting Started

### Prerequisites

- Node.js (v20+)
- PostgreSQL (v15+)
- Python (v3.10+)
- Expo CLI (`npm install -g expo-cli`)

### Backend

```bash
cd backend
npm install
# Configure .env with database credentials
npm run start:dev
```

The API will be available at `http://localhost:3000`. Swagger docs at `http://localhost:3000/api`.

### Mobile

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go or press `a` for Android emulator / `i` for iOS simulator.

### Recommender

```bash
cd recommender
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Scope](docs/scope.md) | Project scope, MVP definition, and deliverables |
| [Database Design](docs/database-design.md) | Schema specification with types and constraints |
| [Architecture](docs/architecture.md) | System design, module structure, and data flow |
| [Roadmap](docs/roadmap.md) | Development phases and progress tracking |

---

## Recommendation Algorithms

The project implements and compares three approaches:

1. **Popularity-based** — recommends globally popular songs
2. **Content-based** — recommends songs similar to what you've liked
3. **Collaborative filtering** — recommends songs based on similar users' tastes

Evaluation uses Precision@10, Recall@10, and Hit Rate@10 metrics with a train/test split on interaction data.

---

## License

This project is developed as part of a master's thesis and is not intended for commercial use.
