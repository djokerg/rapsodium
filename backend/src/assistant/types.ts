/**
 * The Session Context ("VibeProfile") — the single structured object that flows
 * through every assistant turn. See docs/assistant.md §3.
 *
 * It is held client-side (Zustand) and round-tripped on every request; the
 * backend is stateless and never persists it.
 */

export const BASE_ALGORITHMS = [
  'content',
  'collaborative',
  'popularity',
] as const;
export type BaseAlgorithm = (typeof BASE_ALGORITHMS)[number];

/** Target audio-feature vector. 0..1, except `tempo` in BPM. Fields are optional. */
export interface FeatureTargets {
  energy?: number;
  valence?: number;
  danceability?: number;
  tempo?: number;
}

export interface VibeProfile {
  /** Free-text activity, for logging/debugging ("studying", "driving"). */
  activity: string | null;
  /** Vibe expressed as target audio features. */
  featureTargets: FeatureTargets;
  /** Multiplicative ranking boosts per genre. >1 boost, <1 suppress. */
  genreBoosts: Record<string, number>;
  /** Artists the user explicitly wants to hear — strongly surfaced if in catalog. */
  artists: string[];
  /** Artists to find SIMILAR music to ("more like X") — ranking anchors on their sound. */
  seedArtists: string[];
  /** Hard filters. */
  excludedArtists: string[];
  excludedGenres: string[];
  /** -1 = underground, 0 = neutral, +1 = chart hits. Skews popularity weighting. */
  mainstream: number;
  /** Which base engine to blend the vibe with. */
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
