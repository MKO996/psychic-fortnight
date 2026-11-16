import { getDictionary, type Dictionary, type WordLength } from './dictionary';
import { getGraph } from './graph';
import { createRng, hashString, pick, type Rng } from './random';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyRule {
  lengths: readonly WordLength[];
  minPar: number;
  maxPar: number;
}

/** Chosen from measured data: every (length, par) pair below has thousands of puzzles. */
export const DIFFICULTIES: Record<Difficulty, DifficultyRule> = {
  easy: { lengths: [3, 4], minPar: 3, maxPar: 4 },
  medium: { lengths: [4], minPar: 5, maxPar: 6 },
  hard: { lengths: [5], minPar: 5, maxPar: 8 },
};

export interface Puzzle {
  start: string;
  target: string;
  /** Fewest moves using common words. */
  par: number;
  difficulty: Difficulty;
  /** One shortest ladder, start..target. Used for "show me" and tests. Never shown during play. */
  solution: readonly string[];
}

/**
 * Picks a START, finds every common word reachable from it (BFS), keeps the
 * START/TARGET candidates whose distance fits the difficulty, and picks one.
 * Because the target comes FROM the search, every puzzle is solvable by construction.
 */
export function generatePuzzle(
  rng: Rng,
  difficulty: Difficulty,
  dictionary: Dictionary = getDictionary(),
): Puzzle {
  const rule = DIFFICULTIES[difficulty];
  for (let attempt = 0; attempt < 200; attempt++) {
    const length = pick(rng, rule.lengths);
    const endpoints = dictionary.words(length, 'endpoint');
    const graph = getGraph(length, 'path', dictionary);
    const start = pick(rng, endpoints);
    const distances = graph.distancesFrom(start);
    const targets = endpoints.filter((w) => {
      const d = distances.get(w);
      return d !== undefined && d >= rule.minPar && d <= rule.maxPar;
    });
    if (targets.length === 0) continue; // an isolated start word: try another
    const target = pick(rng, targets);
    const solution = graph.shortestPath(start, target)!;
    return { start, target, par: solution.length - 1, difficulty, solution };
  }
  throw new Error(`Could not generate a ${difficulty} puzzle`);
}

/** Convenience for Endless mode and tests: a puzzle from a plain number seed. */
export function puzzleFromSeed(seed: number, difficulty: Difficulty, dictionary?: Dictionary): Puzzle {
  return generatePuzzle(createRng(seed), difficulty, dictionary);
}

// ---------------------------------------------------------------------------
// Daily Ladder
// ---------------------------------------------------------------------------

/**
 * Daily #1. Shared results say "Rungs #N", so this must not change after release.
 * Bump DAILY_SEED_VERSION (not this date) if the daily puzzles ever must change.
 */
export const DAILY_EPOCH = '2026-11-16';
export const DAILY_SEED_VERSION = 'v1';

/** Easier early in the week, harder at the weekend when people have time. Index = getUTCDay(). */
const DAILY_SCHEDULE: readonly Difficulty[] = [
  'hard', // Sunday
  'easy', // Monday
  'easy', // Tuesday
  'medium', // Wednesday
  'medium', // Thursday
  'medium', // Friday
  'hard', // Saturday
];

/** The player's LOCAL calendar date as "YYYY-MM-DD". Each person's day starts at their midnight. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error(`Bad date key: ${key}`);
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** 1 on DAILY_EPOCH, 2 the day after, and so on. */
export function dailyNumber(dateKey: string): number {
  return Math.round((parseDateKey(dateKey) - parseDateKey(DAILY_EPOCH)) / 86_400_000) + 1;
}

export interface DailyPuzzle extends Puzzle {
  dateKey: string;
  number: number;
}

/** Same date key -> same puzzle on every device. No network needed. */
export function dailyPuzzle(dateKey: string, dictionary?: Dictionary): DailyPuzzle {
  const weekday = new Date(parseDateKey(dateKey)).getUTCDay();
  const seed = hashString(`rungs-daily-${DAILY_SEED_VERSION}:${dateKey}`);
  const puzzle = generatePuzzle(createRng(seed), DAILY_SCHEDULE[weekday], dictionary);
  return { ...puzzle, dateKey, number: dailyNumber(dateKey) };
}
