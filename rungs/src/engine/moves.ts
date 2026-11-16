import { getDictionary, type Dictionary } from './dictionary';

export type MoveError =
  | 'wrong-length' // "fish" -> "fishy"
  | 'no-change' // "fish" -> "fish"
  | 'too-many-changes' // "fish" -> "dash" (two letters changed)
  | 'not-a-word' // "fish" -> "fizh"
  | 'already-used'; // the word is already on this ladder

export type MoveCheck = { ok: true; changedIndex: number } | { ok: false; error: MoveError };

/** Index of the single letter that differs, -1 if none, -2 if more than one (or lengths differ). */
export function changedIndex(a: string, b: string): number {
  if (a.length !== b.length) return -2;
  let index = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (index !== -1) return -2;
      index = i;
    }
  }
  return index;
}

/**
 * Checks one move and says WHY it fails, so the UI can react differently
 * (shake for a non-word, point at the old rung for a repeated word).
 */
export function checkMove(
  current: string,
  next: string,
  usedWords: Iterable<string>,
  dictionary: Dictionary = getDictionary(),
): MoveCheck {
  const from = current.toLowerCase();
  const to = next.toLowerCase();
  if (from.length !== to.length) return { ok: false, error: 'wrong-length' };
  const index = changedIndex(from, to);
  if (index === -1) return { ok: false, error: 'no-change' };
  if (index === -2) return { ok: false, error: 'too-many-changes' };
  if (!dictionary.isWord(to)) return { ok: false, error: 'not-a-word' };
  for (const used of usedWords) {
    if (used.toLowerCase() === to) return { ok: false, error: 'already-used' };
  }
  return { ok: true, changedIndex: index };
}

/** Section 3 of the spec: true when `next` is a legal move from `current`. */
export function isValidMove(
  current: string,
  next: string,
  usedWords: Iterable<string>,
  dictionary?: Dictionary,
): boolean {
  return checkMove(current, next, usedWords, dictionary).ok;
}
