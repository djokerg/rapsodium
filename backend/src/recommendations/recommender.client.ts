import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VibeProfile } from '../assistant/types.js';

export interface ScoredSong {
  readonly songId: string;
  readonly score: number;
}

export interface PopularityParams {
  readonly userId?: string;
  readonly genres?: readonly string[];
  readonly limit: number;
}

export interface PersonalizedParams {
  readonly userId: string;
  readonly genres?: readonly string[];
  readonly limit: number;
}

export interface ContextualParams {
  readonly userId: string;
  readonly profile: VibeProfile;
  readonly limit: number;
}

interface RecommendResponseBody {
  algorithm: string;
  recommendations: Array<{
    song_id: string;
    score: number;
  }>;
}

const DEFAULT_TIMEOUT_MS = 5000;

@Injectable()
export class RecommenderClient {
  private readonly logger = new Logger(RecommenderClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl =
      config.get<string>('RECOMMENDER_URL') ?? 'http://localhost:8000';
  }

  popularity(params: PopularityParams): Promise<ScoredSong[]> {
    return this.call('/recommend/popularity', {
      user_id: params.userId,
      genres: params.genres,
      limit: params.limit,
    });
  }

  content(params: PersonalizedParams): Promise<ScoredSong[]> {
    return this.call('/recommend/content', {
      user_id: params.userId,
      genres: params.genres,
      limit: params.limit,
    });
  }

  collaborative(params: PersonalizedParams): Promise<ScoredSong[]> {
    return this.call('/recommend/collaborative', {
      user_id: params.userId,
      genres: params.genres,
      limit: params.limit,
    });
  }

  /** Vibe-driven recommendations from a conversational VibeProfile. */
  contextual(params: ContextualParams): Promise<ScoredSong[]> {
    const p = params.profile;
    return this.call('/recommend/contextual', {
      user_id: params.userId,
      feature_targets: p.featureTargets,
      genre_boosts: p.genreBoosts,
      artists: p.artists,
      seed_artists: p.seedArtists,
      excluded_artists: p.excludedArtists,
      excluded_genres: p.excludedGenres,
      mainstream: p.mainstream,
      base_algorithm: p.baseAlgorithm,
      limit: params.limit,
    });
  }

  private async call(path: string, payload: unknown): Promise<ScoredSong[]> {
    const body = await this.post<RecommendResponseBody>(path, payload);
    return body.recommendations.map((item) => ({
      songId: item.song_id,
      score: item.score,
    }));
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(
          `Recommender ${path} returned ${response.status}: ${text.slice(0, 200)}`,
        );
        throw new ServiceUnavailableException(
          'Recommender service returned an error',
        );
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Recommender ${path} unreachable: ${message}`);
      throw new ServiceUnavailableException('Recommender service unreachable');
    } finally {
      clearTimeout(timeout);
    }
  }
}
