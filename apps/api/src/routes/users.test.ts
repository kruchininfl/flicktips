import { schema } from '@flicktips/db';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { hasTestDb, signIn, useTestApp, type TestContext } from '../../test/helpers.js';

type Headers = Record<string, string>;

async function addMovie(ctx: TestContext, fields: Partial<typeof schema.movie.$inferInsert> = {}) {
  const [res] = await ctx.t.db.insert(schema.movie).values({ title: 'Фильм', ...fields });
  return res.insertId;
}

async function addGenre(ctx: TestContext, name: string, movieIds: number[]) {
  const [res] = await ctx.t.db.insert(schema.genre).values({ name, tmdbId: Math.floor(Math.random() * 1e9) });
  for (const movieId of movieIds) await ctx.t.db.insert(schema.movieGenre).values({ movieId, genreId: res.insertId });
  return res.insertId;
}

async function follow(ctx: TestContext, from: number, to: number, subscribed = 1) {
  await ctx.t.db.insert(schema.userFriends).values({ user1: from, user2: to, subscribed });
}

const inject = (ctx: TestContext, method: 'GET' | 'POST' | 'PATCH', url: string, headers?: Headers, payload?: object) =>
  ctx.app.inject({ method, url, headers, payload });

describe.skipIf(!hasTestDb)('user routes', () => {
  const ctx = useTestApp();

  describe('GET /api/users/:id', () => {
    it('returns the public profile, with relation fields only for another signed-in viewer', async () => {
      const viewer = await signIn(ctx, { username: 'Зритель' });
      const other = await signIn(ctx, {
        username: 'Другой',
        avatarSource: 'https://example.com/a.jpg',
        avatar: 'not-public',
        gender: 'female',
        registrationDate: '2020-01-02 03:04:05',
      });
      await follow(ctx, viewer.id, other.id);
      const profile = {
        id: other.id,
        username: 'Другой',
        avatar: 'https://example.com/a.jpg',
        gender: 'female',
        registration_date: '2020-01-02 03:04:05',
      };

      const anonymous = await inject(ctx, 'GET', `/api/users/${other.id}`);
      expect(anonymous.statusCode).toBe(200);
      expect(anonymous.json()).toEqual({ success: true, user: profile });

      const asViewer = await inject(ctx, 'GET', `/api/users/${other.id}`, viewer.headers);
      expect(asViewer.json()).toEqual({ success: true, user: { ...profile, subscribed: true, followsMe: false } });

      const self = await inject(ctx, 'GET', `/api/users/${other.id}`, other.headers);
      expect(self.json()).toEqual({ success: true, user: profile });
    });

    it('answers 404 for unknown and non-numeric ids', async () => {
      for (const id of ['999999', 'abc']) {
        const res = await inject(ctx, 'GET', `/api/users/${id}`);
        expect(res.statusCode).toBe(404);
        expect(res.json()).toEqual({ success: false, err: 'User not found' });
      }
    });
  });

  describe('POST /api/me/votes', () => {
    it('toggles the vote, moves the counters and queues vote_event rows for the bot', async () => {
      const voter = await signIn(ctx);
      const movieId = await addMovie(ctx, { likes: 5, super: 1 });
      await ctx.t.db.insert(schema.tgChat).values({ chatId: -100123, title: 'Группа' });
      await ctx.t.db.insert(schema.tgChatMember).values({ chatId: -100123, userId: voter.id });
      const vote = (v: string) => inject(ctx, 'POST', '/api/me/votes', voter.headers, { id: movieId, vote: v });
      const flags = { isSuper: false, isLiked: false, isNeutral: false, isDisliked: false };

      const liked = await vote('like');
      expect(liked.statusCode).toBe(200);
      expect(liked.json()).toEqual({
        success: true,
        data: { id: movieId, super: 1, likes: 6, neutral: 0, dislikes: 0, ...flags, isLiked: true },
      });

      const superVote = await vote('super');
      expect(superVote.json()).toEqual({
        success: true,
        data: { id: movieId, super: 2, likes: 5, neutral: 0, dislikes: 0, ...flags, isSuper: true },
      });

      const removed = await vote('super');
      expect(removed.json()).toEqual({
        success: true,
        data: { id: movieId, super: 1, likes: 5, neutral: 0, dislikes: 0, ...flags },
      });
      expect(await ctx.t.db.select().from(schema.movieVote).where(eq(schema.movieVote.movieId, movieId))).toEqual([]);

      const disliked = await vote('dislike');
      expect(disliked.json().data).toEqual({
        id: movieId,
        super: 1,
        likes: 5,
        neutral: 0,
        dislikes: 1,
        ...flags,
        isDisliked: true,
      });
      const [stored] = await ctx.t.db.select().from(schema.movieVote).where(eq(schema.movieVote.movieId, movieId));
      expect(stored).toMatchObject({ movieId, userId: voter.id, vote: 0 });

      const events = await ctx.t.db
        .select({
          userId: schema.voteEvent.userId,
          movieId: schema.voteEvent.movieId,
          vote: schema.voteEvent.vote,
          processedAt: schema.voteEvent.processedAt,
          attempts: schema.voteEvent.attempts,
        })
        .from(schema.voteEvent)
        .where(eq(schema.voteEvent.movieId, movieId))
        .orderBy(schema.voteEvent.id);
      const event = { userId: voter.id, movieId, processedAt: null, attempts: 0 };
      expect(events).toEqual([
        { ...event, vote: 2 },
        { ...event, vote: 3 },
        { ...event, vote: null },
        { ...event, vote: 0 },
      ]);
    });

    it('queues nothing for users outside active Telegram groups', async () => {
      const voter = await signIn(ctx);
      const movieId = await addMovie(ctx);
      await ctx.t.db.insert(schema.tgChat).values({ chatId: -100456, title: 'Старая', active: 0 });
      await ctx.t.db.insert(schema.tgChatMember).values({ chatId: -100456, userId: voter.id });
      const res = await inject(ctx, 'POST', '/api/me/votes', voter.headers, { id: String(movieId), vote: 'neutral' });
      expect(res.json().data).toMatchObject({ neutral: 1, isNeutral: true });
      expect(await ctx.t.db.select().from(schema.voteEvent).where(eq(schema.voteEvent.userId, voter.id))).toEqual([]);
    });

    it('rejects bad input, unknown movies and anonymous requests', async () => {
      const voter = await signIn(ctx);
      const movieId = await addMovie(ctx);
      const bad = await inject(ctx, 'POST', '/api/me/votes', voter.headers, { id: movieId, vote: 'love' });
      expect(bad.statusCode).toBe(400);
      expect(bad.json().success).toBe(false);

      const unknown = await inject(ctx, 'POST', '/api/me/votes', voter.headers, { id: 999999, vote: 'like' });
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json()).toEqual({ success: false, err: 'Movie not found' });

      const anonymous = await inject(ctx, 'POST', '/api/me/votes', undefined, { id: movieId, vote: 'like' });
      expect(anonymous.statusCode).toBe(401);
      expect(anonymous.json()).toEqual({ success: false, msg: 'authorization required' });
    });
  });

  describe('bookmarks', () => {
    it('toggles bookmarks and lists them newest first with genres and friend votes', async () => {
      const me = await signIn(ctx);
      const friend = await signIn(ctx, { username: 'Друг', avatar: 'friend.jpg', avatarSource: 'src.jpg' });
      const stranger = await signIn(ctx);
      await follow(ctx, me.id, friend.id);
      const first = await addMovie(ctx, {
        tmdbId: 'tmdb-1',
        type: 'movie',
        title: 'Первый',
        originalTitle: 'First',
        tmdbPosterPath: '/p.jpg',
        releaseDate: '2001-02-03',
        tmdbOverview: 'TMDB overview',
        originalLanguage: 'ru',
        tmdbPopularity: 7.5,
        kpId: 326,
        kpTitle: 'Первый (КП)',
        kpStartYear: 2001,
        kpOverview: 'Описание с Кинопоиска',
        kpDuration: 142,
        kpReleaseDate: '2001-02-03',
        kpRatingValue: 8.25,
        kpRatingCount: 1000,
        imdbId: 'tt0111161',
        imdbRatingValue: 9.25,
        imdbRatingCount: 2000,
        likes: 3,
      });
      const second = await addMovie(ctx, { title: 'Второй' });
      const third = await addMovie(ctx, { title: 'Третий' });
      const drama = await addGenre(ctx, 'драма', [first]);
      const comedy = await addGenre(ctx, 'комедия', [first]);
      await ctx.t.db.insert(schema.movieVote).values([
        { movieId: first, userId: me.id, vote: 2 },
        { movieId: first, userId: friend.id, vote: 3, timestamp: '2024-05-06 07:08:09' },
        { movieId: first, userId: stranger.id, vote: 0 },
      ]);

      const toggle = (movieId: number) => inject(ctx, 'POST', '/api/me/bookmarks/toggle', me.headers, { movieId });
      for (const movieId of [first, second, third]) {
        expect((await toggle(movieId)).json()).toEqual({
          success: true,
          data: { movie_id: movieId, inBookmarks: true },
        });
      }

      const page1 = await inject(ctx, 'GET', '/api/me/bookmarks?size=2', me.headers);
      expect(page1.json()).toMatchObject({ success: true, results: { total: 3, page: 1, pages: 2 } });
      expect(page1.json().results.entities.map((m: { id: number }) => m.id)).toEqual([third, second]);

      const page2 = await inject(ctx, 'GET', '/api/me/bookmarks?size=2&page=2', me.headers);
      const [{ friend_votes, ...item }] = page2.json().results.entities;
      expect(page2.json().results.entities).toHaveLength(1);
      expect(friend_votes).toEqual([
        {
          user_id: friend.id,
          user_name: 'Друг',
          user_avatar: 'friend.jpg',
          vote: 3,
          vote_timestamp: expect.any(Number),
        },
      ]);
      expect(item).toEqual({
        id: first,
        tmdb_id: 'tmdb-1',
        type: 'movie',
        title: 'Первый',
        original_title: 'First',
        tmdb_poster_path: '/p.jpg',
        release_date: '2001-02-03',
        first_air_date: null,
        tmdb_overview: 'TMDB overview',
        original_language: 'ru',
        tmdb_trailers: null,
        tmdb_popularity: 7.5,
        kp_id: '326',
        kp_title: 'Первый (КП)',
        kp_original_title: null,
        kp_start_year: '2001',
        kp_finish_year: null,
        kp_overview: 'Описание с Кинопоиска',
        kp_duration: '142',
        kp_release_date: '2001-02-03',
        kp_release_date_dvd: null,
        kp_release_date_rus: null,
        kp_rating_value: 8.25,
        kp_rating_count: 1000,
        imdb_id: 'tt0111161',
        imdb_rating_value: 9.25,
        imdb_rating_count: 2000,
        kp_check_date: null,
        kp_error: null,
        kp_title_similarity: null,
        kp_force_check: '0',
        super: 0,
        likes: 3,
        neutral: 0,
        dislikes: 0,
        suspend: '0',
        isSuper: false,
        isLiked: true,
        isNeutral: false,
        isDisliked: false,
        inBookmarks: true,
        genres: [
          { id: drama, name: 'драма' },
          { id: comedy, name: 'комедия' },
        ],
      });

      // a movie without genres and friend votes has neither key, as with PHP's Mapper
      const third0 = page1.json().results.entities[0];
      expect(third0).not.toHaveProperty('genres');
      expect(third0).not.toHaveProperty('friend_votes');

      expect((await toggle(second)).json()).toEqual({ success: true, data: { movie_id: second, inBookmarks: false } });
      const after = await inject(ctx, 'GET', '/api/me/bookmarks', me.headers);
      expect(after.json().results).toMatchObject({ total: 2, page: 1, pages: 1 });
      expect(after.json().results.entities.map((m: { id: number }) => m.id)).toEqual([third, first]);
    });

    it('returns an empty page, 404 for unknown movies and 401 without a viewer', async () => {
      const me = await signIn(ctx);
      const empty = await inject(ctx, 'GET', '/api/me/bookmarks?page=3', me.headers);
      expect(empty.json()).toEqual({ success: true, results: { total: 0, page: 3, pages: 0, entities: [] } });

      const unknown = await inject(ctx, 'POST', '/api/me/bookmarks/toggle', me.headers, { movieId: 999999 });
      expect(unknown.statusCode).toBe(404);

      const bad = await inject(ctx, 'GET', '/api/me/bookmarks?page=abc', me.headers);
      expect(bad.statusCode).toBe(400);

      expect((await inject(ctx, 'GET', '/api/me/bookmarks')).statusCode).toBe(401);
      expect((await inject(ctx, 'POST', '/api/me/bookmarks/toggle', undefined, { movieId: 1 })).statusCode).toBe(401);
    });
  });

  describe('subscriptions and friends', () => {
    it('subscribes, unsubscribes and lists following / followers', async () => {
      const me = await signIn(ctx, { username: 'Я' });
      const a = await signIn(ctx, { username: 'А', gender: 'male' });
      const b = await signIn(ctx, { username: 'Б' });
      const sub = (userId: number, subscribed: unknown) =>
        inject(ctx, 'POST', '/api/me/subscriptions', me.headers, { userId, subscribed });

      expect((await sub(a.id, 1)).json()).toEqual({ success: true, userId: a.id, subscribed: true });
      expect((await sub(b.id, true)).json()).toEqual({ success: true, userId: b.id, subscribed: true });
      await follow(ctx, a.id, me.id);

      const following = await inject(ctx, 'GET', '/api/me/friends', me.headers);
      const user = (u: { id: number }, username: string, subscribed: boolean, gender: string | null = null) => ({
        id: u.id,
        username,
        avatar: null,
        gender,
        registration_date: null,
        subscribed,
      });
      expect(following.json()).toEqual({
        success: true,
        results: { total: 2, page: 1, pages: 1, entities: [user(a, 'А', true, 'male'), user(b, 'Б', true)] },
      });

      expect((await sub(b.id, 0)).json()).toEqual({ success: true, userId: b.id, subscribed: false });
      const afterUnsubscribe = await inject(ctx, 'GET', '/api/me/friends?type=following', me.headers);
      expect(afterUnsubscribe.json().results).toEqual({
        total: 1,
        page: 1,
        pages: 1,
        entities: [user(a, 'А', true, 'male')],
      });

      // b follows me, I no longer follow b: listed with subscribed false
      await follow(ctx, b.id, me.id);
      const followers = await inject(ctx, 'GET', '/api/me/friends?type=followers', me.headers);
      expect(followers.json().results).toEqual({
        total: 2,
        page: 1,
        pages: 1,
        entities: [user(a, 'А', true, 'male'), user(b, 'Б', false)],
      });

      const self = await sub(me.id, 1);
      expect(self.statusCode).toBe(400);
      expect(self.json()).toEqual({ success: false, msg: 'cannot subscribe to yourself' });
      const missing = await sub(999999, 1);
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ success: false, msg: 'user not found' });
    });

    it('toggles an existing follow row and returns PDO strings', async () => {
      const me = await signIn(ctx);
      const a = await signIn(ctx);
      await follow(ctx, me.id, a.id);
      const toggle = (friendId: number) =>
        inject(ctx, 'POST', '/api/me/subscriptions/toggle', me.headers, { friendId });
      expect((await toggle(a.id)).json()).toEqual({ success: true, friendId: String(a.id), subscribed: '0' });
      expect((await toggle(a.id)).json()).toEqual({ success: true, friendId: String(a.id), subscribed: '1' });
      const none = await toggle(999999);
      expect(none.statusCode).toBe(200);
      expect(none.json()).toEqual({ success: false, msg: 'friend not found' });
    });

    it('lists the votes of followed users and marks notifications as seen', async () => {
      const me = await signIn(ctx, { lastSeenNotifications: '2024-01-01 00:00:00' });
      const friend = await signIn(ctx, { username: 'Друг', avatarSource: 'f.jpg', gender: 'male' });
      const unfollowed = await signIn(ctx);
      await follow(ctx, me.id, friend.id);
      await follow(ctx, me.id, unfollowed.id, 0);
      const older = await addMovie(ctx, { title: 'Старый', kpId: 1, kpOverview: 'КП', tmdbPopularity: 1.5 });
      const newer = await addMovie(ctx, { title: 'Новый', likes: 1 });
      const genre = await addGenre(ctx, 'ужасы', [older]);
      await ctx.t.db.insert(schema.movieVote).values([
        { movieId: older, userId: friend.id, vote: 3, timestamp: '2023-06-01 10:00:00' },
        { movieId: newer, userId: friend.id, vote: 2, timestamp: '2024-06-01 10:00:00' },
        { movieId: older, userId: me.id, vote: 1 },
        { movieId: newer, userId: unfollowed.id, vote: 0 },
      ]);
      await ctx.t.db.insert(schema.bookmark).values({ userId: me.id, movieId: newer });

      const profile = await inject(ctx, 'PATCH', '/api/me', me.headers, {});
      expect(profile.json().data.new_notifications).toBe(1);
      expect(profile.json().data.votes_count).toBe(1);

      const res = await inject(ctx, 'GET', '/api/me/friends/votes?size=1', me.headers);
      const body = res.json();
      expect(body).toMatchObject({ success: true, results: { total: 2, page: 1, pages: 2 } });
      const friendUser = { id: friend.id, name: 'Друг', avatar: 'f.jpg', gender: 'male' };
      const movieBase = {
        original_title: null,
        tmdb_poster_path: null,
        release_date: null,
        first_air_date: null,
        tmdb_overview: null,
        original_language: null,
        neutral: 0,
        dislikes: 0,
      };
      expect(body.results.entities).toEqual([
        {
          vote: 2,
          timestamp: expect.any(Number),
          isNew: true,
          group_id: `${friend.id}_${newer}`,
          movie: {
            ...movieBase,
            id: newer,
            title: 'Новый',
            kp_id: 0,
            kp_overview: null,
            tmdb_popularity: 0,
            super: 0,
            likes: 1,
            isSuper: false,
            isLiked: false,
            isNeutral: false,
            isDisliked: false,
            inBookmarks: true,
          },
          user: friendUser,
        },
      ]);

      // page 2 returns everything up to the end of page 2, as in PHP
      const page2 = await inject(ctx, 'GET', '/api/me/friends/votes?size=1&page=2', me.headers);
      const entities = page2.json().results.entities;
      expect(entities.map((e: { movie: { id: number } }) => e.movie.id)).toEqual([newer, older]);
      expect(entities[1]).toEqual({
        vote: 3,
        timestamp: entities[0].timestamp - 366 * 24 * 3600,
        isNew: false,
        group_id: `${friend.id}_${older}`,
        movie: {
          ...movieBase,
          id: older,
          title: 'Старый',
          kp_id: 1,
          kp_overview: 'КП',
          tmdb_popularity: 1.5,
          super: 0,
          likes: 0,
          isSuper: false,
          isLiked: false,
          isNeutral: true,
          isDisliked: false,
          inBookmarks: false,
          genres: [{ id: genre, name: 'ужасы' }],
        },
        user: friendUser,
      });

      const [seen] = await ctx.t.db
        .select({ at: schema.user.lastSeenNotifications })
        .from(schema.user)
        .where(eq(schema.user.id, me.id));
      expect(seen!.at! > '2024-01-01 00:00:00').toBe(true);
      expect((await inject(ctx, 'PATCH', '/api/me', me.headers, {})).json().data.new_notifications).toBe(0);
    });
  });

  describe('PATCH /api/me', () => {
    it('updates hide_viewed and returns the viewer profile', async () => {
      const me = await signIn(ctx, { username: 'Настройки', registrationDate: '2019-05-05 05:05:05' });
      const res = await inject(ctx, 'PATCH', '/api/me', me.headers, { data: { hide_viewed: 1 } });
      expect(res.json()).toEqual({
        success: true,
        data: {
          id: me.id,
          username: 'Настройки',
          avatar: null,
          gender: null,
          registration_date: '2019-05-05 05:05:05',
          new_notifications: 0,
          hide_viewed: true,
          votes_count: 0,
        },
      });
      const off = await inject(ctx, 'PATCH', '/api/me', me.headers, { data: { hide_viewed: 0 } });
      expect(off.json().data.hide_viewed).toBe(false);
      const untouched = await inject(ctx, 'PATCH', '/api/me', me.headers, { data: { other: 1 } });
      expect(untouched.json().data.hide_viewed).toBe(false);
      expect((await inject(ctx, 'PATCH', '/api/me', me.headers, { data: { hide_viewed: 'x' } })).statusCode).toBe(400);
      expect((await inject(ctx, 'PATCH', '/api/me', undefined, { data: { hide_viewed: 1 } })).statusCode).toBe(401);
    });
  });

  describe('invites', () => {
    it('creates one code per user, shows the inviter and makes friends on accept', async () => {
      const inviter = await signIn(ctx, { username: 'Пригласивший' });
      const guest = await signIn(ctx);

      const first = await inject(ctx, 'GET', '/api/me/invite', inviter.headers);
      const { code } = first.json();
      expect(first.json()).toEqual({ success: true, code: expect.stringMatching(/^[0-9a-f]{12}$/) });
      expect((await inject(ctx, 'GET', '/api/me/invite', inviter.headers)).json()).toEqual({ success: true, code });

      const shown = await inject(ctx, 'GET', `/api/invites/${code}`);
      expect(shown.json()).toEqual({
        success: true,
        user: { id: inviter.id, username: 'Пригласивший', avatar: null, gender: null, registration_date: null },
      });

      const accepted = await inject(ctx, 'POST', '/api/me/invite/accept', guest.headers, { code });
      expect(accepted.json()).toEqual({ success: true, inviterId: inviter.id });
      const rows = await ctx.t.db
        .select()
        .from(schema.userFriends)
        .where(and(eq(schema.userFriends.subscribed, 1)));
      expect(rows).toEqual(
        expect.arrayContaining([
          { user1: guest.id, user2: inviter.id, subscribed: 1 },
          { user1: inviter.id, user2: guest.id, subscribed: 1 },
        ]),
      );

      // own invite: accepted, but no self-follow
      const own = await inject(ctx, 'POST', '/api/me/invite/accept', inviter.headers, { code });
      expect(own.json()).toEqual({ success: true, inviterId: inviter.id });
      expect(
        await ctx.t.db.select().from(schema.userFriends).where(eq(schema.userFriends.user2, schema.userFriends.user1)),
      ).toEqual([]);
    });

    it('answers 404 for unknown codes and 401 without a viewer', async () => {
      const guest = await signIn(ctx);
      const missing = await inject(ctx, 'GET', '/api/invites/nope');
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ success: false, err: 'Invite not found' });
      const accept = await inject(ctx, 'POST', '/api/me/invite/accept', guest.headers, { code: 'nope' });
      expect(accept.statusCode).toBe(404);
      expect(accept.json()).toEqual({ success: false, err: 'Invite not found' });
      const noCode = await inject(ctx, 'POST', '/api/me/invite/accept', guest.headers, {});
      expect(noCode.statusCode).toBe(404);
      expect((await inject(ctx, 'GET', '/api/me/invite')).statusCode).toBe(401);
      expect((await inject(ctx, 'POST', '/api/me/invite/accept', undefined, { code: 'x' })).statusCode).toBe(401);
    });
  });

  describe('GET /api/users/search', () => {
    it('finds users by name, prefix matches first, with the viewer excluded and flagged', async () => {
      const viewer = await signIn(ctx, { username: 'Зоркий Поисковик' });
      const prefix = await signIn(ctx, { username: 'Поисковик Второй' });
      const contains = await signIn(ctx, { username: 'Анна Поисковикова' });
      await signIn(ctx, { username: 'Поиск_овик' });
      await follow(ctx, viewer.id, contains.id);
      const row = (u: { id: number }, username: string, subscribed: boolean) => ({
        id: u.id,
        username,
        avatar: null,
        gender: null,
        registration_date: null,
        subscribed,
      });

      const res = await inject(ctx, 'GET', `/api/users/search?q=${encodeURIComponent('  поисковик ')}`, viewer.headers);
      expect(res.json()).toEqual({
        success: true,
        results: [row(prefix, 'Поисковик Второй', false), row(contains, 'Анна Поисковикова', true)],
      });

      const anonymous = await inject(ctx, 'GET', `/api/users/search?q=${encodeURIComponent('Поисковик')}`);
      expect(anonymous.json().results.map((u: { id: number }) => u.id)).toEqual([prefix.id, contains.id, viewer.id]);

      // LIKE wildcards are literal
      const wildcard = await inject(ctx, 'GET', `/api/users/search?q=${encodeURIComponent('%%')}`);
      expect(wildcard.json()).toEqual({ success: true, results: [] });
      const underscore = await inject(ctx, 'GET', `/api/users/search?q=${encodeURIComponent('к_о')}`);
      expect(underscore.json().results.map((u: { username: string }) => u.username)).toEqual(['Поиск_овик']);

      expect((await inject(ctx, 'GET', '/api/users/search?q=%D0%9F')).json()).toEqual({ success: true, results: [] });
      expect((await inject(ctx, 'GET', '/api/users/search')).json()).toEqual({ success: true, results: [] });
    });
  });

  describe('GET /api/me/recommendations', () => {
    it('suggests friends of friends first, then same-taste voters, then others', async () => {
      const me = await signIn(ctx);
      const friend = await signIn(ctx);
      const fof = await signIn(ctx, { username: 'Друг друга' });
      const twin = await signIn(ctx, { username: 'Близнец' });
      await follow(ctx, me.id, friend.id);
      await follow(ctx, friend.id, fof.id);
      const m1 = await addMovie(ctx);
      const m2 = await addMovie(ctx);
      await ctx.t.db.insert(schema.movieVote).values([
        { movieId: m1, userId: me.id, vote: 2 },
        { movieId: m2, userId: me.id, vote: 0 },
        { movieId: m1, userId: twin.id, vote: 2 },
        { movieId: m2, userId: twin.id, vote: 0 },
      ]);

      const res = await inject(ctx, 'GET', '/api/me/recommendations', me.headers);
      const { success, results } = res.json();
      expect(success).toBe(true);
      expect(results.length).toBeLessThanOrEqual(12);
      expect(results[0]).toEqual({
        id: fof.id,
        username: 'Друг друга',
        avatar: null,
        gender: null,
        registration_date: null,
        reason: 'friends',
        reason_count: 1,
        subscribed: false,
      });
      expect(results[1]).toMatchObject({ id: twin.id, reason: 'votes', reason_count: 2, subscribed: false });
      const ids = results.map((u: { id: number }) => u.id);
      expect(ids).not.toContain(me.id);
      expect(ids).not.toContain(friend.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const r of results.slice(2)) expect(r).toMatchObject({ reason: 'random', reason_count: 0 });

      expect((await inject(ctx, 'GET', '/api/me/recommendations')).statusCode).toBe(401);
    });
  });

  describe('GET /api/me/accounts', () => {
    it('lists the linked sign-in services', async () => {
      const me = await signIn(ctx, { vkontakteId: `vk-${Math.random()}` });
      expect((await inject(ctx, 'GET', '/api/me/accounts', me.headers)).json()).toEqual({
        success: true,
        services: { vkontakte: true, yandex: false },
      });
      expect((await inject(ctx, 'GET', '/api/me/accounts')).statusCode).toBe(401);
    });
  });

  it('answers 401 on every /api/me route without a viewer', async () => {
    const routes: ['GET' | 'POST' | 'PATCH', string][] = [
      ['PATCH', '/api/me'],
      ['GET', '/api/me/friends'],
      ['GET', '/api/me/friends/votes'],
      ['GET', '/api/me/bookmarks'],
      ['POST', '/api/me/votes'],
      ['POST', '/api/me/bookmarks/toggle'],
      ['POST', '/api/me/subscriptions/toggle'],
      ['POST', '/api/me/subscriptions'],
      ['GET', '/api/me/invite'],
      ['POST', '/api/me/invite/accept'],
      ['GET', '/api/me/recommendations'],
      ['GET', '/api/me/accounts'],
    ];
    for (const [method, url] of routes) {
      const res = await inject(ctx, method, url, undefined, method === 'GET' ? undefined : {});
      expect(res.statusCode, `${method} ${url}`).toBe(401);
      expect(res.json()).toEqual({ success: false, msg: 'authorization required' });
    }
  });
});
