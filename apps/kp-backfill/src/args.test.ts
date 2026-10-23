import { describe, expect, it } from 'vitest';

import { parseCli } from './args.js';
import { ConfigError, dbConfigFromEnv, describeDb, kpApiKeyFromEnv } from './env.js';
import { csvLine } from './report.js';

describe('parseCli', () => {
  it('defaults to a dry-run match', () => {
    const cli = parseCli([]);
    expect(cli.command).toBe('match');
    if (cli.command === 'help') throw new Error('unreachable');
    // every movie with kp_id NULL has kp_error='not_found' in production, so they are included by default
    expect(cli.match).toMatchObject({ apply: false, includeErrored: true, batchSize: 100, concurrency: 2 });
    expect(cli.rps).toBe(4);
  });

  it('reads the options', () => {
    const cli = parseCli(['match', '--apply', '--skip-errored', '--ids', '3,1', '--limit', '10', '--rps', '2.5']);
    if (cli.command === 'help') throw new Error('unreachable');
    expect(cli.match).toMatchObject({ apply: true, includeErrored: false, ids: [3, 1], limit: 10 });
    expect(cli.rps).toBe(2.5);
    const legacy = parseCli(['match', '--include-errored']);
    expect(legacy.command !== 'help' && legacy.match.includeErrored).toBe(true);
    expect(parseCli(['duplicates', '--out-dir', '/tmp/x']).command).toBe('duplicates');
    expect(parseCli(['dedupe-plan', '--fetch-kp'])).toMatchObject({ command: 'dedupe-plan', fetchKp: true });
    expect(parseCli(['dedupe-apply', 'plan.jsonl'])).toMatchObject({ command: 'dedupe-apply', file: 'plan.jsonl' });
  });

  it('rejects bad input', () => {
    expect(() => parseCli(['nope'])).toThrow(ConfigError);
    expect(() => parseCli(['--batch-size', '0'])).toThrow(ConfigError);
    expect(() => parseCli(['--unknown'])).toThrow(ConfigError);
    expect(() => parseCli(['dedupe-apply'])).toThrow(/plan .jsonl/);
    expect(() => parseCli(['match', '--skip-errored', '--include-errored'])).toThrow(ConfigError);
    expect(() => parseCli(['match', '--fetch-kp'])).toThrow(/fetch-kp/);
  });
});

describe('env', () => {
  it('needs DB_NAME and never shows the password', () => {
    expect(() => dbConfigFromEnv({})).toThrow(/DB_NAME/);
    const c = dbConfigFromEnv({ DB_NAME: 'flicktips', DB_PORT: '3307', DB_PASSWORD: 's3cret' });
    expect(c).toMatchObject({ host: '127.0.0.1', port: 3307, user: 'flicktips', database: 'flicktips' });
    expect(describeDb(c)).toBe('flicktips@127.0.0.1:3307/flicktips (password set)');
    expect(describeDb(c)).not.toContain('s3cret');
    expect(() => kpApiKeyFromEnv({})).toThrow(/KP_API_KEY/);
  });
});

describe('csvLine', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvLine([1, 'a,b', 'say "hi"', null, 'x\ny', true])).toBe('1,"a,b","say ""hi""",,"x\ny",true\n');
  });
});
