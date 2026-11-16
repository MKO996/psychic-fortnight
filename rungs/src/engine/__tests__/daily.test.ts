import { DAILY_EPOCH, dailyNumber, dailyPuzzle, toDateKey } from '../generator';

describe('daily puzzle', () => {
  it('same date gives the same puzzle every time', () => {
    expect(dailyPuzzle('2027-03-14')).toEqual(dailyPuzzle('2027-03-14'));
  });

  it('different days give different puzzles', () => {
    const keys = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const p = dailyPuzzle(`2027-02-${String(day).padStart(2, '0')}`);
      keys.add(`${p.start}-${p.target}`);
    }
    expect(keys.size).toBe(28);
  });

  it('numbers days from the epoch, starting at #1', () => {
    expect(dailyNumber(DAILY_EPOCH)).toBe(1);
    expect(dailyNumber('2026-11-17')).toBe(2);
    expect(dailyNumber('2027-11-16')).toBe(366);
  });

  it('follows the weekly difficulty rhythm', () => {
    expect(dailyPuzzle('2026-11-16').difficulty).toBe('easy'); // Monday
    expect(dailyPuzzle('2026-11-18').difficulty).toBe('medium'); // Wednesday
    expect(dailyPuzzle('2026-11-21').difficulty).toBe('hard'); // Saturday
  });

  it('uses the local calendar date', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toDateKey(new Date(2026, 0, 6, 0, 1))).toBe('2026-01-06');
  });

  /**
   * GOLDEN TEST. Players compare daily results, so these puzzles must never change
   * by accident. If this fails after editing the word list or the generator, every
   * player would get a different "today". Only update it on purpose, before release.
   */
  it('golden: known dates keep their puzzles', () => {
    const golden = ['2026-11-16', '2026-11-18', '2026-11-21', '2027-01-01'].map((key) => {
      const p = dailyPuzzle(key);
      return `${key} #${p.number} ${p.difficulty}: ${p.start} -> ${p.target} (par ${p.par})`;
    });
    expect(golden).toMatchSnapshot();
  });
});
