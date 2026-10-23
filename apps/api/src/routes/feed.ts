// Vote feeds ported from IndexController: last graded films (everyone / friends) and a user's votes.
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { requireViewer } from '../auth/viewer.js';
import type { AppDeps } from '../deps.js';
import { HttpError } from '../lib/errors.js';
import { HOME_LIST_SIZE, VOTES_LIST_SIZE } from '../lib/limits.js';
import { notFoundMsg, optionalPositiveInt, parseId, parseQuery } from '../lib/query-params.js';
import {
  countFeed,
  countUserVotes,
  feedViewer,
  findByUserId,
  getFilmsOrderedByVotes,
  userExists,
} from '../repositories/movies.js';

const pageQuery = z.object({ page: optionalPositiveInt(10_000) });
const votesQuery = z.object({ page: optionalPositiveInt(100_000), size: optionalPositiveInt(500) });

export const feedRoutes =
  (deps: AppDeps): FastifyPluginAsync =>
  async (app) => {
    const { db } = deps;

    // getLastGradedFilms / getLastGradedFilmsFriends: page N returns the first N pages at once (the
    // home page appends by re-requesting), `pages` counts pages of HOME_LIST_SIZE.
    const feed = (onlyFriends: boolean) => async (request: FastifyRequest) => {
      const viewerId = onlyFriends ? requireViewer(request).id : (request.viewer?.id ?? null);
      const { page = 1 } = parseQuery(pageQuery, request.query);
      const viewer = await feedViewer(db, viewerId);
      const total = await countFeed(db, viewer, onlyFriends);
      const entities = total ? await getFilmsOrderedByVotes(db, page * HOME_LIST_SIZE, viewer, onlyFriends) : [];
      return {
        success: true,
        results: { total, page, pages: Math.ceil(total / HOME_LIST_SIZE), entities },
      };
    };
    app.get('/feed/last-graded', feed(false));
    app.get('/feed/friends', feed(true));

    // IndexController::getVotes: `me` is the signed-in viewer.
    app.get<{ Params: { id: string } }>('/users/:id/votes', async (request) => {
      let userId: number;
      if (request.params.id === 'me') {
        if (!request.viewer) throw new HttpError(401, 'Access denied');
        userId = request.viewer.id;
      } else {
        userId = parseId(request.params.id);
        if (!(await userExists(db, userId))) throw notFoundMsg();
      }
      const { page = 1, size = VOTES_LIST_SIZE } = parseQuery(votesQuery, request.query);
      const total = await countUserVotes(db, userId);
      return {
        success: true,
        results: {
          total,
          page,
          pages: Math.ceil(total / size),
          entities: total ? await findByUserId(db, request.viewer?.id ?? null, userId, size, (page - 1) * size) : [],
        },
      };
    });
  };
