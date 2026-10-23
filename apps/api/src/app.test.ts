import { healthResponseSchema } from '@flicktips/shared';
import { describe, expect, it } from 'vitest';

import { fakeOAuth, hasTestDb, signIn, useTestApp } from '../test/helpers.js';
import { buildApp } from './app.js';
import { requireViewer } from './auth/viewer.js';
import { loadConfig } from './config.js';
import type { AppDeps } from './deps.js';

const deps = (pingDb: AppDeps['pingDb']) =>
  ({
    pingDb,
    db: {} as AppDeps['db'],
    kp: {} as AppDeps['kp'],
    oauth: fakeOAuth(),
    config: { env: 'dev', telegramBotUsername: 'x', siteUrl: 'https://flicktips.test', authSecret: 's' },
  }) as AppDeps;

describe('GET /api/health', () => {
  it('reports the database as up', async () => {
    const app = buildApp(
      deps(async () => true),
      { resolveViewer: async () => null },
    );
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(healthResponseSchema.parse(res.json())).toEqual({ status: 'ok', db: 'up' });
  });

  it('reports the database as down when the ping fails', async () => {
    const app = buildApp(
      deps(async () => Promise.reject(new Error('ECONNREFUSED'))),
      {
        resolveViewer: async () => null,
      },
    );
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.json()).toEqual({ status: 'ok', db: 'down' });
  });
});

describe('loadConfig', () => {
  it('picks flicktips_test for APP_ENV=dev', () => {
    expect(loadConfig({ APP_ENV: 'dev' }).db.database).toBe('flicktips_test');
    expect(loadConfig({}).db.database).toBe('flicktips');
    expect(loadConfig({ DB_NAME: 'other' }).db.database).toBe('other');
  });

  it('normalizes SITE_URL to an origin and derives the auth secret from the OAuth secrets', () => {
    expect(loadConfig({}).siteUrl).toBe('https://flicktips.ru');
    expect(loadConfig({ SITE_URL: 'https://flicktips.local/' }).siteUrl).toBe('https://flicktips.local');
    const a = loadConfig({ VKONTAKTE_API_SECRET: 'a', YANDEX_CLIENT_SECRET: 'b' }).authSecret;
    const b = loadConfig({ VKONTAKTE_API_SECRET: 'a', YANDEX_CLIENT_SECRET: 'c' }).authSecret;
    expect(a).toHaveLength(64);
    expect(a).not.toBe(b);
    expect(loadConfig({ AUTH_SECRET: 'explicit' }).authSecret).toBe('explicit');
  });
});

describe.skipIf(!hasTestDb)('session cookie auth', () => {
  const ctx = useTestApp(undefined, (app) => {
    app.get('/api/_whoami', async (request) => ({ id: requireViewer(request).id }));
  });

  it('resolves the viewer from the session cookie', async () => {
    const { id, headers } = await signIn(ctx);
    const ok = await ctx.app.inject({ method: 'GET', url: '/api/_whoami', headers });
    expect(ok.json()).toEqual({ id });
    const bad = await ctx.app.inject({
      method: 'GET',
      url: '/api/_whoami',
      headers: { cookie: 'ft_session=wrong' },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.json()).toEqual({ success: false, msg: 'authorization required' });
    const none = await ctx.app.inject({ method: 'GET', url: '/api/_whoami' });
    expect(none.statusCode).toBe(401);
  });
});
