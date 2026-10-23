// Data for the sitemap files the site serves at /sitemaps/*.xml (apps/web/app/sitemaps): which chunks exist and
// the ids in each. New in v2 (the legacy sitemap came from a crawler, web/crawler.js); see docs/sitemap.md.
import type { SitemapIndexResponse, SitemapMoviesResponse, SitemapPeopleResponse } from '@flicktips/shared';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';

import type { AppDeps } from '../deps.js';
import { notFoundMsg } from '../lib/query-params.js';
import { TtlCache } from '../lib/ttl-cache.js';
import { SITEMAP_CHUNK_SIZE, sitemapChunks, sitemapMovies, sitemapPeople } from '../repositories/sitemap.js';

// The site regenerates its sitemap once a day; an hour here only spares the DB repeated full scans.
const CACHE_TTL_MS = 3600_000;
const CACHE_CONTROL = 'public, max-age=3600';
// the index plus a few chunks (a people chunk is ~50 000 numbers)
const CACHE_ENTRIES = 8;
// ids are int(11): no chunk beyond this can hold anything
const MAX_CHUNK = Math.floor(2_147_483_647 / SITEMAP_CHUNK_SIZE);

function parseChunk(value: string): number {
  if (!/^\d{1,6}$/.test(value)) throw notFoundMsg();
  const chunk = Number(value);
  if (chunk > MAX_CHUNK) throw notFoundMsg();
  return chunk;
}

export const sitemapRoutes =
  ({ db }: AppDeps): FastifyPluginAsync =>
  async (app) => {
    const cache = new TtlCache<unknown>(CACHE_TTL_MS, CACHE_ENTRIES);
    const cached = <T>(reply: FastifyReply, key: string, load: () => Promise<T>) => {
      reply.header('cache-control', CACHE_CONTROL);
      return cache.get(key, load) as Promise<T>;
    };

    app.get('/sitemap', async (_request, reply) =>
      cached(reply, 'index', async (): Promise<SitemapIndexResponse> => {
        const [movies, people] = await Promise.all([sitemapChunks(db, 'movies'), sitemapChunks(db, 'people')]);
        return { success: true, chunkSize: SITEMAP_CHUNK_SIZE, movies, people };
      }),
    );

    app.get<{ Params: { chunk: string } }>('/sitemap/movies/:chunk', async (request, reply) => {
      const chunk = parseChunk(request.params.chunk);
      return cached(reply, `movies:${chunk}`, async (): Promise<SitemapMoviesResponse> => ({
        success: true,
        chunk,
        ...(await sitemapMovies(db, chunk)),
      }));
    });

    app.get<{ Params: { chunk: string } }>('/sitemap/people/:chunk', async (request, reply) => {
      const chunk = parseChunk(request.params.chunk);
      return cached(reply, `people:${chunk}`, async (): Promise<SitemapPeopleResponse> => ({
        success: true,
        chunk,
        ...(await sitemapPeople(db, chunk)),
      }));
    });
  };
