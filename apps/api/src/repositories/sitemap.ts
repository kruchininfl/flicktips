// Ids (and dates) of the movies and people that have a public page, for the site's sitemap.xml
// (apps/web/app/sitemaps). See docs/sitemap.md.
import type { Db } from '@flicktips/db';
import { sql } from 'drizzle-orm';

import { selectRows } from './sql.js';

// Ids per sitemap file: chunk N holds the ids N*SIZE+1 … (N+1)*SIZE, so a file never exceeds the protocol's
// 50 000 URLs and a chunk keeps its URL while rows are added elsewhere.
export const SITEMAP_CHUNK_SIZE = 50_000;

export type SitemapKind = 'movies' | 'people';

export interface SitemapChunk {
  chunk: number;
  count: number;
  // newest lastmod in the chunk (movies only), YYYY-MM-DD
  lastmod?: string;
}

const N = sql.raw(String(SITEMAP_CHUNK_SIZE));

// Same conditions as the pages' 404s: getFilm skips `movie.suspend = 1`; getPerson skips suspended people and
// people without a single unsuspended movie.
const visibleMovie = sql`m.suspend <> 1`;
const visiblePerson = sql`p.suspend <> 1 AND EXISTS (
  SELECT 1 FROM movie_people mp JOIN movie pm ON pm.id = mp.movie_id AND pm.suspend <> 1
  WHERE mp.people_id = p.id)`;

// A movie page changes when kp-parser refreshes it (kp_check_date) and when someone votes on it.
// '1000-01-01' stands for "no date" so GREATEST does not turn NULL; zero dates sort below it.
const NO_DATE = sql`DATE('1000-01-01')`;
const movieLastmod = sql`DATE_FORMAT(NULLIF(GREATEST(COALESCE(m.kp_check_date, ${NO_DATE}),
  COALESCE(DATE(v.voted_at), ${NO_DATE})), ${NO_DATE}), '%Y-%m-%d')`;
const lastVotes = sql`LEFT JOIN (SELECT movie_id, MAX(timestamp) AS voted_at FROM movie_vote GROUP BY movie_id) v
  ON v.movie_id = m.id`;

export async function sitemapChunks(db: Db, kind: SitemapKind): Promise<SitemapChunk[]> {
  const rows =
    kind === 'movies'
      ? await selectRows(
          db,
          sql`SELECT FLOOR((m.id - 1) / ${N}) AS chunk, COUNT(*) AS n, MAX(${movieLastmod}) AS lastmod
            FROM movie m ${lastVotes} WHERE ${visibleMovie} GROUP BY chunk ORDER BY chunk`,
        )
      : await selectRows(
          db,
          sql`SELECT FLOOR((p.id - 1) / ${N}) AS chunk, COUNT(*) AS n
            FROM people p WHERE ${visiblePerson} GROUP BY chunk ORDER BY chunk`,
        );
  return rows.map((row) => ({
    chunk: Number(row.chunk),
    count: Number(row.n),
    ...(typeof row.lastmod === 'string' ? { lastmod: row.lastmod } : {}),
  }));
}

const chunkRange = (chunk: number) => [chunk * SITEMAP_CHUNK_SIZE + 1, (chunk + 1) * SITEMAP_CHUNK_SIZE] as const;

// Movie ids of one chunk in id order, with each one's lastmod (null when unknown) at the same index.
export async function sitemapMovies(db: Db, chunk: number): Promise<{ ids: number[]; lastmod: (string | null)[] }> {
  const [from, to] = chunkRange(chunk);
  const rows = await selectRows(
    db,
    sql`SELECT m.id, ${movieLastmod} AS lastmod FROM movie m ${lastVotes}
      WHERE m.id BETWEEN ${from} AND ${to} AND ${visibleMovie} ORDER BY m.id`,
  );
  return {
    ids: rows.map((row) => Number(row.id)),
    lastmod: rows.map((row) => (typeof row.lastmod === 'string' ? row.lastmod : null)),
  };
}

// People ids of one chunk in id order (the table has no date to offer as lastmod).
export async function sitemapPeople(db: Db, chunk: number): Promise<{ ids: number[] }> {
  const [from, to] = chunkRange(chunk);
  const rows = await selectRows(
    db,
    sql`SELECT p.id FROM people p WHERE p.id BETWEEN ${from} AND ${to} AND ${visiblePerson} ORDER BY p.id`,
  );
  return { ids: rows.map((row) => Number(row.id)) };
}
