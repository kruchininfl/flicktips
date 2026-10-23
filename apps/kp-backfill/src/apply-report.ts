// `apply-report <match-dry-run.jsonl>`: writes the confident matches of a reviewed dry-run report without
// searching Кинопоиск again (the API quota is daily). Same guarantees as `match --apply`: only kp_id NULL rows,
// never a kp_id that another movie has.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Pool } from 'mysql2/promise';

import { REPORT_COLUMNS, reportCsvRow, type ReportRow } from './backfill.js';
import { applyKpId } from './db.js';
import { ReportWriter } from './report.js';

export async function readReport(file: string): Promise<ReportRow[]> {
  const byMovie = new Map<number, ReportRow>();
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    if (!line.trim()) continue;
    const row = JSON.parse(line) as ReportRow;
    // a batch can be written twice after a crash; the later line wins
    byMovie.delete(row.movieId);
    byMovie.set(row.movieId, row);
  }
  return [...byMovie.values()];
}

export async function runApplyReport(
  opts: { file: string; outDir: string; log?: (line: string) => void },
  deps: { pool: Pool },
) {
  const log = opts.log ?? (() => undefined);
  const rows = (await readReport(opts.file)).filter((r) => r.status === 'confident' && r.kpId !== null);
  log(`${rows.length} confident matches in ${opts.file}`);
  const base = join(opts.outDir, 'apply-report');
  const report = new ReportWriter<ReportRow>(
    { csv: `${base}.csv`, jsonl: `${base}.jsonl` },
    REPORT_COLUMNS,
    reportCsvRow,
  );
  await report.open();
  const totals: Record<string, number> = {};
  const out: ReportRow[] = [];
  for (const [i, r] of rows.entries()) {
    const row: ReportRow = { ...r, conflictMovieIds: [] };
    try {
      const res = await applyKpId(deps.pool, row.movieId, row.kpId as number, row.tmdbId);
      row.action = res.result;
      if (res.result === 'duplicate') row.conflictMovieIds = res.movieIds;
    } catch (err) {
      row.action = 'error';
      row.reasons = [...row.reasons, `update failed: ${(err as Error).message}`];
    }
    totals[row.action] = (totals[row.action] ?? 0) + 1;
    out.push(row);
    if (out.length >= 200 || i === rows.length - 1) {
      await report.append(out.splice(0));
      log(`${i + 1}/${rows.length}: ${JSON.stringify(totals)}`);
    }
  }
  return { totals, reportCsv: `${base}.csv`, reportJsonl: `${base}.jsonl` };
}
