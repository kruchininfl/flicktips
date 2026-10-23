// The SQL this tool runs. Reads go through Drizzle; the only write is applyKpId().
import { schema, type Db } from '@flicktips/db';
import { and, asc, count, gt, inArray, isNotNull, isNull, lte, type SQL } from 'drizzle-orm';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import type { MovieRow } from './classify.js';

const { movie } = schema;

export interface SelectOptions {
  includeErrored: boolean;
  maxId?: number;
}

function pendingWhere(opts: SelectOptions, afterId?: number): SQL | undefined {
  return and(
    isNull(movie.kpId),
    opts.includeErrored ? undefined : isNull(movie.kpError),
    afterId !== undefined ? gt(movie.id, afterId) : undefined,
    opts.maxId !== undefined ? lte(movie.id, opts.maxId) : undefined,
  );
}

export async function countPending(db: Db, opts: SelectOptions, afterId: number): Promise<number> {
  const [row] = await db.select({ n: count() }).from(movie).where(pendingWhere(opts, afterId));
  return row?.n ?? 0;
}

const movieColumns = {
  id: movie.id,
  tmdbId: movie.tmdbId,
  imdbId: movie.imdbId,
  type: movie.type,
  title: movie.title,
  originalTitle: movie.originalTitle,
  releaseDate: movie.releaseDate,
  firstAirDate: movie.firstAirDate,
  kpError: movie.kpError,
};

// --ids: the given movies, if their kp_id is still NULL (kp_error is not checked)
export function selectByIds(db: Db, ids: number[]): Promise<MovieRow[]> {
  return db
    .select(movieColumns)
    .from(movie)
    .where(and(isNull(movie.kpId), inArray(movie.id, ids)))
    .orderBy(asc(movie.id));
}

export function selectBatch(db: Db, opts: SelectOptions, afterId: number, limit: number): Promise<MovieRow[]> {
  return db.select(movieColumns).from(movie).where(pendingWhere(opts, afterId)).orderBy(asc(movie.id)).limit(limit);
}

// kp_id -> ids of the movies that already have it
export async function moviesByKpId(db: Db, kpIds: number[]): Promise<Map<number, number[]>> {
  const out = new Map<number, number[]>();
  if (!kpIds.length) return out;
  const rows = await db
    .select({ id: movie.id, kpId: movie.kpId })
    .from(movie)
    .where(and(isNotNull(movie.kpId), inArray(movie.kpId, kpIds)));
  for (const r of rows) {
    if (r.kpId === null) continue;
    out.set(r.kpId, [...(out.get(r.kpId) ?? []), r.id]);
  }
  return out;
}

export type ApplyResult =
  | { result: 'applied' }
  | { result: 'duplicate'; movieIds: number[] }
  | { result: 'kp_id_already_set' }
  // the row is gone or its tmdb_id is not the one in the report (a report made on another database)
  | { result: 'movie_changed' };

// Sets movie.kp_id only while it is still NULL and no other movie has that kp_id. The movie row and the kp_id
// index range are locked (FOR UPDATE), so a concurrent writer cannot slip the same kp_id in between.
export async function applyKpId(
  pool: Pool,
  movieId: number,
  kpId: number,
  expectTmdbId?: string | null,
): Promise<ApplyResult> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[current]] = await conn.query<RowDataPacket[]>('SELECT kp_id, tmdb_id FROM movie WHERE id = ? FOR UPDATE', [
      movieId,
    ]);
    let result: ApplyResult | null = null;
    if (!current || (expectTmdbId !== undefined && current.tmdb_id !== expectTmdbId))
      result = { result: 'movie_changed' };
    else if (current.kp_id !== null) result = { result: 'kp_id_already_set' };
    else {
      const [taken] = await conn.query<RowDataPacket[]>('SELECT id FROM movie WHERE kp_id = ? FOR UPDATE', [kpId]);
      if (taken.length) result = { result: 'duplicate', movieIds: taken.map((r) => Number(r.id)) };
    }
    if (result) {
      await conn.rollback();
      return result;
    }
    const [res] = await conn.query<ResultSetHeader>('UPDATE movie SET kp_id = ? WHERE id = ? AND kp_id IS NULL', [
      kpId,
      movieId,
    ]);
    await conn.commit();
    return res.affectedRows ? { result: 'applied' } : { result: 'kp_id_already_set' };
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}

