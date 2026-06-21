import type {
  GenreCount,
  GenreTrend,
  HourBucket,
  TasteShift,
  WeekdayBucket,
} from './insights.types.js';

export const HOURS_IN_DAY = 24;
export const DAYS_IN_WEEK = 7;

/**
 * Expand sparse `{ hour, plays }` rows into a dense 0–23 series so the client can
 * render a full-day chart without gap handling.
 */
export function fillHourBuckets(
  rows: readonly { hour: number; plays: number }[],
): HourBucket[] {
  const counts = new Map(rows.map((r) => [r.hour, r.plays]));
  return Array.from({ length: HOURS_IN_DAY }, (_, hour) => ({
    hour,
    plays: counts.get(hour) ?? 0,
  }));
}

/**
 * Expand sparse `{ weekday, plays }` rows into a dense 0–6 series
 * (0 = Sunday … 6 = Saturday).
 */
export function fillWeekdayBuckets(
  rows: readonly { weekday: number; plays: number }[],
): WeekdayBucket[] {
  const counts = new Map(rows.map((r) => [r.weekday, r.plays]));
  return Array.from({ length: DAYS_IN_WEEK }, (_, weekday) => ({
    weekday,
    plays: counts.get(weekday) ?? 0,
  }));
}

/** Attach each genre's share of total plays (0–1). */
export function withGenreShares(
  rows: readonly { genre: string; plays: number }[],
  totalPlays: number,
): GenreCount[] {
  return rows.map((row) => ({
    genre: row.genre,
    plays: row.plays,
    share: totalPlays > 0 ? row.plays / totalPlays : 0,
  }));
}

/**
 * Turn per-genre recent/previous play counts into the biggest rising and falling
 * genres. Genres with no plays in either half are dropped, and ties break
 * alphabetically so the output is deterministic.
 */
export function computeTasteShift(
  rows: readonly { genre: string; recent: number; previous: number }[],
  limit = 3,
): TasteShift {
  const trends: GenreTrend[] = rows
    .filter((r) => r.recent > 0 || r.previous > 0)
    .map((r) => ({
      genre: r.genre,
      recent: r.recent,
      previous: r.previous,
      delta: r.recent - r.previous,
    }));

  const rising = trends
    .filter((t) => t.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.genre.localeCompare(b.genre))
    .slice(0, limit);

  const falling = trends
    .filter((t) => t.delta < 0)
    .sort((a, b) => a.delta - b.delta || a.genre.localeCompare(b.genre))
    .slice(0, limit);

  return { rising, falling };
}
