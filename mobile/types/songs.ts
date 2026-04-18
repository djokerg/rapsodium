export interface SongSummary {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string;
  durationSec: number;
  coverUrl: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