export interface DuplicateMovie {
  kpId: number;
  id: number;
  tmdbId: string | null;
  type: string | null;
  title: string | null;
  originalTitle: string | null;
  year: string | null;
  kpTitle: string | null;
  suspend: number;
  votes: number;
  bookmarks: number;
  tgPosts: number;
  // likes + super + neutral + dislikes counters on the movie row
  counters: number;
}

export interface DuplicateGroup {
  kpId: number;
  movies: DuplicateMovie[];
  // users who voted for / bookmarked more than one movie of the group: a merge has to resolve them,
  // since movie_vote and bookmark are unique per (movie, user)
  sharedVoters: number;
  sharedBookmarkers: number;
  suggestKeep: number;
}

const DUP_KP_IDS = 'SELECT kp_id FROM movie WHERE kp_id IS NOT NULL GROUP BY kp_id HAVING COUNT(*) > 1';

export async function findDuplicates(pool: Pool): Promise<DuplicateGroup[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT m.kp_id, m.id, m.tmdb_id, m.type, m.title, m.original_title,
       LEFT(COALESCE(NULLIF(m.release_date, ''), m.first_air_date), 4) AS year, m.kp_title, m.suspend,
       m.likes + m.super + m.neutral + m.dislikes AS counters,
       (SELECT COUNT(*) FROM movie_vote v WHERE v.movie_id = m.id) AS votes,
       (SELECT COUNT(*) FROM bookmark b WHERE b.movie_id = m.id) AS bookmarks,
       (SELECT COUNT(*) FROM tg_post p WHERE p.movie_id = m.id) AS tg_posts
     FROM movie m JOIN (${DUP_KP_IDS}) d ON d.kp_id = m.kp_id
     ORDER BY m.kp_id, m.id`,
  );
  const shared = async (table: 'movie_vote' | 'bookmark') => {
    const [r] = await pool.query<RowDataPacket[]>(
      `SELECT kp_id, COUNT(*) AS n FROM (
         SELECT m.kp_id, t.user_id FROM ${table} t
         JOIN movie m ON m.id = t.movie_id
         JOIN (${DUP_KP_IDS}) d ON d.kp_id = m.kp_id
         GROUP BY m.kp_id, t.user_id HAVING COUNT(*) > 1
       ) x GROUP BY kp_id`,
    );
    return new Map(r.map((x) => [Number(x.kp_id), Number(x.n)]));
  };
  const sharedVotes = await shared('movie_vote');
  const sharedBookmarks = await shared('bookmark');

  const groups = new Map<number, DuplicateGroup>();
  for (const r of rows) {
    const kpId = Number(r.kp_id);
    let g = groups.get(kpId);
    if (!g) {
      g = {
        kpId,
        movies: [],
        sharedVoters: sharedVotes.get(kpId) ?? 0,
        sharedBookmarkers: sharedBookmarks.get(kpId) ?? 0,
        suggestKeep: 0,
      };
      groups.set(kpId, g);
    }
    g.movies.push({
      kpId,
      id: Number(r.id),
      tmdbId: r.tmdb_id ?? null,
      type: r.type ?? null,
      title: r.title ?? null,
      originalTitle: r.original_title ?? null,
      year: r.year ?? null,
      kpTitle: r.kp_title ?? null,
      suspend: Number(r.suspend),
      votes: Number(r.votes),
      bookmarks: Number(r.bookmarks),
      tgPosts: Number(r.tg_posts),
      counters: Number(r.counters),
    });
  }
  for (const g of groups.values()) g.suggestKeep = suggestKeep(g.movies);
  return [...groups.values()];
}

// Only a hint for the human deciding the merge: the most used movie, then one that is not suspended and has a
// TMDb id, then the oldest.
export function suggestKeep(movies: DuplicateMovie[]): number {
  const score = (m: DuplicateMovie) => m.votes + m.bookmarks + m.tgPosts;
  const sorted = [...movies].sort(
    (a, b) => score(b) - score(a) || a.suspend - b.suspend || Number(!!b.tmdbId) - Number(!!a.tmdbId) || a.id - b.id,
  );
  return sorted[0]?.id ?? 0;
}
