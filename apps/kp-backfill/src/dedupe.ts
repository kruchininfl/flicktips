// `dedupe-plan` (read-only) and `dedupe-apply <plan.jsonl>`: make every kp_id belong to one movie, so that
// movie.kp_id can get a UNIQUE key. The plan keeps the kp_id on the movie that matches the Кинопоиск film
// (dedupe-score.ts) and clears it on the others the way kp-parser marks a film it did not find; apply writes
// only the auto_safe rows and the ones a human approved, one transaction per group, after checking that
// nothing changed since the plan. Movies are never deleted.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { KinopoiskError, type KpFilm } from '@flicktips/kinopoisk';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import { findDuplicates, type DuplicateGroup } from './db.js';
import { kpRefFromDb, planGroup, type KpRef, type PlanRow } from './dedupe-score.js';
import { ReportWriter } from './report.js';

export interface FilmClient {
  getFilm(id: number): Promise<KpFilm | null>;
}

// kp-parser (kp-parser/app.js insertError) writes kp_error 'not_found' and today's kp_check_date when its search
// finds nothing, and searches such a movie again once kp_check_date is MAX_DIFF_CHECKING_DAY (7) days old. It
// never reads kp_error itself. A cleared movie gets exactly that state, so kp-parser (and `match`) look for its
// real film later, and the Кинопоиск data of the wrong film is cleared like insertError does.
export const CLEARED_KP_ERROR = 'not_found';
const CLEARED_NULL_COLUMNS = [
  'kp_title',
  'kp_original_title',
  'kp_start_year',
  'kp_finish_year',
  'kp_overview',
  'kp_duration',
  'kp_release_date',
  'kp_release_date_dvd',
  'kp_release_date_rus',
  'kp_rating_value',
  'kp_rating_count',
  'imdb_rating_value',
  'imdb_rating_count',
  'kp_title_similarity',
] as const;
// saved in the apply report, to undo a group by hand
const BEFORE_COLUMNS = ['kp_id', 'kp_error', 'kp_check_date', 'kp_force_check', ...CLEARED_NULL_COLUMNS] as const;

// --- Кинопоиск films for groups the database knows too little about (--fetch-kp) ---

type CachedFilm = Pick<KpFilm, 'nameRu' | 'nameOriginal' | 'nameEn' | 'year' | 'startYear' | 'type'> | null;

const refFromFilm = (f: NonNullable<CachedFilm>): KpRef => ({
  title: f.nameRu,
  originalTitle: f.nameOriginal ?? f.nameEn,
  year: f.year ?? f.startYear,
  type: f.type,
  source: 'api',
});

export interface FetchOptions {
  client: FilmClient;
  cacheFile: string;
  maxRequests?: number;
  beforeRequest?: () => Promise<void>;
  log: (line: string) => void;
}

async function readCache(file: string): Promise<Record<string, CachedFilm>> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as Record<string, CachedFilm>;
  } catch {
    return {};
  }
}

// The Кинопоиск film of each group; fetched for the groups whose title or year is not in the database
export async function kpRefs(groups: DuplicateGroup[], fetch?: FetchOptions): Promise<Map<number, KpRef>> {
  const refs = new Map(groups.map((g) => [g.kpId, kpRefFromDb(g.movies)]));
  if (!fetch) return refs;
  const cache = await readCache(fetch.cacheFile);
  const wanted = groups.filter((g) => {
    const r = refs.get(g.kpId) as KpRef;
    return r.source === 'none' || r.year === null;
  });
  let requests = 0;
  let failed = 0;
  for (const g of wanted) {
    const key = String(g.kpId);
    if (!(key in cache)) {
      if (fetch.maxRequests !== undefined && requests >= fetch.maxRequests) {
        fetch.log(`--max-requests ${fetch.maxRequests} reached: the other groups use the database values`);
        break;
      }
      requests++;
      try {
        await fetch.beforeRequest?.();
        const f = await fetch.client.getFilm(g.kpId);
        cache[key] = f && {
          nameRu: f.nameRu,
          nameOriginal: f.nameOriginal,
          nameEn: f.nameEn,
          year: f.year,
          startYear: f.startYear,
          type: f.type,
        };
      } catch (err) {
        if (err instanceof KinopoiskError && [401, 402, 403].includes(err.status)) {
          fetch.log(`stopping the fetch: ${err.message}`);
          break;
        }
        failed++;
        fetch.log(`kp ${g.kpId}: ${(err as Error).message}`);
        continue;
      }
      if (requests % 50 === 0) await writeCache(fetch.cacheFile, cache);
    }
    const film = cache[key];
    if (film) refs.set(g.kpId, refFromFilm(film));
    else if (film === null) {
      // Кинопоиск has no such film (any more): the kp_id is wrong for every movie of the group
      refs.set(g.kpId, { title: null, originalTitle: null, year: null, type: null, source: 'none' });
    }
  }
  await writeCache(fetch.cacheFile, cache);
  fetch.log(`fetched ${requests} Кинопоиск films for ${wanted.length} groups (${failed} failed)`);
  return refs;
}

