import type { HealthResponse } from '@flicktips/shared';
import Fastify, { type FastifyServerOptions } from 'fastify';

export interface AppDeps {
  // Returns true when the database answers; injected so tests run without MySQL.
  pingDb: () => Promise<boolean>;
}

export function buildApp(deps: AppDeps, options: FastifyServerOptions = {}) {
  const app = Fastify(options);

  app.get('/api/health', async (): Promise<HealthResponse> => {
    const up = await deps.pingDb().catch(() => false);
    return { status: 'ok', db: up ? 'up' : 'down' };
  });

  return app;
}
