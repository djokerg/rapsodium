"""Print the current popularity leaderboard.

Useful for validating that the mobile "For you" feed matches what the
algorithm actually ranks, and as a demo artifact for the thesis defense.

Usage::

    poetry run leaderboard                     # top 20 overall
    poetry run leaderboard --limit 10
    poetry run leaderboard --genres Rock
    poetry run leaderboard --genres "Rock,Pop"
    poetry run leaderboard --user-id <uuid>    # exclude that user's seen songs
"""

from __future__ import annotations

import argparse
from uuid import UUID

import pandas as pd

from ..algorithms import PopularityRecommender
from ..data import load_interactions_df, load_songs_df


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
            f"{row['score']:>{widths['score']}.2f}  "
            f"{_truncate(str(row['title']), widths['title']):<{widths['title']}}  "
            f"{_truncate(str(row['artist']), widths['artist']):<{widths['artist']}}  "
            f"{_truncate(str(row['genre']), widths['genre']):<{widths['genre']}}"
        )
    return "\n".join(lines)


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Print the popularity-based leaderboard.")
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
        help="Exclude songs the given user has already interacted with.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    interactions = load_interactions_df()
    songs = load_songs_df()
    recommender = PopularityRecommender(interactions=interactions, songs=songs)

    user_id = UUID(args.user_id) if args.user_id else None
    genres = [g.strip() for g in args.genres.split(",") if g.strip()] if args.genres else None
    scored = recommender.recommend(user_id=user_id, genres=genres, limit=args.limit)

    scored_df = pd.DataFrame([{"song_id": item.song_id, "score": item.score} for item in scored])

    if scored_df.empty:
        print("(no results)")
        return 0

    # Hydrate title/artist/genre from the songs DataFrame; preserve recommender order.
    catalogue = songs[["id", "title", "artist", "genre"]].rename(columns={"id": "song_id"})
    table = scored_df.merge(catalogue, on="song_id", how="left")
    table.insert(0, "rank", range(1, len(table) + 1))

    filter_parts = []
    if genres:
        filter_parts.append(f"genres={', '.join(genres)}")
    if args.user_id:
        filter_parts.append(f"excluding user={args.user_id}")
    suffix = f" ({'; '.join(filter_parts)})" if filter_parts else ""

    print(f"Popularity leaderboard — top {len(table)}{suffix}")
    print(f"Scoring: 3*save + 1*play - 1*skip  ({len(interactions)} interactions seen)")
    print()
    print(_render_table(table))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
