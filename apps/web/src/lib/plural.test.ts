import { describe, expect, it } from 'vitest';

import { plural } from './plural';

describe('plural', () => {
  it('picks the form by the last digits', () => {
    const forms: [string, string, string] = ['друг', 'друга', 'друзей'];
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111, 0].map((n) => plural(n, forms))).toEqual([
      'друг',
      'друга',
      'друзей',
      'друзей',
      'друзей',
      'друг',
      'друга',
      'друзей',
      'друзей',
      'друзей',
    ]);
  });
});
