import { z } from 'zod';
import { BASE_ALGORITHMS } from './types.js';

/**
 * Validates the `VibeProfile` the client sends with each message. Every field is
 * optional — the client may send `{}` to start a fresh vibe. Values are
 * range-checked here and clamped again after the merge (see vibe-merge.ts).
 */
export const featureTargetsSchema = z.object({
  energy: z.number().min(0).max(1).optional(),
  valence: z.number().min(0).max(1).optional(),
  danceability: z.number().min(0).max(1).optional(),
  tempo: z.number().min(0).max(300).optional(),
});

export const vibeProfileSchema = z.object({
  activity: z.string().max(120).nullable().optional(),
  featureTargets: featureTargetsSchema.optional(),
  genreBoosts: z.record(z.string(), z.number()).optional(),
  artists: z.array(z.string()).optional(),
  seedArtists: z.array(z.string()).optional(),
  excludedArtists: z.array(z.string()).optional(),
  excludedGenres: z.array(z.string()).optional(),
  mainstream: z.number().min(-1).max(1).optional(),
  baseAlgorithm: z.enum(BASE_ALGORITHMS).optional(),
});

export const assistantMessageSchema = z.object({
  text: z.string().min(1, 'Message must not be empty').max(1000),
  context: vibeProfileSchema.optional().default({}),
  limit: z.number().int().positive().max(50).optional().default(20),
});

export type AssistantMessageDto = z.infer<typeof assistantMessageSchema>;
