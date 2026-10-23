// IndexController::getPerson
import type { FastifyPluginAsync } from 'fastify';

import type { AppDeps } from '../deps.js';
import { notFoundMsg, parseId } from '../lib/query-params.js';
import { getPerson } from '../repositories/people.js';

export const peopleRoutes =
  (deps: AppDeps): FastifyPluginAsync =>
  async (app) => {
    app.get<{ Params: { id: string } }>('/people/:id', async (request) => {
      const person = await getPerson(deps.db, parseId(request.params.id), request.viewer?.id ?? null);
      if (!person) throw notFoundMsg();
      return { success: true, person };
    });
  };
