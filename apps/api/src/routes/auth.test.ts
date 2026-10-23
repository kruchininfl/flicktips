import { schema } from '@flicktips/db';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { hasTestDb, sessionCookie, signIn, TEST_SITE_URL, useTestApp } from '../../test/helpers.js';
import type { LoginService, OAuthIdentity } from '../auth/oauth.js';
import { hashSessionToken, SESSION_COOKIE } from '../auth/sessions.js';
import { OAUTH_COOKIE, validateNext } from './auth.js';

const { user, session, movie, movieVote, bookmark, userFriends, tgChat, tgChatMember, tgPost, voteEvent } = schema;

const unauthorized = { success: false, msg: 'authorization required' };

const vkUser = (id: string, username = 'Иван Петров'): OAuthIdentity => ({
  id,
  username,
  avatar: `https://vk.example/${id}.jpg`,
  gender: 'male',
});
const yaUser = (id: string, username = 'ivan'): OAuthIdentity => ({ id, username, avatar: null, gender: null });

// Cookie header for a session token the flow handed out (undefined when it did not: the test then fails on 401).
const cookieOf = (token: string | undefined) => sessionCookie(token ?? '');

// Set-Cookie values of a response, by name (value only, '' when cleared).
function cookiesOf(res: { cookies: { name: string; value: string }[] }): Record<string, string> {
  return Object.fromEntries(res.cookies.map((c) => [c.name, c.value]));
}

describe('validateNext', () => {
  it('accepts only relative paths on this site', () => {
    expect(validateNext('/')).toBe('/');
    expect(validateNext('/profile/accounts?tab=1#x')).toBe('/profile/accounts?tab=1#x');
    expect(validateNext('https://evil.example/')).toBeNull();
    expect(validateNext('//evil.example/')).toBeNull();
    expect(validateNext('/\\evil.example')).toBeNull();
    expect(validateNext('javascript:alert(1)')).toBeNull();
    expect(validateNext('profile')).toBeNull();
    expect(validateNext('/a\nb')).toBeNull();
    expect(validateNext('')).toBeNull();
    expect(validateNext(undefined)).toBeNull();
    expect(validateNext('/' + 'a'.repeat(2000))).toBeNull();
  });
});

