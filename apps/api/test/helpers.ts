// Integration-test helpers: a fresh MySQL database per test file (TEST_DB_* env, see packages/db),
// a fake Кинопоиск client, fake sign-in providers and helpers to sign requests in as a user.
import { schema } from '@flicktips/db';
import { createTestDatabase, testDbServer, type TestDatabase } from '@flicktips/db/testing';
import { afterAll, beforeAll } from 'vitest';

import { buildApp, type BuildAppOptions } from '../src/app.js';
import {
  LOGIN_SERVICES,
  OAuthError,
  type CallbackRequest,
  type LoginService,
  type OAuthIdentity,
  type OAuthProvider,
} from '../src/auth/oauth.js';
import { createSession, SESSION_COOKIE } from '../src/auth/sessions.js';
import type { AppDeps } from '../src/deps.js';

export const hasTestDb = !!testDbServer();

export const TEST_SITE_URL = 'https://flicktips.test';

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

// A provider that never touches the network: `identity` is who signs in next; a callback with code !== 'ok'
// fails like a rejected code would.
export interface FakeOAuthProvider extends OAuthProvider {
  identity: OAuthIdentity | null;
  calls: CallbackRequest[];
}

export function fakeOAuthProvider(name: LoginService): FakeOAuthProvider {
  const provider: FakeOAuthProvider = {
    identity: null,
    calls: [],
    authorizationUrl: ({ state, redirectUri }) =>
      `https://${name}.example/authorize?${new URLSearchParams({ state, redirect_uri: redirectUri })}`,
    fetchIdentity: async (request) => {
      provider.calls.push(request);
      if (request.query.code !== 'ok') throw new OAuthError('provider', `${name}: bad code`);
      if (!provider.identity) throw new Error(`${name}: no fake identity set`);
      return provider.identity;
    },
  };
  return provider;
}

export type FakeOAuthProviders = Record<LoginService, FakeOAuthProvider>;

export function fakeOAuth(): FakeOAuthProviders {
  return Object.fromEntries(LOGIN_SERVICES.map((s) => [s, fakeOAuthProvider(s)])) as FakeOAuthProviders;
}

export interface TestContext {
  t: TestDatabase;
  app: ReturnType<typeof buildApp>;
  kp: AppDeps['kp'];
  oauth: FakeOAuthProviders;
}

// Call at the top level of a describe.skipIf(!hasTestDb) block.
export function useTestApp(
  kp: AppDeps['kp'] = fakeKp(),
  configure?: (app: ReturnType<typeof buildApp>) => void,
  extra: { deps?: Partial<AppDeps>; options?: BuildAppOptions } = {},
): TestContext {
  const ctx = { kp, oauth: fakeOAuth() } as TestContext;
  beforeAll(async () => {
    ctx.t = await createTestDatabase();
    ctx.app = buildApp(
      {
        db: ctx.t.db,
        kp: ctx.kp,
        oauth: ctx.oauth,
        config: { env: 'dev', telegramBotUsername: 'FlickTipsBot', siteUrl: TEST_SITE_URL, authSecret: 'test-secret' },
        pingDb: async () => true,
        ...extra.deps,
      },
      extra.options,
    );
    configure?.(ctx.app);
    await ctx.app.ready();
  });
  afterAll(async () => {
    await ctx.app?.close();
    await ctx.t?.drop();
  });
  return ctx;
}

export const sessionCookie = (token: string) => `${SESSION_COOKIE}=${token}`;

// Creates a user with a session and returns the headers that sign requests in as that user.
export async function signIn(ctx: TestContext, fields: Partial<typeof schema.user.$inferInsert> = {}) {
  const [res] = await ctx.t.db.insert(schema.user).values({ username: 'Тестовый пользователь', ...fields });
  const id = res.insertId;
  const token = await createSession(ctx.t.db, id, 'vitest');
  return { id, headers: { cookie: sessionCookie(token) } };
}
