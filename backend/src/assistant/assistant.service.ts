import { Inject, Injectable, Logger } from '@nestjs/common';
import { ilike, inArray, or } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';
import { songs } from '../database/schema.js';
import { RecommenderClient } from '../recommendations/recommender.client.js';
import type { SongSummary } from '../songs/songs.types.js';
import { formatUnavailableArtistsNote } from './artist-availability.js';
import { LlmService } from './llm.service.js';
import type { VibeProfile } from './types.js';
import {
  clampProfile,
  mergeVibeProfile,
  normalizeProfile,
} from './vibe-merge.js';

export interface AssistantReply {
  /** Natural-language reply to show as a chat bubble. */
  reply: string;
  /** The updated VibeProfile — the client stores this for the next turn. */
  context: VibeProfile;
  /** Recommendations for the merged context (live recommendation strip). */
  songs: SongSummary[];
}

interface HandleParams {
  userId: string;
  text: string;
  context?: Partial<VibeProfile>;
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
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly llm: LlmService,
    private readonly recommender: RecommenderClient,
  ) {}

  async handleMessage(params: HandleParams): Promise<AssistantReply> {
    const current = normalizeProfile(params.context);

    // 1. NL -> reply + patch. Degrade gracefully: on any LLM failure, keep the
    //    received context unchanged and apologize rather than failing the turn.
    let reply: string;
    let context: VibeProfile;
    try {
      const turn = await this.llm.extract(current, params.text, (name, args) =>
        this.executeTool(name, args),
      );
      reply = turn.assistantReply;
      context = clampProfile(mergeVibeProfile(current, turn.patch));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`LLM extraction failed: ${message}`);
      reply = "Sorry, I can't process that right now. Please try again.";
      context = current;
    }

    // 2. Catalog-aware artist resolution: keep only artists we actually have
    //    (canonical spelling). Unknown play-requests get an availability note;
    //    unknown seed artists are dropped silently (the vibe fallback covers them).
    if (context.artists.length > 0 || context.seedArtists.length > 0) {
      const [play, seed] = await Promise.all([
        this.resolveArtists(context.artists),
        this.resolveArtists(context.seedArtists),
      ]);
      context = { ...context, artists: play.known, seedArtists: seed.known };
      const note = formatUnavailableArtistsNote(play.unknown);
      if (note) reply = `${reply}\n\n${note}`;
    }

    // 3. Apply the merged context to the recommender.
    const scored = await this.recommender.contextual({
      userId: params.userId,
      profile: context,
      limit: params.limit,
    });

    return {
      reply,
      context,
      songs: await this.hydrate(scored.map((s) => s.songId)),
    };
  }

  /**
   * Split requested artists into those present in the catalogue (returned with
   * the catalogue's canonical spelling) and those that are not. Case-insensitive.
   */
  private async resolveArtists(
    requested: string[],
  ): Promise<{ known: string[]; unknown: string[] }> {
    const rows = await this.db
      .selectDistinct({ artist: songs.artist })
      .from(songs);
    const canonicalByLower = new Map(
      rows.map((row) => [row.artist.toLowerCase(), row.artist]),
    );

    const known = new Set<string>();
    const unknown: string[] = [];
    for (const name of requested) {
      const canonical = canonicalByLower.get(name.trim().toLowerCase());
      if (canonical) known.add(canonical);
      else unknown.push(name);
    }
    return { known: [...known], unknown };
  }

  /** Dispatch a tool call the LLM made (see LlmService.extract). */
  private async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (name === 'search_catalog') {
      const query = typeof args.query === 'string' ? args.query : '';
      return this.searchCatalog(query);
    }
    return { error: `unknown tool: ${name}` };
  }

  /**
   * Substring search over the catalogue by artist / title / genre. Returns the
   * distinct artists and genres found (so the model can pick real values) plus a
   * few sample matches.
   */
  private async searchCatalog(query: string): Promise<{
    query: string;
    artists: string[];
    genres: string[];
    matches: { title: string; artist: string; genre: string }[];
  }> {
    const q = query.trim();
    if (!q) return { query: q, artists: [], genres: [], matches: [] };

    const pattern = `%${q}%`;
    const rows = await this.db
      .select({ title: songs.title, artist: songs.artist, genre: songs.genre })
      .from(songs)
      .where(
        or(
          ilike(songs.artist, pattern),
          ilike(songs.title, pattern),
          ilike(songs.genre, pattern),
        ),
      )
      .limit(15);

    return {
      query: q,
      artists: [...new Set(rows.map((r) => r.artist))],
      genres: [...new Set(rows.map((r) => r.genre))],
      matches: rows.slice(0, 10),
    };
  }

  /** Resolve song IDs to summaries, preserving the recommender's order. */
  private async hydrate(songIds: string[]): Promise<SongSummary[]> {
    if (songIds.length === 0) return [];

    const rows = await this.db
      .select(summaryColumns)
      .from(songs)
      .where(inArray(songs.id, songIds));

    const byId = new Map<string, SongSummary>(rows.map((row) => [row.id, row]));
    return songIds
      .map((id) => byId.get(id))
      .filter((row): row is SongSummary => row !== undefined);
  }
}
