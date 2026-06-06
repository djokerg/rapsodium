import {
  BASE_ALGORITHMS,
  EMPTY_VIBE_PROFILE,
  type FeatureTargets,
  type VibeProfile,
} from './types.js';

/**
 * Pure helpers for evolving the VibeProfile across a conversation.
 *
 * The conversation is stateless on the server: the client sends the current
 * profile, the LLM returns a *patch*, and we merge + clamp. Keeping these as
 * pure functions makes the patch semantics deterministic and unit-testable —
 * only the NL→patch step is model-driven. See docs/assistant.md §3, §12.
 */

/** Fill any missing fields of a (possibly partial) profile with defaults. */
export function normalizeProfile(partial?: Partial<VibeProfile>): VibeProfile {
  return {
    ...EMPTY_VIBE_PROFILE,
    ...partial,
    featureTargets: {
      ...EMPTY_VIBE_PROFILE.featureTargets,
      ...partial?.featureTargets,
    },
    genreBoosts: { ...EMPTY_VIBE_PROFILE.genreBoosts, ...partial?.genreBoosts },
    artists: partial?.artists ?? [...EMPTY_VIBE_PROFILE.artists],
    seedArtists: partial?.seedArtists ?? [...EMPTY_VIBE_PROFILE.seedArtists],
    excludedArtists: partial?.excludedArtists ?? [
      ...EMPTY_VIBE_PROFILE.excludedArtists,
    ],
    excludedGenres: partial?.excludedGenres ?? [
      ...EMPTY_VIBE_PROFILE.excludedGenres,
    ],
  };
}

/**
 * Merge an LLM patch into the current profile.
 *
 * - `featureTargets` / `genreBoosts` → field-level merge (new keys override)
 * - `excludedArtists` / `excludedGenres` → set union (de-duplicated)
 * - scalars (`activity`, `mainstream`, `baseAlgorithm`) → overwrite if present
 *
 * `undefined` in the patch means "no signal this turn" and preserves the
 * existing value. To clear the whole vibe, the client simply sends `{}` as the
 * context on the next request.
 */
export function mergeVibeProfile(
  current: VibeProfile,
  patch: Partial<VibeProfile>,
): VibeProfile {
  return {
    activity: patch.activity !== undefined ? patch.activity : current.activity,
    featureTargets: mergeFeatureTargets(
      current.featureTargets,
      patch.featureTargets,
    ),
    genreBoosts: { ...current.genreBoosts, ...patch.genreBoosts },
    // Requested / seed artists are per-turn directives: they apply only when
    // named this turn and reset otherwise, so "play Rammstein" then "something
    // calm" doesn't leave Rammstein stuck on top forever.
    artists: patch.artists ?? [],
    seedArtists: patch.seedArtists ?? [],
    excludedArtists: unionStrings(
      current.excludedArtists,
      patch.excludedArtists,
    ),
    excludedGenres: unionStrings(current.excludedGenres, patch.excludedGenres),
    mainstream:
      patch.mainstream !== undefined ? patch.mainstream : current.mainstream,
    baseAlgorithm:
      patch.baseAlgorithm !== undefined
        ? patch.baseAlgorithm
        : current.baseAlgorithm,
  };
}

/**
 * Clamp/sanitize a profile so a bad model output can't poison the recommender.
 * Treat everything coming from the LLM as untrusted input (docs/assistant.md §12).
 */
export function clampProfile(profile: VibeProfile): VibeProfile {
  return {
    activity: profile.activity,
    featureTargets: clampFeatureTargets(profile.featureTargets),
    genreBoosts: clampGenreBoosts(profile.genreBoosts),
    artists: profile.artists,
    seedArtists: profile.seedArtists,
    excludedArtists: profile.excludedArtists,
    excludedGenres: profile.excludedGenres,
    mainstream: clamp(profile.mainstream, -1, 1, 0),
    baseAlgorithm: BASE_ALGORITHMS.includes(profile.baseAlgorithm)
      ? profile.baseAlgorithm
      : 'content',
  };
}

// --- internals ---------------------------------------------------------------

function mergeFeatureTargets(
  current: FeatureTargets,
  patch: FeatureTargets | undefined,
): FeatureTargets {
  if (!patch) return { ...current };
  const merged: FeatureTargets = { ...current };
  for (const key of ['energy', 'valence', 'danceability', 'tempo'] as const) {
    const value = patch[key];
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

function unionStrings(a: string[], b: string[] | undefined): string[] {
  return [...new Set([...a, ...(b ?? [])])];
}

function clampFeatureTargets(targets: FeatureTargets): FeatureTargets {
  const out: FeatureTargets = {};
  const unit = (v: number | undefined) =>
    v === undefined || !Number.isFinite(v) ? undefined : clamp(v, 0, 1, 0);
  const e = unit(targets.energy);
  const v = unit(targets.valence);
  const d = unit(targets.danceability);
  if (e !== undefined) out.energy = e;
  if (v !== undefined) out.valence = v;
  if (d !== undefined) out.danceability = d;
  if (targets.tempo !== undefined && Number.isFinite(targets.tempo)) {
    out.tempo = clamp(targets.tempo, 0, 300, 0);
  }
  return out;
}

function clampGenreBoosts(
  boosts: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [genre, weight] of Object.entries(boosts)) {
    if (Number.isFinite(weight)) out[genre] = clamp(weight, 0, 5, 1);
  }
  return out;
}

function clamp(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
