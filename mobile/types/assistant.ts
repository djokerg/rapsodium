import type { SongSummary } from './songs';

/**
 * Mirrors the backend VibeProfile (backend/src/assistant/types.ts). Held in
 * memory and round-tripped on every request — the chat is stateless/ephemeral.
 */
export type BaseAlgorithm = 'content' | 'collaborative' | 'popularity';

export interface FeatureTargets {
  energy?: number;
  valence?: number;
  danceability?: number;
  tempo?: number;
}

export interface VibeProfile {
  activity: string | null;
  featureTargets: FeatureTargets;
  genreBoosts: Record<string, number>;
  artists: string[];
  seedArtists: string[];
  excludedArtists: string[];
  excludedGenres: string[];
  mainstream: number;
  baseAlgorithm: BaseAlgorithm;
}

export const EMPTY_VIBE_PROFILE: VibeProfile = {
  activity: null,
  featureTargets: {},
  genreBoosts: {},
  artists: [],
  seedArtists: [],
  excludedArtists: [],
  excludedGenres: [],
  mainstream: 0,
  baseAlgorithm: 'content',
};

/** Response from POST /assistant/message. */
export interface AssistantReply {
  reply: string;
  context: VibeProfile;
  songs: SongSummary[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}