async function writeCache(file: string, cache: Record<string, CachedFilm>) {
  await writeFile(file, JSON.stringify(cache));
}

// --- dedupe-plan ---

export const PLAN_COLUMNS = [
  'kp_id',
  'status',
  'action',
  'movie_id',
  'tmdb_id',
  'type',
  'year',
  'title',
  'original_title',
  'kp_title',
  'kp_original_title',
  'kp_year',
  'kp_type',
  'title_similarity',
  'score',
  'votes',
  'bookmarks',
  'tg_posts',
  'note',
  'group_reasons',
  'kp_url',
] as const;

export interface PlanSummary {
  groups: number;
  autoSafe: number;
  needsReview: number;
  // movies whose kp_id the auto_safe rows clear
  autoSafeClears: number;
  planCsv: string;
  planJsonl: string;
}

export interface PlanOptions {
  outDir: string;
  database: string;
  fetch?: Omit<FetchOptions, 'cacheFile' | 'log'>;
  log?: (line: string) => void;
}

export async function planDuplicates(
  pool: Pool,
  opts: PlanOptions,
): Promise<{ groups: DuplicateGroup[]; plans: PlanRow[] }> {
  const log = opts.log ?? (() => undefined);
  const groups = await findDuplicates(pool);
  if (opts.fetch) await mkdir(opts.outDir, { recursive: true });
  const refs = await kpRefs(
    groups,
    opts.fetch && { ...opts.fetch, cacheFile: join(opts.outDir, 'kp-films.json'), log },
  );
  return { groups, plans: groups.map((g) => planGroup(g, refs.get(g.kpId) as KpRef, opts.database)) };
}

export async function runDedupePlan(opts: PlanOptions, deps: { pool: Pool }): Promise<PlanSummary> {
  const log = opts.log ?? (() => undefined);
  const { plans } = await planDuplicates(deps.pool, opts);
  const base = join(opts.outDir, 'dedupe-plan');
  const jsonl = new ReportWriter<PlanRow>({ jsonl: `${base}.jsonl` });
  await jsonl.open(true);
  await jsonl.append(plans);

  const rows = plans.flatMap((p) => p.movies.map((m) => ({ p, m })));
  const csv = new ReportWriter<(typeof rows)[number]>({ csv: `${base}.csv` }, PLAN_COLUMNS, ({ p, m }) => [
    p.kpId,
    p.status,
    m.action,
    m.id,
    m.tmdbId,
    m.type,
    m.year,
    m.title,
    m.originalTitle,
    p.kp.title,
    p.kp.originalTitle,
    p.kp.year,
    p.kp.type,
    m.titleSimilarity,
    m.score,
    m.votes,
    m.bookmarks,
    m.tgPosts,
    m.note,
    p.reasons.join(' | '),
    `https://www.kinopoisk.ru/film/${p.kpId}/`,
  ]);
  await csv.open(true);
  await csv.append(rows);

  const safe = plans.filter((p) => p.status === 'auto_safe');
  const summary: PlanSummary = {
    groups: plans.length,
    autoSafe: safe.length,
    needsReview: plans.length - safe.length,
    autoSafeClears: safe.reduce((n, p) => n + p.clearIds.length, 0),
    planCsv: `${base}.csv`,
    planJsonl: `${base}.jsonl`,
  };
  log(
    `${summary.groups} kp_ids shared by ${rows.length} movies: ${summary.autoSafe} groups auto_safe ` +
      `(${summary.autoSafeClears} kp_ids to clear), ${summary.needsReview} needs_review`,
  );
  return summary;
}

// --- dedupe-apply ---

export type ApplyGroupResult =
  | 'applied'
  | 'already_applied'
  // refused: needs_review and not approved
  | 'not_approved'
  // refused: the plan line itself is inconsistent (edited by hand)
  | 'invalid_plan'
  // refused: made on another database
  | 'wrong_database'
  // refused: the state in the database is not the one the plan was made from
  | 'changed'
  | 'error';

