/**
 * The bundled word list (built by scripts/build_words.py from ENABLE).
 *
 * Three tiers per word length, each containing the one above it:
 *   endpoint ⊂ path ⊂ valid
 * - endpoint: very common words that can be a puzzle's START or TARGET.
 *   (We call it "endpoint" in code to avoid clashing with React's "target" in event handlers.)
 * - path:     common words. PAR is the shortest path using only these, so par is always fair.
 * - valid:    every word the player may play. A clever player can beat par with them.
 */
import raw from './data/words.json';

export const WORD_LENGTHS = [3, 4, 5] as const;
export type WordLength = (typeof WORD_LENGTHS)[number];
export type Tier = 'endpoint' | 'path' | 'valid';

type RawTiers = { endpoint: string; path: string; valid: string };
type RawWords = { version: number; lengths: Record<string, RawTiers> };

export interface Dictionary {
  /** True if the word may be played as a move. Case-insensitive. */
  isWord(word: string): boolean;
  /** Words of one length and tier, sorted A→Z. Tiers include the tiers above them. */
  words(length: WordLength, tier: Tier): readonly string[];
  /** Set version of words(), for fast lookups. */
  wordSet(length: WordLength, tier: Tier): ReadonlySet<string>;
}

export function createDictionary(data: RawWords): Dictionary {
  const lists = new Map<string, string[]>();
  const sets = new Map<string, Set<string>>();
  const split = (s: string) => (s.length ? s.split(' ') : []);

  for (const length of WORD_LENGTHS) {
    const tiers = data.lengths[String(length)];
    if (!tiers) continue;
    const endpoint = split(tiers.endpoint);
    const path = [...endpoint, ...split(tiers.path)].sort();
    const valid = [...path, ...split(tiers.valid)].sort();
    for (const [tier, list] of [
      ['endpoint', endpoint],
      ['path', path],
      ['valid', valid],
    ] as const) {
      lists.set(`${length}:${tier}`, list);
      sets.set(`${length}:${tier}`, new Set(list));
    }
  }

  const empty = new Set<string>();
  const wordSet = (length: WordLength, tier: Tier) => sets.get(`${length}:${tier}`) ?? empty;

  return {
    isWord(word) {
      const w = word.toLowerCase();
      return (WORD_LENGTHS as readonly number[]).includes(w.length)
        ? wordSet(w.length as WordLength, 'valid').has(w)
        : false;
    },
    words: (length, tier) => lists.get(`${length}:${tier}`) ?? [],
    wordSet,
  };
}

let defaultDictionary: Dictionary | null = null;

/** The app's dictionary. Built on first use (a few milliseconds), then cached. */
export function getDictionary(): Dictionary {
  defaultDictionary ??= createDictionary(raw as RawWords);
  return defaultDictionary;
}
