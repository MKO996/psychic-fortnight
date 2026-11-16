/**
 * The first-launch puzzle. It teaches by doing: an arrow points at the tile to tap
 * and the letter to pick, one rung at a time. No text tutorial.
 *
 * The normal hint would follow the BFS route (CAT → COT → COG → DOG), so the
 * tutorial carries its own script instead.
 */
import type { Puzzle } from './generator';
import { getHint } from './hint';
import { changedIndex } from './moves';
import { currentWord, isSolved, type LadderState } from './ladder';

export const TUTORIAL_PUZZLE: Puzzle = {
  start: 'cat',
  target: 'dog',
  par: 3,
  difficulty: 'easy',
  solution: ['cat', 'cot', 'dot', 'dog'],
};

export type GuideStep =
  /** Point at this tile, then at this key. `letter` is null when we only know the position. */
  | { kind: 'tap'; position: number; letter: string | null }
  | { kind: 'done' }
  /** Player wandered into a dead end: point at the erase control. */
  | { kind: 'erase' };

/**
 * What the arrow should point at next.
 * While the player follows the script, show the exact tile AND letter.
 * If they find their own way (e.g. COG), switch to a normal position-only hint.
 */
export function tutorialGuide(state: LadderState): GuideStep {
  if (isSolved(state)) return { kind: 'done' };
  const script = state.puzzle.solution;
  const onScript = state.rungs.every((word, i) => word === script[i]);
  if (onScript && state.rungs.length < script.length) {
    const from = script[state.rungs.length - 1];
    const to = script[state.rungs.length];
    const position = changedIndex(from, to);
    return { kind: 'tap', position, letter: to[position] };
  }
  const hint = getHint(currentWord(state), state.puzzle.target, state.rungs);
  if (hint.kind === 'position') return { kind: 'tap', position: hint.position, letter: null };
  if (hint.kind === 'solved') return { kind: 'done' };
  return { kind: 'erase' };
}
