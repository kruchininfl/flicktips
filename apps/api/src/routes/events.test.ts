import { schema } from '@flicktips/db';
import { describe, expect, it } from 'vitest';

import { MemoryEventBus, type LiveEvent } from '../events/bus.js';
import { fakeKp, hasTestDb, signIn, TEST_SITE_URL, useTestApp, type TestContext } from '../../test/helpers.js';

// The tests talk HTTP to a listening server: inject() cannot read a response that never ends.
const bus = new MemoryEventBus();

async function addMovie(ctx: TestContext) {
  const [res] = await ctx.t.db.insert(schema.movie).values({ title: 'Фильм', likes: 2 });
  return res.insertId;
}

interface SseMessage {
  event?: string;
  data?: string;
  comment?: string;
  retry?: string;
}

// Reads a text/event-stream response message by message.
function sseReader(response: Response) {
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  const next = async (): Promise<SseMessage | null> => {
    for (;;) {
      const end = buffer.indexOf('\n\n');
      if (end >= 0) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const message: SseMessage = {};
        for (const line of block.split('\n')) {
          if (line.startsWith(':')) message.comment = line.slice(1).trim();
          else {
            const colon = line.indexOf(':');
            const field = line.slice(0, colon) as keyof SseMessage;
            message[field] = line.slice(colon + 1).trimStart();
          }
        }
        return message;
      }
      const { value, done } = await reader.read();
      if (done) return null;
      buffer += value;
    }
  };
  // the next message that carries an event, skipping heartbeats
  const nextEvent = async () => {
    for (;;) {
      const message = await next();
      if (!message || message.event) return message;
    }
  };
  return { next, nextEvent, cancel: () => reader.cancel() };
}

const until = async (check: () => boolean, ms = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

describe.skipIf(!hasTestDb)('GET /api/events', () => {
  const ctx = useTestApp(fakeKp(), undefined, {
    deps: { events: bus },
    options: { eventStream: { heartbeatMs: 50, maxPerUser: 2, retryMs: 1234 } },
  });
  let base = '';

  const open = async (headers: Record<string, string> = {}) => {
    if (!base) base = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
    return fetch(`${base}/api/events`, { headers });
  };
  const vote = (headers: Record<string, string>, id: number, vote: string) =>
    fetch(`${base}/api/me/votes`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json', origin: TEST_SITE_URL },
      body: JSON.stringify({ id, vote }),
    });

  it('answers 401 without a session', async () => {
    const res = await open();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ success: false, msg: 'authorization required' });
  });

  it('streams vote changes: counters for everyone, the flags only to the voter', async () => {
    const alice = await signIn(ctx);
    const bob = await signIn(ctx);
    const movieId = await addMovie(ctx);

    const aliceRes = await open(alice.headers);
    expect(aliceRes.status).toBe(200);
    expect(aliceRes.headers.get('content-type')).toBe('text/event-stream; charset=utf-8');
    expect(aliceRes.headers.get('cache-control')).toBe('no-cache, no-transform');
    expect(aliceRes.headers.get('x-accel-buffering')).toBe('no');
    const aliceStream = sseReader(aliceRes);
    expect(await aliceStream.next()).toEqual({ retry: '1234', comment: 'connected' });

    const bobStream = sseReader(await open(bob.headers));
    await bobStream.next();

    expect((await vote(alice.headers, movieId, 'like')).status).toBe(200);
    const counters = { id: movieId, super: 0, likes: 3, neutral: 0, dislikes: 0 };
    const own = await aliceStream.nextEvent();
    expect(own?.event).toBe('vote');
    expect(JSON.parse(own!.data!)).toEqual({
      ...counters,
      isSuper: false,
      isLiked: true,
      isNeutral: false,
      isDisliked: false,
    });
    const others = await bobStream.nextEvent();
    expect(JSON.parse(others!.data!)).toEqual(counters);

    // removing the vote is a change too
    await vote(alice.headers, movieId, 'like');
    expect(JSON.parse((await bobStream.nextEvent())!.data!)).toEqual({ ...counters, likes: 2 });

    await aliceStream.cancel();
    await bobStream.cancel();
  });

  it('sends heartbeats and unsubscribes when the client goes away', async () => {
    const user = await signIn(ctx);
    const before = bus.listenerCount;
    const stream = sseReader(await open(user.headers));
    await stream.next();
    expect(bus.listenerCount).toBe(before + 1);
    expect(await stream.next()).toEqual({ comment: 'ping' });

    await stream.cancel();
    await until(() => bus.listenerCount === before);
  });

  it('limits the open streams per user and frees the slot on disconnect', async () => {
    const user = await signIn(ctx);
    const first = sseReader(await open(user.headers));
    const second = sseReader(await open(user.headers));
    await first.next();
    await second.next();

    const third = await open(user.headers);
    expect(third.status).toBe(429);
    await third.body?.cancel();

    await first.cancel();
    await until(() => bus.listenerCount <= 1);
    const again = await open(user.headers);
    expect(again.status).toBe(200);
    await again.body?.cancel();
    await second.cancel();
  });
});

// Its own app and port: idle keep-alive sockets the client keeps towards the other tests' server would hold up
// that server's close() for the client's keep-alive timeout.
describe.skipIf(!hasTestDb)('GET /api/events lifetime and shutdown', () => {
  const ownBus = new MemoryEventBus();
  const ctx = useTestApp(fakeKp(), undefined, {
    deps: { events: ownBus },
    options: { eventStream: { maxLifetimeMs: 200 } },
  });
  let base = '';
  const open = async (headers: Record<string, string>) => {
    if (!base) base = await ctx.app.listen({ host: '127.0.0.1', port: 0 });
    return sseReader(await fetch(`${base}/api/events`, { headers }));
  };

  it('ends a stream after its lifetime, so the browser reconnects and signs in again', async () => {
    const user = await signIn(ctx);
    const stream = await open(user.headers);
    const started = Date.now();
    expect(await stream.next()).toMatchObject({ comment: 'connected' });
    expect(await stream.next()).toBeNull();
    expect(Date.now() - started).toBeGreaterThanOrEqual(150);
    await until(() => ownBus.listenerCount === 0);
  });

  it('closes the streams when the app shuts down', async () => {
    const user = await signIn(ctx);
    const stream = await open(user.headers);
    await stream.next();
    await ctx.app.close();
    // the stream ends instead of hanging the shutdown
    let message: SseMessage | null;
    do message = await stream.next();
    while (message);
    expect(ownBus.listenerCount).toBe(0);
  });
});

describe('MemoryEventBus', () => {
  const event: LiveEvent = {
    type: 'vote',
    userId: 1,
    movie: { id: 2, super: 0, likes: 1, neutral: 0, dislikes: 0 },
    flags: { isSuper: false, isLiked: true, isNeutral: false, isDisliked: false },
  };

  it('delivers to every subscriber until it unsubscribes', () => {
    const local = new MemoryEventBus();
    const got: string[] = [];
    const offA = local.subscribe(() => got.push('a'));
    local.subscribe(() => got.push('b'));
    local.publish(event);
    offA();
    local.publish(event);
    expect(got).toEqual(['a', 'b', 'b']);
  });

  it('keeps delivering when a listener throws', () => {
    const errors: unknown[] = [];
    const local = new MemoryEventBus((error) => errors.push(error));
    const got: LiveEvent[] = [];
    local.subscribe(() => {
      throw new Error('boom');
    });
    local.subscribe((e) => got.push(e));
    local.publish(event);
    expect(got).toEqual([event]);
    expect(errors).toHaveLength(1);
  });
});
