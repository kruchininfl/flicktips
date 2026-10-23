import type { FastifyPluginAsync } from 'fastify';

import type { AppDeps } from '../deps.js';
import { PEOPLE_SEARCH_SIZE } from '../lib/limits.js';
import { notFoundMsg, parseId } from '../lib/query-params.js';
import { getPerson, searchPeople } from '../repositories/people.js';

export const peopleRoutes =
  (deps: AppDeps): FastifyPluginAsync =>
  async (app) => {
    // the search's «Люди»: from two letters, by name
    app.get('/people/search', async (request) => {
      const raw = (request.query as Record<string, unknown>).q;
      const query = typeof raw === 'string' ? raw.trim().slice(0, 64) : '';
      if ([...query].length < 2) return { success: true, results: [] };
      return { success: true, results: await searchPeople(deps.db, query, PEOPLE_SEARCH_SIZE) };
    });

    // IndexController::getPerson
    app.get<{ Params: { id: string } }>('/people/:id', async (request) => {
      const person = await getPerson(deps.db, parseId(request.params.id), request.viewer?.id ?? null);
      if (!person) throw notFoundMsg();
      return { success: true, person };
    });
  };
