/**
 * Words are nodes; two words are linked when they differ by exactly one letter.
 * Breadth-first search (BFS) on this graph gives the shortest ladder = PAR.
 */
import { getDictionary, type Dictionary, type Tier, type WordLength } from './dictionary';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

export class WordGraph {
  private readonly adjacency = new Map<string, string[]>();

  constructor(readonly words: ReadonlySet<string>) {
    // "Bucket" trick: fish, dish and wish all share the pattern "_ish".
    // Words in the same bucket are neighbours. Much faster than comparing every pair.
    const buckets = new Map<string, string[]>();
    for (const word of [...words].sort()) {
      for (let i = 0; i < word.length; i++) {
        const key = word.slice(0, i) + '_' + word.slice(i + 1);
        const bucket = buckets.get(key);
        if (bucket) bucket.push(word);
        else buckets.set(key, [word]);
      }
    }
    for (const word of words) this.adjacency.set(word, []);
    for (const bucket of buckets.values()) {
      for (const a of bucket) {
        const list = this.adjacency.get(a)!;
        for (const b of bucket) if (a !== b) list.push(b);
      }
    }
    for (const list of this.adjacency.values()) list.sort();
  }

  /**
   * Neighbours of a word, sorted A→Z (sorting keeps everything deterministic).
   * Works even for a word outside the graph, e.g. a rare word the player just played.
   */
  neighbors(word: string): readonly string[] {
    const known = this.adjacency.get(word);
    if (known) return known;
    const found: string[] = [];
    for (let i = 0; i < word.length; i++) {
      for (const c of ALPHABET) {
        if (c === word[i]) continue;
        const candidate = word.slice(0, i) + c + word.slice(i + 1);
        if (this.words.has(candidate)) found.push(candidate);
      }
    }
    return found.sort();
  }

  /** Steps from `start` to every reachable word. */
  distancesFrom(start: string, blocked?: ReadonlySet<string>): Map<string, number> {
    const dist = new Map<string, number>([[start, 0]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const word = queue[head];
      const d = dist.get(word)!;
      for (const next of this.neighbors(word)) {
        if (dist.has(next) || blocked?.has(next)) continue;
        dist.set(next, d + 1);
        queue.push(next);
      }
    }
    return dist;
  }

  /**
   * Shortest ladder from start to goal, including both ends, or null if impossible.
   * `blocked` words may not be used (e.g. words already on the player's ladder).
   */
  shortestPath(start: string, goal: string, blocked?: ReadonlySet<string>): string[] | null {
    if (start === goal) return [start];
    const previous = new Map<string, string | null>([[start, null]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head++) {
      const word = queue[head];
      for (const next of this.neighbors(word)) {
        if (previous.has(next) || (blocked?.has(next) && next !== goal)) continue;
        previous.set(next, word);
        if (next === goal) {
          const path = [goal];
          for (let w = word; w !== null; w = previous.get(w)!) path.push(w);
          return path.reverse();
        }
        queue.push(next);
      }
    }
    return null;
  }
}

const cache = new Map<string, WordGraph>();

/** Graphs are built once per (dictionary, length, tier) and reused. */
export function getGraph(
  length: WordLength,
  tier: Tier,
  dictionary: Dictionary = getDictionary(),
): WordGraph {
  if (dictionary !== getDictionary()) return new WordGraph(dictionary.wordSet(length, tier));
  const key = `${length}:${tier}`;
  let graph = cache.get(key);
  if (!graph) {
    graph = new WordGraph(dictionary.wordSet(length, tier));
    cache.set(key, graph);
  }
  return graph;
}

/** PAR = number of moves on the shortest ladder using common ("path" tier) words. */
export function findPar(start: string, goal: string, dictionary?: Dictionary): number | null {
  const s = start.toLowerCase();
  const g = goal.toLowerCase();
  if (s.length !== g.length) return null;
  const path = getGraph(s.length as WordLength, 'path', dictionary).shortestPath(s, g);
  return path ? path.length - 1 : null;
}
