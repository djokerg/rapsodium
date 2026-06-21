import type { SongSummary } from '../songs/songs.types.js';

/** The time window the insights were computed over. */
export interface InsightsRange {
  /** Size of the window in days. */
  days: number;
  /** ISO timestamp of the window's lower bound. */
  since: string;
}

/** Headline counters for the window. */
export interface InsightsTotals {
  plays: number;
  uniqueSongs: number;
  uniqueArtists: number;
  saves: number;
  /** Total listening time in minutes (rounded), from reported `listenedSeconds`. */
  listeningMinutes: number;
}

export interface ArtistCount {
  artist: string;
  plays: number;
}

export interface SongCount {
  song: SongSummary;
  plays: number;
}

export interface GenreCount {
  genre: string;
  plays: number;
  /** Fraction of total plays in the window (0–1). */
  share: number;
}

/** Plays bucketed by hour of day (0–23). */
export interface HourBucket {
  hour: number;
  plays: number;
}

/** Plays bucketed by weekday (0 = Sunday … 6 = Saturday). */
export interface WeekdayBucket {
  weekday: number;
  plays: number;
}

/** How much a genre's play count moved between the two halves of the window. */
export interface GenreTrend {
  genre: string;
  recent: number;
  previous: number;
  /** `recent - previous`; positive means the genre is rising. */
  delta: number;
}

export interface TasteShift {
  rising: GenreTrend[];
  falling: GenreTrend[];
}

/** Full listening-insights overview for a user over a time window. */
export interface ListeningInsights {
  range: InsightsRange;
  totals: InsightsTotals;
  topArtists: ArtistCount[];
  topSongs: SongCount[];
  topGenres: GenreCount[];
  byHour: HourBucket[];
  byWeekday: WeekdayBucket[];
  tasteShift: TasteShift;
}