export interface ApplyGroupRow {
  kpId: number;
  status: PlanRow['status'];
  approve: boolean;
  keepId: number;
  clearIds: number[];
  result: ApplyGroupResult;
  reasons: string[];
  // the cleared rows before the update (strings as MySQL shows them), to undo by hand
  before: Record<string, string | null>[];
}

export const APPLY_COLUMNS = ['kp_id', 'status', 'approve', 'keep_id', 'clear_ids', 'result', 'reasons'] as const;

export async function readPlan(file: string): Promise<PlanRow[]> {
  const byKp = new Map<number, PlanRow>();
  for (const [i, line] of (await readFile(file, 'utf8')).split('\n').entries()) {
    if (!line.trim()) continue;
    let row: PlanRow;
    try {
      row = JSON.parse(line) as PlanRow;
    } catch {
      throw new Error(`${file}:${i + 1} is not JSON`);
    }
    byKp.delete(row.kpId);
    byKp.set(row.kpId, row);
  }
  return [...byKp.values()];
}

// The plan line must name each movie of the group once: the keep, and every other one to clear
function planProblem(p: PlanRow): string | null {
  if (
    !Number.isInteger(p.kpId) ||
    !Number.isInteger(p.keepId) ||
    !Array.isArray(p.clearIds) ||
    !Array.isArray(p.movies)
  )
    return 'kpId, keepId, clearIds and movies are required';
  const ids = p.movies.map((m) => m.id);
  if (new Set(ids).size !== ids.length) return 'a movie is listed twice';
  if (!ids.includes(p.keepId)) return `keepId ${p.keepId} is not a movie of the group`;
  if (p.clearIds.includes(p.keepId)) return 'keepId is also in clearIds';
  const expected = ids.filter((id) => id !== p.keepId).sort((a, b) => a - b);
  const got = [...p.clearIds].sort((a, b) => a - b);
  if (expected.join() !== got.join()) return `clearIds must be every movie but the keep: ${expected.join(', ')}`;
  return null;
}