describe.skipIf(!hasTestDb)('auth routes', () => {
  const ctx = useTestApp();
  const db = () => ctx.t.db;

  // Starts the flow: the redirect to the provider and the flow cookie.
  async function start(provider: LoginService, query = '', headers: Record<string, string> = {}) {
    const res = await ctx.app.inject({ method: 'GET', url: `/auth/${provider}${query}`, headers });
    const location = res.headers.location as string | undefined;
    const state = location ? new URL(location).searchParams.get('state') : null;
    return { res, location, state, flowCookie: cookiesOf(res)[OAUTH_COOKIE] };
  }

  // Runs the whole flow for `identity` and returns the callback response plus the session cookie it set.
  async function login(
    provider: LoginService,
    identity: OAuthIdentity,
    { query = '', headers = {} as Record<string, string>, code = 'ok' } = {},
  ) {
    ctx.oauth[provider].identity = identity;
    const started = await start(provider, query, headers);
    expect(started.res.statusCode).toBe(302);
    const cookieHeader = [headers.cookie, `${OAUTH_COOKIE}=${started.flowCookie}`].filter(Boolean).join('; ');
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/auth/${provider}/callback?code=${code}&state=${started.state}&device_id=dev1`,
      headers: { ...headers, cookie: cookieHeader },
    });
    const token = cookiesOf(res)[SESSION_COOKIE];
    return { res, token, location: res.headers.location as string | undefined, started };
  }

  const me = (token: string | undefined) =>
    ctx.app.inject({ method: 'GET', url: '/api/me', headers: { cookie: cookieOf(token) } });

  it('redirects to the provider with a state and a flow cookie', async () => {
    const { res, location, state, flowCookie } = await start('vkontakte', '?next=/movies/1');
    expect(res.statusCode).toBe(302);
    expect(location).toMatch(/^https:\/\/vkontakte\.example\/authorize\?/);
    expect(new URL(location!).searchParams.get('redirect_uri')).toBe(`${TEST_SITE_URL}/auth/vkontakte/callback`);
    expect(state).toMatch(/^[0-9a-f]{48}$/);
    expect(flowCookie).toBeTruthy();
    const cookie = res.cookies.find((c) => c.name === OAUTH_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe('/auth');
    expect(cookie.sameSite).toBe('Lax');
  });

  it('answers 404 for an unknown provider', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/auth/facebook' });
    expect(res.statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'GET', url: '/auth/facebook/callback' })).statusCode).toBe(404);
  });

  it('signs in: creates the user, a session and the cookie, then redirects to next', async () => {
    const { res, token, location } = await login('vkontakte', vkUser('100'), { query: '?next=/movies/1' });
    expect(res.statusCode).toBe(302);
    expect(location).toBe('/movies/1');
    expect(token).toBeTruthy();
    const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE)!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe('/');
    expect(cookie.sameSite).toBe('Lax');
    expect(cookie.maxAge).toBe(365 * 24 * 3600);
    // dev config: not Secure (tests and flicktips.local without TLS)
    expect(cookie.secure).toBeUndefined();
    // the flow cookie is gone
    expect(cookiesOf(res)[OAUTH_COOKIE]).toBe('');

    const [created] = await db().select().from(user).where(eq(user.vkontakteId, '100'));
    expect(created).toMatchObject({
      username: 'Иван Петров',
      avatarSource: 'https://vk.example/100.jpg',
      gender: 'male',
      avatar: '',
      yandexId: null,
    });
    expect(created!.registrationDate).toBeTruthy();

    const [stored] = await db()
      .select()
      .from(session)
      .where(eq(session.id, hashSessionToken(token ?? '')));
    expect(stored).toMatchObject({ userId: created!.id, userAgent: 'lightMyRequest' });
    expect(stored!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 360 * 24 * 3600 * 1000);

    // the callback passed the provider what it needs: the state and the exact redirect URI
    const call = ctx.oauth.vkontakte.calls.at(-1)!;
    expect(call.redirectUri).toBe(`${TEST_SITE_URL}/auth/vkontakte/callback`);
    expect(call.query).toMatchObject({ code: 'ok', device_id: 'dev1', state: call.state });

    const profile = await me(token);
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toEqual({
      success: true,
      data: {
        id: created!.id,
        username: 'Иван Петров',
        avatar: 'https://vk.example/100.jpg',
        gender: 'male',
        registration_date: created!.registrationDate,
        new_notifications: 0,
        hide_viewed: false,
      },
    });
  });

  it('finds the existing user on the second sign-in with the same provider account', async () => {
    const first = await login('yandex', yaUser('y-1', 'first name'));
    const second = await login('yandex', yaUser('y-1', 'renamed'));
    expect(second.res.statusCode).toBe(302);
    expect(second.location).toBe('/');
    const [a, b] = await Promise.all([me(first.token), me(second.token)]);
    expect(a.json().data.id).toBe(b.json().data.id);
    // like PHP, the profile is not overwritten on later sign-ins
    expect(b.json().data.username).toBe('first name');
    const rows = await db().select().from(user).where(eq(user.yandexId, 'y-1'));
    expect(rows).toHaveLength(1);
    // two independent sessions
    const sessions = await db().select().from(session).where(eq(session.userId, a.json().data.id));
    expect(sessions).toHaveLength(2);
  });

  it('ignores an absolute or protocol-relative next', async () => {
    for (const next of ['https://evil.example/', '//evil.example/x', '/\\evil.example']) {
      const { location } = await login('vkontakte', vkUser('101'), { query: `?next=${encodeURIComponent(next)}` });
      expect(location).toBe('/');
    }
  });

  it('rejects a callback whose state does not match the cookie', async () => {
    ctx.oauth.vkontakte.identity = vkUser('102');
    const started = await start('vkontakte', '?next=/here');
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/auth/vkontakte/callback?code=ok&state=${'0'.repeat(48)}&device_id=d`,
      headers: { cookie: `${OAUTH_COOKIE}=${started.flowCookie}` },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/signin?error=state&next=%2Fhere');
    expect(cookiesOf(res)[SESSION_COOKIE]).toBeUndefined();
    expect(await db().select().from(user).where(eq(user.vkontakteId, '102'))).toHaveLength(0);

    // no cookie at all (another browser, or a tampered cookie)
    const bare = await ctx.app.inject({
      method: 'GET',
      url: `/auth/vkontakte/callback?code=ok&state=${started.state}`,
    });
    expect(bare.headers.location).toBe('/signin?error=state&next=%2F');
    const tampered = await ctx.app.inject({
      method: 'GET',
      url: `/auth/vkontakte/callback?code=ok&state=${started.state}`,
      headers: { cookie: `${OAUTH_COOKIE}=${started.flowCookie}x` },
    });
    expect(tampered.headers.location).toBe('/signin?error=state&next=%2F');
    // a cookie of another provider's flow
    const other = await ctx.app.inject({
      method: 'GET',
      url: `/auth/yandex/callback?code=ok&state=${started.state}`,
      headers: { cookie: `${OAUTH_COOKIE}=${started.flowCookie}` },
    });
    expect(other.headers.location).toBe('/signin?error=state&next=%2Fhere');
  });

  it('sends provider errors and denials back to the sign-in page', async () => {
    const bad = await login('yandex', yaUser('y-2'), { code: 'nope', query: '?next=/x' });
    expect(bad.location).toBe('/signin?error=provider&next=%2Fx');
    expect(bad.token).toBeUndefined();

    const started = await start('yandex');
    const denied = await ctx.app.inject({
      method: 'GET',
      url: `/auth/yandex/callback?error=access_denied&state=${started.state}`,
      headers: { cookie: `${OAUTH_COOKIE}=${started.flowCookie}` },
    });
    expect(denied.headers.location).toBe('/signin?error=denied&next=%2F');
  });

  it('GET /api/me: 401 without, with an unknown, an expired or a revoked session', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401);
    expect((await me('nonsense')).statusCode).toBe(401);
    expect((await me('nonsense')).json()).toEqual(unauthorized);

    const { token } = await login('vkontakte', vkUser('103'));
    expect((await me(token)).statusCode).toBe(200);

    await db()
      .update(session)
      .set({ expiresAt: sql`DATE_SUB(NOW(), INTERVAL 1 MINUTE)` as unknown as Date })
      .where(eq(session.id, hashSessionToken(token ?? '')));
    expect((await me(token)).statusCode).toBe(401);

    const { token: other } = await login('vkontakte', vkUser('103'));
    expect((await me(other)).statusCode).toBe(200);
    await db()
      .delete(session)
      .where(eq(session.id, hashSessionToken(other ?? '')));
    expect((await me(other)).statusCode).toBe(401);
  });

  it('slides the expiry forward when the session was last seen a while ago', async () => {
    const { token } = await login('vkontakte', vkUser('104'));
    const id = hashSessionToken(token ?? '');
    await db()
      .update(session)
      .set({
        lastSeenAt: sql`DATE_SUB(NOW(), INTERVAL 1 HOUR)` as unknown as Date,
        expiresAt: sql`DATE_ADD(NOW(), INTERVAL 1 DAY)` as unknown as Date,
      })
      .where(eq(session.id, id));
    expect((await me(token)).statusCode).toBe(200);
    const [row] = await db().select().from(session).where(eq(session.id, id));
    expect(row!.lastSeenAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 360 * 24 * 3600 * 1000);
  });

  it('deletes expired sessions lazily on sign-in', async () => {
    await db()
      .insert(session)
      .values({
        id: 'f'.repeat(64),
        userId: 1,
        createdAt: sql`NOW()` as unknown as Date,
        lastSeenAt: sql`NOW()` as unknown as Date,
        expiresAt: sql`DATE_SUB(NOW(), INTERVAL 1 DAY)` as unknown as Date,
      });
    await login('vkontakte', vkUser('105'));
    expect(
      await db()
        .select()
        .from(session)
        .where(eq(session.id, 'f'.repeat(64))),
    ).toHaveLength(0);
  });

  it('logout revokes the current session only, logout-all every session of the user', async () => {
    const a = await login('vkontakte', vkUser('106'));
    const b = await login('vkontakte', vkUser('106'));
    const c = await login('vkontakte', vkUser('106'));

    const out = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: cookieOf(a.token) },
    });
    expect(out.statusCode).toBe(200);
    expect(out.json()).toEqual({ success: true });
    expect(cookiesOf(out)[SESSION_COOKIE]).toBe('');
    expect((await me(a.token)).statusCode).toBe(401);
    expect((await me(b.token)).statusCode).toBe(200);
    expect((await me(c.token)).statusCode).toBe(200);

    // logging out without a session is fine too
    expect((await ctx.app.inject({ method: 'POST', url: '/api/auth/logout' })).json()).toEqual({ success: true });

    const all = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/logout-all',
      headers: { cookie: cookieOf(b.token) },
    });
    expect(all.json()).toEqual({ success: true });
    expect((await me(b.token)).statusCode).toBe(401);
    expect((await me(c.token)).statusCode).toBe(401);

    const anon = await ctx.app.inject({ method: 'POST', url: '/api/auth/logout-all' });
    expect(anon.statusCode).toBe(401);
  });

  it('rejects state-changing requests from another origin', async () => {
    const { headers } = await signIn(ctx);
    const evil = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { ...headers, origin: 'https://evil.example' },
    });
    expect(evil.statusCode).toBe(403);
    expect(evil.json()).toEqual({ success: false, msg: 'cross-site request rejected' });
    // the session is still alive
    expect((await ctx.app.inject({ method: 'GET', url: '/api/me', headers })).statusCode).toBe(200);

    const crossSite = await ctx.app.inject({
      method: 'POST',
      url: '/api/me/accounts/unlink',
      headers: { ...headers, 'sec-fetch-site': 'cross-site' },
      payload: { service: 'vkontakte' },
    });
    expect(crossSite.statusCode).toBe(403);

    // a `null` origin (opaque) is not us either
    expect(
      (await ctx.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { ...headers, origin: 'null' } }))
        .statusCode,
    ).toBe(403);

    // our own origin, a same-origin fetch, and a GET from anywhere pass
    for (const extra of [{ origin: TEST_SITE_URL }, { 'sec-fetch-site': 'same-origin' }, {}]) {
      const ok = await ctx.app.inject({
        method: 'PATCH',
        url: '/api/me',
        headers: { ...headers, ...extra },
        payload: { data: { hide_viewed: 1 } },
      });
      expect(ok.statusCode, JSON.stringify(extra)).toBe(200);
    }
    const get = await ctx.app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { ...headers, origin: 'https://evil.example' },
    });
    expect(get.statusCode).toBe(200);
  });

  describe('linked accounts', () => {
    // Runs the link flow for the signed-in `headers` and returns the proof from the redirect.
    async function linkProof(provider: LoginService, identity: OAuthIdentity, headers: Record<string, string>) {
      const { res, location } = await login(provider, identity, { query: '?link=1&next=/profile/accounts', headers });
      expect(res.statusCode).toBe(302);
      const url = new URL(location!, TEST_SITE_URL);
      expect(url.pathname).toBe('/profile/accounts');
      expect(url.searchParams.get('link_error')).toBeNull();
      // link mode never signs in or creates anyone
      expect(cookiesOf(res)[SESSION_COOKIE]).toBeUndefined();
      return url.searchParams.get('link_proof')!;
    }

    const post = (url: string, headers: Record<string, string>, payload: object) =>
      ctx.app.inject({ method: 'POST', url, headers, payload });

    it('requires a signed-in user to start linking', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/auth/yandex?link=1&next=/profile/accounts' });
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('/signin?next=%2Fprofile%2Faccounts');
    });

    it('links a second provider to the signed-in account', async () => {
      const { token } = await login('vkontakte', vkUser('200'));
      const headers = { cookie: cookieOf(token) };
      const proof = await linkProof('yandex', yaUser('y-200'), headers);
      expect(proof).toBeTruthy();
      expect(await db().select().from(user).where(eq(user.yandexId, 'y-200'))).toHaveLength(0);

      const res = await post('/api/me/accounts/link', headers, { proof });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        success: true,
        status: 'linked',
        service: 'yandex',
        services: { vkontakte: true, yandex: true },
      });
      const accounts = await ctx.app.inject({ method: 'GET', url: '/api/me/accounts', headers });
      expect(accounts.json()).toEqual({ success: true, services: { vkontakte: true, yandex: true } });

      // linking the same account again is a no-op
      const again = await post('/api/me/accounts/link', headers, { proof });
      expect(again.json().status).toBe('linked');

      // another account of the same service: refused
      const other = await linkProof('yandex', yaUser('y-201'), headers);
      const conflict = await post('/api/me/accounts/link', headers, { proof: other });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json()).toEqual({ success: false, msg: 'another account of this service is already linked' });

      // the yandex account now signs in to the same user
      const { token: viaYandex } = await login('yandex', yaUser('y-200'));
      expect((await me(viaYandex)).json().data.id).toBe((await me(token)).json().data.id);
    });

    it('refuses a proof that is missing, forged, expired or issued to another session', async () => {
      const { token } = await login('vkontakte', vkUser('202'));
      const headers = { cookie: cookieOf(token) };
      const expired = { success: false, msg: 'sign-in expired, try again' };

      expect((await post('/api/me/accounts/link', headers, {})).statusCode).toBe(400);
      const forged = await post('/api/me/accounts/link', headers, { proof: 'abc.def' });
      expect(forged.statusCode).toBe(400);
      expect(forged.json()).toEqual(expired);

      const proof = await linkProof('yandex', yaUser('y-202'), headers);
      const [payload, signature] = proof.split('.');
      const tampered = await post('/api/me/accounts/link', headers, { proof: `${payload}x.${signature}` });
      expect(tampered.json()).toEqual(expired);

      // the same user from another browser (session): the proof is bound to the session that got it
      const { token: elsewhere } = await login('vkontakte', vkUser('202'));
      const stolen = await post('/api/me/accounts/link', { cookie: cookieOf(elsewhere) }, { proof });
      expect(stolen.statusCode).toBe(400);
      expect(stolen.json()).toEqual(expired);

      // a stranger
      const stranger = await signIn(ctx);
      expect((await post('/api/me/accounts/link', stranger.headers, { proof })).json()).toEqual(expired);
      expect((await post('/api/me/accounts/link', {}, { proof })).json()).toEqual(unauthorized);
      expect((await post('/api/me/accounts/merge', {}, { proof })).statusCode).toBe(401);
    });

    it('fails the link flow when the browser is no longer signed in as the same user', async () => {
      const { token } = await login('vkontakte', vkUser('203'));
      ctx.oauth.yandex.identity = yaUser('y-203');
      const started = await start('yandex', '?link=1&next=/profile/accounts', { cookie: cookieOf(token) });
      // signed out in between
      await ctx.app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie: cookieOf(token) } });
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/auth/yandex/callback?code=ok&state=${started.state}`,
        headers: { cookie: `${OAUTH_COOKIE}=${started.flowCookie}; ${cookieOf(token)}` },
      });
      expect(res.headers.location).toBe('/profile/accounts?link_error=session');
      expect(cookiesOf(res)[SESSION_COOKIE]).toBeUndefined();
    });

    it('reports a conflict with a merge summary, then merges the other account in', async () => {
      // "mine": VK user; "theirs": Yandex user with data of every kind
      const mine = await login('vkontakte', vkUser('300', 'Mine'));
      const theirs = await login('yandex', yaUser('y-300', 'Theirs'));
      const theirsAgain = await login('yandex', yaUser('y-300', 'Theirs'));
      const myId = (await me(mine.token)).json().data.id as number;
      const theirId = (await me(theirs.token)).json().data.id as number;
      const headers = { cookie: cookieOf(mine.token) };

      const third = await signIn(ctx, { username: 'Third' });
      const fourth = await signIn(ctx, { username: 'Fourth' });

      await db()
        .insert(movie)
        .values([
          { id: 1, tmdbId: 't1', title: 'Both, theirs newer', likes: 1, super: 1 },
          { id: 2, tmdbId: 't2', title: 'Both, mine newer', likes: 1, dislikes: 1 },
          { id: 3, tmdbId: 't3', title: 'Only theirs', neutral: 1 },
        ]);
      await db()
        .insert(movieVote)
        .values([
          { movieId: 1, userId: myId, vote: 2, timestamp: '2026-01-01 10:00:00' },
          { movieId: 1, userId: theirId, vote: 3, timestamp: '2026-01-02 10:00:00' },
          { movieId: 2, userId: myId, vote: 2, timestamp: '2026-01-05 10:00:00' },
          { movieId: 2, userId: theirId, vote: 0, timestamp: '2026-01-04 10:00:00' },
          { movieId: 3, userId: theirId, vote: 1, timestamp: '2026-01-03 10:00:00' },
        ]);
      await db()
        .insert(bookmark)
        .values([
          { movieId: 1, userId: myId },
          { movieId: 1, userId: theirId },
          { movieId: 3, userId: theirId },
        ]);
      await db()
        .insert(userFriends)
        .values([
          // theirs follows third and fourth, fourth follows theirs; I unfollowed third; we follow each other
          { user1: theirId, user2: third.id, subscribed: 1 },
          { user1: theirId, user2: fourth.id, subscribed: 1 },
          { user1: fourth.id, user2: theirId, subscribed: 1 },
          { user1: myId, user2: third.id, subscribed: 0 },
          { user1: myId, user2: theirId, subscribed: 1 },
          { user1: theirId, user2: myId, subscribed: 1 },
        ]);
      // Telegram: theirs is linked and in a group with a post and a queued vote event
      await db()
        .update(user)
        .set({ tgUserId: 555, tgUsername: 'theirs_tg', inviteCode: 'abcdef' })
        .where(eq(user.id, theirId));
      await db().insert(tgChat).values({ chatId: -100500, title: 'Group', active: 1 });
      await db().insert(tgChatMember).values({ chatId: -100500, userId: theirId, joinedAt: '2026-01-01 00:00:00' });
      await db().insert(tgPost).values({ chatId: -100500, messageId: 7, userId: theirId, movieId: 3, vote: 1 });
      await db().insert(voteEvent).values({ userId: theirId, movieId: 3, vote: 1 });

      const proof = await linkProof('yandex', yaUser('y-300'), headers);
      const conflict = await post('/api/me/accounts/link', headers, { proof });
      expect(conflict.statusCode).toBe(200);
      expect(conflict.json()).toEqual({
        success: true,
        status: 'conflict',
        service: 'yandex',
        merge: {
          user: {
            id: theirId,
            username: 'Theirs',
            avatar: null,
            gender: null,
            registration_date: expect.any(String),
          },
          votes: 3,
          bookmarks: 2,
          following: 2,
          conflicts: 2,
          blocking: [],
        },
      });
      // nothing changed yet
      expect((await me(theirs.token)).statusCode).toBe(200);

      const merged = await post('/api/me/accounts/merge', headers, { proof });
      expect(merged.statusCode).toBe(200);
      expect(merged.json()).toEqual({
        success: true,
        status: 'merged',
        service: 'yandex',
        services: { vkontakte: true, yandex: true },
      });

      // the other user is gone, with every session
      expect(await db().select().from(user).where(eq(user.id, theirId))).toHaveLength(0);
      expect((await me(theirs.token)).statusCode).toBe(401);
      expect((await me(theirsAgain.token)).statusCode).toBe(401);
      expect(await db().select().from(session).where(eq(session.userId, theirId))).toHaveLength(0);
      // mine still works and keeps its profile
      const profile = (await me(mine.token)).json().data;
      expect(profile).toMatchObject({ id: myId, username: 'Mine', avatar: 'https://vk.example/300.jpg' });
      const [row] = await db().select().from(user).where(eq(user.id, myId));
      expect(row).toMatchObject({
        vkontakteId: '300',
        yandexId: 'y-300',
        tgUserId: 555,
        tgUsername: 'theirs_tg',
        inviteCode: 'abcdef',
      });

      // votes: newer wins, counters drop the loser
      const votes = await db().select().from(movieVote).orderBy(movieVote.movieId);
      expect(votes.map((v) => [v.movieId, v.userId, v.vote])).toEqual([
        [1, myId, 3],
        [2, myId, 2],
        [3, myId, 1],
      ]);
      const movies = await db().select().from(movie).orderBy(movie.id);
      expect(movies.map((m) => [m.id, m.dislikes, m.neutral, m.likes, m.super])).toEqual([
        [1, 0, 0, 0, 1],
        [2, 0, 0, 1, 0],
        [3, 0, 1, 0, 0],
      ]);
      // bookmarks united
      const marks = await db().select().from(bookmark).orderBy(bookmark.movieId);
      expect(marks.map((b) => [b.movieId, b.userId])).toEqual([
        [1, myId],
        [3, myId],
      ]);
      // follows: a follow wins over my unfollow of third; fourth now follows me; the pair's rows are gone
      const follows = await db().select().from(userFriends).orderBy(userFriends.user1, userFriends.user2);
      expect(follows.map((f) => [f.user1, f.user2, f.subscribed]).sort()).toEqual(
        [
          [myId, third.id, 1],
          [myId, fourth.id, 1],
          [fourth.id, myId, 1],
        ].sort(),
      );
      // Telegram membership, post and queued vote event moved over
      expect((await db().select().from(tgChatMember)).map((m) => m.userId)).toEqual([myId]);
      expect((await db().select().from(tgPost)).map((p) => p.userId)).toEqual([myId]);
      expect((await db().select().from(voteEvent)).map((e) => e.userId)).toEqual([myId]);
    });

    it('refuses to merge when both accounts use different accounts of one service', async () => {
      const mine = await login('vkontakte', vkUser('400'));
      const headers = { cookie: cookieOf(mine.token) };
      // theirs: yandex + another VK account
      const theirs = await login('yandex', yaUser('y-400'));
      const theirId = (await me(theirs.token)).json().data.id as number;
      await db().update(user).set({ vkontakteId: '401' }).where(eq(user.id, theirId));

      const proof = await linkProof('yandex', yaUser('y-400'), headers);
      const conflict = await post('/api/me/accounts/link', headers, { proof });
      expect(conflict.json().merge.blocking).toEqual(['vkontakte']);
      const merged = await post('/api/me/accounts/merge', headers, { proof });
      expect(merged.statusCode).toBe(409);
      expect(merged.json()).toEqual({ success: false, msg: 'accounts cannot be merged' });
      expect((await me(theirs.token)).statusCode).toBe(200);

      // nothing to merge: the account is free (or mine)
      const free = await linkProof('yandex', yaUser('y-402'), headers);
      const nothing = await post('/api/me/accounts/merge', headers, { proof: free });
      expect(nothing.statusCode).toBe(409);
      expect(nothing.json()).toEqual({ success: false, msg: 'nothing to merge' });
    });

    it('unlinks a provider, but never the last one', async () => {
      const { token } = await login('vkontakte', vkUser('500'));
      const headers = { cookie: cookieOf(token) };

      const last = await post('/api/me/accounts/unlink', headers, { service: 'vkontakte' });
      expect(last.statusCode).toBe(409);
      expect(last.json()).toEqual({ success: false, msg: 'cannot unlink the last sign-in method' });

      const unknown = await post('/api/me/accounts/unlink', headers, { service: 'facebook' });
      expect(unknown.statusCode).toBe(400);
      expect(unknown.json()).toEqual({ success: false, msg: 'unknown service' });

      const proof = await linkProof('yandex', yaUser('y-500'), headers);
      await post('/api/me/accounts/link', headers, { proof });
      const ok = await post('/api/me/accounts/unlink', headers, { service: 'vkontakte' });
      expect(ok.statusCode).toBe(200);
      expect(ok.json()).toEqual({ success: true, services: { vkontakte: false, yandex: true } });
      // the session survives; a new VK sign-in with that account creates a fresh user
      expect((await me(token)).statusCode).toBe(200);
      const fresh = await login('vkontakte', vkUser('500'));
      expect((await me(fresh.token)).json().data.id).not.toBe((await me(token)).json().data.id);

      expect((await post('/api/me/accounts/unlink', {}, { service: 'yandex' })).statusCode).toBe(401);
    });
  });
});
