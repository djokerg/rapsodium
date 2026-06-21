import {
  computeTasteShift,
  fillHourBuckets,
  fillWeekdayBuckets,
  withGenreShares,
} from './insights.util.js';

describe('fillHourBuckets', () => {
  it('returns a dense 0–23 series, zero-filling missing hours', () => {
    const buckets = fillHourBuckets([
      { hour: 9, plays: 4 },
      { hour: 22, plays: 7 },
    ]);

    expect(buckets).toHaveLength(24);
    expect(buckets[0]).toEqual({ hour: 0, plays: 0 });
    expect(buckets[9]).toEqual({ hour: 9, plays: 4 });
    expect(buckets[22]).toEqual({ hour: 22, plays: 7 });
  });
});

describe('fillWeekdayBuckets', () => {
  it('returns a dense 0–6 series, zero-filling missing weekdays', () => {
    const buckets = fillWeekdayBuckets([{ weekday: 1, plays: 3 }]);

    expect(buckets).toHaveLength(7);
    expect(buckets[1]).toEqual({ weekday: 1, plays: 3 });
    expect(buckets[6]).toEqual({ weekday: 6, plays: 0 });
  });
});

describe('withGenreShares', () => {
  it('computes each genre share of the total', () => {
    const result = withGenreShares(
      [
        { genre: 'rock', plays: 30 },
        { genre: 'pop', plays: 10 },
      ],
      40,
    );

    expect(result[0]).toEqual({ genre: 'rock', plays: 30, share: 0.75 });
    expect(result[1]).toEqual({ genre: 'pop', plays: 10, share: 0.25 });
  });

  it('returns zero shares when there are no plays', () => {
    const result = withGenreShares([{ genre: 'rock', plays: 0 }], 0);
    expect(result[0]?.share).toBe(0);
  });
});

describe('computeTasteShift', () => {
  it('splits genres into rising and falling by delta', () => {
    const shift = computeTasteShift([
      { genre: 'metal', recent: 10, previous: 2 }, // +8 rising
      { genre: 'pop', recent: 1, previous: 9 }, // -8 falling
      { genre: 'jazz', recent: 5, previous: 5 }, // flat -> excluded
    ]);

    expect(shift.rising.map((t) => t.genre)).toEqual(['metal']);
    expect(shift.falling.map((t) => t.genre)).toEqual(['pop']);
    expect(shift.rising[0]?.delta).toBe(8);
    expect(shift.falling[0]?.delta).toBe(-8);
  });

  it('drops genres absent from both halves and respects the limit', () => {
    const shift = computeTasteShift(
      [
        { genre: 'a', recent: 9, previous: 1 },
        { genre: 'b', recent: 8, previous: 1 },
        { genre: 'c', recent: 7, previous: 1 },
        { genre: 'd', recent: 6, previous: 1 },
        { genre: 'empty', recent: 0, previous: 0 },
      ],
      2,
    );

    expect(shift.rising).toHaveLength(2);
    expect(shift.rising.map((t) => t.genre)).toEqual(['a', 'b']);
    expect(shift.rising.some((t) => t.genre === 'empty')).toBe(false);
  });
});
