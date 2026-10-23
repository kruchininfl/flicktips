import { schema } from '@flicktips/db';
import type { KpFilmListItem } from '@flicktips/kinopoisk';
import { eq, sql } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { fakeKp, hasTestDb, signIn, useTestApp, type TestContext } from '../../test/helpers.js';

type MovieInsert = typeof schema.movie.$inferInsert;

// The object without the given keys (expected bodies of routes that drop some columns).
function omit<T extends object>(obj: T, ...keys: string[]): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k))) as Partial<T>;
}

// A `movie.*` row as PDO returned it to PHP and Mapper::group cast it.
function movieStar(fields: Record<string, unknown>) {
  return {
    id: 0,
    tmdb_id: null,
    type: 'movie',
    title: null,
    original_title: null,
    tmdb_poster_path: null,
    release_date: null,
    first_air_date: null,
    tmdb_overview: null,
    original_language: null,
    tmdb_trailers: null,
    tmdb_popularity: 0,
    kp_id: null,
    kp_title: null,
    kp_original_title: null,
    kp_start_year: null,
    kp_finish_year: null,
    kp_overview: null,
    kp_duration: null,
    kp_release_date: null,
    kp_release_date_dvd: null,
    kp_release_date_rus: null,
    kp_rating_value: 0,
    kp_rating_count: 0,
    imdb_id: null,
    imdb_rating_value: 0,
    imdb_rating_count: 0,
    kp_check_date: null,
    kp_error: null,
    kp_title_similarity: null,
    kp_force_check: '0',
    super: 0,
    likes: 0,
    neutral: 0,
    dislikes: 0,
    suspend: '0',
    isSuper: false,
    isLiked: false,
    isNeutral: false,
    isDisliked: false,
    overview: null,
    ...fields,
  };
}

const flags = (vote: number | null, inBookmarks = false) => ({
  isSuper: vote === 3,
  isLiked: vote === 2,
  isNeutral: vote === 1,
  isDisliked: vote === 0,
  inBookmarks,
});

interface Seed {
  viewer: Awaited<ReturnType<typeof signIn>>;
  friend: Awaited<ReturnType<typeof signIn>>;
  stranger: Awaited<ReturnType<typeof signIn>>;
  movies: Record<'brat' | 'serial' | 'hidden', number>;
  people: Record<'director' | 'actor' | 'banned', number>;
  ts: Record<string, number>;
  raw: Record<string, string>;
}

async function insertMovie(ctx: TestContext, values: MovieInsert) {
  const [res] = await ctx.t.db.insert(schema.movie).values(values);
  return res.insertId;
}

async function vote(ctx: TestContext, userId: number, movieId: number, value: number, hoursAgo: number) {
  const [res] = await ctx.t.db.insert(schema.movieVote).values({
    userId,
    movieId,
    vote: value,
    timestamp: sql`NOW() - INTERVAL ${hoursAgo} HOUR`,
  });
  return res.insertId;
}

