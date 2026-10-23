// `match`: movies with kp_id NULL, in id order and batches, searched on Кинопоиск and classified. Dry run
// writes the report only; --apply also writes kp_id for confident matches (see applyKpId).
import { join } from 'node:path';

import type { Db } from '@flicktips/db';
import { KinopoiskError, type KpFilmList, type KpFilmListItem, type SearchFilmsParams } from '@flicktips/kinopoisk';
import type { Pool } from 'mysql2/promise';

import { readCheckpoint, writeCheckpoint, type Checkpoint } from './checkpoint.js';
import {
  classify,
  DEFAULT_THRESHOLDS,
  movieQuery,
  type Candidate,
  type MatchStatus,
  type MovieRow,
  type Thresholds,
} from './classify.js';
import { applyKpId, countPending, moviesByKpId, selectBatch, selectByIds, type SelectOptions } from './db.js';
import { ReportWriter } from './report.js';

export interface SearchClient {
  searchFilms(params: SearchFilmsParams): Promise<KpFilmList>;
}

export interface MatchOptions {
  apply: boolean;
  includeErrored: boolean;
  batchSize: number;
  // movies searched at once
  concurrency: number;
  // stop after this many movies in this run
  limit?: number;
  // stop before Кинопоиск requests in this run exceed this (daily quota)
  maxRequests?: number;
  // start after this id instead of the checkpoint
  fromId?: number;
  maxId?: number;
  // only these movie ids (still only if kp_id is NULL); no checkpoint
  ids?: number[];
  // ignore the checkpoint and start new report files
  restart: boolean;
  outDir: string;
  thresholds?: Thresholds;
  log?: (line: string) => void;
  // aborted (Ctrl-C): no new searches start; the finished movies are written and checkpointed
  signal?: AbortSignal;
}

export interface MatchDeps {
  db: Db;
  pool: Pool;
  kp: SearchClient;
  target: { database: string; host: string };
  // called before every Кинопоиск request (rate limiter)
  beforeRequest?: () => Promise<void>;
}

export type Action =
  | 'would_apply' // dry run: --apply would write this kp_id
  | 'applied'
  | 'duplicate' // the kp_id belongs to another movie already (or to an earlier match of this run)
  | 'kp_id_already_set' // someone set kp_id between the select and the update
  | 'movie_changed' // apply-report: the movie row is gone or has another tmdb_id than in the report
  | 'skipped' // not confident
  | 'error';

export interface ReportRow {
  movieId: number;
  tmdbId: string | null;
  type: string | null;
  year: number | null;
  title: string | null;
  originalTitle: string | null;
  kpError: string | null;
  status: MatchStatus | 'error';
  action: Action;
  kpId: number | null;
  similarity: number | null;
  yearDiff: number | null;
  kpName: string | null;
  kpYear: number | null;
  kpType: string | null;
  conflictMovieIds: number[];
  requests: number;
  reasons: string[];
  candidates: Candidate[];
}

export const REPORT_COLUMNS = [
  'movie_id',
  'tmdb_id',
  'type',
  'year',
  'title',
  'original_title',
  'kp_error',
  'status',
  'action',
  'kp_id',
  'similarity',
  'year_diff',
  'kp_name',
  'kp_year',
  'kp_type',
  'conflict_movie_ids',
  'kp_url',
  'reasons',
  'other_candidates',
] as const;

export const reportCsvRow = (r: ReportRow) => [
  r.movieId,
  r.tmdbId,
  r.type,
  r.year,
  r.title,
  r.originalTitle,
  r.kpError,
  r.status,
  r.action,
  r.kpId,
  r.similarity,
  r.yearDiff,
  r.kpName,
  r.kpYear,
  r.kpType,
  r.conflictMovieIds.join(' '),
  r.kpId ? `https://www.kinopoisk.ru/film/${r.kpId}/` : '',
  r.reasons.join(' | '),
  r.candidates
    .filter((c) => c.kinopoiskId !== r.kpId)
    .map((c) => `${c.kinopoiskId} ${c.name} (${c.year ?? '?'}, ${c.type}) ${c.similarity}`)
    .join(' | '),
];

export interface MatchSummary {
  processed: number;
  cursor: number;
  stoppedBy: 'done' | 'limit' | 'max_requests' | 'fatal_error' | 'errors' | 'interrupted' | null;
  totals: Record<string, number>;
  requests: number;
  reportCsv: string;
  reportJsonl: string;
}

const MAX_CONSECUTIVE_ERRORS = 5;

// 401/402/403 will not get better by retrying: wrong key or the daily quota is used up
const isFatal = (err: unknown) => err instanceof KinopoiskError && [401, 402, 403].includes(err.status);

