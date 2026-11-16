/**
 * One ladder being played. Pure functions: every move returns a NEW state
 * and never edits the old one. That makes undo, replays and multiplayer sync simple.
 */
import { type Dictionary } from './dictionary';
import type { Puzzle } from './generator';
import { checkMove, type MoveError } from './moves';

export interface LadderState {
  readonly puzzle: Puzzle;
  /** rungs[0] is the START word; the last rung is the current word. */
  readonly rungs: readonly string[];
}

export type PlayResult =
  | {
      ok: true;
      state: LadderState;
      changedIndex: number;
      /** Positions that match the target now but did not before: draw the underline. */
      newlyMatched: number[];
      solved: boolean;
    }
  | { ok: false; state: LadderState; error: MoveError };

export function startLadder(puzzle: Puzzle): LadderState {
  return { puzzle, rungs: [puzzle.start] };
}

export const currentWord = (state: LadderState) => state.rungs[state.rungs.length - 1];
export const steps = (state: LadderState) => state.rungs.length - 1;
export const isSolved = (state: LadderState) => currentWord(state) === state.puzzle.target;

/** Positions where `word` already has the target's letter (shown underlined/locked). */
export function matchedPositions(word: string, target: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < word.length; i++) if (word[i] === target[i]) out.push(i);
  return out;
}

export function playWord(state: LadderState, word: string, dictionary?: Dictionary): PlayResult {
  if (isSolved(state)) return { ok: false, state, error: 'no-change' };
  const next = word.toLowerCase();
  const before = currentWord(state);
  const check = checkMove(before, next, state.rungs, dictionary);
  if (!check.ok) return { ok: false, state, error: check.error };

  const target = state.puzzle.target;
  const wasMatched = new Set(matchedPositions(before, target));
  const newState: LadderState = { ...state, rungs: [...state.rungs, next] };
  return {
    ok: true,
    state: newState,
    changedIndex: check.changedIndex,
    newlyMatched: matchedPositions(next, target).filter((i) => !wasMatched.has(i)),
    solved: next === target,
  };
}

/** The two-tap move from the UI: select a tile, pick a letter. */
export function playLetter(
  state: LadderState,
  position: number,
  letter: string,
  dictionary?: Dictionary,
): PlayResult {
  const word = currentWord(state);
  const next = word.slice(0, position) + letter.toLowerCase() + word.slice(position + 1);
  return playWord(state, next, dictionary);
}

/** Wipe the last rung off the board. The START word can't be erased. */
export function eraseLast(state: LadderState): LadderState {
  if (state.rungs.length <= 1) return state;
  return { ...state, rungs: state.rungs.slice(0, -1) };
}

export interface Rating {
  /** steps - par. Negative = beat par. */
  diff: number;
  label: string; // "Under par" | "Par" | "+2"
}

export function rate(stepsTaken: number, par: number): Rating {
  const diff = stepsTaken - par;
  if (diff < 0) return { diff, label: 'Under par' };
  if (diff === 0) return { diff, label: 'Par' };
  return { diff, label: `+${diff}` };
}