async function seed(ctx: TestContext): Promise<Seed> {
  const { db } = ctx.t;
  const viewer = await signIn(ctx, { username: 'Зритель', avatarSource: 'https://a/viewer.jpg', gender: '2' });
  const friend = await signIn(ctx, { username: 'Друг', avatarSource: 'https://a/friend.jpg', gender: '1' });
  const stranger = await signIn(ctx, { username: 'Чужой' });
  await db.insert(schema.userFriends).values({ user1: viewer.id, user2: friend.id, subscribed: 1 });

  const brat = await insertMovie(ctx, {
    tmdbId: 'movie_101',
    type: 'movie',
    title: 'Брат',
    originalTitle: 'Brat',
    tmdbPosterPath: '/brat.jpg',
    releaseDate: '1997-05-17',
    tmdbOverview: 'TMDB text',
    originalLanguage: 'ru',
    tmdbPopularity: 12.5,
    kpId: 41519,
    kpOverview: 'Текст Кинопоиска',
    kpStartYear: 1997,
    kpRatingValue: 8.3,
    kpRatingCount: 1000,
    imdbRatingValue: 7.9,
    super: 1,
    likes: 1,
    dislikes: 1,
  });
  const serial = await insertMovie(ctx, {
    tmdbId: 'tv_202',
    type: 'tv',
    title: 'Сериал',
    firstAirDate: '2010-01-01',
    tmdbOverview: 'Only TMDB',
    kpId: 777,
    kpOverview: '',
    likes: 1,
  });
  const hidden = await insertMovie(ctx, { tmdbId: 'movie_303', title: 'Скрытый', suspend: 1, kpId: 303 });

  const [drama] = await db.insert(schema.genre).values({ tmdbId: 18, name: 'драма' });
  const [crime] = await db.insert(schema.genre).values({ tmdbId: 80, name: 'криминал' });
  await db.insert(schema.movieGenre).values([
    { movieId: brat, genreId: crime.insertId },
    { movieId: brat, genreId: drama.insertId },
  ]);
  // Кинопоиск genres: used only for the movie without TMDB genres
  const [comedy] = await db.insert(schema.kpGenre).values({ name: 'комедия' });
  const [kpDrama] = await db.insert(schema.kpGenre).values({ name: 'драма' });
  await db.insert(schema.movieKpGenre).values([
    { movieId: serial, kpGenreId: comedy.insertId },
    { movieId: brat, kpGenreId: kpDrama.insertId },
  ]);

  const [ru] = await db.insert(schema.country).values({ name: 'Россия' });
  await db.insert(schema.movieCountry).values({ movieId: brat, countryId: ru.insertId });

  const [directors] = await db
    .insert(schema.group)
    .values({ type: 'director', title: 'Режиссеры', titleSingular: 'Режиссер' });
  const [actors] = await db.insert(schema.group).values({ type: 'actor', title: 'Актеры', titleSingular: 'Актер' });
  const person = async (name: string, kpId: number, suspend = 0) =>
    (
      await db
        .insert(schema.people)
        .values({ name, originalName: `${name} (en)`, kpId, kpPhoto: `p${kpId}.jpg`, suspend })
    )[0].insertId;
  const director = await person('Алексей Балабанов', 1);
  const actor = await person('Сергей Бодров', 2);
  const banned = await person('Скрытый актер', 3, 1);
  await db.insert(schema.moviePeople).values([
    { movieId: brat, peopleId: actor, groupId: actors.insertId, order: 1, description: 'Данила' },
    { movieId: brat, peopleId: director, groupId: directors.insertId, order: 0 },
    { movieId: brat, peopleId: banned, groupId: actors.insertId, order: 2 },
    { movieId: brat, peopleId: actor, groupId: directors.insertId, order: 3 },
    { movieId: serial, peopleId: actor, groupId: actors.insertId, order: 0 },
    { movieId: hidden, peopleId: actor, groupId: actors.insertId, order: 0 },
  ]);

  const ids = {
    friendBrat: await vote(ctx, friend.id, brat, 3, 5),
    strangerBrat: await vote(ctx, stranger.id, brat, 2, 30),
    viewerBrat: await vote(ctx, viewer.id, brat, 0, 1),
    friendSerial: await vote(ctx, friend.id, serial, 2, 50),
  };
  await db.insert(schema.bookmark).values({ userId: viewer.id, movieId: brat });

  const ts: Record<string, number> = {};
  const raw: Record<string, string> = {};
  for (const [name, id] of Object.entries(ids)) {
    const [row] = await db
      .select({ ts: sql<number>`UNIX_TIMESTAMP(timestamp)`, raw: schema.movieVote.timestamp, id: schema.movieVote.id })
      .from(schema.movieVote)
      .where(eq(schema.movieVote.id, id));
    ts[name] = Number(row!.ts);
    raw[name] = row!.raw;
    raw[`${name}Id`] = String(row!.id);
  }
  return {
    viewer,
    friend,
    stranger,
    movies: { brat, serial, hidden },
    people: { director, actor, banned },
    ts,
    raw,
  };
}

const getVideos = vi.fn(async (id: number) => ({
  total: 2,
  items:
    id === 41519
      ? [
          { url: 'https://www.youtube.com/watch?v=brat0000001', name: 'Трейлер', site: 'YOUTUBE' },
          { url: 'https://widgets.kinopoisk.ru/discovery/trailer/1', name: 'Виджет', site: 'KINOPOISK_WIDGET' },
        ]
      : [],
}));

