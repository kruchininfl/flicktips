// `duplicates`: movies that share a kp_id, with what a merge would have to move. Read-only.
import { join } from 'node:path';

import type { Pool } from 'mysql2/promise';

import { findDuplicates, type DuplicateGroup } from './db.js';
import { ReportWriter } from './report.js';

export const DUPLICATE_COLUMNS = [
  'kp_id',
  'group_size',
  'movie_id',
  'suggest_keep',
  'tmdb_id',
  'type',
  'year',
  'title',
  'original_title',
  'kp_title',
  'suspend',
  'votes',
  'bookmarks',
  'tg_posts',
  'vote_counters',
  'group_shared_voters',
  'group_shared_bookmarkers',
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
  opts: { outDir: string; log?: (line: string) => void },
  deps: { pool: Pool },
): Promise<DuplicatesSummary> {
  const log = opts.log ?? (() => undefined);
  const base = join(opts.outDir, 'duplicates');
  const groups = await findDuplicates(deps.pool);

  // JSONL: one line per kp_id group; CSV: one line per movie
  const jsonl = new ReportWriter<DuplicateGroup>({ jsonl: `${base}.jsonl` });
  await jsonl.open(true);
  await jsonl.append(groups);

  const rows = groups.flatMap((g) => g.movies.map((m) => ({ g, m })));
  const csv = new ReportWriter<(typeof rows)[number]>({ csv: `${base}.csv` }, DUPLICATE_COLUMNS, ({ g, m }) => [
    g.kpId,
    g.movies.length,
    m.id,
    m.id === g.suggestKeep,
    m.tmdbId,
    m.type,
    m.year,
    m.title,
    m.originalTitle,
    m.kpTitle,
    m.suspend,
    m.votes,
    m.bookmarks,
    m.tgPosts,
    m.counters,
    g.sharedVoters,
    g.sharedBookmarkers,
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
  log(
    `${summary.groups} kp_ids are shared by ${summary.movies} movies (${summary.extraMovies} would have to go before ` +
      `a UNIQUE key on movie.kp_id); ${withUsage.length} groups have votes/bookmarks on more than one movie`,
  );
  return summary;
}
