// Integration test: a throwaway MySQL database (TEST_DB_*, see packages/db) and a fake Кинопоиск client.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { schema } from '@flicktips/db';
import { createTestDatabase, testDbServer, type TestDatabase } from '@flicktips/db/testing';
import { KinopoiskError, type KpFilmListItem, type SearchFilmsParams } from '@flicktips/kinopoisk';
import { asc } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runApplyReport } from './apply-report.js';
import { runMatch, type MatchOptions, type ReportRow, type SearchClient } from './backfill.js';
import { readCheckpoint } from './checkpoint.js';
import { runDuplicates } from './duplicates.js';

const { movie, movieVote, bookmark, user } = schema;

const kp = (kinopoiskId: number, nameRu: string, year: number, over: Partial<KpFilmListItem> = {}): KpFilmListItem => ({
  kinopoiskId,
  imdbId: null,
  nameRu,
  nameEn: null,
  nameOriginal: null,
  countries: [],
  genres: [],
  ratingKinopoisk: null,
  ratingImdb: null,
  year,
  type: 'FILM',
  posterUrl: null,
  posterUrlPreview: null,
  ...over,
});

// keyword -> search results; `failAfter` makes the n+1-th call fail with 402 (daily quota used up)
class FakeKinopoisk implements SearchClient {
  calls: SearchFilmsParams[] = [];
  failAfter = Infinity;
  constructor(private readonly results: Record<string, KpFilmListItem[]>) {}
  async searchFilms(params: SearchFilmsParams) {
    if (this.calls.length >= this.failAfter) throw new KinopoiskError('Kinopoisk 402 for /api/v2.2/films', 402);
    this.calls.push(params);
    const items = this.results[params.keyword ?? ''] ?? [];
    return { total: items.length, totalPages: 1, items };
  }
}

const results: Record<string, KpFilmListItem[]> = {
  'The Truman Show': [kp(252, 'Шоу Трумана', 1998, { nameOriginal: 'The Truman Show' })],
  // two films of the same name in one year
  Twins: [kp(500, 'Близнецы', 2005, { nameOriginal: 'Twins' }), kp(501, 'Близнецы', 2005, { nameOriginal: 'Twins' })],
  Близнецы: [kp(500, 'Близнецы', 2005, { nameOriginal: 'Twins' })],
  // found only by the Russian title, second search
  'Брат 2': [kp(41519, 'Брат 2', 2000)],
  // the kp_id of the already matched movie 'Leon'
  // (the original title is too different, the Russian one matches)
  'Léon: The Professional': [kp(389, 'Леон', 1994, { nameOriginal: 'Léon' })],
  Леон: [kp(389, 'Леон', 1994, { nameOriginal: 'Léon' })],
  // two TMDb rows of the same film: the first match wins, the second is a duplicate
  'Same Film': [kp(9000, 'Тот же фильм', 2010, { nameOriginal: 'Same Film' })],
  'Errored Before': [kp(7000, 'Ошибка', 2001, { nameOriginal: 'Errored Before' })],
};

