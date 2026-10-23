// Integration test of dedupe-plan / dedupe-apply on a throwaway MySQL database (TEST_DB_*, see packages/db).
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { schema } from '@flicktips/db';
import { createTestDatabase, testDbServer, type TestDatabase } from '@flicktips/db/testing';
import type { KpFilm } from '@flicktips/kinopoisk';
import { asc } from 'drizzle-orm';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { PlanRow } from './dedupe-score.js';
import { readPlan, runDedupeApply, runDedupePlan, type ApplyGroupRow, type FilmClient } from './dedupe.js';
import { runDuplicates } from './duplicates.js';

const { movie, movieVote, bookmark, user } = schema;

type MovieInsert = typeof movie.$inferInsert;

describe.skipIf(!testDbServer())('dedupe-plan / dedupe-apply against MySQL', () => {
  let t: TestDatabase;
  let outDir: string;
  let users: number[] = [];
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(async () => {
    await t?.drop();
  });

  const film = (title: string, originalTitle: string, releaseDate: string | null, over: MovieInsert = {}) => ({
    type: 'movie',
    title,
    originalTitle,
    releaseDate,
    ...over,
  });

  beforeEach(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'kp-dedupe-'));
    for (const table of ['movie_vote', 'bookmark', 'movie', 'user']) await t.pool.query(`DELETE FROM \`${table}\``);
    users = [];
    for (const name of ['a', 'b']) {
      const [res] = await t.db.insert(user).values({ username: name });
      users.push(res.insertId);
    }
    const matrixKp = { kpId: 316, kpTitle: 'Матрица: Революция', kpRatingValue: 7.6, kpCheckDate: '2026-01-01' };
    const bratKp = { kpId: 41519, kpTitle: 'Брат', kpReleaseDate: '1997-05-17' };
    const rows: Record<string, MovieInsert> = {
      // kp 316: "The Rev" got the kp_id of The Matrix Revolutions and is the older row
      rev: film('Преподобный', 'The Rev', '2002-01-01', { tmdbId: '1', ...matrixKp }),
      matrix: film('Матрица: Революция', 'The Matrix Revolutions', '2003-11-05', { tmdbId: '2', ...matrixKp }),
      // kp 41519: Брат (1997) and a Брат without a year
      bratNoYear: film('Брат', 'Brat', null, { tmdbId: '3', ...bratKp }),
      brat: film('Брат', 'Brother', '1997-05-17', { tmdbId: '4', ...bratKp }),
      // kp 500: two equal movies, no clear winner
      twinA: film('Близнецы', 'Twins', '2005-01-01', { tmdbId: '5', kpId: 500, kpTitle: 'Близнецы' }),
      twinB: film('Близнецы', 'Twins', '2005-01-01', { tmdbId: '6', kpId: 500, kpTitle: 'Близнецы' }),
      // kp 600: the namesake that would lose the kp_id has votes
      ironMan: film('Железный человек', 'Iron Man', '2008-04-30', {
        tmdbId: '7',
        kpId: 600,
        kpTitle: 'Железный человек',
      }),
      ironMaking: film('Как снимали «Железного человека»', 'Making Iron Man', '2008-09-30', {
        tmdbId: '8',
        kpId: 600,
        kpTitle: 'Железный человек',
      }),
      // kp 700 and 800: auto_safe, but they change between the plan and the apply
      leon: film('Леон', 'Léon', '1994-09-14', { tmdbId: '9', kpId: 700, kpTitle: 'Леон' }),
      leonDoc: film('Леон: за кадром', 'Leon: Behind the Scenes', '2015-01-01', {
        tmdbId: '10',
        kpId: 700,
        kpTitle: 'Леон',
      }),
      up: film('Вверх', 'Up', '2009-05-28', { tmdbId: '11', kpId: 800, kpTitle: 'Вверх' }),
      upShort: film('Дуг на свидании', "Dug's Special Mission", '2009-11-10', {
        tmdbId: '12',
        kpId: 800,
        kpTitle: 'Вверх',
      }),
      // not a duplicate
      single: film('Шоу Трумана', 'The Truman Show', '1998-06-04', { tmdbId: '13', kpId: 252, kpTitle: 'Шоу Трумана' }),
    };
    for (const [key, values] of Object.entries(rows)) {
      const [res] = await t.db.insert(movie).values(values);
      ids[key] = res.insertId;
    }
    await t.db.insert(movieVote).values([
      { movieId: ids.matrix!, userId: users[0]!, vote: 2 },
      { movieId: ids.ironMaking!, userId: users[0]!, vote: 1 },
    ]);
  });
  afterEach(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  const snapshot = async () => t.db.select().from(movie).orderBy(asc(movie.id));
  const plan = () => runDedupePlan({ outDir, database: t.name }, { pool: t.pool });
  const byKp = (rows: PlanRow[]) => Object.fromEntries(rows.map((r) => [r.kpId, r]));
  const writePlan = async (rows: PlanRow[]) => {
    const file = join(outDir, 'reviewed.jsonl');
    await writeFile(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    return file;
  };
  const apply = (file: string, database = t.name) => runDedupeApply({ file, outDir, database }, { pool: t.pool });
  const applyRows = async () =>
    Object.fromEntries(
      (await readFile(join(outDir, 'dedupe-apply.jsonl'), 'utf8'))
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as ApplyGroupRow)
        .map((r) => [r.kpId, r]),
    );

  it('dedupe-plan is read-only and sorts the groups into auto_safe and needs_review', async () => {
    const before = await snapshot();
    const s = await plan();
    expect(await snapshot()).toEqual(before);
    expect(s).toMatchObject({ groups: 6, autoSafe: 4, needsReview: 2, autoSafeClears: 4 });

    const p = byKp(await readPlan(s.planJsonl));
    expect(p[316]).toMatchObject({ status: 'auto_safe', keepId: ids.matrix, clearIds: [ids.rev], database: t.name });
    expect(p[41519]).toMatchObject({ status: 'auto_safe', keepId: ids.brat, clearIds: [ids.bratNoYear] });
    expect(p[41519]?.kp).toEqual({ title: 'Брат', originalTitle: null, year: 1997, type: null, source: 'db' });
    expect(p[500]).toMatchObject({ status: 'needs_review', keepId: ids.twinA, approve: false });
    expect(p[500]?.reasons.join()).toContain('no clear winner');
    expect(p[600]).toMatchObject({ status: 'needs_review', keepId: ids.ironMan, clearIds: [ids.ironMaking] });
    expect(p[600]?.reasons.join()).toContain('votes/bookmarks on movies that would lose the kp_id');
    expect(p[252]).toBeUndefined();

    const csv = await readFile(s.planCsv, 'utf8');
    expect(csv.startsWith('﻿kp_id,status,action,movie_id')).toBe(true);
    expect(csv.split('\n').filter(Boolean)).toHaveLength(13);

    // duplicates suggests the same keep
    const d = await runDuplicates({ outDir, database: t.name }, { pool: t.pool });
    const groups = (await readFile(d.reportJsonl, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    expect(groups.find((g) => g.kpId === 316)).toMatchObject({ suggestKeep: ids.matrix, status: 'auto_safe' });
  });

  it('dedupe-apply clears the auto_safe and approved groups and refuses what changed since the plan', async () => {
    const s = await plan();
    const rows = await readPlan(s.planJsonl);
    // a human approves the twins (keep A), leaves Iron Man for later
    const reviewed = rows.map((r) => (r.kpId === 500 ? { ...r, approve: true } : r));
    const file = await writePlan(reviewed);
    // meanwhile: someone votes for the Леон documentary, kp-parser moves "Dug's Special Mission" to its own kp_id
    await t.db.insert(movieVote).values({ movieId: ids.leonDoc!, userId: users[1]!, vote: 1 });
    await t.pool.query('UPDATE movie SET kp_id = 801 WHERE id = ?', [ids.upShort]);
    const movieCount = (await snapshot()).length;

    const res = await apply(file);
    expect(res.totals).toEqual({ applied: 3, not_approved: 1, changed: 2 });
    expect(res.cleared).toBe(3);
    const report = await applyRows();
    expect(report[700]?.reasons.join()).toContain(`movie ${ids.leonDoc} has 1 votes and 0 bookmarks now`);
    expect(report[800]?.reasons.join()).toContain(`movie ${ids.upShort} has kp_id 801, not 800`);
    expect(report[316]?.before).toEqual([
      expect.objectContaining({
        id: ids.rev,
        kp_id: '316',
        kp_title: 'Матрица: Революция',
        kp_check_date: '2026-01-01',
      }),
    ]);

    const after = Object.fromEntries((await snapshot()).map((m) => [m.id, m]));
    expect(Object.keys(after)).toHaveLength(movieCount);
    const today = (await t.pool.query<RowDataPacket[]>('SELECT CAST(CURDATE() AS CHAR) AS d'))[0][0]?.d;
    for (const id of [ids.rev, ids.bratNoYear, ids.twinB]) {
      expect(after[id!]).toMatchObject({
        kpId: null,
        kpError: 'not_found',
        kpCheckDate: today,
        kpForceCheck: 0,
        kpTitle: null,
        kpRatingValue: null,
        kpReleaseDate: null,
      });
    }
    expect(after[ids.matrix!]).toMatchObject({ kpId: 316, kpTitle: 'Матрица: Революция', kpRatingValue: 7.6 });
    expect(after[ids.brat!]?.kpId).toBe(41519);
    expect(after[ids.twinA!]?.kpId).toBe(500);
    // refused groups are untouched
    expect([after[ids.ironMaking!]?.kpId, after[ids.leonDoc!]?.kpId, after[ids.up!]?.kpId]).toEqual([600, 700, 800]);
    // votes stay where they were
    expect((await t.db.select().from(movieVote)).map((v) => v.movieId).sort()).toEqual(
      [ids.matrix, ids.ironMaking, ids.leonDoc].sort(),
    );

    // duplicates no longer lists the applied groups (800 is no group any more either: 801 took one movie)
    const d = await runDuplicates({ outDir, database: t.name }, { pool: t.pool });
    const left = (await readFile(d.reportJsonl, 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l).kpId);
    expect(left).toEqual([600, 700]);

    // a second apply changes nothing
    const again = await apply(file);
    expect(again.totals).toEqual({ already_applied: 3, not_approved: 1, changed: 2 });
    expect(await snapshot()).toEqual(Object.values(after));
  });

  it('refuses a plan from another database, an inconsistent plan and new movies in the group', async () => {
    const s = await plan();
    const p = byKp(await readPlan(s.planJsonl));
    const brat = p[41519] as PlanRow;
    const matrix = p[316] as PlanRow;
    const twins = p[500] as PlanRow;
    const file = await writePlan([
      { ...brat, clearIds: [] },
      { ...matrix, keepId: matrix.clearIds[0] as number, clearIds: matrix.clearIds },
      { ...twins, approve: true },
    ]);
    // a third movie got kp 500 after the plan
    await t.db.insert(movie).values(film('Близнецы', 'Twins', '2005-02-01', { tmdbId: '14', kpId: 500 }));
    const before = await snapshot();

    expect((await apply(file, 'flicktips')).totals).toEqual({ invalid_plan: 2, wrong_database: 1 });
    const res = await apply(file);
    expect(res.totals).toEqual({ invalid_plan: 2, changed: 1 });
    const report = await applyRows();
    expect(report[41519]?.reasons[0]).toContain('clearIds must be every movie but the keep');
    expect(report[316]?.reasons[0]).toBe('keepId is also in clearIds');
    expect(report[500]?.reasons.join()).toMatch(/movies not in the plan have kp_id 500 now/);
    expect(await snapshot()).toEqual(before);

    // the tmdb_id of a cleared movie changed: the plan is for other rows
    await t.pool.query('UPDATE movie SET tmdb_id = ? WHERE id = ?', ['999', ids.rev]);
    const changed = await apply(await writePlan([matrix]));
    expect(changed.totals).toEqual({ changed: 1 });
    expect((await applyRows())[316]?.reasons[0]).toContain('has tmdb_id 999, not 1');
  });

  it('a new bookmark on a movie to clear stops the group', async () => {
    const s = await plan();
    const file = await writePlan([byKp(await readPlan(s.planJsonl))[316] as PlanRow]);
    await t.db.insert(bookmark).values({ movieId: ids.rev!, userId: users[0]! });
    expect((await apply(file)).totals).toEqual({ changed: 1 });
    expect((await snapshot()).find((m) => m.id === ids.rev)?.kpId).toBe(316);
  });

  it('--fetch-kp fetches the films the database knows too little about, once', async () => {
    // kp 500 has no kp_title in the database any more; 600 has no year
    await t.pool.query('UPDATE movie SET kp_title = NULL WHERE kp_id = 500');
    const calls: number[] = [];
    const client: FilmClient = {
      getFilm: async (id) => {
        calls.push(id);
        if (id === 500)
          return { nameRu: 'Близнецы', nameOriginal: 'Twins', nameEn: null, year: 2005, type: 'FILM' } as KpFilm;
        return null;
      },
    };
    const s = await runDedupePlan({ outDir, database: t.name, fetch: { client } }, { pool: t.pool });
    // 41519 has its year in the database (kp_release_date), the others do not
    expect(calls.sort((a, b) => a - b)).toEqual([316, 500, 600, 700, 800]);
    const p = byKp(await readPlan(s.planJsonl));
    expect(p[500]?.kp).toEqual({ title: 'Близнецы', originalTitle: 'Twins', year: 2005, type: 'FILM', source: 'api' });
    // Кинопоиск has no film 600: nobody keeps it without a review
    expect(p[600]).toMatchObject({ status: 'needs_review', kp: { source: 'none' } });
    expect(p[41519]?.kp.source).toBe('db');

    calls.length = 0;
    await runDedupePlan({ outDir, database: t.name, fetch: { client, maxRequests: 0 } }, { pool: t.pool });
    expect(calls).toEqual([]);
    expect(JSON.parse(await readFile(join(outDir, 'kp-films.json'), 'utf8'))).toHaveProperty('500');
  });

  it('once duplicates are 0, migration 002 adds the UNIQUE key', async () => {
    // resolve every group: apply the auto_safe ones, approve the others as planned
    const s = await plan();
    const rows = (await readPlan(s.planJsonl)).map((r) => ({ ...r, approve: true }));
    expect((await apply(await writePlan(rows))).totals).toEqual({ applied: 6 });
    expect((await runDuplicates({ outDir, database: t.name }, { pool: t.pool })).groups).toBe(0);

    const file = fileURLToPath(new URL('../../../packages/db/migrations/002-movie-kp-id-unique.sql', import.meta.url));
    const statements = (await readFile(file, 'utf8'))
      .split('\n')
      .filter((l) => l.trim() && !l.trimStart().startsWith('--'));
    expect(statements).toHaveLength(2);
    expect(statements[1]).toBe('ALTER TABLE `movie` DROP INDEX `kp_id`, ADD UNIQUE KEY `kp_id` (`kp_id`);');
    // the server's default strict sql_mode, as in production
    const conn = await t.pool.getConnection();
    try {
      await conn.query('SET SESSION sql_mode = DEFAULT');
      for (const sql of statements) await conn.query(sql);
    } finally {
      conn.release();
    }
    await expect(t.pool.query('UPDATE movie SET kp_id = 316 WHERE id = ?', [ids.rev])).rejects.toMatchObject({
      code: 'ER_DUP_ENTRY',
    });
    // NULLs are not duplicates
    await t.pool.query('UPDATE movie SET kp_id = NULL WHERE id = ?', [ids.single]);
  });
});
