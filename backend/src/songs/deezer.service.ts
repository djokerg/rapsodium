import { Injectable, Logger } from '@nestjs/common';

interface DeezerTrackResponse {
  preview?: string;
  error?: { code: number; message: string };
}

interface CacheEntry {
  readonly previewUrl: string;
  readonly expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class DeezerService {
  private readonly logger = new Logger(DeezerService.name);
  private readonly cache = new Map<number, CacheEntry>();

  async getFreshPreviewUrl(deezerId: number): Promise<string | null> {
    const cached = this.cache.get(deezerId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.previewUrl;
    }

    try {
      const response = await fetch(`https://api.deezer.com/track/${deezerId}`);

      if (!response.ok) {
        this.logger.warn(
          `Deezer API returned ${response.status} for track ${deezerId}`,
        );
        return null;
      }

      const data = (await response.json()) as DeezerTrackResponse;

      if (data.error || !data.preview) {
        return null;
      }

      this.cache.set(deezerId, {
        previewUrl: data.preview,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return data.preview;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Deezer track ${deezerId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