describe.skipIf(!testDbServer())('kp-backfill against MySQL', () => {
  let t: TestDatabase;
  let outDir: string;
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'kp-backfill-'));
    await t.pool.query('DELETE FROM movie_vote');
    await t.pool.query('DELETE FROM bookmark');
    await t.pool.query('DELETE FROM movie');
    const rows = [
      {
        key: 'leon',
        tmdbId: '101',
        type: 'movie',
        title: 'Леон',
        originalTitle: 'Leon',
        releaseDate: '1994-09-14',
        kpId: 389,
      },
      {
        key: 'truman',
        tmdbId: '102',
        type: 'movie',
        title: 'Шоу Трумана',
        originalTitle: 'The Truman Show',
        releaseDate: '1998-06-04',
      },
      {
        key: 'twins',
        tmdbId: '103',
        type: 'movie',
        title: 'Близнецы',
        originalTitle: 'Twins',
        releaseDate: '2005-01-01',
      },
      {
        key: 'brat',
        tmdbId: '104',
        type: 'movie',
        title: 'Брат 2',
        originalTitle: 'Brother 2',
        releaseDate: '2000-05-11',
      },
      {
        key: 'leon2',
        tmdbId: '105',
        type: 'movie',
        title: 'Леон',
        originalTitle: 'Léon: The Professional',
        releaseDate: '1994-09-14',
      },
      {
        key: 'same1',
        tmdbId: '106',
        type: 'movie',
        title: 'Тот же фильм',
        originalTitle: 'Same Film',
        releaseDate: '2010-01-01',
      },
      {
        key: 'same2',
        tmdbId: '107',
        type: 'movie',
        title: 'Тот же фильм',
        originalTitle: 'Same Film',
        releaseDate: '2010-03-01',
      },
      {
        key: 'nothing',
        tmdbId: '108',
        type: 'movie',
        title: 'Неизвестно',
        originalTitle: 'Unknown Thing',
        releaseDate: '2012-01-01',
      },
      {
        key: 'errored',
        tmdbId: '109',
        type: 'movie',
        title: 'Ошибка',
        originalTitle: 'Errored Before',
        releaseDate: '2001-01-01',
        kpError: 'not_found',
      },
    ];
    for (const { key, ...values } of rows) {
      const [res] = await t.db.insert(movie).values(values);
      ids[key] = res.insertId;
    }
  });
  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  const opts = (over: Partial<MatchOptions> = {}): MatchOptions => ({
    apply: false,
    includeErrored: false,
    batchSize: 3,
    concurrency: 2,
    restart: false,
    outDir,
    ...over,
  });
  const deps = (client: SearchClient) => ({
    db: t.db,
    pool: t.pool,
    kp: client,
    target: { database: t.name, host: 'test' },
  });
  const kpIds = async () =>
    Object.fromEntries(
      (await t.db.select({ id: movie.id, kpId: movie.kpId }).from(movie).orderBy(asc(movie.id))).map((r) => [
        r.id,
        r.kpId,
      ]),
    );
  const readJsonl = async (path: string) =>
    (await readFile(path, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as ReportRow);
  const byMovie = (rows: ReportRow[]) => Object.fromEntries(rows.map((r) => [r.movieId, r]));

  it('dry run reports every movie and writes nothing', async () => {
    const before = await kpIds();
    const client = new FakeKinopoisk(results);
    const s = await runMatch(opts(), deps(client));
    expect(s.stoppedBy).toBe('done');
    expect(await kpIds()).toEqual(before);

    const rows = byMovie(await readJsonl(s.reportJsonl));
    expect(Object.keys(rows)).toHaveLength(7); // kp_id set and kp_error rows are not selected
    expect(rows[ids.truman!]).toMatchObject({ status: 'confident', action: 'would_apply', kpId: 252 });
    expect(rows[ids.twins!]).toMatchObject({ status: 'ambiguous', action: 'skipped' });
    expect(rows[ids.twins!]?.reasons.join(' ')).toContain('other close candidate');
    expect(rows[ids.brat!]).toMatchObject({ status: 'confident', kpId: 41519, requests: 2 });
    expect(rows[ids.leon2!]).toMatchObject({ status: 'confident', action: 'duplicate', conflictMovieIds: [ids.leon] });
    expect(rows[ids.same1!]).toMatchObject({ action: 'would_apply', kpId: 9000 });
    expect(rows[ids.same2!]).toMatchObject({ action: 'duplicate', conflictMovieIds: [ids.same1] });
    expect(rows[ids.nothing!]).toMatchObject({ status: 'not_found', action: 'skipped', kpId: null });
    expect(client.calls.find((c) => c.keyword === 'The Truman Show')).toMatchObject({ yearFrom: 1996, yearTo: 2000 });

    const csv = await readFile(s.reportCsv, 'utf8');
    expect(csv.startsWith('﻿movie_id,tmdb_id')).toBe(true);
    expect(csv.split('\n').filter(Boolean)).toHaveLength(8);
    expect(csv).toContain('https://www.kinopoisk.ru/film/252/');
  });

  it('--apply writes confident kp_ids only, never twice and never over an existing one', async () => {
    const s = await runMatch(opts({ apply: true, includeErrored: true }), deps(new FakeKinopoisk(results)));
    const after = await kpIds();
    expect(after[ids.leon!]).toBe(389);
    expect(after[ids.truman!]).toBe(252);
    expect(after[ids.brat!]).toBe(41519);
    expect(after[ids.errored!]).toBe(7000);
    expect(after[ids.twins!]).toBeNull();
    expect(after[ids.nothing!]).toBeNull();
    expect(after[ids.leon2!]).toBeNull();
    expect(after[ids.same1!]).toBe(9000);
    expect(after[ids.same2!]).toBeNull();

    const rows = byMovie(await readJsonl(s.reportJsonl));
    expect(rows[ids.leon2!]).toMatchObject({ action: 'duplicate', conflictMovieIds: [ids.leon] });
    expect(rows[ids.same2!]).toMatchObject({ action: 'duplicate', conflictMovieIds: [ids.same1] });
    expect(s.totals).toMatchObject({ applied: 4, duplicate: 2, confident: 6, ambiguous: 1, not_found: 1 });

    // a second run finds only the movies that are still NULL and changes nothing
    const again = await runMatch(
      opts({ apply: true, includeErrored: true, restart: true }),
      deps(new FakeKinopoisk(results)),
    );
    expect(again.totals.applied ?? 0).toBe(0);
    expect(await kpIds()).toEqual(after);
  });

  it('resumes from the checkpoint and stops cleanly when the quota is used up', async () => {
    const client = new FakeKinopoisk(results);
    client.failAfter = 3;
    const first = await runMatch(opts({ concurrency: 1 }), deps(client));
    expect(first.stoppedBy).toBe('fatal_error');
    // truman (1 request) and twins (2 requests); brat's first request fails
    expect(first.processed).toBe(2);
    expect((await readCheckpoint(join(outDir, 'match-dry-run.checkpoint.json')))?.cursor).toBe(ids.twins);

    const second = await runMatch(opts({ limit: 2 }), deps(new FakeKinopoisk(results)));
    expect(second.stoppedBy).toBe('limit');
    expect(second.processed).toBe(2);

    const third = await runMatch(opts({ maxRequests: 100 }), deps(new FakeKinopoisk(results)));
    expect(third.stoppedBy).toBe('done');
    const rows = await readJsonl(third.reportJsonl);
    expect(rows.map((r) => r.movieId)).toEqual([
      ids.truman,
      ids.twins,
      ids.brat,
      ids.leon2,
      ids.same1,
      ids.same2,
      ids.nothing,
    ]);
    expect(third.totals.would_apply).toBe(3);

    // another database must not reuse this checkpoint
    await expect(
      runMatch(opts(), { ...deps(new FakeKinopoisk(results)), target: { database: 'other', host: 'test' } }),
    ).rejects.toThrow(/belongs to another run/);
  });

  it('stops before going over --max-requests', async () => {
    const client = new FakeKinopoisk(results);
    const s = await runMatch(opts({ maxRequests: 3, concurrency: 1 }), deps(client));
    expect(client.calls).toHaveLength(3);
    expect(s.stoppedBy).toBe('max_requests');
    // truman, twins, brat (2 requests) are done
    expect(s.processed).toBe(2);
  });

  it('apply-report writes the confident rows of a dry-run report without searching', async () => {
    const dry = await runMatch(opts(), deps(new FakeKinopoisk(results)));
    // a reviewer drops Truman from the report; a concurrent writer takes Brat's kp_id meanwhile
    const lines = (await readFile(dry.reportJsonl, 'utf8')).split('\n').filter((l) => l && !l.includes('"kpId":252'));
    const reviewed = join(outDir, 'reviewed.jsonl');
    await writeFile(reviewed, lines.join('\n') + '\n');
    await t.pool.query('UPDATE movie SET kp_id = 41519 WHERE id = ?', [ids.nothing]);

    const s = await runApplyReport({ file: reviewed, outDir }, { pool: t.pool });
    expect(s.totals).toEqual({ applied: 1, duplicate: 3 });
    const after = await kpIds();
    expect(after[ids.truman!]).toBeNull();
    expect(after[ids.brat!]).toBeNull();
    expect(after[ids.same1!]).toBe(9000);
    expect(after[ids.same2!]).toBeNull();
    const rows = byMovie(await readJsonl(s.reportJsonl));
    expect(rows[ids.brat!]).toMatchObject({ action: 'duplicate', conflictMovieIds: [ids.nothing] });

    // a report from another database: the tmdb_id of the row does not match
    const foreign = join(outDir, 'foreign.jsonl');
    await writeFile(foreign, JSON.stringify({ ...rows[ids.same2!], movieId: ids.twins, kpId: 1234 }) + '\n');
    expect((await runApplyReport({ file: foreign, outDir }, { pool: t.pool })).totals).toEqual({ movie_changed: 1 });

    // running it again changes nothing
    const again = await runApplyReport({ file: reviewed, outDir }, { pool: t.pool });
    expect(again.totals).toEqual({ kp_id_already_set: 1, duplicate: 3 });
  });

  it('an interrupt finishes the movie in flight and checkpoints it', async () => {
    const interrupt = new AbortController();
    const client: SearchClient = {
      searchFilms: async (p) => {
        interrupt.abort();
        return new FakeKinopoisk(results).searchFilms(p);
      },
    };
    const s = await runMatch(opts({ concurrency: 1, signal: interrupt.signal }), deps(client));
    expect(s).toMatchObject({ stoppedBy: 'interrupted', processed: 1, cursor: ids.truman });
  });

  it('--ids processes only the given movies', async () => {
    const s = await runMatch(opts({ ids: [ids.truman!, ids.leon!] }), deps(new FakeKinopoisk(results)));
    const rows = await readJsonl(s.reportJsonl);
    expect(rows.map((r) => r.movieId)).toEqual([ids.truman]);
    expect(s.reportJsonl).toContain('match-dry-run-ids');
  });

  it('records search errors and goes on', async () => {
    const client: SearchClient = {
      searchFilms: async (p) => {
        if (p.keyword === 'Twins') throw new KinopoiskError('Kinopoisk 500 for /api/v2.2/films', 500);
        return new FakeKinopoisk(results).searchFilms(p);
      },
    };
    const s = await runMatch(opts(), deps(client));
    expect(s.stoppedBy).toBe('done');
    const rows = byMovie(await readJsonl(s.reportJsonl));
    expect(rows[ids.twins!]).toMatchObject({ status: 'error', action: 'error' });
    expect(s.totals.error).toBe(1);
  });

  it('duplicates lists movies sharing a kp_id with their votes and bookmarks', async () => {
    await t.pool.query('UPDATE movie SET kp_id = 389 WHERE id = ?', [ids.leon2]);
    await t.pool.query('UPDATE movie SET kp_id = 9000 WHERE id IN (?, ?)', [ids.same1, ids.same2]);
    const users = [];
    for (const name of ['a', 'b']) {
      const [res] = await t.db.insert(user).values({ username: name });
      users.push(res.insertId);
    }
    await t.db.insert(movieVote).values([
      { movieId: ids.leon2!, userId: users[0]!, vote: 2 },
      { movieId: ids.leon2!, userId: users[1]!, vote: 1 },
      { movieId: ids.leon!, userId: users[0]!, vote: 2 },
    ]);
    await t.db.insert(bookmark).values({ movieId: ids.same2!, userId: users[0]! });

    const s = await runDuplicates({ outDir }, { pool: t.pool });
    expect(s).toMatchObject({ groups: 2, movies: 4, extraMovies: 2 });
    const groups = (await readFile(s.reportJsonl, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    expect(groups[0]).toMatchObject({ kpId: 389, sharedVoters: 1, suggestKeep: ids.leon2 });
    expect(groups[0].movies.map((m: { id: number; votes: number }) => [m.id, m.votes])).toEqual([
      [ids.leon, 1],
      [ids.leon2, 2],
    ]);
    expect(groups[1]).toMatchObject({ kpId: 9000, sharedVoters: 0, suggestKeep: ids.same2 });
    const csv = await readFile(s.reportCsv, 'utf8');
    expect(csv.split('\n').filter(Boolean)).toHaveLength(5);
  });
});
