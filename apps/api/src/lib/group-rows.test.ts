import { describe, expect, it } from 'vitest';

import { groupRows, pdoRow, phpCast } from './group-rows.js';

describe('phpCast', () => {
  it('follows settype for ints and floats', () => {
    expect(phpCast(null, 'int')).toBe(0);
    expect(phpCast('12abc', 'int')).toBe(12);
    expect(phpCast('7.9', 'int')).toBe(7);
    expect(phpCast('abc', 'int')).toBe(0);
    expect(phpCast(true, 'int')).toBe(1);
    expect(phpCast('7.9', 'float')).toBe(7.9);
    expect(phpCast(undefined, 'float')).toBe(0);
    expect(phpCast(' 1e3', 'float')).toBe(1000);
  });

  it('follows settype for bools and strings', () => {
    expect(phpCast('0', 'bool')).toBe(false);
    expect(phpCast('', 'bool')).toBe(false);
    expect(phpCast(null, 'bool')).toBe(false);
    expect(phpCast('1', 'bool')).toBe(true);
    expect(phpCast('0.0', 'bool')).toBe(true);
    expect(phpCast(0, 'bool')).toBe(false);
    expect(phpCast(null, 'string')).toBe('');
    expect(phpCast(5, 'string')).toBe('5');
  });
});

describe('pdoRow', () => {
  it('turns every non-NULL value into a string', () => {
    expect(pdoRow({ a: 1, b: 7.5, c: null, d: 'x', e: undefined })).toEqual({
      a: '1',
      b: '7.5',
      c: null,
      d: 'x',
      e: null,
    });
  });
});

describe('groupRows', () => {
  const rows = [
    { id: '1', title: 'A', genre_id: '5', genre_name: 'Drama', vote_user: '7', vote_val: '3' },
    { id: '1', title: 'A', genre_id: '6', genre_name: 'Comedy', vote_user: '7', vote_val: '3' },
    { id: '2', title: 'B', genre_id: null, genre_name: null, vote_user: '', vote_val: null },
    { id: '1', title: 'A2', genre_id: '5', genre_name: 'Drama', vote_user: '8', vote_val: '0' },
  ];
  const fields = {
    id: { type: 'int' as const },
    genre_id: { group: 'genres', groupIdField: 'genre_id', rename: 'id', type: 'int' as const },
    genre_name: { group: 'genres', groupIdField: 'genre_id', rename: 'name' },
    vote_user: { group: 'votes', groupIdField: ['id', 'vote_user'], rename: 'user_id', type: 'int' as const },
    vote_val: { group: 'votes', groupIdField: ['id', 'vote_user'], rename: 'value', type: 'int' as const },
  };

  it('merges rows by key, dedupes group items and keeps first-appearance order', () => {
    expect(groupRows(rows, 'id', fields)).toEqual([
      {
        id: 1,
        title: 'A2', // later rows overwrite flat fields
        genres: [
          { id: 5, name: 'Drama' },
          { id: 6, name: 'Comedy' },
        ],
        votes: [
          { user_id: 7, value: 3 },
          { user_id: 8, value: 0 },
        ],
      },
      // empty groups are left out
      { id: 2, title: 'B' },
    ]);
  });

  it('joins composite keys with _', () => {
    const out = groupRows(
      [
        { a: '1', b: '2', x: 'first' },
        { a: '1', b: null, x: 'second' },
        { a: '1', b: '2', x: 'third' },
      ],
      ['a', 'b'],
      {},
    );
    expect(out).toEqual([
      { a: '1', b: '2', x: 'third' },
      { a: '1', b: null, x: 'second' },
    ]);
  });

  it('returns [] for no rows', () => {
    expect(groupRows([], 'id', {})).toEqual([]);
  });
});
