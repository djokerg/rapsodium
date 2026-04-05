import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, ilike, or, count } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { songs } from '../database/schema.js';
import type { SongSummary, SongDetail, PaginatedResult } from './songs.types.js';

export type { SongSummary, SongDetail, PaginatedResult };

function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

const summaryColumns = {
  id: songs.id,
  title: songs.title,
  artist: songs.artist,
  album: songs.album,
  genre: songs.genre,
  durationSec: songs.durationSec,
  coverUrl: songs.coverUrl,
} as const;

@Injectable()
export class SongsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async list(page: number, limit: number): Promise<PaginatedResult<SongSummary>> {
    const offset = (page - 1) * limit;

    const [data, totalRows] = await Promise.all([
      this.db
        .select(summaryColumns)
        .from(songs)
        .orderBy(asc(songs.title))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(songs),
    ]);

    const total = totalRows[0]?.total ?? 0;

    return { data, meta: { page, limit, total } };
  }

  async search(q: string, page: number, limit: number): Promise<PaginatedResult<SongSummary>> {
    const offset = (page - 1) * limit;
    const pattern = `%${escapeLikePattern(q)}%`;

    const where = or(
      ilike(songs.title, pattern),
      ilike(songs.artist, pattern),
      ilike(songs.genre, pattern),
    );

    const [data, totalRows] = await Promise.all([
      this.db
        .select(summaryColumns)
        .from(songs)
        .where(where)
        .orderBy(asc(songs.title))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(songs)
        .where(where),
    ]);

    const total = totalRows[0]?.total ?? 0;

    return { data, meta: { page, limit, total } };
  }

  async getById(id: string): Promise<SongDetail> {
    const [song] = await this.db
      .select({
        ...summaryColumns,
        previewUrl: songs.previewUrl,
      })
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);

    if (!song) {
      throw new NotFoundException('Song not found');
    }

    return song;
  }
}
