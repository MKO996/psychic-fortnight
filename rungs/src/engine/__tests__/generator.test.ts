import { getDictionary, type WordLength } from '../dictionary';
import { DIFFICULTIES, puzzleFromSeed, type Difficulty, type Puzzle } from '../generator';
import { WordGraph } from '../graph';
import { isValidMove } from '../moves';

const dict = getDictionary();
const difficulties: Difficulty[] = ['easy', 'medium', 'hard'];

// An independent check: a fresh graph over ALL valid words (not the generator's cached one).
const fullGraphs = new Map<number, WordGraph>();
const fullGraph = (n: WordLength) => {
  if (!fullGraphs.has(n)) fullGraphs.set(n, new WordGraph(dict.wordSet(n, 'valid')));
  return fullGraphs.get(n)!;
};

describe('puzzle generator', () => {
  const puzzles: Puzzle[] = [];
  beforeAll(() => {
    for (let seed = 0; seed < 1000; seed++) {
      puzzles.push(puzzleFromSeed(seed, difficulties[seed % 3]));
    }
  });

  it('generates 1,000 puzzles that are all solvable', () => {
    expect(puzzles).toHaveLength(1000);
    for (const p of puzzles) {
      const n = p.start.length as WordLength;
      expect(fullGraph(n).shortestPath(p.start, p.target)).not.toBeNull();
    }
  });

  it('every puzzle has par between 3 and 8, inside its difficulty range', () => {
    for (const p of puzzles) {
      const rule = DIFFICULTIES[p.difficulty];
      expect(p.par).toBeGreaterThanOrEqual(3);
      expect(p.par).toBeLessThanOrEqual(8);
      expect(p.par).toBeGreaterThanOrEqual(rule.minPar);
      expect(p.par).toBeLessThanOrEqual(rule.maxPar);
      expect(rule.lengths).toContain(p.start.length);
    }
  });

  it('the stored solution is a real ladder of common words with exactly par moves', () => {
    for (const p of puzzles) {
      const n = p.start.length as WordLength;
      expect(p.solution[0]).toBe(p.start);
      expect(p.solution[p.solution.length - 1]).toBe(p.target);
      expect(p.solution.length - 1).toBe(p.par);
      for (let i = 1; i < p.solution.length; i++) {
        expect(dict.wordSet(n, 'path').has(p.solution[i])).toBe(true);
        expect(isValidMove(p.solution[i - 1], p.solution[i], p.solution.slice(0, i))).toBe(true);
      }
    }
  });

  it('START and TARGET are always well-known words', () => {
    for (const p of puzzles) {
      const endpoints = dict.wordSet(p.start.length as WordLength, 'endpoint');
      expect(endpoints.has(p.start)).toBe(true);
      expect(endpoints.has(p.target)).toBe(true);
    }
  });

  it('is deterministic: same seed, same puzzle', () => {
    expect(puzzleFromSeed(42, 'hard')).toEqual(puzzleFromSeed(42, 'hard'));
  });

  it('produces variety', () => {
    const unique = new Set(puzzles.map((p) => `${p.start}-${p.target}`));
    expect(unique.size).toBeGreaterThan(950);
  });
});
