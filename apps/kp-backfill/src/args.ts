// Command-line arguments of kp-backfill.
import { parseArgs } from 'node:util';

import type { MatchOptions } from './backfill.js';
import { ConfigError } from './env.js';

export const USAGE = `Usage:
  kp-backfill match [options]     search Кинопоиск for movies with kp_id NULL (dry run: report only)
  kp-backfill apply-report <file>  write the confident matches of a reviewed match-dry-run.jsonl (no searches)
  kp-backfill duplicates [options] report movies that share a kp_id (read-only)
  kp-backfill dedupe-plan [options] plan which movie of each kp_id group keeps it (read-only)
  kp-backfill dedupe-apply <file>  clear kp_id on the auto_safe / approved rows of a dedupe-plan.jsonl

match options:
  --apply                write kp_id for confident matches (never overwrites, refuses kp_ids in use)
  --skip-errored         skip movies kp-parser marked with kp_error (by default they are searched too)
  --batch-size <n>       movies per batch and checkpoint (default 100)
  --concurrency <n>      movies searched at once (default 2)
  --rps <n>              Кинопоиск requests per second (default 4)
  --limit <n>            stop after n movies in this run
  --max-requests <n>     stop before more than n Кинопоиск requests in this run (daily quota)
  --from-id <id>         start after this movie id instead of the checkpoint
  --max-id <id>          only movies with id <= this
  --ids <a,b,c>          only these movie ids (no checkpoint; separate report files)
  --restart              ignore the checkpoint and start new report files
duplicates / dedupe-plan options:
  --fetch-kp             fetch the Кинопоиск film of the groups whose kp_title or year is not in the database
                         (needs KP_API_KEY; cached in <out-dir>/kp-films.json; --max-requests and --rps apply)
common:
  --out-dir <dir>        reports and checkpoint (default ./kp-backfill-out)

Environment: DB_NAME (required), DB_HOST (127.0.0.1), DB_PORT (3306), DB_USER (flicktips), DB_PASSWORD,
KP_API_KEY (match, and --fetch-kp).`;

export type Command = 'match' | 'duplicates' | 'apply-report' | 'dedupe-plan' | 'dedupe-apply';

const COMMANDS: Command[] = ['match', 'duplicates', 'apply-report', 'dedupe-plan', 'dedupe-apply'];
// commands that take a file argument
const FILE_COMMANDS: Partial<Record<Command, string>> = {
  'apply-report': 'apply-report needs the dry-run .jsonl file',
  'dedupe-apply': 'dedupe-apply needs the dedupe-plan .jsonl file',
};

const int = (name: string, value: string | undefined, min = 1): number | undefined => {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) throw new ConfigError(`--${name} must be an integer >= ${min}`);
  return n;
};

const parseOptions = (argv: string[]) =>
  parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      apply: { type: 'boolean', default: false },
      'skip-errored': { type: 'boolean', default: false },
      // the old opt-in, now the default; still accepted
      'include-errored': { type: 'boolean', default: false },
      'fetch-kp': { type: 'boolean', default: false },
      'batch-size': { type: 'string' },
      concurrency: { type: 'string' },
      rps: { type: 'string' },
      limit: { type: 'string' },
      'max-requests': { type: 'string' },
      'from-id': { type: 'string' },
      'max-id': { type: 'string' },
      ids: { type: 'string' },
      restart: { type: 'boolean', default: false },
      'out-dir': { type: 'string', default: 'kp-backfill-out' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

export type Cli =
  | { command: 'help' }
  | {
      command: Command;
      match: Omit<MatchOptions, 'log'>;
      rps: number;
      outDir: string;
      // apply-report: the dry-run JSONL; dedupe-apply: the plan JSONL
      file?: string;
      fetchKp: boolean;
    };

export function parseCli(argv: string[]): Cli {
  let parsed;
  try {
    parsed = parseOptions(argv);
  } catch (err) {
    throw new ConfigError((err as Error).message);
  }
  const { values, positionals } = parsed;
  const command = positionals[0] ?? 'match';
  if (values.help || command === 'help') return { command: 'help' };
  if (!COMMANDS.includes(command as Command)) throw new ConfigError(`unknown command ${command}`);
  const fileError = FILE_COMMANDS[command as Command];
  const file = fileError ? positionals[1] : undefined;
  if (fileError && !file) throw new ConfigError(fileError);
  if (values['skip-errored'] && values['include-errored'])
    throw new ConfigError('--skip-errored and --include-errored contradict each other');
  if (values['fetch-kp'] && !['duplicates', 'dedupe-plan'].includes(command))
    throw new ConfigError('--fetch-kp is for duplicates and dedupe-plan');
  if (positionals.length > (file ? 2 : 1)) throw new ConfigError(`unexpected argument ${positionals.at(-1)}`);
  const ids = values.ids
    ?.split(',')
    .filter(Boolean)
    .map((s) => int('ids', s.trim()) as number);
  const match: Omit<MatchOptions, 'log'> = {
    apply: values.apply,
    includeErrored: !values['skip-errored'],
    batchSize: int('batch-size', values['batch-size']) ?? 100,
    concurrency: int('concurrency', values.concurrency) ?? 2,
    limit: int('limit', values.limit),
    maxRequests: int('max-requests', values['max-requests']),
    fromId: int('from-id', values['from-id'], 0),
    maxId: int('max-id', values['max-id']),
    ids: ids?.length ? ids : undefined,
    restart: values.restart,
    outDir: values['out-dir'],
  };
  const rps = Number(values.rps ?? 4);
  if (!(rps > 0)) throw new ConfigError('--rps must be a positive number');
  return { command: command as Command, match, rps, outDir: values['out-dir'], file, fetchKp: values['fetch-kp'] };
}
