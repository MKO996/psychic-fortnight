import { findPar, isValidMove } from '..';
import { playLetter, playWord, startLadder, type LadderState } from '../ladder';
import { TUTORIAL_PUZZLE, tutorialGuide } from '../tutorial';

describe('first-launch tutorial: CAT → COT → DOT → DOG', () => {
  it('is a real ladder played at par', () => {
    const s = TUTORIAL_PUZZLE.solution;
    for (let i = 1; i < s.length; i++) expect(isValidMove(s[i - 1], s[i], s.slice(0, i))).toBe(true);
    expect(findPar('cat', 'dog')).toBe(TUTORIAL_PUZZLE.par);
    expect(s.length - 1).toBe(TUTORIAL_PUZZLE.par);
  });

  it('following the arrow (tile + letter) wins in exactly 3 moves', () => {
    let state: LadderState = startLadder(TUTORIAL_PUZZLE);
    const taps: string[] = [];
    for (let move = 0; move < 3; move++) {
      const guide = tutorialGuide(state);
      if (guide.kind !== 'tap' || guide.letter === null) throw new Error('expected a full tap');
      taps.push(`${guide.position}:${guide.letter}`);
      const r = playLetter(state, guide.position, guide.letter);
      if (!r.ok) throw new Error(r.error);
      state = r.state;
    }
    expect(taps).toEqual(['1:o', '0:d', '2:g']);
    expect(tutorialGuide(state)).toEqual({ kind: 'done' });
  });

  it('if the player goes their own way, it falls back to a position-only hint', () => {
    const r = playWord(startLadder(TUTORIAL_PUZZLE), 'cot');
    if (!r.ok) throw new Error();
    const off = playWord(r.state, 'cog'); // valid, but not the script
    if (!off.ok) throw new Error();
    expect(tutorialGuide(off.state)).toEqual({ kind: 'tap', position: 0, letter: null });
  });
});
