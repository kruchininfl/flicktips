import { schema } from '@flicktips/db';
import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

import { hasTestDb, signIn, TEST_SITE_URL, useTestApp, type TestContext } from '../../test/helpers.js';
import { revokeSession } from '../auth/sessions.js';
import { endpointId, MAX_SUBSCRIPTIONS_PER_USER } from '../repositories/push.js';
import { PushSubscriptionGoneError, type PushMessage, type PushSender, type PushTarget } from '../push/sender.js';
import { isPushServiceUrl } from './push.js';

type Headers = Record<string, string>;

const PUBLIC_KEY = 'BPublicKeyForTests_-0123456789';

class FakeSender implements PushSender {
  sent: { target: PushTarget; message: PushMessage }[] = [];
  gone = new Set<string>();
  failing = new Set<string>();

  async send(target: PushTarget, message: PushMessage) {
    if (this.gone.has(target.endpoint)) throw new PushSubscriptionGoneError(410);
    if (this.failing.has(target.endpoint)) throw new Error('push service is down');
    this.sent.push({ target, message });
  }
}

let n = 0;
const fcm = () => `https://fcm.googleapis.com/fcm/send/test-${++n}-${Math.random().toString(36).slice(2)}`;
const subscription = (endpoint: string) => ({
  endpoint,
  expirationTime: null,
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
});

const inject = (
  ctx: TestContext,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  headers?: Headers,
  payload?: object,
) => ctx.app.inject({ method, url, headers, payload });

async function addMovie(ctx: TestContext, title: string) {
  const [res] = await ctx.t.db.insert(schema.movie).values({ title });
  return res.insertId;
}

async function follow(ctx: TestContext, from: number, to: number, subscribed = 1) {
  await ctx.t.db.insert(schema.userFriends).values({ user1: from, user2: to, subscribed });
}

async function subscribe(ctx: TestContext, headers: Headers, endpoint = fcm()) {
  const res = await inject(ctx, 'POST', '/api/me/push/subscriptions', headers, {
    subscription: subscription(endpoint),
  });
  expect(res.statusCode).toBe(200);
  return endpoint;
}

const rows = (ctx: TestContext, userId: number) =>
  ctx.t.db.select().from(schema.pushSubscription).where(eq(schema.pushSubscription.userId, userId));