const searchItem = (fields: Partial<KpFilmListItem>): KpFilmListItem => ({
  kinopoiskId: 0,
  imdbId: null,
  nameRu: null,
  nameEn: null,
  nameOriginal: null,
  countries: [],
  genres: [],
  ratingKinopoisk: null,
  ratingImdb: null,
  year: null,
  type: 'FILM',
  posterUrl: null,
  posterUrlPreview: null,
  ...fields,
});

const searchFilms = vi.fn(async () => ({
  total: 2,
  totalPages: 1,
  items: [
    searchItem({
      kinopoiskId: 9001,
      nameRu: 'Новый сериал',
      nameOriginal: 'New Show',
      imdbId: 'tt9001',
      year: 2024,
      type: 'TV_SERIES',
      ratingKinopoisk: 7.1,
      ratingImdb: 6.9,
      genres: [{ genre: 'драма' }, { genre: 'фантастика' }],
      countries: [{ country: 'Россия' }, { country: 'США' }],
    }),
    searchItem({ kinopoiskId: 41519, nameRu: 'Брат', year: 1997 }),
  ],
}));

describe.skipIf(!hasTestDb)('IndexController routes', () => {
  const ctx = useTestApp(fakeKp({ getVideos, searchFilms }));
  let s: Seed;
  beforeAll(async () => {
    s = await seed(ctx);
  });

  const get = (url: string, headers: Record<string, string> = {}) => ctx.app.inject({ method: 'GET', url, headers });

  const bratVotes = () => [
    {
      timestamp: s.ts.viewerBrat,
      value: 0,
      user_id: s.viewer.id,
      user_name: 'Зритель',
      user_avatar: 'https://a/viewer.jpg',
    },
    {
      timestamp: s.ts.friendBrat,
      value: 3,
      user_id: s.friend.id,
      user_name: 'Друг',
      user_avatar: 'https://a/friend.jpg',
    },
    { timestamp: s.ts.strangerBrat, value: 2, user_id: s.stranger.id, user_name: 'Чужой', user_avatar: null },
  ];
  const bratGenres = () => [
    { id: expect.any(Number), name: 'драма' },
    { id: expect.any(Number), name: 'криминал' },
  ];
  const brat = (fields: Record<string, unknown> = {}) =>
    movieStar({
      id: s.movies.brat,
      tmdb_id: 'movie_101',
      title: 'Брат',
      original_title: 'Brat',
      tmdb_poster_path: '/brat.jpg',
      release_date: '1997-05-17',
      tmdb_overview: 'TMDB text',
      original_language: 'ru',
      tmdb_popularity: 12.5,
      kp_id: '41519',
      kp_overview: 'Текст Кинопоиска',
      kp_start_year: '1997',
      kp_rating_value: 8.3,
      kp_rating_count: 1000,
      imdb_rating_value: 7.9,
      super: 1,
      likes: 1,
      dislikes: 1,
      overview: 'Текст Кинопоиска',
      genres: bratGenres(),
      ...fields,
    });
  const serial = (fields: Record<string, unknown> = {}) =>
    movieStar({
      id: s.movies.serial,
      tmdb_id: 'tv_202',
      type: 'tv',
      title: 'Сериал',
      first_air_date: '2010-01-01',
      tmdb_overview: 'Only TMDB',
      kp_id: '777',
      kp_overview: '',
      likes: 1,
      overview: 'Only TMDB',
      genres: [{ id: expect.any(Number), name: 'комедия' }],
      ...fields,
    });

  it('GET /api/ answers the version', async () => {
    expect((await get('/api/')).json()).toEqual({ version: '0.0.1' });
  });

  describe('GET /api/movies/:id', () => {
    it('returns the film page for an anonymous viewer and caches the Кинопоиск trailers', async () => {
      const res = await get(`/api/movies/${s.movies.brat}`);
      expect(res.statusCode).toBe(200);
      const movie = omit(
        brat({
          tmdb_trailers: ['YouTube:brat0000001'],
          countries: [{ id: expect.any(Number), name: 'Россия' }],
          staff: [
            {
              type: 'director',
              title: 'Режиссеры',
              people: [
                {
                  id: s.people.director,
                  name: 'Алексей Балабанов',
                  original_name: 'Алексей Балабанов (en)',
                  photo: 'p1.jpg',
                  description: null,
                },
                {
                  id: s.people.actor,
                  name: 'Сергей Бодров',
                  original_name: 'Сергей Бодров (en)',
                  photo: 'p2.jpg',
                  description: null,
                },
              ],
            },
            {
              type: 'actor',
              title: 'Актеры',
              people: [
                {
                  id: s.people.actor,
                  name: 'Сергей Бодров',
                  original_name: 'Сергей Бодров (en)',
                  photo: 'p2.jpg',
                  description: 'Данила',
                },
              ],
            },
          ],
          votes: bratVotes(),
        }),
        'kp_check_date',
        'kp_error',
      );
      expect(res.json()).toEqual({ success: true, movie });
      expect(getVideos).toHaveBeenCalledWith(41519);

      const [row] = await ctx.t.db
        .select({ trailers: schema.movie.tmdbTrailers })
        .from(schema.movie)
        .where(eq(schema.movie.id, s.movies.brat));
      expect(row!.trailers).toBe('["YouTube:brat0000001"]');

      getVideos.mockClear();
      const again = await get(`/api/movies/${s.movies.brat}`, s.viewer.headers);
      expect(getVideos).not.toHaveBeenCalled();
      expect(again.json().movie).toMatchObject({ tmdb_trailers: ['YouTube:brat0000001'], ...flags(0, true) });
    });

    it('adds the viewer flags and falls back to Кинопоиск genres', async () => {
      const res = await get(`/api/movies/${s.movies.serial}`, s.viewer.headers);
      const movie = omit(
        serial({
          ...flags(null),
          tmdb_trailers: [],
          staff: [
            {
              type: 'actor',
              title: 'Актеры',
              people: [
                {
                  id: s.people.actor,
                  name: 'Сергей Бодров',
                  original_name: 'Сергей Бодров (en)',
                  photo: 'p2.jpg',
                  description: null,
                },
              ],
            },
          ],
          votes: [
            {
              timestamp: s.ts.friendSerial,
              value: 2,
              user_id: s.friend.id,
              user_name: 'Друг',
              user_avatar: 'https://a/friend.jpg',
            },
          ],
        }),
        'kp_check_date',
        'kp_error',
      );
      expect(res.json()).toEqual({ success: true, movie });
    });

    it('answers 404 for missing, suspended and malformed ids', async () => {
      for (const id of [999999, s.movies.hidden, 'abc', 0]) {
        const res = await get(`/api/movies/${id}`);
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ success: false, msg: 'Not found' });
      }
    });
  });

  describe('GET /api/movies/:id/votes', () => {
    it('lists the votes with the friend flag for the viewer', async () => {
      const vote = (who: 'viewer' | 'friend' | 'stranger', value: number, isFriend: boolean) => {
        const key = `${who}Brat`;
        const user = s[who];
        return {
          id: Number(s.raw[`${key}Id`]),
          vote: value,
          timestamp: s.raw[key],
          user: {
            id: user.id,
            avatar: { viewer: 'https://a/viewer.jpg', friend: 'https://a/friend.jpg', stranger: '' }[who],
            gender: { viewer: '2', friend: '1', stranger: '' }[who],
            username: { viewer: 'Зритель', friend: 'Друг', stranger: 'Чужой' }[who],
            isFriend,
          },
        };
      };
      const anon = await get(`/api/movies/${s.movies.brat}/votes`);
      expect(anon.json()).toEqual({
        success: true,
        movie_id: s.movies.brat,
        votes: [vote('viewer', 0, false), vote('friend', 3, false), vote('stranger', 2, false)],
      });
      const signed = await get(`/api/movies/${s.movies.brat}/votes`, s.viewer.headers);
      expect(signed.json().votes).toEqual([
        vote('viewer', 0, false),
        vote('friend', 3, true),
        vote('stranger', 2, false),
      ]);
      expect((await get('/api/movies/999999/votes')).json()).toEqual({ success: true, movie_id: 999999, votes: [] });
    });
  });

  describe('GET /api/movies/trends', () => {
    it('orders by recent votes, with friend votes for the viewer', async () => {
      const anon = await get('/api/movies/trends');
      // the film page tests above filled the trailer caches
      expect(anon.json()).toEqual({
        success: true,
        results: {
          total: 2,
          entities: [brat({ tmdb_trailers: '["YouTube:brat0000001"]' }), serial({ tmdb_trailers: '[]' })],
        },
      });

      const signed = await get('/api/movies/trends', s.viewer.headers);
      expect(signed.json()).toEqual({
        success: true,
        results: {
          total: 2,
          entities: [
            brat({
              ...flags(0, true),
              tmdb_trailers: '["YouTube:brat0000001"]',
              friend_votes: [
                {
                  user_id: s.friend.id,
                  user_name: 'Друг',
                  user_avatar: 'https://a/friend.jpg',
                  vote: 3,
                  vote_timestamp: s.ts.friendBrat,
                },
              ],
            }),
            serial({
              ...flags(null),
              tmdb_trailers: '[]',
              friend_votes: [
                {
                  user_id: s.friend.id,
                  user_name: 'Друг',
                  user_avatar: 'https://a/friend.jpg',
                  vote: 2,
                  vote_timestamp: s.ts.friendSerial,
                },
              ],
            }),
          ],
        },
      });
    });
  });

  describe('feeds', () => {
    const prefixed = (id: number, fields: Record<string, unknown>) => ({
      id,
      type: 'movie',
      title: null,
      original_title: null,
      tmdb_poster_path: null,
      kp_id: 0,
      release_date: null,
      first_air_date: null,
      tmdb_overview: null,
      original_language: null,
      tmdb_popularity: 0,
      super: 0,
      likes: 0,
      neutral: 0,
      dislikes: 0,
      kp_rating_value: 0,
      imdb_rating_value: 0,
      overview: null,
      ...fields,
    });
    const bratPrefixed = (fields: Record<string, unknown> = {}) =>
      prefixed(s.movies.brat, {
        title: 'Брат',
        original_title: 'Brat',
        tmdb_poster_path: '/brat.jpg',
        kp_id: 41519,
        release_date: '1997-05-17',
        tmdb_overview: 'TMDB text',
        original_language: 'ru',
        tmdb_popularity: 12.5,
        super: 1,
        likes: 1,
        dislikes: 1,
        kp_rating_value: 8.3,
        imdb_rating_value: 7.9,
        overview: 'Текст Кинопоиска',
        genres: bratGenres(),
        ...fields,
      });
    const serialPrefixed = (fields: Record<string, unknown> = {}) =>
      prefixed(s.movies.serial, {
        type: 'tv',
        title: 'Сериал',
        kp_id: 777,
        first_air_date: '2010-01-01',
        tmdb_overview: 'Only TMDB',
        likes: 1,
        overview: 'Only TMDB',
        genres: [{ id: expect.any(Number), name: 'комедия' }],
        ...fields,
      });
    const friendSerialVote = () => ({
      timestamp: s.ts.friendSerial,
      value: 2,
      user_id: s.friend.id,
      user_name: 'Друг',
      user_avatar: 'https://a/friend.jpg',
    });

    it('GET /api/feed/last-graded lists movies by their last vote', async () => {
      const res = await get('/api/feed/last-graded');
      expect(res.json()).toEqual({
        success: true,
        results: {
          total: 2,
          page: 1,
          pages: 1,
          entities: [bratPrefixed({ votes: bratVotes() }), serialPrefixed({ votes: [friendSerialVote()] })],
        },
      });
    });

    it('hides the movies a hide_viewed viewer has voted on', async () => {
      const hider = await signIn(ctx, { hideViewed: 1 });
      await vote(ctx, hider.id, s.movies.brat, 1, 0);
      const res = await get('/api/feed/last-graded', hider.headers);
      expect(res.json()).toEqual({
        success: true,
        results: {
          total: 1,
          page: 1,
          pages: 1,
          entities: [serialPrefixed({ ...flags(null), votes: [friendSerialVote()] })],
        },
      });
      await ctx.t.db.delete(schema.movieVote).where(eq(schema.movieVote.userId, hider.id));
    });

    it('GET /api/feed/friends needs a viewer and keeps the friends votes only', async () => {
      const anon = await get('/api/feed/friends');
      expect(anon.statusCode).toBe(401);
      expect(anon.json()).toEqual({ success: false, msg: 'authorization required' });

      const res = await get('/api/feed/friends?page=1', s.viewer.headers);
      expect(res.json()).toEqual({
        success: true,
        results: {
          total: 2,
          page: 1,
          pages: 1,
          entities: [
            bratPrefixed({ ...flags(0, true), votes: [bratVotes()[1]] }),
            serialPrefixed({ ...flags(null), votes: [friendSerialVote()] }),
          ],
        },
      });
    });

    it('GET /api/people/:id lists the movies per role, newest first', async () => {
      const res = await get(`/api/people/${s.people.actor}`, s.viewer.headers);
      const groupIds = await ctx.t.db.select().from(schema.group);
      const groupId = (type: string) => groupIds.find((g) => g.type === type)!.id;
      const serialFields = omit(
        serialPrefixed({
          group_id: groupId('actor'),
          group_title: 'Актер',
          ...flags(null),
          votes: [friendSerialVote()],
        }),
        'genres',
      );
      const bratAs = (type: string, title: string) => {
        const movie = omit(
          bratPrefixed({
            group_id: groupId(type),
            group_title: title,
            ...flags(0, true),
            votes: bratVotes(),
          }),
          'genres',
        );
        return movie;
      };
      expect(res.json()).toEqual({
        success: true,
        person: {
          id: String(s.people.actor),
          name: 'Сергей Бодров',
          original_name: 'Сергей Бодров (en)',
          kp_photo: 'p2.jpg',
          suspend: '0',
          movies: [serialFields, bratAs('director', 'Режиссер'), bratAs('actor', 'Актер')],
        },
      });
      // anonymous: no viewer flags at all
      const anon = (await get(`/api/people/${s.people.actor}`)).json();
      expect(anon.person.movies[0]).not.toHaveProperty('isSuper');
    });

    it('GET /api/people/search finds people by either name, skipping suspended ones', async () => {
      const search = async (q: string) => (await get(`/api/people/search?q=${encodeURIComponent(q)}`)).json();
      const actor = {
        id: s.people.actor,
        name: 'Сергей Бодров',
        original_name: 'Сергей Бодров (en)',
        kp_photo: 'p2.jpg',
        role: 'Актер',
        movies_count: 2,
      };
      const director = {
        id: s.people.director,
        name: 'Алексей Балабанов',
        original_name: 'Алексей Балабанов (en)',
        kp_photo: 'p1.jpg',
        role: 'Режиссер',
        movies_count: 1,
      };
      expect(await search('бодров')).toEqual({ success: true, results: [actor] });
      // no prefix match: more movies first; the suspended actor is not there
      expect(await search('(en)')).toEqual({ success: true, results: [actor, director] });
      expect(await search('Скрытый')).toEqual({ success: true, results: [] });
      expect(await search('а')).toEqual({ success: true, results: [] });
    });

    it('GET /api/people/:id answers 404 for missing, suspended and movie-less people', async () => {
      const [lonely] = await ctx.t.db.insert(schema.people).values({ name: 'Без фильмов', kpId: 99 });
      for (const id of [999999, s.people.banned, lonely.insertId, 'x']) {
        const res = await get(`/api/people/${id}`);
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ success: false, msg: 'Not found' });
      }
    });
  });

  describe('GET /api/users/:id/votes', () => {
    it("lists a user's votes, newest first, with the viewer's flags and friends' votes", async () => {
      const res = await get(`/api/users/${s.friend.id}/votes?size=1`, s.viewer.headers);
      expect(res.json()).toEqual({
        success: true,
        results: {
          total: 2,
          page: 1,
          pages: 2,
          entities: [
            brat({
              timestamp: String(s.ts.friendBrat),
              vote: 3,
              tmdb_trailers: '["YouTube:brat0000001"]',
              ...flags(0, true),
              friend_votes: [
                {
                  user_id: s.friend.id,
                  user_name: 'Друг',
                  user_avatar: 'https://a/friend.jpg',
                  vote: 3,
                  vote_timestamp: s.ts.friendBrat,
                },
              ],
            }),
          ],
        },
      });

      const page2 = (await get(`/api/users/${s.friend.id}/votes?size=1&page=2`)).json();
      const anonSerial = omit(
        serial({
          timestamp: String(s.ts.friendSerial),
          vote: 2,
          tmdb_trailers: '[]',
        }),
        'isSuper',
        'isLiked',
        'isNeutral',
        'isDisliked',
      );
      expect(page2).toEqual({ success: true, results: { total: 2, page: 2, pages: 2, entities: [anonSerial] } });
    });

    it('filters by the kind of vote', async () => {
      const liked = (await get(`/api/users/${s.friend.id}/votes?vote=like`)).json();
      expect(liked.results).toMatchObject({ total: 1, pages: 1, entities: [{ id: s.movies.serial, vote: 2 }] });
      const none = (await get(`/api/users/${s.friend.id}/votes?vote=dislike`)).json();
      expect(none.results).toEqual({ total: 0, page: 1, pages: 0, entities: [] });
      expect((await get(`/api/users/${s.friend.id}/votes?vote=meh`)).statusCode).toBe(400);
    });

    it('`me` is the viewer; 401 without one, 404 for unknown users', async () => {
      const mine = (await get('/api/users/me/votes', s.viewer.headers)).json();
      expect(mine.results.total).toBe(1);
      expect(mine.results.entities[0]).toMatchObject({ id: s.movies.brat, vote: 0 });

      const anon = await get('/api/users/me/votes');
      expect(anon.statusCode).toBe(401);
      expect(anon.json()).toEqual({ success: false, msg: 'Access denied' });

      const missing = await get('/api/users/999999/votes');
      expect(missing.statusCode).toBe(404);

      const empty = (await get(`/api/users/${s.stranger.id + 100}/votes`)).statusCode;
      expect(empty).toBe(404);
    });
  });

  describe('GET /api/movies/search', () => {
    it('adds films found only on Кинопоиск and returns them with the known ones', async () => {
      const res = await get('/api/movies/search?query=%D0%B1%D1%80%D0%B0%D1%82', s.viewer.headers);
      expect(searchFilms).toHaveBeenCalledWith({ keyword: 'брат', order: 'NUM_VOTE' });
      const body = res.json();
      const [created] = await ctx.t.db.select().from(schema.movie).where(eq(schema.movie.kpId, 9001));
      expect(created).toMatchObject({
        tmdbId: null,
        type: 'tv',
        title: 'Новый сериал',
        originalTitle: 'New Show',
        firstAirDate: '2024',
        releaseDate: null,
        kpTitle: 'Новый сериал',
        kpOriginalTitle: 'New Show',
        kpStartYear: 2024,
        imdbId: 'tt9001',
      });
      expect(body).toEqual({
        total: 2,
        results: [
          movieStar({
            id: created!.id,
            type: 'tv',
            title: 'Новый сериал',
            original_title: 'New Show',
            first_air_date: '2024',
            kp_id: '9001',
            kp_title: 'Новый сериал',
            kp_original_title: 'New Show',
            kp_start_year: '2024',
            kp_rating_value: 7.1,
            imdb_id: 'tt9001',
            imdb_rating_value: 6.9,
            ...flags(null),
            genres: [
              { id: expect.any(Number), name: 'драма' },
              { id: expect.any(Number), name: 'фантастика' },
            ],
          }),
          brat({
            ...flags(0, true),
            tmdb_trailers: '["YouTube:brat0000001"]',
            votes: [
              {
                user_id: s.friend.id,
                user_name: 'Друг',
                user_avatar: 'https://a/friend.jpg',
                value: 3,
                timestamp: s.ts.friendBrat,
              },
            ],
          }),
        ],
      });

      const countries = await ctx.t.db
        .select({ name: schema.country.name })
        .from(schema.movieCountry)
        .innerJoin(schema.country, eq(schema.country.id, schema.movieCountry.countryId))
        .where(eq(schema.movieCountry.movieId, created!.id));
      expect(countries.map((c) => c.name).sort()).toEqual(['Россия', 'США']);

      // a second search does not duplicate the film
      await get('/api/movies/search?query=брат');
      const rows = await ctx.t.db.select({ id: schema.movie.id }).from(schema.movie).where(eq(schema.movie.kpId, 9001));
      expect(rows).toHaveLength(1);
    });

    it('answers an empty result for an empty query and 502 when Кинопоиск fails', async () => {
      expect((await get('/api/movies/search?query=')).json()).toEqual({ total: 0, results: [] });
      searchFilms.mockRejectedValueOnce(new Error('ECONNRESET'));
      const res = await get('/api/movies/search?query=x');
      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ success: false, msg: 'Kinopoisk is unavailable' });
    });
  });

  describe('digital releases', () => {
    beforeAll(async () => {
      const { db } = ctx.t;
      const [hd] = await db.insert(schema.ftQuality).values({ name: 'HD', description: '720p', ratio: 2 });
      await db.insert(schema.ftQuality).values({ name: 'SD' });
      const [dub] = await db.insert(schema.ftVoice).values({ name: 'Дубляж', alias: 'dub', sort: 10 });
      await db.insert(schema.ftVoice).values({ name: 'Оригинал', alias: 'orig', sort: 20 });
      const film = async (kpId: number, created: string, quality: number, voice: number) => {
        const [f] = await db.insert(schema.ftFilm).values({
          ftId: kpId,
          kpId,
          name: 'x',
          originalName: 'x',
          slug: 'x',
          dateAdd: '2026-01-01',
          dateUpdate: '2026-01-01',
        });
        const [t] = await db
          .insert(schema.ftTorrent)
          .values({ ftId: kpId, quality, voice, size: '1', link: 'l', created });
        await db.insert(schema.ftFilmTorrent).values({ filmId: f.insertId, torrentId: t.insertId });
      };
      await film(41519, '2026-02-01', hd.insertId, dub.insertId);
      await film(777, '2026-03-01', hd.insertId + 1, dub.insertId);
    });

    it('GET /api/datasets lists qualities and voices as the PHP did (strings)', async () => {
      const res = await get('/api/datasets');
      expect(res.json()).toEqual({
        success: true,
        results: {
          quality: [
            { id: expect.any(String), name: 'HD', description: '720p', ratio: '2' },
            { id: expect.any(String), name: 'SD', description: null, ratio: '1' },
          ],
          voice: [
            { id: expect.any(String), name: 'Оригинал', alias: 'orig', sort: '20' },
            { id: expect.any(String), name: 'Дубляж', alias: 'dub', sort: '10' },
          ],
        },
      });
    });

    it('GET /api/movies/digital filters by quality, rating and release date', async () => {
      // the serial has no release_date, so the default date range drops it (as in the PHP)
      const all = (await get('/api/movies/digital')).json();
      expect(all).toEqual({
        success: true,
        results: { total: 1, page: 1, pages: 1, entities: [brat({ tmdb_trailers: '["YouTube:brat0000001"]' })] },
      });

      const [sd] = await ctx.t.db.select().from(schema.ftQuality).where(eq(schema.ftQuality.name, 'SD'));
      const none = (await get(`/api/movies/digital?quality=${sd!.id}`)).json();
      expect(none.results).toEqual({ total: 0, page: 1, pages: 0, entities: [] });

      expect((await get('/api/movies/digital?kp_rating_value=9')).json().results.total).toBe(0);
      expect((await get('/api/movies/digital?date_from=1998-01')).json().results.total).toBe(0);
      expect((await get('/api/movies/digital?date_to=1997-12&date_from=1997-01')).json().results.total).toBe(1);
    });
  });
});

