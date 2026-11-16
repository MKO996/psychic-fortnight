import { readFileSync } from 'fs';
import { join } from 'path';

import { getDictionary, WORD_LENGTHS } from '../dictionary';

const dict = getDictionary();
const readList = (name: string) =>
  readFileSync(join(__dirname, '../../../wordlists', name), 'utf8')
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith('#') && !l.includes(' '));

describe('bundled dictionary', () => {
  it('has a healthy number of words for 3, 4 and 5 letters', () => {
    for (const n of WORD_LENGTHS) {
      expect(dict.words(n, 'endpoint').length).toBeGreaterThan(300);
      expect(dict.words(n, 'valid').length).toBeGreaterThan(900);
    }
  });

  it('tiers are nested: endpoint ⊂ path ⊂ valid', () => {
    for (const n of WORD_LENGTHS) {
      const path = dict.wordSet(n, 'path');
      const valid = dict.wordSet(n, 'valid');
      for (const w of dict.words(n, 'endpoint')) expect(path.has(w)).toBe(true);
      for (const w of path) expect(valid.has(w)).toBe(true);
    }
  });

  it('contains no blocked word (family-friendly)', () => {
    const blocked = [...readList('ldnoobw-en.txt'), ...readList('extra-blocklist.txt')];
    const found = blocked.filter((w) => dict.isWord(w));
    expect(found).toEqual([]);
  });

  it('also blocks plurals and verb forms of blocked words ("shit" -> "shits")', () => {
    const blocked = [...readList('ldnoobw-en.txt'), ...readList('extra-blocklist.txt')];
    const found = blocked
      .flatMap((w) => [`${w}s`, `${w}es`, `${w}ed`, `${w}y`])
      .filter((w) => dict.isWord(w));
    expect(found).toEqual([]);
  });

  it('no excluded word is ever a START or TARGET', () => {
    const excluded = readList('endpoint-exclude.txt');
    for (const w of excluded) {
      if (!(WORD_LENGTHS as readonly number[]).includes(w.length)) continue;
      expect(dict.wordSet(w.length as 3 | 4 | 5, 'endpoint').has(w)).toBe(false);
    }
  });

  it('rejects words of other lengths and junk', () => {
    expect(dict.isWord('at')).toBe(false);
    expect(dict.isWord('ladder')).toBe(false);
    expect(dict.isWord('qzxv')).toBe(false);
  });
});
