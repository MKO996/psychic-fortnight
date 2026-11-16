import type { Puzzle } from '../generator';
import { getHint } from '../hint';
import {
  currentWord,
  eraseLast,
  matchedPositions,
  playLetter,
  playWord,
  rate,
  startLadder,
  steps,
} from '../ladder';
import { tinyDictionary as dict } from '../__fixtures__/tiny';

const puzzle: Puzzle = {
  start: 'cat',
  target: 'dog',
  par: 3,
  difficulty: 'easy',
  solution: ['cat', 'cot', 'cog', 'dog'],
};

describe('ladder', () => {
  it('plays letters, tracks newly matching positions, and detects the win', () => {
    let s = startLadder(puzzle);
    const r1 = playLetter(s, 1, 'o', dict); // cat -> cot: "o" now matches dog
    expect(r1).toMatchObject({ ok: true, changedIndex: 1, newlyMatched: [1], solved: false });
    if (!r1.ok) return;
    const r2 = playLetter(r1.state, 2, 'g', dict); // cot -> cog
    if (!r2.ok) throw new Error();
    expect(r2.newlyMatched).toEqual([2]);
    const r3 = playLetter(r2.state, 0, 'd', dict); // cog -> dog
    if (!r3.ok) throw new Error();
    expect(r3.solved).toBe(true);
    s = r3.state;
    expect(steps(s)).toBe(3);
    expect(playWord(s, 'cog', dict).ok).toBe(false); // no moves after the win
  });

  it('an invalid move leaves the state unchanged', () => {
    const s = startLadder(puzzle);
    const r = playLetter(s, 0, 'x', dict);
    expect(r).toMatchObject({ ok: false, error: 'not-a-word' });
    expect(r.state).toBe(s);
  });

  it('erasing removes the last rung but never the start word', () => {
    const r = playWord(startLadder(puzzle), 'cot', dict);
    if (!r.ok) throw new Error();
    const erased = eraseLast(r.state);
    expect(currentWord(erased)).toBe('cat');
    expect(eraseLast(erased)).toBe(erased);
  });

  it('matchedPositions finds letters already in the right place', () => {
    expect(matchedPositions('cog', 'dog')).toEqual([1, 2]);
  });

  it('rates against par', () => {
    expect(rate(2, 3).label).toBe('Under par');
    expect(rate(3, 3).label).toBe('Par');
    expect(rate(5, 3).label).toBe('+2');
  });
});

describe('hint', () => {
  it('points to the next letter on a shortest route', () => {
    expect(getHint('cat', 'dog', ['cat'], dict)).toEqual({ kind: 'position', position: 1 });
  });

  it('routes around used words, using rare words if it must', () => {
    // cot is used, so the only way is cat-bat-bot-bog-dog: change letter 0 first.
    expect(getHint('cat', 'dog', ['cat', 'cot'], dict)).toEqual({ kind: 'position', position: 0 });
  });

  it('says solved or stuck when there is nothing to hint', () => {
    expect(getHint('dog', 'dog', [], dict)).toEqual({ kind: 'solved' });
    expect(getHint('zzz', 'dog', [], dict)).toEqual({ kind: 'stuck' });
  });
});