class StopRun extends Error {}

export async function runMatch(opts: MatchOptions, deps: MatchDeps): Promise<MatchSummary> {
  const log = opts.log ?? (() => undefined);
  const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS;
  const mode = opts.apply ? 'apply' : 'dry-run';
  const base = join(opts.outDir, opts.ids ? `match-${mode}-ids` : `match-${mode}`);
  const checkpointPath = `${base}.checkpoint.json`;
  const report = new ReportWriter<ReportRow>(
    { csv: `${base}.csv`, jsonl: `${base}.jsonl` },
    REPORT_COLUMNS,
    reportCsvRow,
  );
  const select: SelectOptions = { includeErrored: opts.includeErrored, maxId: opts.maxId };

  let cursor = 0;
  let totals: Record<string, number> = {};
  if (!opts.ids) {
    const saved = opts.restart ? null : await readCheckpoint(checkpointPath);
    if (saved) {
      if (
        saved.database !== deps.target.database ||
        saved.host !== deps.target.host ||
        saved.includeErrored !== opts.includeErrored
      ) {
        throw new Error(
          `${checkpointPath} belongs to another run (${saved.host}/${saved.database}, includeErrored=${saved.includeErrored}); ` +
            'use another --out-dir or --restart',
        );
      }
      cursor = saved.cursor;
      totals = saved.totals;
      log(`resuming after movie id ${cursor} (${checkpointPath})`);
    }
    if (opts.fromId !== undefined) cursor = opts.fromId;
  }
  await report.open(opts.restart || !!opts.ids);

  const pending = opts.ids ? opts.ids.length : await countPending(deps.db, select, cursor);
  log(`${mode}: ${pending} movies with kp_id NULL${opts.includeErrored ? '' : ' and no kp_error'} after id ${cursor}`);

  let requests = 0;
  let processed = 0;
  let consecutiveErrors = 0;
  // set from inside the search workers too, hence an object rather than a narrowed let
  const state: { stoppedBy: MatchSummary['stoppedBy'] } = { stoppedBy: null };
  // dry run: kp_ids this run would write, to report the second movie that would get one as a duplicate
  const claimed = new Map<number, number>();
  const started = Date.now();
  const count = (key: string) => (totals[key] = (totals[key] ?? 0) + 1);

  const search = async (m: MovieRow): Promise<{ row: ReportRow; error: unknown }> => {
    const q = movieQuery(m);
    const items: KpFilmListItem[] = [];
    let used = 0;
    let c = classify(q, items, thresholds);
    let error: unknown = null;
    try {
      for (const title of q.titles) {
        if (opts.maxRequests !== undefined && requests >= opts.maxRequests) {
          state.stoppedBy = 'max_requests';
          throw new StopRun();
        }
        requests++;
        used++;
        await deps.beforeRequest?.();
        const res = await deps.kp.searchFilms({
          keyword: title,
          yearFrom: q.year ? q.year - 2 : undefined,
          yearTo: q.year ? q.year + 2 : undefined,
          order: 'NUM_VOTE',
        });
        items.push(...res.items);
        c = classify(q, items, thresholds);
        if (c.status === 'confident') break;
      }
    } catch (err) {
      if (err instanceof StopRun || isFatal(err)) throw err;
      error = err;
    }
    const best = c.best;
    return {
      error,
      row: {
        movieId: m.id,
        tmdbId: m.tmdbId,
        type: m.type,
        year: q.year,
        title: m.title,
        originalTitle: m.originalTitle,
        kpError: m.kpError,
        status: error ? 'error' : c.status,
        action: error ? 'error' : 'skipped',
        kpId: error ? null : c.kpId,
        similarity: c.similarity,
        yearDiff: c.yearDiff,
        kpName: best?.name ?? null,
        kpYear: best?.year ?? null,
        kpType: best?.type ?? null,
        conflictMovieIds: [],
        requests: used,
        reasons: error ? [`search failed: ${(error as Error).message}`] : c.reasons,
        candidates: c.candidates,
      },
    };
  };

  // Searches a batch with `concurrency` workers. Returns the rows of the leading movies that finished: when the
  // run has to stop mid-batch, the movies after the first unfinished one are left for the next run.
  const searchBatch = async (batch: MovieRow[]): Promise<ReportRow[]> => {
    const results: (ReportRow | undefined)[] = new Array(batch.length);
    let next = 0;
    let fatal: unknown = null;
    const worker = async () => {
      while (!fatal && !opts.signal?.aborted && next < batch.length) {
        const i = next++;
        try {
          const { row, error } = await search(batch[i] as MovieRow);
          results[i] = row;
          if (error) log(`movie ${row.movieId}: ${row.reasons[0]}`);
        } catch (err) {
          fatal = err;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));
    const done: ReportRow[] = [];
    for (const r of results) {
      if (!r) break;
      done.push(r);
    }
    if (fatal) {
      if (!(fatal instanceof StopRun)) {
        state.stoppedBy = 'fatal_error';
        log(`stopping: ${(fatal as Error).message}`);
      }
    }
    return done;
  };

  const decide = async (rows: ReportRow[]) => {
    const confident = rows.filter((r) => r.status === 'confident' && r.kpId !== null);
    const taken = opts.apply
      ? new Map<number, number[]>()
      : await moviesByKpId(deps.db, [...new Set(confident.map((r) => r.kpId as number))]);
    for (const r of confident) {
      const kpId = r.kpId as number;
      if (opts.apply) {
        try {
          const res = await applyKpId(deps.pool, r.movieId, kpId);
          r.action = res.result;
          if (res.result === 'duplicate') r.conflictMovieIds = res.movieIds;
        } catch (err) {
          r.action = 'error';
          r.reasons.push(`update failed: ${(err as Error).message}`);
        }
        continue;
      }
      const others = (taken.get(kpId) ?? []).filter((id) => id !== r.movieId);
      const earlier = claimed.get(kpId);
      if (others.length || earlier !== undefined) {
        r.action = 'duplicate';
        r.conflictMovieIds = earlier !== undefined ? [...others, earlier] : others;
      } else {
        r.action = 'would_apply';
        claimed.set(kpId, r.movieId);
      }
    }
  };

  const remainingIds = opts.ids ? [...opts.ids].sort((a, b) => a - b) : null;
  for (let batchNo = 1; ; batchNo++) {
    let size = opts.batchSize;
    if (opts.limit !== undefined) size = Math.min(size, opts.limit - processed);
    if (size <= 0) {
      state.stoppedBy = 'limit';
      break;
    }
    let batch: MovieRow[];
    if (remainingIds) {
      const ids = remainingIds.splice(0, size);
      if (!ids.length) {
        state.stoppedBy = 'done';
        break;
      }
      batch = await selectByIds(deps.db, ids);
    } else {
      batch = await selectBatch(deps.db, select, cursor, size);
      if (!batch.length) {
        state.stoppedBy = 'done';
        break;
      }
    }

    const rows = await searchBatch(batch);
    await decide(rows);
    await report.append(rows);
    for (const r of rows) {
      // keys: statuses and actions; `error` counts failed searches and failed updates once each
      count(r.status);
      if (r.action !== r.status) count(r.action);
      consecutiveErrors = r.status === 'error' ? consecutiveErrors + 1 : 0;
    }
    processed += rows.length;
    const last = rows.at(-1);
    if (last && !remainingIds) {
      cursor = last.movieId;
      const checkpoint: Checkpoint = {
        version: 1,
        mode,
        database: deps.target.database,
        host: deps.target.host,
        includeErrored: opts.includeErrored,
        cursor,
        updatedAt: new Date().toISOString(),
        totals,
      };
      await writeCheckpoint(checkpointPath, checkpoint);
    }

    const secs = (Date.now() - started) / 1000;
    const rate = processed / Math.max(secs, 0.001);
    const eta = rate > 0 ? Math.round((pending - processed) / rate / 60) : 0;
    log(
      `batch ${batchNo}: ids ${batch[0]?.id}..${last?.movieId ?? '-'} | ${processed}/${pending} | ` +
        `confident ${totals.confident ?? 0}, ambiguous ${totals.ambiguous ?? 0}, not_found ${totals.not_found ?? 0}, ` +
        `duplicate ${totals.duplicate ?? 0}, error ${totals.error ?? 0}` +
        (opts.apply ? `, applied ${totals.applied ?? 0}` : `, would_apply ${totals.would_apply ?? 0}`) +
        ` | ${requests} requests | ${(rate * 60).toFixed(0)}/min, ETA ${eta} min`,
    );

    if (opts.signal?.aborted) state.stoppedBy = 'interrupted';
    if (state.stoppedBy) break;
    if (rows.length < batch.length) break;
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      state.stoppedBy = 'errors';
      log(`stopping: ${consecutiveErrors} searches failed in a row`);
      break;
    }
  }

  return {
    processed,
    cursor,
    stoppedBy: state.stoppedBy,
    totals,
    requests,
    reportCsv: `${base}.csv`,
    reportJsonl: `${base}.jsonl`,
  };
}
