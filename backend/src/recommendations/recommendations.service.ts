import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { songs, userPreferences } from '../database/schema.js';
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

  private async callAlgorithm(params: RecommendParams): Promise<ScoredSong[]> {
    const genres = await this.getUserGenres(params.userId);
    const genreFilter = genres.length > 0 ? genres : undefined;

    switch (params.algorithm) {
      case 'popularity':
        return this.recommender.popularity({
          userId: params.userId,
          genres: genreFilter,
          limit: params.limit,
        });
      case 'content':
        return this.recommender.content({
          userId: params.userId,
          genres: genreFilter,
          limit: params.limit,
        });
      case 'collaborative':
        return this.recommender.collaborative({
          userId: params.userId,
          genres: genreFilter,
          limit: params.limit,
        });
    }
  }

  private async getUserGenres(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ genre: userPreferences.genre })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return rows.map((row) => row.genre);
  }
}
