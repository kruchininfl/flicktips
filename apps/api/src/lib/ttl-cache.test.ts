import { describe, expect, it } from 'vitest';

import { TtlCache } from './ttl-cache.js';

describe('TtlCache', () => {
  it('shares one load per key until the entry expires', async () => {
    let now = 0;
    const cache = new TtlCache<number>(1000, 10, () => now);
    let loads = 0;
    const load = async () => ++loads;

    const [a, b] = await Promise.all([cache.get('k', load), cache.get('k', load)]);
    expect([a, b, loads]).toEqual([1, 1, 1]);
    now = 999;
    expect(await cache.get('k', load)).toBe(1);
    now = 1000;
    expect(await cache.get('k', load)).toBe(2);
  });

  it('keeps at most maxEntries, dropping the oldest', async () => {
    const cache = new TtlCache<string>(1000, 2);
    let loads = 0;
    const load = (v: string) => async () => (loads++, v);
    await cache.get('a', load('a'));
    await cache.get('b', load('b'));
    await cache.get('c', load('c'));
    await cache.get('b', load('b'));
    expect(loads).toBe(3);
    await cache.get('a', load('a'));
    expect(loads).toBe(4);
  });

  it('does not keep failed loads', async () => {
    const cache = new TtlCache<number>(1000, 2);
    await expect(cache.get('k', async () => Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(await cache.get('k', async () => 7)).toBe(7);
  });
});
