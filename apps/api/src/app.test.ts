import { healthResponseSchema } from '@flicktips/shared';
import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';

describe('GET /api/health', () => {
  it('reports the database as up', async () => {
    const app = buildApp({ pingDb: async () => true });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(healthResponseSchema.parse(res.json())).toEqual({ status: 'ok', db: 'up' });
  });

  it('reports the database as down when the ping fails', async () => {
    const app = buildApp({ pingDb: async () => Promise.reject(new Error('ECONNREFUSED')) });
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
