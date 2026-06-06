import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { FeatureTargets, VibeProfile } from './types.js';

export interface LlmTurn {
  /** Short, friendly natural-language reply (English) shown as a chat bubble. */
  assistantReply: string;
  /** The merge patch to apply to the current VibeProfile (docs/assistant.md §3). */
  patch: Partial<VibeProfile>;
}

/** Executes a tool the model asked for. Returns a JSON-serializable result. */
export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;

const MAX_TOOL_ROUNDS = 2;

const SYSTEM_PROMPT = `You are Rapsodium's music assistant. The user describes what they're \
doing or the vibe they want. Translate that into a recommendation context for a music \
recommender.

You can call the search_catalog tool to look up what's actually in the music library \
(matches by artist, title, or genre). Use it to:
- check whether a requested artist exists before deciding how to handle the request,
- discover the real genres / similar artists the catalogue actually has, so you set \
genre_boosts and seed_artists to values that exist.
Only call search_catalog when the user names a SPECIFIC artist or genre. For general moods \
or activities (studying, driving, chill, workout) do NOT search — just map the vibe \
directly. Keep tool use minimal.

Output rules:
- Put a short, friendly reply (in English) in "assistant_reply". Keep it about the \
mood/vibe. Do NOT assert whether a specific artist is in the library — the app appends an \
availability note for that.
- Put ONLY the fields the user gave a signal for THIS turn into "context_patch". Leave \
everything else null/empty so prior context is preserved (it is a patch, not a full state).

Mapping guidance (audio features are 0..1, tempo in BPM):
- studying/focus/reading -> energy ~0.2, valence ~0.4, danceability ~0.3, tempo ~80
- relaxing/chill         -> energy ~0.3, valence ~0.5, tempo ~90
- driving                -> energy ~0.7, valence ~0.6, tempo ~120
- workout/gym            -> energy ~0.9, danceability ~0.8, tempo ~140
- party/dancing          -> energy ~0.8, valence ~0.8, danceability ~0.9, tempo ~125, mainstream +0.5
- sad/melancholic        -> energy ~0.3, valence ~0.2, tempo ~75
- "not too mainstream"/underground -> mainstream negative (toward -1)
- "only hits"/popular              -> mainstream positive (toward +1)
- "more <genre>"  -> genre_boosts with weight > 1 (e.g. 1.5)
- "less/no <genre>" -> genre_boosts weight < 1, or add to excluded_genres
- "avoid <artist>" -> add to excluded_artists

Artist handling — pick ONE bucket per artist based on the user's intent:
- DIRECT request ("play <artist>", "some <artist>", "I want <artist>") -> put the artist in \
"artists" (catalogue spelling from search_catalog if found, else the user's spelling). \
ALWAYS include it even if you suspect it's not in the library — the app verifies and adds \
the availability note. ALSO approximate that artist's typical sound with genre_boosts + \
feature_targets so the fallback feels right if they're absent.
- SIMILARITY request ("more like <artist>", "similar to <artist>", "stuff like <artist>", \
"in the style of <artist>") -> put the artist in "seed_artists" ONLY. Do NOT also put it in \
"artists" (the user wants similar music, not that exact artist). Prefer an artist that \
exists in the catalogue, per search_catalog.
- "avoid <artist>" -> excluded_artists.
- Only include artists for THIS turn; do not repeat artists from earlier turns unless asked.

If the user just chats with no music signal, return an empty patch (all null/empty).`;

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_catalog',
      description:
        'Search the music library by artist, title, or genre. Returns matching songs and the distinct artists/genres found. Use to verify availability and discover real catalogue values.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description:
              'Artist, title, or genre to look up (substring match).',
          },
        },
      },
    },
  },
];

const nullableNumber = { type: ['number', 'null'] } as const;
const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['assistant_reply', 'context_patch'],
  properties: {
    assistant_reply: { type: 'string' },
    context_patch: {
      type: 'object',
      additionalProperties: false,
      required: [
        'activity',
        'feature_targets',
        'genre_boosts',
        'artists',
        'seed_artists',
        'excluded_artists',
        'excluded_genres',
        'mainstream',
        'base_algorithm',
      ],
      properties: {
        activity: { type: ['string', 'null'] },
        feature_targets: {
          type: 'object',
          additionalProperties: false,
          required: ['energy', 'valence', 'danceability', 'tempo'],
          properties: {
            energy: nullableNumber,
            valence: nullableNumber,
            danceability: nullableNumber,
            tempo: nullableNumber,
          },
        },
        genre_boosts: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['genre', 'weight'],
            properties: {
              genre: { type: 'string' },
              weight: { type: 'number' },
            },
          },
        },
        artists: { type: 'array', items: { type: 'string' } },
        seed_artists: { type: 'array', items: { type: 'string' } },
        excluded_artists: { type: 'array', items: { type: 'string' } },
        excluded_genres: { type: 'array', items: { type: 'string' } },
        mainstream: nullableNumber,
        base_algorithm: {
          type: ['string', 'null'],
          enum: ['content', 'collaborative', 'popularity', null],
        },
      },
    },
  },
} as const;

