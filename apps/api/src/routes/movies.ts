// Movie routes ported from api/src/Controllers/IndexController.php (see docs/routes-movies.md).
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { AppDeps } from '../deps.js';
import { HttpError } from '../lib/errors.js';
import { DIGITAL_LIST_SIZE, TRENDS_LIST_SIZE } from '../lib/limits.js';
import { notFoundMsg, optionalPositiveInt, parseId, parseQuery } from '../lib/query-params.js';
import { trailersFromKp } from '../lib/trailers.js';
import {
  cacheTrailers,
  countVotedMovies,
  findMoviesByIds,
  getDatasets,
  getDigital,
  getFilm,
  getFilmVotes,
  getTrends,
  upsertKpFilms,
} from '../repositories/movies.js';

const searchQuery = z.object({ query: z.string().max(200).optional() });

const csvIds = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(',')
          .filter((id) => /^\d+$/.test(id.trim()))
          .map(Number)
      : [],
  );

// PHP casts: (float) / (int) of whatever came, 0 when missing
const phpNumber = (int: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const n = v === undefined ? 0 : Number.parseFloat(v);
      if (!Number.isFinite(n)) return 0;
      return int ? Math.trunc(n) : n;
    });

const digitalQuery = z.object({
  page: optionalPositiveInt(100_000),
  quality: csvIds,
  voice: csvIds,
  kp_rating_value: phpNumber(false),
  kp_rating_count: phpNumber(true),
  // a date only counts when it has a '-' ("2020-05", "2020-05-01"), like the PHP check
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

const kpUnavailable = () => new HttpError(502, 'Kinopoisk is unavailable');

export const movieRoutes =
  (deps: AppDeps): FastifyPluginAsync =>
  async (app) => {
    const { db, kp } = deps;

    // IndexController::index
    app.get('/', async () => ({ version: '0.0.1' }));

    // IndexController::search: Кинопоиск keyword search; films we do not have are added as KP-only movies.
    app.get('/movies/search', async (request) => {
      const { query } = parseQuery(searchQuery, request.query);
      const keyword = query?.trim();
      if (!keyword) return { total: 0, results: [] };

      let items;
      try {
        ({ items } = await kp.searchFilms({ keyword, order: 'NUM_VOTE' }));
      } catch (error) {
        // HTTP errors (KinopoiskError), timeouts and network failures alike
        request.log.warn({ err: error }, 'Kinopoisk search failed');
        throw kpUnavailable();
      }
      if (!items.length) return { total: 0, results: [] };

      const ids = await upsertKpFilms(db, items);
      const movies = await findMoviesByIds(db, ids, request.viewer?.id ?? null);
      return { total: movies.length, results: movies };
    });

    // IndexController::getTrends
    app.get('/movies/trends', async (request) => {
      const total = await countVotedMovies(db);
      const entities = total ? await getTrends(db, TRENDS_LIST_SIZE, request.viewer?.id ?? null) : [];
      return { success: true, results: { total, entities } };
    });

    // IndexController::getDigitalFilms
    app.get('/movies/digital', async (request) => {
      const q = parseQuery(digitalQuery, request.query);
      const page = q.page ?? 1;
      const { total, ids } = await getDigital(
        db,
        {
          quality: q.quality,
          voice: q.voice,
          ratingValue: q.kp_rating_value,
          ratingCount: q.kp_rating_count,
          dateFrom: q.date_from?.includes('-') ? q.date_from : '0',
          dateTo: q.date_to?.includes('-') ? q.date_to : '9999',
        },
        DIGITAL_LIST_SIZE,
        (page - 1) * DIGITAL_LIST_SIZE,
      );
      return {
        success: true,
        results: {
          total,
          page,
          pages: Math.ceil(total / DIGITAL_LIST_SIZE),
          entities: ids.length ? await findMoviesByIds(db, ids, request.viewer?.id ?? null) : [],
        },
      };
    });

    // IndexController::getDatasets: torrent qualities and voice-overs for the digital filters.
    app.get('/datasets', async () => ({ success: true, results: await getDatasets(db) }));

    // IndexController::getFilm
    app.get<{ Params: { id: string } }>('/movies/:id', async (request) => {
      const id = parseId(request.params.id);
      const movie = await getFilm(db, id, request.viewer?.id ?? null);
      if (!movie) throw notFoundMsg();

      // movie.tmdb_trailers is only a cache now: NULL = not fetched yet, filled from Кинопоиск videos
      const cached = movie.tmdb_trailers;
      let trailers: unknown = [];
      if (typeof cached === 'string') {
        try {
          trailers = JSON.parse(cached);
        } catch {
          trailers = [];
        }
      } else {
        const kpId = Number(movie.kp_id);
        if (kpId > 0) {
          try {
            const videos = await kp.getVideos(kpId);
            trailers = trailersFromKp(videos.items);
            await cacheTrailers(db, id, trailers as string[]);
          } catch (error) {
            // Кинопоиск down or refusing: show the film now, try again next time
            request.log.warn({ err: error }, 'Kinopoisk videos failed');
          }
        }
      }
      movie.tmdb_trailers = trailers;
      return { success: true, movie };
    });

    // IndexController::getFilmVotes
    app.get<{ Params: { id: string } }>('/movies/:id/votes', async (request) => {
      const id = parseId(request.params.id);
      return { success: true, movie_id: id, votes: await getFilmVotes(db, id, request.viewer?.id ?? null) };
    });
  };
