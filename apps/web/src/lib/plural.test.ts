import { describe, expect, it } from 'vitest';

import { compactCount, plural } from './plural';

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

describe('compactCount', () => {
  it('shortens thousands and millions', () => {
    expect(compactCount(940)).toBe('940');
    expect(compactCount(1250)).toBe('1,3 тыс.');
    expect(compactCount(310_400)).toBe('310 тыс.');
    expect(compactCount(1_200_000)).toBe('1,2 млн');
    expect(compactCount(3_000_000)).toBe('3 млн');
  });
});
