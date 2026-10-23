import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { movie, session } from './schema/index.js';
import { createTestDatabase, testDbServer } from './testing.js';

describe.skipIf(!testDbServer())('createTestDatabase', () => {
  it('creates the legacy schema with the v2 migrations applied', async () => {
    const t = await createTestDatabase();
    try {
      await t.db.insert(movie).values({ title: 'Только на Кинопоиске', kpId: 326 });
      const [row] = await t.db.select().from(movie).where(eq(movie.kpId, 326));
      expect(row?.tmdbId).toBeNull();
      expect(await t.db.select().from(session)).toEqual([]);
    } finally {
      await t.drop();
    }
  });
});
