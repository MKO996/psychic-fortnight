/**
 * Seeded randomness. Same seed in -> same numbers out, on every phone, forever.
 * That is what makes the Daily Ladder identical for everyone, even offline.
 * (Math.random() can't do this: it has no seed.)
 */

export type Rng = () => number; // returns a float in [0, 1)

/** Mulberry32: tiny, fast, good enough for games. Not for security. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turns a string like "rungs-daily-v1:2026-11-16" into a 32-bit seed (FNV-1a). */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() from an empty list');
  return items[Math.floor(rng() * items.length)];
}
