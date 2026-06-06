import { formatUnavailableArtistsNote } from './artist-availability.js';

describe('formatUnavailableArtistsNote', () => {
  it('returns empty string when nothing is missing', () => {
    expect(formatUnavailableArtistsNote([])).toBe('');
  });

  it('formats a single missing artist', () => {
    expect(formatUnavailableArtistsNote(['Rammstein'])).toBe(
      "I couldn't find Rammstein in the library, so here's something with a similar vibe instead.",
    );
  });

  it('joins two missing artists with "and"', () => {
    expect(formatUnavailableArtistsNote(['Rammstein', 'Tool'])).toContain(
      'Rammstein and Tool',
    );
  });

  it('uses an Oxford-comma list for three or more', () => {
    expect(formatUnavailableArtistsNote(['A', 'B', 'C'])).toContain(
      'A, B, and C',
    );
  });
});
