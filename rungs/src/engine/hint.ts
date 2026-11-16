import { getDictionary, type Dictionary, type WordLength } from './dictionary';
import { getGraph } from './graph';
import { changedIndex } from './moves';

export type Hint =
  | { kind: 'position'; position: number } // "change letter number N" (0-based)
  | { kind: 'solved' }
  | { kind: 'stuck' }; // no way forward without erasing a rung

/**
 * Reveals WHICH letter to change next, never the new word.
 * Looks for a shortest route that avoids words already on the ladder:
 * first with common words (fair), then with any valid word.
 */
export function getHint(
  current: string,
  target: string,
  usedWords: Iterable<string>,
  dictionary: Dictionary = getDictionary(),
): Hint {
  const from = current.toLowerCase();
  const to = target.toLowerCase();
  if (from === to) return { kind: 'solved' };

  const blocked = new Set<string>();
  for (const w of usedWords) blocked.add(w.toLowerCase());
  blocked.delete(from);

  const length = from.length as WordLength;
  for (const tier of ['path', 'valid'] as const) {
    const route = getGraph(length, tier, dictionary).shortestPath(from, to, blocked);
    if (route && route.length >= 2) {
      return { kind: 'position', position: changedIndex(route[0], route[1]) };
    }
  }
  return { kind: 'stuck' };
}
