import {
  clampProfile,
  mergeVibeProfile,
  normalizeProfile,
} from './vibe-merge.js';
import { EMPTY_VIBE_PROFILE, type VibeProfile } from './types.js';

describe('normalizeProfile', () => {
  it('fills defaults for an empty/undefined context', () => {
    expect(normalizeProfile()).toEqual(EMPTY_VIBE_PROFILE);
    expect(normalizeProfile({})).toEqual(EMPTY_VIBE_PROFILE);
  });

  it('preserves provided fields and defaults the rest', () => {
    const result = normalizeProfile({
      mainstream: -0.5,
      featureTargets: { energy: 0.2 },
    });
    expect(result.mainstream).toBe(-0.5);
    expect(result.featureTargets).toEqual({ energy: 0.2 });
    expect(result.baseAlgorithm).toBe('content');
    expect(result.excludedArtists).toEqual([]);
  });
});

describe('mergeVibeProfile', () => {
  const base: VibeProfile = {
    activity: 'studying',
    featureTargets: { energy: 0.2, tempo: 80 },
    genreBoosts: { lofi: 1.4 },
    artists: [],
    seedArtists: [],
    excludedArtists: ['Ed Sheeran'],
    excludedGenres: [],
    mainstream: -0.6,
    baseAlgorithm: 'content',
  };

  it('field-merges featureTargets, keeping untouched keys', () => {
    const merged = mergeVibeProfile(base, { featureTargets: { energy: 0.8 } });
    expect(merged.featureTargets).toEqual({ energy: 0.8, tempo: 80 });
  });

  it('field-merges genreBoosts (adds the new genre, keeps the old)', () => {
    const merged = mergeVibeProfile(base, { genreBoosts: { rock: 1.6 } });
    expect(merged.genreBoosts).toEqual({ lofi: 1.4, rock: 1.6 });
  });

  it('unions excluded lists and de-duplicates', () => {
    const merged = mergeVibeProfile(base, {
      excludedArtists: ['Ed Sheeran', 'Drake'],
    });
    expect(merged.excludedArtists).toEqual(['Ed Sheeran', 'Drake']);
  });

  it('overwrites scalars only when present in the patch', () => {
    const merged = mergeVibeProfile(base, { mainstream: 0.3 });
    expect(merged.mainstream).toBe(0.3);
    expect(merged.activity).toBe('studying'); // untouched
  });

  it('treats undefined scalar as "no change"', () => {
    const merged = mergeVibeProfile(base, {});
    expect(merged).toEqual(base);
  });

  it('sets requested artists for the turn they are named', () => {
    const merged = mergeVibeProfile(base, { artists: ['Rammstein'] });
    expect(merged.artists).toEqual(['Rammstein']);
  });

  it('resets requested artists on a turn that does not name one', () => {
    const withArtist = mergeVibeProfile(base, { artists: ['Rammstein'] });
    const next = mergeVibeProfile(withArtist, {
      featureTargets: { energy: 0.2 },
    });
    expect(next.artists).toEqual([]); // per-turn directive, not sticky
  });

  it('models the "driving → no wait, something calm" flow', () => {
    const driving = mergeVibeProfile(normalizeProfile(), {
      activity: 'driving',
      featureTargets: { energy: 0.7, tempo: 120 },
      genreBoosts: { rock: 1.5 },
    });
    const calmer = mergeVibeProfile(driving, {
      featureTargets: { energy: 0.2, tempo: 80 },
    });
    // energy/tempo overwritten, the rock boost from the first turn survives.
    expect(calmer.featureTargets).toEqual({ energy: 0.2, tempo: 80 });
    expect(calmer.genreBoosts).toEqual({ rock: 1.5 });
  });
});

describe('clampProfile', () => {
  it('clamps out-of-range feature targets and mainstream', () => {
    const clamped = clampProfile({
      ...EMPTY_VIBE_PROFILE,
      featureTargets: { energy: 5, valence: -2, tempo: 999 },
      mainstream: 9,
    });
    expect(clamped.featureTargets).toEqual({
      energy: 1,
      valence: 0,
      tempo: 300,
    });
    expect(clamped.mainstream).toBe(1);
  });

  it('drops non-finite feature targets and genre boosts', () => {
    const clamped = clampProfile({
      ...EMPTY_VIBE_PROFILE,
      featureTargets: { energy: NaN, danceability: 0.5 },
      genreBoosts: { rock: Infinity, pop: 1.5 },
    });
    expect(clamped.featureTargets).toEqual({ danceability: 0.5 });
    expect(clamped.genreBoosts).toEqual({ pop: 1.5 });
  });

  it('falls back to content for an unknown baseAlgorithm', () => {
    const clamped = clampProfile({
      ...EMPTY_VIBE_PROFILE,
      baseAlgorithm: 'bogus' as VibeProfile['baseAlgorithm'],
    });
    expect(clamped.baseAlgorithm).toBe('content');
  });
});
