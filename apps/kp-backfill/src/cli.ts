#!/usr/bin/env node
// kp-backfill: fills movie.kp_id from Кинопоиск search (see README.md). Dry run unless --apply.
import { createDb } from '@flicktips/db';
import { KinopoiskClient } from '@flicktips/kinopoisk';

import { runApplyReport } from './apply-report.js';
import { parseCli, USAGE } from './args.js';
import { runMatch } from './backfill.js';
import { runDedupeApply, runDedupePlan } from './dedupe.js';
import { runDuplicates } from './duplicates.js';
import { ConfigError, dbConfigFromEnv, describeDb, kpApiKeyFromEnv } from './env.js';
import { rateLimiter } from './rate-limit.js';

async function main(argv: string[]): Promise<number> {
  const cli = parseCli(argv);
  if (cli.command === 'help') {
    console.log(USAGE);
    return 0;
  }
  const log = (line: string) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${line}`);
  const dbConfig = dbConfigFromEnv();
  const apiKey = cli.command === 'match' || cli.fetchKp ? kpApiKeyFromEnv() : '';
  log(`database ${describeDb(dbConfig)}`);
  const { db, pool } = createDb(dbConfig);
  try {
    // duplicates / dedupe-plan --fetch-kp
    const fetch = cli.fetchKp
      ? {
          client: new KinopoiskClient({ apiKey, concurrency: 1 }),
          maxRequests: cli.match.maxRequests,
          beforeRequest: rateLimiter(cli.rps),
        }
      : undefined;
    if (cli.command === 'duplicates') {
      const s = await runDuplicates({ outDir: cli.outDir, database: dbConfig.database, fetch, log }, { pool });
      log(`report: ${s.reportCsv}, ${s.reportJsonl}`);
      return 0;
    }
    if (cli.command === 'dedupe-plan') {
      log('dedupe-plan: read-only, no database writes');
      const s = await runDedupePlan({ outDir: cli.outDir, database: dbConfig.database, fetch, log }, { pool });
      log(`plan: ${s.planCsv}, ${s.planJsonl}`);
      return 0;
    }
    if (cli.command === 'dedupe-apply') {
      log('APPLY: kp_id will be cleared on the auto_safe and approved groups of the plan');
      const s = await runDedupeApply(
        { file: cli.file as string, outDir: cli.outDir, database: dbConfig.database, log },
        { pool },
      );
      log(`totals: ${JSON.stringify(s.totals)}; ${s.cleared} kp_ids cleared`);
      log(`report: ${s.reportCsv}, ${s.reportJsonl}`);
      return s.totals.error ? 1 : 0;
    }
    if (cli.command === 'apply-report') {
      log('APPLY: kp_id will be written for the confident matches of the report');
      const s = await runApplyReport({ file: cli.file as string, outDir: cli.outDir, log }, { pool });
      log(`totals: ${JSON.stringify(s.totals)}`);
      log(`report: ${s.reportCsv}, ${s.reportJsonl}`);
      return 0;
    }
    log(cli.match.apply ? 'APPLY: kp_id will be written for confident matches' : 'dry run: no database writes');
    // first Ctrl-C: finish the movies in flight, write them and the checkpoint; second: exit at once
    const interrupt = new AbortController();
    process.on('SIGINT', () => {
      if (interrupt.signal.aborted) process.exit(130);
      log('interrupted: finishing the current searches (Ctrl-C again to quit now)');
      interrupt.abort();
    });
    const kp = new KinopoiskClient({ apiKey, concurrency: cli.match.concurrency });
    const s = await runMatch(
      { ...cli.match, log, signal: interrupt.signal },
      {
        db,
        pool,
        kp,
        target: { database: dbConfig.database, host: `${dbConfig.host}:${dbConfig.port}` },
        beforeRequest: rateLimiter(cli.rps),
      },
    );
    log(`stopped: ${s.stoppedBy}; ${s.processed} movies, ${s.requests} requests; cursor ${s.cursor}`);
    log(`totals: ${JSON.stringify(s.totals)}`);
    log(`report: ${s.reportCsv}, ${s.reportJsonl}`);
    return s.stoppedBy === 'fatal_error' || s.stoppedBy === 'errors' ? 2 : 0;
  } finally {
    await pool.end();
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err: unknown) => {
    if (err instanceof ConfigError) {
      console.error(`kp-backfill: ${err.message}\n\n${USAGE}`);
      process.exit(64);
    }
    console.error(`kp-backfill: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
