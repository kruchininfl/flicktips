import { healthResponseSchema } from '@flicktips/shared';
import { describe, expect, it } from 'vitest';

import { hasTestDb, signIn, useTestApp } from '../test/helpers.js';
import { buildApp } from './app.js';
import { requireViewer } from './auth/viewer.js';
import { loadConfig } from './config.js';
import type { AppDeps } from './deps.js';

const deps = (pingDb: AppDeps['pingDb']) =>
  ({
    pingDb,
    db: {} as AppDeps['db'],
    kp: {} as AppDeps['kp'],
    config: { env: 'dev', telegramBotUsername: 'x' },
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
});

describe.skipIf(!hasTestDb)('legacy token auth', () => {
  const ctx = useTestApp(undefined, (app) => {
    app.get('/api/_whoami', async (request) => ({ id: requireViewer(request).id }));
  });

  it('resolves the viewer from uid + access-token', async () => {
    const { id, headers } = await signIn(ctx);
    const ok = await ctx.app.inject({ method: 'GET', url: '/api/_whoami', headers });
    expect(ok.json()).toEqual({ id });
    const bad = await ctx.app.inject({
      method: 'GET',
      url: '/api/_whoami',
      headers: { ...headers, 'access-token': 'wrong' },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.json()).toEqual({ success: false, msg: 'authorization required' });
  });
});
