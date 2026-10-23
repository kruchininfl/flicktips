// Integration-test helpers: a fresh MySQL database per test file (TEST_DB_* env, see packages/db),
// a fake Кинопоиск client and helpers to sign requests in as a user.
import { schema } from '@flicktips/db';
import { createTestDatabase, testDbServer, type TestDatabase } from '@flicktips/db/testing';
import { afterAll, beforeAll } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppDeps } from '../src/deps.js';

export const hasTestDb = !!testDbServer();

export function fakeKp(overrides: Partial<AppDeps['kp']> = {}): AppDeps['kp'] {
  return {
    getFilm: async () => null,
    searchFilms: async () => ({ total: 0, totalPages: 0, items: [] }),
    getVideos: async () => ({ total: 0, items: [] }),
    getStaff: async () => [],
    getFilters: async () => ({ genres: [], countries: [] }),
    ...overrides,
  };
}

export interface TestContext {
  t: TestDatabase;
  app: ReturnType<typeof buildApp>;
  kp: AppDeps['kp'];
}

// Call at the top level of a describe.skipIf(!hasTestDb) block.
export function useTestApp(
  kp: AppDeps['kp'] = fakeKp(),
  configure?: (app: ReturnType<typeof buildApp>) => void,
): TestContext {
  const ctx = { kp } as TestContext;
  beforeAll(async () => {
    ctx.t = await createTestDatabase();
    ctx.app = buildApp({
      db: ctx.t.db,
      kp: ctx.kp,
      config: { env: 'dev', telegramBotUsername: 'FlickTipsBot' },
      pingDb: async () => true,
    });
    configure?.(ctx.app);
    await ctx.app.ready();
  });
  afterAll(async () => {
    await ctx.app?.close();
    await ctx.t?.drop();
  });
  return ctx;
}

// Creates a user and returns the legacy auth headers for it.
export async function signIn(ctx: TestContext, fields: Partial<typeof schema.user.$inferInsert> = {}) {
  const token = `token-${Math.random().toString(36).slice(2)}`;
  const [res] = await ctx.t.db.insert(schema.user).values({ username: 'Тестовый пользователь', token, ...fields });
  const id = res.insertId;
  return { id, headers: { uid: String(id), 'access-token': token } };
}