interface RawTurn {
  assistant_reply: string;
  context_patch: {
    activity: string | null;
    feature_targets: {
      energy: number | null;
      valence: number | null;
      danceability: number | null;
      tempo: number | null;
    };
    genre_boosts: Array<{ genre: string; weight: number }>;
    artists: string[];
    seed_artists: string[];
    excluded_artists: string[];
    excluded_genres: string[];
    mainstream: number | null;
    base_algorithm: VibeProfile['baseAlgorithm'] | null;
  };
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.client = new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.model = config.get<string>('ASSISTANT_MODEL') ?? 'gpt-4o-mini';
  }

  /**
   * Turn the user's message (+ current context) into an NL reply and a patch.
   * Runs a bounded tool-calling loop so the model can search the catalogue before
   * deciding. The caller merges + clamps the returned patch.
   */
  async extract(
    current: VibeProfile,
    userText: string,
    executeTool: ToolExecutor,
  ): Promise<LlmTurn> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content:
          `Current context (JSON):\n${JSON.stringify(current)}\n\n` +
          `User message:\n${userText}`,
      },
    ];

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      // On the final allowed round, drop tools so the model must answer.
      const useTools = round < MAX_TOOL_ROUNDS;
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: useTools ? TOOLS : undefined,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'vibe_turn',
            schema: RESPONSE_SCHEMA,
            strict: true,
          },
        },
      });

      const message = completion.choices[0].message;
      const toolCalls = message.tool_calls ?? [];
      if (useTools && toolCalls.length > 0) {
        messages.push(message);
        for (const call of toolCalls) {
          const result = await this.runTool(call.function, executeTool);
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      if (!message.content)
        throw new Error('OpenAI returned an empty response');
      const raw = JSON.parse(message.content) as RawTurn;
      return { assistantReply: raw.assistant_reply, patch: toPatch(raw) };
    }

    throw new Error('OpenAI did not produce a final answer');
  }

  private async runTool(
    fn: OpenAI.Chat.Completions.ChatCompletionMessageToolCall.Function,
    executeTool: ToolExecutor,
  ): Promise<unknown> {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(fn.arguments || '{}') as Record<string, unknown>;
    } catch {
      return { error: 'invalid tool arguments' };
    }
    try {
      return await executeTool(fn.name, args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Tool ${fn.name} failed: ${message}`);
      return { error: 'tool execution failed' };
    }
  }
}

/** Convert the strict (array/nullable) wire shape into a VibeProfile patch.
 * `null` becomes `undefined` so the merge treats it as "no change this turn". */
function toPatch(raw: RawTurn): Partial<VibeProfile> {
  const p = raw.context_patch;
  const patch: Partial<VibeProfile> = {};

  if (p.activity !== null) patch.activity = p.activity;

  const featureTargets: FeatureTargets = {};
  for (const key of ['energy', 'valence', 'danceability', 'tempo'] as const) {
    const value = p.feature_targets[key];
    if (value !== null) featureTargets[key] = value;
  }
  if (Object.keys(featureTargets).length > 0)
    patch.featureTargets = featureTargets;

  if (p.genre_boosts.length) {
    patch.genreBoosts = Object.fromEntries(
      p.genre_boosts.map((b) => [b.genre, b.weight]),
    );
  }
  if (p.artists.length) patch.artists = p.artists;
  if (p.seed_artists.length) patch.seedArtists = p.seed_artists;
  if (p.excluded_artists.length) patch.excludedArtists = p.excluded_artists;
  if (p.excluded_genres.length) patch.excludedGenres = p.excluded_genres;
  if (p.mainstream !== null) patch.mainstream = p.mainstream;
  if (p.base_algorithm !== null) patch.baseAlgorithm = p.base_algorithm;

  return patch;
}
