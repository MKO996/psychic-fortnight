/** The example from the spec, played against the REAL bundled word list. */
import { findPar, getDictionary, getHint, isValidMove, playWord, rate, startLadder } from '..';
import type { Puzzle } from '../generator';

const EXAMPLE = ['fish', 'dish', 'dash', 'cash', 'cast', 'cost', 'coat', 'boat'];

describe('FISH -> BOAT', () => {
  it('every word in the example is in the dictionary', () => {
    for (const word of EXAMPLE) expect(getDictionary().isWord(word)).toBe(true);
  });

  it('every step of the example is a valid move', () => {
    for (let i = 1; i < EXAMPLE.length; i++) {
      expect(isValidMove(EXAMPLE[i - 1], EXAMPLE[i], EXAMPLE.slice(0, i))).toBe(true);
    }
  });

  it('par is at most the example length and at least the 4 letters that differ', () => {
    const par = findPar('fish', 'boat');
    expect(par).not.toBeNull();
    expect(par!).toBeLessThanOrEqual(7);
    expect(par!).toBeGreaterThanOrEqual(4);
  });

  it('plays the full ladder to a solved state in 7 steps', () => {
    const par = findPar('fish', 'boat')!;
    const puzzle: Puzzle = { start: 'fish', target: 'boat', par, difficulty: 'medium', solution: [] };
    let state = startLadder(puzzle);
    let solved = false;
    for (const word of EXAMPLE.slice(1)) {
      const result = playWord(state, word);
      if (!result.ok) throw new Error(`${word} rejected: ${result.error}`);
      state = result.state;
      solved = result.solved;
    }
    expect(solved).toBe(true);
    expect(state.rungs).toEqual(EXAMPLE);
    expect(rate(7, par)).toEqual(par === 7 ? { diff: 0, label: 'Par' } : { diff: 7 - par, label: `+${7 - par}` });
  });

  it('cannot reuse a word: FISH -> DISH -> FISH is rejected', () => {
    const puzzle: Puzzle = { start: 'fish', target: 'boat', par: 7, difficulty: 'medium', solution: [] };
    const step = playWord(startLadder(puzzle), 'dish');
    if (!step.ok) throw new Error('dish rejected');
    expect(playWord(step.state, 'fish')).toMatchObject({ ok: false, error: 'already-used' });
  });

  it('a hint points at a letter that really gets you closer', () => {
    const hint = getHint('fish', 'boat', ['fish']);
    expect(hint.kind).toBe('position');
    if (hint.kind !== 'position') return;
    const par = findPar('fish', 'boat')!;
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const closer = [...alphabet].some((c) => {
      const next = 'fish'.slice(0, hint.position) + c + 'fish'.slice(hint.position + 1);
      if (!isValidMove('fish', next, ['fish'])) return false;
      return findPar(next, 'boat') === par - 1;
    });
    expect(closer).toBe(true);
  });
});
