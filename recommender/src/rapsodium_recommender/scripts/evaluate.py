"""Evaluate and compare the recommendation algorithms (leave-one-out).

Holds out one positive song per user, trains each algorithm on the rest, and
reports Precision@K, Recall@K, and Hit Rate@K. Prints a table and can write the
results to CSV and a comparison bar chart.

Usage::

    poetry run evaluate                            # K=10, all algorithms, table only
    poetry run evaluate --k 10 --csv results.csv
    poetry run evaluate --algorithms popularity,content
    poetry run evaluate --positive-events save,play
    poetry run evaluate --csv results.csv --chart results.png
"""

from __future__ import annotations

import argparse

import pandas as pd

from ..data import load_interactions_df, load_songs_df
from ..evaluation import EvalResult, evaluate_all
from ..evaluation.runner import DEFAULT_ALGORITHMS


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Leave-one-out evaluation of the recommendation algorithms."
    )
    parser.add_argument(
        "--k", type=int, default=10, help="Top-N cutoff for metrics (default 10)."
    )
    parser.add_argument(
        "--algorithms",
        type=str,
        default=",".join(DEFAULT_ALGORITHMS),
        help="Comma-separated algorithms to evaluate (default: all baselines).",
    )
    parser.add_argument(
        "--positive-events",
        type=str,
        default="save",
        help="Event types that count as a relevant held-out item (default: save).",
    )
    parser.add_argument(
        "--csv", type=str, default=None, help="Optional path to write results as CSV."
    )
    parser.add_argument(
        "--chart",
        type=str,
        default=None,
        help="Optional path to write a comparison bar chart (PNG; needs matplotlib).",
    )
    return parser.parse_args(argv)


def _results_frame(results: list[EvalResult]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "algorithm": r.algorithm,
                "k": r.k,
                "precision": r.precision,
                "recall": r.recall,
                "hit_rate": r.hit_rate,
                "users_evaluated": r.users_evaluated,
                "users_with_recs": r.users_with_recs,
            }
            for r in results
        ]
    )


def render_table(results: list[EvalResult], k: int) -> str:
    """Format results as a fixed-width text table."""
    if not results:
        return "(no results — no users had a held-out positive interaction)"

    header = (
        f"{'algorithm':<14}  {f'P@{k}':>8}  {f'R@{k}':>8}  "
        f"{f'HR@{k}':>8}  {'users':>6}  {'covered':>7}"
    )
    lines = [header, "-" * len(header)]
    for r in results:
        lines.append(
            f"{r.algorithm:<14}  {r.precision:>8.4f}  {r.recall:>8.4f}  "
            f"{r.hit_rate:>8.4f}  {r.users_evaluated:>6}  {r.users_with_recs:>7}"
        )
    return "\n".join(lines)


def write_chart(results: list[EvalResult], k: int, path: str) -> None:
    """Write a grouped bar chart comparing the metrics per algorithm."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise SystemExit(
            "matplotlib is required for --chart. "
            "Install it with `poetry add --group dev matplotlib`."
        ) from exc

    algorithms = [r.algorithm for r in results]
    metrics = {
        f"Precision@{k}": [r.precision for r in results],
        f"Recall@{k}": [r.recall for r in results],
        f"Hit Rate@{k}": [r.hit_rate for r in results],
    }

    x = range(len(algorithms))
    width = 0.25
    fig, ax = plt.subplots(figsize=(8, 5))
    for offset, (label, values) in enumerate(metrics.items()):
        ax.bar([i + offset * width for i in x], values, width, label=label)

    ax.set_xticks([i + width for i in x])
    ax.set_xticklabels(algorithms)
    ax.set_ylabel("score")
    ax.set_title(f"Recommendation algorithm comparison (leave-one-out, K={k})")
    ax.legend()
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)

    algorithms = tuple(a.strip() for a in args.algorithms.split(",") if a.strip())
    positive_events = frozenset(
        e.strip() for e in args.positive_events.split(",") if e.strip()
    )

    interactions = load_interactions_df()
    songs = load_songs_df()

    results = evaluate_all(
        interactions,
        songs,
        k=args.k,
        algorithms=algorithms,
        positive_events=positive_events,
    )

    print(
        f"Leave-one-out evaluation — K={args.k}, "
        f"positives={sorted(positive_events)}"
    )
    print(f"Catalogue: {len(songs)} songs, {len(interactions)} interactions")
    print()
    print(render_table(results, args.k))

    if args.csv:
        _results_frame(results).to_csv(args.csv, index=False)
        print(f"\nWrote CSV -> {args.csv}")

    if args.chart:
        write_chart(results, args.k, args.chart)
        print(f"Wrote chart -> {args.chart}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
