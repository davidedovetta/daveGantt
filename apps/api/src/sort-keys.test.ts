import { describe, expect, it } from 'vitest';
import { compareKeys, keyAfter } from './sort-keys.js';

describe('keyAfter', () => {
  it('places keys first, last and in between', () => {
    const a = keyAfter([], undefined);
    const c = keyAfter([a], undefined);
    const b = keyAfter([a, c], a);
    const first = keyAfter([a, b, c], null);
    expect([c, b, first, a].sort(compareKeys)).toEqual([first, a, b, c]);
  });

  it('keeps byte order where locale collation would not', () => {
    // fractional-indexing uses 0-9A-Za-z: "Zz" < "a0" byte-wise.
    expect(compareKeys('Zz', 'a0')).toBe(-1);
  });
});
