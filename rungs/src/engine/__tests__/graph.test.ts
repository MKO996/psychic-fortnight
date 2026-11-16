import { WordGraph } from '../graph';
import { tinyDictionary as dict } from '../__fixtures__/tiny';

const valid = new WordGraph(dict.wordSet(3, 'valid'));
const path = new WordGraph(dict.wordSet(3, 'path'));

describe('WordGraph', () => {
  it('links words that differ by one letter', () => {
    expect(valid.neighbors('cat')).toEqual(['bat', 'cot']);
  });

  it('finds neighbours of a word outside the graph', () => {
    expect(path.neighbors('bog')).toEqual(['bot', 'cog', 'dog']);
  });

  it('BFS returns the shortest path', () => {
    expect(valid.shortestPath('cat', 'dog')).toEqual(['cat', 'cot', 'cog', 'dog']);
  });

  it('BFS routes around blocked words', () => {
    expect(valid.shortestPath('cat', 'dog', new Set(['cot']))).toEqual([
      'cat',
      'bat',
      'bot',
      'bog',
      'dog',
    ]);
  });

  it('returns null when there is no path', () => {
    expect(valid.shortestPath('cat', 'zzz')).toBeNull();
    expect(path.shortestPath('cat', 'dog', new Set(['cot', 'bot']))).toBeNull();
  });

  it('distance from a word to itself is zero', () => {
    expect(valid.shortestPath('cat', 'cat')).toEqual(['cat']);
    expect(valid.distancesFrom('cat').get('dog')).toBe(3);
  });
});
