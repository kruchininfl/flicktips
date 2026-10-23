import cookie from '@fastify/cookie';
import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';

import { assertSameOrigin } from './auth/csrf.js';
import { sessionResolver } from './auth/sessions.js';
import type { ViewerResolver } from './auth/viewer.js';
import type { AppDeps, ResolvedDeps } from './deps.js';
import { MemoryEventBus } from './events/bus.js';
import { HttpError } from './lib/errors.js';
import { createPushNotifier, noopPushNotifier } from './push/notifier.js';
import { authRoutes } from './routes/auth.js';
import { eventRoutes, type EventStreamOptions } from './routes/events.js';
import { healthRoutes } from './routes/health.js';
import { pushRoutes } from './routes/push.js';
import { sitemapRoutes } from './routes/sitemap.js';
import { telegramRoutes } from './routes/telegram.js';
import { userRoutes } from './routes/users.js';
import { indexControllerRoutes } from './routes/index-controller.js';

export interface BuildAppOptions extends FastifyServerOptions {
  resolveViewer?: ViewerResolver;
  // GET /api/events timings and limits (tests shorten them)
  eventStream?: Partial<EventStreamOptions>;
}

export function buildApp(appDeps: AppDeps, { resolveViewer, eventStream, ...options }: BuildAppOptions = {}) {
  const app = Fastify(options);
  const deps: ResolvedDeps = {
    ...appDeps,
    events: appDeps.events ?? new MemoryEventBus((error) => app.log.error({ err: error }, 'event listener failed')),
    push:
      appDeps.pushSender && appDeps.config.webPushPublicKey
        ? createPushNotifier(appDeps.db, appDeps.pushSender, app.log)
        : noopPushNotifier,
  };
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
  app.register(indexControllerRoutes(deps), { prefix: '/api' });
  app.register(sitemapRoutes(deps), { prefix: '/api' });
  app.register(eventRoutes(deps, eventStream), { prefix: '/api' });
  app.register(pushRoutes(deps), { prefix: '/api' });

  return app;
}
