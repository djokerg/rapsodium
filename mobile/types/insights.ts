import type { SongSummary } from './songs';

export interface InsightsRange {
  days: number;
  since: string;
}

export interface InsightsTotals {
  plays: number;
  uniqueSongs: number;
  uniqueArtists: number;
  saves: number;
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
  share: number;
}

export interface HourBucket {
  hour: number;
  plays: number;
}

export interface WeekdayBucket {
  weekday: number;
  plays: number;
}

export interface GenreTrend {
  genre: string;
  recent: number;
  previous: number;
  delta: number;
}

export interface TasteShift {
  rising: GenreTrend[];
  falling: GenreTrend[];
}

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
