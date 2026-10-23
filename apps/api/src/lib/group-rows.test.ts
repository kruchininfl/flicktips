import { describe, expect, it } from 'vitest';

import { groupRows, phpCast } from './group-rows.js';

describe('phpCast', () => {
  it('follows PHP settype for ints and floats', () => {
    expect(phpCast('12', 'int')).toBe(12);
    expect(phpCast(' 12abc', 'int')).toBe(12);
    expect(phpCast('1e3', 'int')).toBe(1000);
    expect(phpCast('1.9', 'int')).toBe(1);
    expect(phpCast('-3', 'int')).toBe(-3);
    expect(phpCast('abc', 'int')).toBe(0);
    expect(phpCast(null, 'int')).toBe(0);
    expect(phpCast(true, 'int')).toBe(1);
    expect(phpCast('7.3', 'float')).toBe(7.3);
    expect(phpCast(null, 'float')).toBe(0);
    expect(phpCast(5, 'float')).toBe(5);
  });

  it('follows PHP settype for bools and strings', () => {
    expect(phpCast('0', 'bool')).toBe(false);
    expect(phpCast('', 'bool')).toBe(false);
    expect(phpCast(null, 'bool')).toBe(false);
    expect(phpCast('1', 'bool')).toBe(true);
    expect(phpCast('false', 'bool')).toBe(true);
    expect(phpCast(0, 'bool')).toBe(false);
    expect(phpCast(2, 'bool')).toBe(true);
    expect(phpCast(null, 'string')).toBe('');
    expect(phpCast(true, 'string')).toBe('1');
    expect(phpCast(false, 'string')).toBe('');
    expect(phpCast(12, 'string')).toBe('12');
  });
});

describe('groupRows', () => {
  const genreFields = {
    id: { type: 'int' as const },
    genre_id: { group: 'genres', groupIdField: 'genre_id', rename: 'id', type: 'int' as const },
    genre_name: { group: 'genres', groupIdField: 'genre_id', rename: 'name' },
  };

  it('folds rows by key, collects groups in first-seen order and casts', () => {
    const rows = [
      { id: '20', title: 'B', genre_id: '7', genre_name: 'драма' },
      { id: '10', title: 'A', genre_id: '3', genre_name: 'комедия' },
      { id: '20', title: 'B', genre_id: '2', genre_name: 'боевик' },
      { id: '20', title: 'B', genre_id: '7', genre_name: 'драма' },
    ];
    expect(groupRows(rows, 'id', genreFields)).toEqual([
      {
        id: 20,
        title: 'B',
        genres: [
          { id: 7, name: 'драма' },
          { id: 2, name: 'боевик' },
        ],
      },
      { id: 10, title: 'A', genres: [{ id: 3, name: 'комедия' }] },
    ]);
  });

  it('keeps the order of numeric-like keys (no JS integer key sorting)', () => {
    const rows = [
      { id: '30', genre_id: '9', genre_name: 'x' },
      { id: '30', genre_id: '1', genre_name: 'y' },
      { id: '4', genre_id: null, genre_name: null },
    ];
    const out = groupRows<{ id: number; genres?: { id: number }[] }>(rows, 'id', genreFields);
    expect(out.map((r) => r.id)).toEqual([30, 4]);
    expect(out[0]!.genres!.map((g) => g.id)).toEqual([9, 1]);
    // no group entries → no key at all
    expect(out[1]).toEqual({ id: 4 });
  });

  it('lets later rows overwrite flat fields and passes uncast values through', () => {
    const out = groupRows(
      [
        { id: '1', v: '1', n: null },
        { id: '1', v: '2', n: null },
      ],
      'id',
      {},
    );
    expect(out).toEqual([{ id: '1', v: '2', n: null }]);
  });

  it('supports composite keys and composite group ids', () => {
    const fields = {
      fid: { group: 'friends', groupIdField: ['mid', 'fid'], rename: 'id', type: 'int' as const },
    };
    const rows = [
      { mid: '1', uid: '5', fid: '8' },
      { mid: '1', uid: '5', fid: null },
      { mid: '1', uid: '6', fid: '' },
      { mid: null, uid: '6', fid: '9' },
    ];
    expect(groupRows(rows, ['mid', 'uid'], fields)).toEqual([
      { mid: '1', uid: '5', friends: [{ id: 8 }] },
      { mid: '1', uid: '6' },
      { mid: null, uid: '6' },
    ]);
  });
});
