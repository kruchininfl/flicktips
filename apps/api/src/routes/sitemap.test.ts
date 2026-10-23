import { schema } from '@flicktips/db';
import { describe, expect, it } from 'vitest';

import { hasTestDb, signIn, useTestApp, type TestContext } from '../../test/helpers.js';

async function addMovie(ctx: TestContext, fields: Partial<typeof schema.movie.$inferInsert> = {}) {
  const [res] = await ctx.t.db.insert(schema.movie).values({ title: 'Фильм', ...fields });
  return res.insertId;
}

async function addPerson(ctx: TestContext, fields: Partial<typeof schema.people.$inferInsert> = {}) {
  const [res] = await ctx.t.db
    .insert(schema.people)
    .values({ kpId: Math.floor(Math.random() * 1e9), name: 'Человек', ...fields });
  return res.insertId;
}

const get = (ctx: TestContext, url: string) => ctx.app.inject({ method: 'GET', url });

describe.skipIf(!hasTestDb)('sitemap routes', () => {
  const ctx = useTestApp();

  // ids picked so that both chunk 0 (1…50 000) and chunk 1 (50 001…100 000) and chunk 3 have rows
  const ids = {
    voted: 10,
    checked: 11,
    plain: 12,
    suspended: 13,
    second: 50_001,
    far: 150_000,
  };
  const people = { actor: 20, suspended: 21, orphan: 22, onlySuspendedMovie: 23, second: 60_000 };
  let seeded: Promise<void> | undefined;

  const seed = () =>
    (seeded ??= (async () => {
      const voter = await signIn(ctx);
      const other = await signIn(ctx);
      await addMovie(ctx, { id: ids.voted, kpCheckDate: '2026-01-05' });
      await addMovie(ctx, { id: ids.checked, kpCheckDate: '2026-03-01' });
      await addMovie(ctx, { id: ids.plain });
      await addMovie(ctx, { id: ids.suspended, suspend: 1, kpCheckDate: '2026-09-09' });
      await addMovie(ctx, { id: ids.second });
      await addMovie(ctx, { id: ids.far, kpCheckDate: '2025-12-31' });
      // the newest vote wins over an older kp_check_date
      await ctx.t.db.insert(schema.movieVote).values([
        { movieId: ids.voted, userId: voter.id, vote: 2, timestamp: '2026-02-10 12:00:00' },
        { movieId: ids.voted, userId: other.id, vote: 3, timestamp: '2026-04-20 23:30:00' },
        { movieId: ids.checked, userId: voter.id, vote: 1, timestamp: '2026-02-01 10:00:00' },
        { movieId: ids.suspended, userId: voter.id, vote: 1, timestamp: '2026-10-01 10:00:00' },
      ]);

      await addPerson(ctx, { id: people.actor });
      await addPerson(ctx, { id: people.suspended, suspend: 1 });
      await addPerson(ctx, { id: people.orphan });
      await addPerson(ctx, { id: people.onlySuspendedMovie });
      await addPerson(ctx, { id: people.second });
      await ctx.t.db.insert(schema.group).values({ id: 1, type: 'actor', title: 'Актеры', titleSingular: 'Актер' });
      await ctx.t.db.insert(schema.moviePeople).values([
        { movieId: ids.voted, peopleId: people.actor, groupId: 1 },
        { movieId: ids.plain, peopleId: people.actor, groupId: 1 },
        { movieId: ids.voted, peopleId: people.suspended, groupId: 1 },
        { movieId: ids.suspended, peopleId: people.onlySuspendedMovie, groupId: 1 },
        { movieId: ids.second, peopleId: people.second, groupId: 1 },
      ]);
    })());

  it('lists the non-empty chunks of each kind, with counts and the movies’ newest lastmod', async () => {
    await seed();
    const res = await get(ctx, '/api/sitemap');
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.json()).toEqual({
      success: true,
      chunkSize: 50_000,
      movies: [
        { chunk: 0, count: 3, lastmod: '2026-04-20' },
        { chunk: 1, count: 1 },
        { chunk: 2, count: 1, lastmod: '2025-12-31' },
      ],
      people: [
        { chunk: 0, count: 1 },
        { chunk: 1, count: 1 },
      ],
    });
  });

  it('returns the movie ids of a chunk with their lastmod, leaving out suspended movies', async () => {
    await seed();
    const res = await get(ctx, '/api/sitemap/movies/0');
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
    expect(res.json()).toEqual({
      success: true,
      chunk: 0,
      ids: [ids.voted, ids.checked, ids.plain],
      lastmod: ['2026-04-20', '2026-03-01', null],
    });

    expect((await get(ctx, '/api/sitemap/movies/1')).json()).toEqual({
      success: true,
      chunk: 1,
      ids: [ids.second],
      lastmod: [null],
    });
    // 150 000 is the last id of chunk 2
    expect((await get(ctx, '/api/sitemap/movies/2')).json().ids).toEqual([ids.far]);
    expect((await get(ctx, '/api/sitemap/movies/3')).json()).toEqual({ success: true, chunk: 3, ids: [], lastmod: [] });
  });

  it('returns only people whose page exists: not suspended and with an unsuspended movie', async () => {
    await seed();
    expect((await get(ctx, '/api/sitemap/people/0')).json()).toEqual({ success: true, chunk: 0, ids: [people.actor] });
    expect((await get(ctx, '/api/sitemap/people/1')).json()).toEqual({ success: true, chunk: 1, ids: [people.second] });
  });

  it('agrees with the pages: every listed id has a page, the others 404', async () => {
    await seed();
    for (const id of [ids.voted, ids.checked, ids.plain, ids.second, ids.far]) {
      expect((await get(ctx, `/api/movies/${id}`)).statusCode).toBe(200);
    }
    expect((await get(ctx, `/api/movies/${ids.suspended}`)).statusCode).toBe(404);
    expect((await get(ctx, `/api/people/${people.actor}`)).statusCode).toBe(200);
    for (const id of [people.suspended, people.orphan, people.onlySuspendedMovie]) {
      expect((await get(ctx, `/api/people/${id}`)).statusCode).toBe(404);
    }
  });

  it('answers 404 for malformed or impossible chunks', async () => {
    for (const url of [
      '/api/sitemap/movies/abc',
      '/api/sitemap/movies/-1',
      '/api/sitemap/people/1.5',
      '/api/sitemap/people/999999',
      '/api/sitemap/actors/0',
    ]) {
      const res = await get(ctx, url);
      expect(res.statusCode, url).toBe(404);
    }
  });

  it('serves repeated requests from its cache', async () => {
    await seed();
    const before = (await get(ctx, '/api/sitemap/people/0')).json();
    await addPerson(ctx, { id: 30 });
    await ctx.t.db.insert(schema.moviePeople).values({ movieId: ids.plain, peopleId: 30, groupId: 1 });
    expect((await get(ctx, '/api/sitemap/people/0')).json()).toEqual(before);
  });
});
