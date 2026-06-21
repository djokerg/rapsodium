import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  sql,
  sum,
} from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { interactions, songs } from '../database/schema.js';
import type { SongSummary } from '../songs/songs.types.js';
import type {
  ArtistCount,
  GenreCount,
  ListeningInsights,
  SongCount,
} from './insights.types.js';
import {
  computeTasteShift,
  fillHourBuckets,
  fillWeekdayBuckets,
  withGenreShares,
} from './insights.util.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TOP_LIMIT = 5;
const TOP_GENRE_LIMIT = 6;
const SECONDS_PER_MINUTE = 60;

const songSummaryColumns = {
  id: songs.id,
  title: songs.title,
  artist: songs.artist,
  album: songs.album,
  genre: songs.genre,
  durationSec: songs.durationSec,
  coverUrl: songs.coverUrl,
} as const;

@Injectable()
export class InsightsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async getInsights(userId: string, days: number): Promise<ListeningInsights> {
    const now = Date.now();
    const since = new Date(now - days * MS_PER_DAY);
    // Midpoint of the window: plays after this are "recent", before are "previous".
    const midpoint = new Date(now - (days / 2) * MS_PER_DAY);

    // All listening stats are derived from `play` events within the window.
    const plays = and(
      eq(interactions.userId, userId),
      eq(interactions.eventType, 'play'),
      gte(interactions.createdAt, since),
    );
    const saves = and(
      eq(interactions.userId, userId),
      eq(interactions.eventType, 'save'),
      gte(interactions.createdAt, since),
    );

    const playCount = count();
    const hourExpr = sql<number>`extract(hour from ${interactions.createdAt})`;
    const weekdayExpr = sql<number>`extract(dow from ${interactions.createdAt})`;

    const [
      totalsRow,
      artistRows,
      saveRows,
      topArtistRows,
      topSongRows,
      genreRows,
      hourRows,
      weekdayRows,
      shiftRows,
    ] = await Promise.all([
      this.db
        .select({
          plays: count(),
          uniqueSongs: countDistinct(interactions.songId),
          listenedSeconds: sum(interactions.listenedSeconds),
        })
        .from(interactions)
        .where(plays),

      this.db
        .select({ uniqueArtists: countDistinct(songs.artist) })
        .from(interactions)
        .innerJoin(songs, eq(interactions.songId, songs.id))
        .where(plays),

      this.db.select({ saves: count() }).from(interactions).where(saves),

      this.db
        .select({ artist: songs.artist, plays: playCount })
        .from(interactions)
        .innerJoin(songs, eq(interactions.songId, songs.id))
        .where(plays)
        .groupBy(songs.artist)
        .orderBy(desc(playCount), songs.artist)
        .limit(TOP_LIMIT),

      this.db
        .select({ ...songSummaryColumns, plays: playCount })
        .from(interactions)
        .innerJoin(songs, eq(interactions.songId, songs.id))
        .where(plays)
        .groupBy(songs.id)
        .orderBy(desc(playCount), songs.title)
        .limit(TOP_LIMIT),

      this.db
        .select({ genre: songs.genre, plays: playCount })
        .from(interactions)
        .innerJoin(songs, eq(interactions.songId, songs.id))
        .where(plays)
        .groupBy(songs.genre)
        .orderBy(desc(playCount), songs.genre)
        .limit(TOP_GENRE_LIMIT),

      this.db
        .select({ hour: sql<number>`${hourExpr}::int`, plays: playCount })
        .from(interactions)
        .where(plays)
        .groupBy(hourExpr),

      this.db
        .select({ weekday: sql<number>`${weekdayExpr}::int`, plays: playCount })
        .from(interactions)
        .where(plays)
        .groupBy(weekdayExpr),

      this.db
        .select({
          genre: songs.genre,
          recent: sql<number>`count(*) filter (where ${interactions.createdAt} >= ${midpoint})::int`,
          previous: sql<number>`count(*) filter (where ${interactions.createdAt} < ${midpoint})::int`,
        })
        .from(interactions)
        .innerJoin(songs, eq(interactions.songId, songs.id))
        .where(plays)
        .groupBy(songs.genre),
    ]);

    const totalPlays = Number(totalsRow[0]?.plays ?? 0);
    const listenedSeconds = Number(totalsRow[0]?.listenedSeconds ?? 0);

    const topArtists: ArtistCount[] = artistRowsToCounts(topArtistRows);
    const topSongs: SongCount[] = topSongRows.map((row) => ({
      song: toSongSummary(row),
      plays: Number(row.plays),
    }));
    const topGenres: GenreCount[] = withGenreShares(
      genreRows.map((r) => ({ genre: r.genre, plays: Number(r.plays) })),
      totalPlays,
    );

    return {
      range: { days, since: since.toISOString() },
      totals: {
        plays: totalPlays,
        uniqueSongs: Number(totalsRow[0]?.uniqueSongs ?? 0),
        uniqueArtists: Number(artistRows[0]?.uniqueArtists ?? 0),
        saves: Number(saveRows[0]?.saves ?? 0),
        listeningMinutes: Math.round(listenedSeconds / SECONDS_PER_MINUTE),
      },
      topArtists,
      topSongs,
      topGenres,
      byHour: fillHourBuckets(
        hourRows.map((r) => ({ hour: r.hour, plays: Number(r.plays) })),
      ),
      byWeekday: fillWeekdayBuckets(
        weekdayRows.map((r) => ({
          weekday: r.weekday,
          plays: Number(r.plays),
        })),
      ),
      tasteShift: computeTasteShift(
        shiftRows.map((r) => ({
          genre: r.genre,
          recent: Number(r.recent),
          previous: Number(r.previous),
        })),
      ),
    };
  }
}

function artistRowsToCounts(
  rows: readonly { artist: string; plays: number | string }[],
): ArtistCount[] {
  return rows.map((row) => ({ artist: row.artist, plays: Number(row.plays) }));
}

function toSongSummary(row: {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string;
  durationSec: number;
  coverUrl: string | null;
}): SongSummary {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    durationSec: row.durationSec,
    coverUrl: row.coverUrl,
  };
}
