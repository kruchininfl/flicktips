import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { movie, session } from './schema/index.js';
import { createTestDatabase, PENDING, testDbServer } from './testing.js';

describe('PENDING', () => {
  it('marks a migration that is not applied yet', () => {
    expect(PENDING.test('-- v2 migration\n-- status: pending\nALTER TABLE x;')).toBe(true);
    expect(PENDING.test('-- v2 migration\nALTER TABLE x;')).toBe(false);
  });
});

// builds the whole schema on the CI MySQL while the API and bot suites do the same in parallel: past the 5s default
describe.skipIf(!testDbServer())('createTestDatabase', { timeout: 30_000 }, () => {
  it('creates the legacy schema with the v2 migrations applied', async () => {
    const t = await createTestDatabase();
    try {
      await t.db.insert(movie).values({ title: 'Только на Кинопоиске', kpId: 326 });
      const [row] = await t.db.select().from(movie).where(eq(movie.kpId, 326));
      expect(row?.tmdbId).toBeNull();
      expect(await t.db.select().from(session)).toEqual([]);
      // migrations marked "-- status: pending" (002, UNIQUE kp_id) are not applied, as in production
      await t.db.insert(movie).values({ title: 'Дубль', kpId: 326 });
      expect(await t.db.select().from(movie).where(eq(movie.kpId, 326))).toHaveLength(2);
    } finally {
      await t.drop();
    }
  });
});
