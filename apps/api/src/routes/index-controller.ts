// Everything the PHP IndexController served: movies, people and the vote feeds.
import type { FastifyPluginAsync } from 'fastify';

import type { AppDeps } from '../deps.js';
import { feedRoutes } from './feed.js';
import { movieRoutes } from './movies.js';
import { peopleRoutes } from './people.js';

export const indexControllerRoutes =
  (deps: AppDeps): FastifyPluginAsync =>
  async (app) => {
    await app.register(movieRoutes(deps));
    await app.register(peopleRoutes(deps));
    await app.register(feedRoutes(deps));
  };