describe.skipIf(!hasTestDb)('feed pagination', () => {
  const ctx = useTestApp();

  it('returns the first page * HOME_LIST_SIZE movies and counts pages of 24', async () => {
    const user = await signIn(ctx);
    for (let i = 0; i < 26; i++) {
      const [m] = await ctx.t.db.insert(schema.movie).values({ tmdbId: `movie_${i}`, title: `Фильм ${i}` });
      await ctx.t.db.insert(schema.movieVote).values({
        userId: user.id,
        movieId: m.insertId,
        vote: 2,
        timestamp: sql`NOW() - INTERVAL ${100 - i} MINUTE`,
      });
    }
    const page1 = (await ctx.app.inject({ method: 'GET', url: '/api/feed/last-graded' })).json();
    expect(page1.results).toMatchObject({ total: 26, page: 1, pages: 2 });
    expect(page1.results.entities).toHaveLength(24);
    expect(page1.results.entities[0].title).toBe('Фильм 25');

    const page2 = (await ctx.app.inject({ method: 'GET', url: '/api/feed/last-graded?page=2' })).json();
    expect(page2.results).toMatchObject({ total: 26, page: 2, pages: 2 });
    expect(page2.results.entities).toHaveLength(26);

    const trends = (await ctx.app.inject({ method: 'GET', url: '/api/movies/trends' })).json();
    expect(trends.results.total).toBe(26);
    expect(trends.results.entities).toHaveLength(24);

    const bad = await ctx.app.inject({ method: 'GET', url: '/api/feed/last-graded?page=abc' });
    expect(bad.statusCode).toBe(400);
  });
});
