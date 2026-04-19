import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ScoredSong {
  readonly songId: string;
  readonly score: number;
}

export interface PopularityParams {
  readonly userId?: string;
  readonly genres?: readonly string[];
  readonly limit: number;
}

interface PopularityResponseBody {
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

  async popularity(params: PopularityParams): Promise<ScoredSong[]> {
    const body = await this.post<PopularityResponseBody>(
      '/recommend/popularity',
      {
        user_id: params.userId,
        genres: params.genres,
        limit: params.limit,
      },
    );

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
