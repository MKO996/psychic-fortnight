import { checkMove, isValidMove } from '../moves';
import { tinyDictionary as dict } from '../__fixtures__/tiny';

describe('isValidMove', () => {
  it('accepts a one-letter change to a real word', () => {
    expect(isValidMove('cat', 'cot', [], dict)).toBe(true);
  });

  it('accepts rare (valid-tier) words', () => {
    expect(isValidMove('bot', 'bog', [], dict)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isValidMove('CAT', 'Cot', ['CAT'], dict)).toBe(true);
  });

  it.each([
    ['cat', 'cats', 'wrong-length'],
    ['cat', 'cat', 'no-change'],
    ['cat', 'cog', 'too-many-changes'],
    ['cat', 'cxt', 'not-a-word'],
  ])('%s -> %s fails with %s', (from, to, error) => {
    expect(checkMove(from, to, [], dict)).toEqual({ ok: false, error });
    expect(isValidMove(from, to, [], dict)).toBe(false);
  });

  it('rejects a word already on the ladder', () => {
    expect(checkMove('cot', 'cat', ['cat', 'cot'], dict)).toEqual({
      ok: false,
      error: 'already-used',
    });
  });

  it('reports which letter changed', () => {
    expect(checkMove('cot', 'cog', [], dict)).toEqual({ ok: true, changedIndex: 2 });
  });
});
