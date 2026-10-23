import type { HealthResponse } from '@flicktips/shared';
import type { FastifyPluginAsync } from 'fastify';

import type { AppDeps } from '../deps.js';

export const healthRoutes =
  (deps: AppDeps): FastifyPluginAsync =>
  async (app) => {
    app.get('/health', async (): Promise<HealthResponse> => {
      const up = await deps.pingDb().catch(() => false);
      return { status: 'ok', db: up ? 'up' : 'down' };
    });
  };