async function countBy(conn: PoolConnection, table: 'movie_vote' | 'bookmark', ids: number[]) {
  // FOR SHARE: no vote or bookmark can be added to these movies until the transaction ends
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT movie_id, COUNT(*) AS n FROM ${table} WHERE movie_id IN (?) GROUP BY movie_id FOR SHARE`,
    [ids],
  );
  return new Map(rows.map((r) => [Number(r.movie_id), Number(r.n)]));
}

// One group in one transaction: lock the rows, check them against the plan, clear, commit.
async function applyGroup(pool: Pool, p: PlanRow): Promise<Pick<ApplyGroupRow, 'result' | 'reasons' | 'before'>> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const planIds = p.movies.map((m) => m.id);
    const [current] = await conn.query<RowDataPacket[]>(
      'SELECT id, kp_id, kp_error, tmdb_id FROM movie WHERE kp_id = ? OR id IN (?) ORDER BY id FOR UPDATE',
      [p.kpId, planIds],
    );
    const byId = new Map(current.map((r) => [Number(r.id), r]));
    const problems: string[] = [];
    for (const m of p.movies) {
      const row = byId.get(m.id);
      if (!row) problems.push(`movie ${m.id} no longer exists`);
      else if ((row.tmdb_id ?? null) !== m.tmdbId)
        problems.push(`movie ${m.id} has tmdb_id ${row.tmdb_id}, not ${m.tmdbId}`);
    }
    const keep = byId.get(p.keepId);
    const cleared = p.clearIds.map((id) => byId.get(id));
    if (
      !problems.length &&
      keep?.kp_id === p.kpId &&
      cleared.every((r) => r?.kp_id === null && r.kp_error === CLEARED_KP_ERROR) &&
      current.filter((r) => r.kp_id === p.kpId).length === 1
    ) {
      await conn.rollback();
      return { result: 'already_applied', reasons: [], before: [] };
    }
    if (keep && keep.kp_id !== p.kpId) problems.push(`keep movie ${p.keepId} has kp_id ${keep.kp_id}, not ${p.kpId}`);
    for (const id of p.clearIds) {
      const row = byId.get(id);
      if (row && row.kp_id !== p.kpId) problems.push(`movie ${id} has kp_id ${row.kp_id}, not ${p.kpId}`);
    }
    const extra = current.filter((r) => r.kp_id === p.kpId && !planIds.includes(Number(r.id))).map((r) => r.id);
    if (extra.length) problems.push(`movies not in the plan have kp_id ${p.kpId} now: ${extra.join(', ')}`);
    const votes = await countBy(conn, 'movie_vote', p.clearIds);
    const bookmarks = await countBy(conn, 'bookmark', p.clearIds);
    for (const id of p.clearIds) {
      const planned = p.movies.find((m) => m.id === id);
      const v = votes.get(id) ?? 0;
      const b = bookmarks.get(id) ?? 0;
      if (v > (planned?.votes ?? 0) || b > (planned?.bookmarks ?? 0)) {
        problems.push(
          `movie ${id} has ${v} votes and ${b} bookmarks now (plan: ${planned?.votes} and ${planned?.bookmarks})`,
        );
      }
    }
    if (problems.length) {
      await conn.rollback();
      return { result: 'changed', reasons: problems, before: [] };
    }

    const [before] = await conn.query<RowDataPacket[]>(
      `SELECT id, ${BEFORE_COLUMNS.map((c) => `CAST(${c} AS CHAR) AS ${c}`).join(', ')} FROM movie WHERE id IN (?) ORDER BY id`,
      [p.clearIds],
    );
    const [res] = await conn.query<ResultSetHeader>(
      `UPDATE movie SET kp_id = NULL, kp_error = ?, kp_check_date = CURDATE(), kp_force_check = 0,
         ${CLEARED_NULL_COLUMNS.map((c) => `${c} = NULL`).join(', ')}
       WHERE id IN (?) AND kp_id = ?`,
      [CLEARED_KP_ERROR, p.clearIds, p.kpId],
    );
    if (res.affectedRows !== p.clearIds.length) {
      await conn.rollback();
      return { result: 'changed', reasons: [`updated ${res.affectedRows} of ${p.clearIds.length} rows`], before: [] };
    }
    await conn.commit();
    return { result: 'applied', reasons: [], before: before.map((r) => ({ ...r }) as Record<string, string | null>) };
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}

export interface ApplySummary {
  totals: Record<string, number>;
  cleared: number;
  reportCsv: string;
  reportJsonl: string;
}

export async function runDedupeApply(
  opts: { file: string; outDir: string; database: string; log?: (line: string) => void },
  deps: { pool: Pool },
): Promise<ApplySummary> {
  const log = opts.log ?? (() => undefined);
  const plans = await readPlan(opts.file);
  log(`${plans.length} groups in ${opts.file}`);
  const base = join(opts.outDir, 'dedupe-apply');
  const report = new ReportWriter<ApplyGroupRow>({ csv: `${base}.csv`, jsonl: `${base}.jsonl` }, APPLY_COLUMNS, (r) => [
    r.kpId,
    r.status,
    r.approve,
    r.keepId,
    r.clearIds.join(' '),
    r.result,
    r.reasons.join(' | '),
  ]);
  await report.open();
  const totals: Record<string, number> = {};
  let cleared = 0;
  const out: ApplyGroupRow[] = [];
  for (const [i, p] of plans.entries()) {
    const row: ApplyGroupRow = {
      kpId: p.kpId,
      status: p.status,
      approve: p.approve === true,
      keepId: p.keepId,
      clearIds: Array.isArray(p.clearIds) ? p.clearIds : [],
      result: 'applied',
      reasons: [],
      before: [],
    };
    const problem = planProblem(p);
    if (problem) Object.assign(row, { result: 'invalid_plan', reasons: [problem] });
    else if (p.database !== opts.database)
      Object.assign(row, { result: 'wrong_database', reasons: [`plan made on ${p.database}, not ${opts.database}`] });
    else if (p.status !== 'auto_safe' && p.approve !== true)
      Object.assign(row, { result: 'not_approved', reasons: ['needs_review; set "approve": true to apply it'] });
    else {
      try {
        Object.assign(row, await applyGroup(deps.pool, p));
        if (row.result === 'applied') cleared += row.clearIds.length;
      } catch (err) {
        Object.assign(row, { result: 'error', reasons: [(err as Error).message] });
      }
    }
    totals[row.result] = (totals[row.result] ?? 0) + 1;
    out.push(row);
    if (out.length >= 200 || i === plans.length - 1) {
      await report.append(out.splice(0));
      log(`${i + 1}/${plans.length}: ${JSON.stringify(totals)}`);
    }
  }
  return { totals, cleared, reportCsv: `${base}.csv`, reportJsonl: `${base}.jsonl` };
}