describe('isPushServiceUrl', () => {
  it('accepts the browsers’ push services only', () => {
    expect(isPushServiceUrl('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushServiceUrl('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isPushServiceUrl('https://web.push.apple.com/abc')).toBe(true);
    expect(isPushServiceUrl('https://wns2-par02p.notify.windows.com/w/?token=abc')).toBe(true);
    expect(isPushServiceUrl('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(isPushServiceUrl('https://fcm.googleapis.com:8443/x')).toBe(false);
    expect(isPushServiceUrl('https://user:pw@fcm.googleapis.com/x')).toBe(false);
    expect(isPushServiceUrl('https://evilfcm.googleapis.com.example/x')).toBe(false);
    expect(isPushServiceUrl('https://127.0.0.1/x')).toBe(false);
    expect(isPushServiceUrl('https://localhost:3002/api/me')).toBe(false);
    expect(isPushServiceUrl('not a url')).toBe(false);
  });
});

describe.skipIf(!hasTestDb)('push routes', () => {
  const sender = new FakeSender();
  const ctx = useTestApp(undefined, undefined, {
    deps: {
      pushSender: sender,
      config: {
        env: 'dev',
        telegramBotUsername: 'FlickTipsBot',
        siteUrl: TEST_SITE_URL,
        authSecret: 'test-secret',
        webPushPublicKey: PUBLIC_KEY,
      },
    },
  });

  it('GET /api/push/key returns the VAPID public key to anyone', async () => {
    const res = await inject(ctx, 'GET', '/api/push/key');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, publicKey: PUBLIC_KEY });
  });

  it('requires a signed-in viewer', async () => {
    const endpoint = fcm();
    expect((await inject(ctx, 'GET', `/api/me/push?endpoint=${encodeURIComponent(endpoint)}`)).statusCode).toBe(401);
    expect(
      (await inject(ctx, 'POST', '/api/me/push/subscriptions', {}, { subscription: subscription(endpoint) })).json(),
    ).toEqual({ success: false, msg: 'authorization required' });
    expect((await inject(ctx, 'DELETE', '/api/me/push/subscriptions', {}, { endpoint })).statusCode).toBe(401);
  });

  it('rejects cross-site subscribe requests (CSRF origin check)', async () => {
    const me = await signIn(ctx);
    const res = await inject(
      ctx,
      'POST',
      '/api/me/push/subscriptions',
      { ...me.headers, origin: 'https://evil.example' },
      { subscription: subscription(fcm()) },
    );
    expect(res.statusCode).toBe(403);
    expect(await rows(ctx, me.id)).toEqual([]);
  });

  it('subscribes, reports the status per session and unsubscribes', async () => {
    const me = await signIn(ctx);
    const endpoint = await subscribe(ctx, { ...me.headers, origin: TEST_SITE_URL });
    const status = `/api/me/push?endpoint=${encodeURIComponent(endpoint)}`;

    expect((await inject(ctx, 'GET', status, me.headers)).json()).toEqual({ success: true, subscribed: true });
    const [row] = await rows(ctx, me.id);
    expect(row).toMatchObject({ id: endpointId(endpoint), endpoint, auth: 'tBHItJI5svbpez7KI4CCXg' });

    // the same user in another browser session does not own this subscription
    const otherSession = await signIn(ctx);
    expect((await inject(ctx, 'GET', status, otherSession.headers)).json().subscribed).toBe(false);

    // subscribing again only updates the row
    await subscribe(ctx, me.headers, endpoint);
    expect(await rows(ctx, me.id)).toHaveLength(1);

    const res = await inject(ctx, 'DELETE', '/api/me/push/subscriptions', me.headers, { endpoint });
    expect(res.json()).toEqual({ success: true, subscribed: false });
    expect(await rows(ctx, me.id)).toEqual([]);
  });

  it('moves an endpoint to whoever subscribes with it last (the browser changed hands)', async () => {
    const first = await signIn(ctx);
    const second = await signIn(ctx);
    const endpoint = await subscribe(ctx, first.headers);
    await subscribe(ctx, second.headers, endpoint);
    expect(await rows(ctx, first.id)).toEqual([]);
    expect(await rows(ctx, second.id)).toHaveLength(1);
    // the first user cannot remove it any more
    await inject(ctx, 'DELETE', '/api/me/push/subscriptions', first.headers, { endpoint });
    expect(await rows(ctx, second.id)).toHaveLength(1);
  });

  it('validates the subscription', async () => {
    const me = await signIn(ctx);
    const bad = async (sub: object) =>
      (await inject(ctx, 'POST', '/api/me/push/subscriptions', me.headers, { subscription: sub })).statusCode;
    expect(await bad({ ...subscription('https://169.254.169.254/latest/meta-data'), expirationTime: null })).toBe(400);
    expect(await bad({ ...subscription(fcm()), keys: { p256dh: 'not base64!', auth: 'x' } })).toBe(400);
    expect(await bad({ endpoint: fcm() })).toBe(400);
    expect((await inject(ctx, 'POST', '/api/me/push/subscriptions', me.headers, {})).statusCode).toBe(400);
    expect(await rows(ctx, me.id)).toEqual([]);
  });

  it(`keeps at most ${MAX_SUBSCRIPTIONS_PER_USER} subscriptions per user`, async () => {
    const me = await signIn(ctx);
    let last = '';
    for (let i = 0; i < MAX_SUBSCRIPTIONS_PER_USER + 2; i++) last = await subscribe(ctx, me.headers);
    const kept = await rows(ctx, me.id);
    expect(kept).toHaveLength(MAX_SUBSCRIPTIONS_PER_USER);
    // the subscription just made always stays
    expect(kept.map((r) => r.endpoint)).toContain(last);
  });

  describe('friend vote notifications', () => {
    const vote = (headers: Headers, id: number, value: string) =>
      inject(ctx, 'POST', '/api/me/votes', headers, { id, vote: value });

    it('pushes a vote to the followers’ live subscriptions and drops gone ones', async () => {
      sender.sent = [];
      const voter = await signIn(ctx, { username: 'Аня' });
      const follower = await signIn(ctx);
      const follower2 = await signIn(ctx);
      const unfollowed = await signIn(ctx);
      const notFollowing = await signIn(ctx);
      await follow(ctx, follower.id, voter.id);
      await follow(ctx, follower2.id, voter.id);
      await follow(ctx, unfollowed.id, voter.id, 0);
      const movieId = await addMovie(ctx, 'Сталкер');

      const live = await subscribe(ctx, follower.headers);
      const gone = await subscribe(ctx, follower2.headers);
      const failing = await subscribe(ctx, follower2.headers);
      await subscribe(ctx, unfollowed.headers);
      await subscribe(ctx, notFollowing.headers);
      await subscribe(ctx, voter.headers);
      sender.gone.add(gone);
      sender.failing.add(failing);

      expect((await vote(voter.headers, movieId, 'super')).statusCode).toBe(200);
      await vi.waitFor(async () => {
        expect(sender.sent).toHaveLength(1);
        expect((await rows(ctx, follower2.id)).map((r) => r.endpoint)).toEqual([failing]);
      });

      expect(sender.sent[0]).toEqual({
        target: { endpoint: live, keys: subscription(live).keys },
        message: {
          payload: {
            title: 'Аня',
            body: '«Сталкер» — Супер',
            url: `/movie/${movieId}`,
            tag: `friend-vote-${voter.id}`,
          },
          ttl: 12 * 3600,
          topic: `fv${voter.id}`,
          urgency: 'low',
        },
      });
    });

    it('does not push removed votes, nor to subscriptions whose session ended', async () => {
      const voter = await signIn(ctx, { username: 'Боря' });
      const follower = await signIn(ctx);
      await follow(ctx, follower.id, voter.id);
      const movieId = await addMovie(ctx, 'Солярис');
      await subscribe(ctx, follower.headers);

      sender.sent = [];
      await vote(voter.headers, movieId, 'like');
      await vi.waitFor(() => expect(sender.sent).toHaveLength(1));
      expect(sender.sent[0]!.message.payload.body).toBe('«Солярис» — Хорошо');

      // removing the vote (same value again) notifies nobody
      await vote(voter.headers, movieId, 'like');
      // the follower signs out: the subscription of that session gets nothing
      const [row] = await rows(ctx, follower.id);
      await revokeSession(ctx.t.db, row!.sessionId);
      await vote(voter.headers, movieId, 'dislike');
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(sender.sent).toHaveLength(1);
    });
  });
});

describe.skipIf(!hasTestDb)('push routes without VAPID keys', () => {
  const ctx = useTestApp();

  it('reports no key and refuses subscriptions', async () => {
    expect((await inject(ctx, 'GET', '/api/push/key')).json()).toEqual({ success: true, publicKey: null });
    const me = await signIn(ctx);
    const res = await inject(ctx, 'POST', '/api/me/push/subscriptions', me.headers, {
      subscription: subscription(fcm()),
    });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ success: false, msg: 'push notifications are not configured' });
  });
});
