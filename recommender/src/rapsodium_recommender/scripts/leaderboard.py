"""Print the current recommender leaderboard for a given algorithm.

Useful for validating that the mobile feed matches what the algorithm actually
ranks, and as a demo artifact for the thesis defense.

Usage::

    poetry run leaderboard                                      # popularity, top 20
    poetry run leaderboard --algorithm content --user-id <uuid>
    poetry run leaderboard --algorithm collaborative --user-id <uuid>
    poetry run leaderboard --algorithm popularity --genres Rock
    poetry run leaderboard --genres "Rock,Pop"
    poetry run leaderboard --user-id <uuid>    # exclude that user's seen songs
"""

from __future__ import annotations

import argparse
from uuid import UUID

import pandas as pd

from ..algorithms import (
    CollaborativeRecommender,
    ContentBasedRecommender,
    PopularityRecommender,
    ScoredSong,
)
from ..data import load_interactions_df, load_songs_df

ALGORITHM_CHOICES = ("popularity", "content", "collaborative")


def _truncate(value: str, width: int) -> str:
    return value if len(value) <= width else value[: width - 1] + "…"


def _render_table(rows: pd.DataFrame) -> str:
    if rows.empty:
        return "(no results)"

    widths = {"rank": 4, "score": 7, "title": 32, "artist": 24, "genre": 14}
    header = (
        f"{'#':>{widths['rank']}}  "
        f"{'score':>{widths['score']}}  "
        f"{'title':<{widths['title']}}  "
        f"{'artist':<{widths['artist']}}  "
        f"{'genre':<{widths['genre']}}"
    )
    separator = "-" * len(header)

    lines = [header, separator]
    for _, row in rows.iterrows():
        lines.append(
            f"{int(row['rank']):>{widths['rank']}}  "
            f"{row['score']:>{widths['score']}.3f}  "
            f"{_truncate(str(row['title']), widths['title']):<{widths['title']}}  "
            f"{_truncate(str(row['artist']), widths['artist']):<{widths['artist']}}  "
            f"{_truncate(str(row['genre']), widths['genre']):<{widths['genre']}}"
        )
    return "\n".join(lines)


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Print a recommender leaderboard.")
    parser.add_argument(
        "--algorithm",
        choices=ALGORITHM_CHOICES,
        default="popularity",
        help="Which algorithm to run (default: popularity).",
    )
    parser.add_argument("--limit", type=int, default=20, help="Top-N to show (default 20).")
    parser.add_argument(
        "--genres",
        type=str,
        default=None,
        help="Restrict to songs in any of these genres (comma-separated).",
    )
    parser.add_argument(
        "--user-id",
        type=str,
        default=None,
        help="User id (required for content / collaborative).",
    )
    return parser.parse_args(argv)


def _run_algorithm(
    algorithm: str,
    *,
    user_id: UUID | None,
    genres: list[str] | None,
    limit: int,
    interactions: pd.DataFrame,
    songs: pd.DataFrame,
) -> list[ScoredSong]:
    if algorithm == "popularity":
        return PopularityRecommender(interactions=interactions, songs=songs).recommend(
            user_id=user_id, genres=genres, limit=limit
        )

    if user_id is None:
        raise SystemExit(f"--user-id is required for algorithm={algorithm!r}")

    if algorithm == "content":
        return ContentBasedRecommender(songs=songs, interactions=interactions).recommend(
            user_id=user_id, genres=genres, limit=limit
        )

    if algorithm == "collaborative":
        return CollaborativeRecommender(interactions=interactions, songs=songs).recommend(
            user_id=user_id, genres=genres, limit=limit
        )

    raise SystemExit(f"unknown algorithm: {algorithm!r}")


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    interactions = load_interactions_df()
    songs = load_songs_df()

    user_id = UUID(args.user_id) if args.user_id else None
    genres = [g.strip() for g in args.genres.split(",") if g.strip()] if args.genres else None

    scored = _run_algorithm(
        args.algorithm,
        user_id=user_id,
        genres=genres,
        limit=args.limit,
        interactions=interactions,
        songs=songs,
    )

    scored_df = pd.DataFrame([{"song_id": item.song_id, "score": item.score} for item in scored])

    if scored_df.empty:
        print("(no results)")
        return 0

    catalogue = songs[["id", "title", "artist", "genre"]].rename(columns={"id": "song_id"})
    table = scored_df.merge(catalogue, on="song_id", how="left")
    table.insert(0, "rank", range(1, len(table) + 1))

    filter_parts = [f"algorithm={args.algorithm}"]
    if genres:
        filter_parts.append(f"genres={', '.join(genres)}")
    if args.user_id:
        filter_parts.append(f"user={args.user_id}")
    suffix = f" ({'; '.join(filter_parts)})"

    print(f"Leaderboard — top {len(table)}{suffix}")
    print(f"Catalogue: {len(songs)} songs, {len(interactions)} interactions")
    print()
    print(_render_table(table))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
