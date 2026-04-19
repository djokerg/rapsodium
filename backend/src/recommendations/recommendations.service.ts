import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { songs } from '../database/schema.js';
import type { SongSummary } from '../songs/songs.types.js';
import { RecommenderClient, type ScoredSong } from './recommender.client.js';
import type { Algorithm } from './recommendations.schemas.js';

export interface RecommendationResult {
  algorithm: Algorithm;
  data: SongSummary[];
}

interface RecommendParams {
  userId: string;
  algorithm: Algorithm;
  genre?: string;
  limit: number;
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
export class RecommendationsService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly recommender: RecommenderClient,
  ) {}

  async recommend(params: RecommendParams): Promise<RecommendationResult> {
    const scored = await this.callAlgorithm(params);

    if (scored.length === 0) {
      return { algorithm: params.algorithm, data: [] };
    }

    const songIds = scored.map((item) => item.songId);
    const rows = await this.db
      .select(summaryColumns)
      .from(songs)
      .where(inArray(songs.id, songIds));

    const byId = new Map<string, SongSummary>(rows.map((row) => [row.id, row]));

    // Preserve the recommender's order; drop IDs the DB could not resolve
    // (e.g. a song deleted after the Python service snapshotted the catalogue).
    const data = scored
      .map((item) => byId.get(item.songId))
      .filter((row): row is SongSummary => row !== undefined);

    return { algorithm: params.algorithm, data };
  }

  private callAlgorithm(params: RecommendParams): Promise<ScoredSong[]> {
    switch (params.algorithm) {
      case 'popularity':
        return this.recommender.popularity({
          userId: params.userId,
          genre: params.genre,
          limit: params.limit,
        });
    }
  }
}
