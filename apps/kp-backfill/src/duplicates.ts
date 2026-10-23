// `duplicates`: movies that share a kp_id, with their usage and which one should keep the kp_id (the same
// scoring as dedupe-plan). Read-only.
import { join } from 'node:path';

import type { Pool } from 'mysql2/promise';

import type { DuplicateGroup } from './db.js';
import type { GroupStatus, KpRef, PlanRow } from './dedupe-score.js';
import { planDuplicates, type PlanOptions } from './dedupe.js';
import { ReportWriter } from './report.js';

export interface DuplicateReportGroup extends DuplicateGroup {
  kp: KpRef;
  // the movie whose title and year match the Кинопоиск film best (usage breaks ties)
  suggestKeep: number;
  // needs_review: usage on another movie of the group, or no movie matches the film well (see reasons)
  status: GroupStatus;
  reasons: string[];
}

export const DUPLICATE_COLUMNS = [
  'kp_id',
  'group_size',
  'movie_id',
  'suggest_keep',
  'group_status',
  'tmdb_id',
  'type',
  'year',
  'title',
  'original_title',
  'kp_title',
  'kp_year',
  'title_similarity',
  'score',
  'suspend',
  'votes',
  'bookmarks',
  'tg_posts',
  'vote_counters',
  'group_shared_voters',
  'group_shared_bookmarkers',
  'group_reasons',
  'kp_url',
] as const;

export interface DuplicatesSummary {
  groups: number;
  movies: number;
  extraMovies: number;
  reportCsv: string;
  reportJsonl: string;
}

export async function runDuplicates(
  opts: Omit<PlanOptions, 'database'> & { database?: string },
  deps: { pool: Pool },
): Promise<DuplicatesSummary> {
  const log = opts.log ?? (() => undefined);
  const base = join(opts.outDir, 'duplicates');
  const plan = await planDuplicates(deps.pool, { ...opts, database: opts.database ?? '' });
  const groups: DuplicateReportGroup[] = plan.groups.map((g, i) => {
    const p = plan.plans[i] as PlanRow;
    return { ...g, kp: p.kp, suggestKeep: p.keepId, status: p.status, reasons: p.reasons };
  });
  const scores = new Map(plan.plans.flatMap((p) => p.movies.map((m) => [m.id, m])));

  // JSONL: one line per kp_id group; CSV: one line per movie
  const jsonl = new ReportWriter<DuplicateReportGroup>({ jsonl: `${base}.jsonl` });
  await jsonl.open(true);
  await jsonl.append(groups);

  const rows = groups.flatMap((g) => g.movies.map((m) => ({ g, m })));
  const csv = new ReportWriter<(typeof rows)[number]>({ csv: `${base}.csv` }, DUPLICATE_COLUMNS, ({ g, m }) => [
    g.kpId,
    g.movies.length,
    m.id,
    m.id === g.suggestKeep,
    g.status,
    m.tmdbId,
    m.type,
    m.year,
    m.title,
    m.originalTitle,
    m.kpTitle,
    g.kp.year,
    scores.get(m.id)?.titleSimilarity,
    scores.get(m.id)?.score,
    m.suspend,
    m.votes,
    m.bookmarks,
    m.tgPosts,
    m.counters,
    g.sharedVoters,
    g.sharedBookmarkers,
    g.reasons.join(' | '),
    `https://www.kinopoisk.ru/film/${g.kpId}/`,
  ]);
  await csv.open(true);
  await csv.append(rows);

  const summary = {
    groups: groups.length,
    movies: rows.length,
    extraMovies: rows.length - groups.length,
    reportCsv: `${base}.csv`,
    reportJsonl: `${base}.jsonl`,
  };
  const withUsage = groups.filter((g) => g.movies.filter((m) => m.votes + m.bookmarks + m.tgPosts > 0).length > 1);
  const review = groups.filter((g) => g.status === 'needs_review').length;
  log(
    `${summary.groups} kp_ids are shared by ${summary.movies} movies (${summary.extraMovies} would have to lose it ` +
      `before a UNIQUE key on movie.kp_id); ${withUsage.length} groups have votes/bookmarks on more than one movie; ` +
      `${review} groups need review (see dedupe-plan)`,
  );
  return summary;
}
