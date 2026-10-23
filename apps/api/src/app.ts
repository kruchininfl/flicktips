import cookie from '@fastify/cookie';
import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';

import { assertSameOrigin } from './auth/csrf.js';
import { sessionResolver } from './auth/sessions.js';
import type { ViewerResolver } from './auth/viewer.js';
import type { AppDeps } from './deps.js';
import { HttpError } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';
import { telegramRoutes } from './routes/telegram.js';
import { userRoutes } from './routes/users.js';

export interface BuildAppOptions extends FastifyServerOptions {
  resolveViewer?: ViewerResolver;
}

export function buildApp(deps: AppDeps, { resolveViewer, ...options }: BuildAppOptions = {}) {
  const app = Fastify(options);
  const viewerOf = resolveViewer ?? sessionResolver(deps);

  app.register(cookie);

  app.decorateRequest('viewer', null);
  app.addHook('onRequest', async (request) => {
    // state-changing requests must come from our own origin (docs/auth.md, "CSRF")
    assertSameOrigin(request, deps.config.siteUrl);
    request.viewer = await viewerOf(request);
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send(error.body);
    }
    if (error.validation) {
      return reply.status(400).send({ success: false, msg: error.message });
    }
    request.log.error(error);
    return reply.status(500).send({ success: false, msg: 'Internal Server Error' });
  });

  // Route modules: one file per area under src/routes, each a plugin taking the deps.
  app.register(authRoutes(deps));
  app.register(healthRoutes(deps), { prefix: '/api' });
  app.register(telegramRoutes(deps), { prefix: '/api' });
  app.register(userRoutes(deps), { prefix: '/api' });

  return app;
}
