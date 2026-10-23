// GET /api/events: a server-sent event stream for the signed-in viewer. Replaces the legacy socket.io
// `vote-changed` broadcast (web/src/server.js); for now it only carries vote changes. See docs/events.md.
import type { ServerResponse } from 'node:http';

import type { VoteChangedEvent } from '@flicktips/shared';
import type { FastifyPluginAsync } from 'fastify';

import { requireViewer } from '../auth/viewer.js';
import type { ResolvedDeps } from '../deps.js';
import { HttpError } from '../lib/errors.js';
import type { LiveEvent } from '../events/bus.js';

export interface EventStreamOptions {
  // a comment line this often keeps proxies and the browser from timing the stream out
  heartbeatMs: number;
  // the stream is closed after this long (± 10 %); EventSource reconnects with the cookie, so a revoked or
  // expired session stops receiving events at the latest then
  maxLifetimeMs: number;
  // open streams per user (tabs × devices); more answer 429
  maxPerUser: number;
  // browser reconnect delay sent as `retry:`
  retryMs: number;
}

export const DEFAULT_EVENT_STREAM_OPTIONS: EventStreamOptions = {
  heartbeatMs: 25_000,
  maxLifetimeMs: 15 * 60_000,
  maxPerUser: 16,
  retryMs: 5_000,
};

// A client that does not read its stream is dropped once this much is queued for it.
const MAX_BUFFERED_BYTES = 256 * 1024;

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// What one viewer may see of an event: the counters always, the flags only on their own vote.
function toFrame(event: LiveEvent, viewerId: number): string {
  const data: VoteChangedEvent = event.userId === viewerId ? { ...event.movie, ...event.flags } : { ...event.movie };
  return frame('vote', data);
}

export const eventRoutes =
  (deps: ResolvedDeps, options: Partial<EventStreamOptions> = {}): FastifyPluginAsync =>
  async (app) => {
    const opts = { ...DEFAULT_EVENT_STREAM_OPTIONS, ...options };
    const open = new Set<(shutdown?: boolean) => void>();
    const perUser = new Map<number, number>();

    // close the streams first, otherwise app.close() would wait for them
    app.addHook('preClose', async () => {
      for (const close of [...open]) close(true);
    });

    app.get('/events', async (request, reply) => {
      const viewer = requireViewer(request);
      if ((perUser.get(viewer.id) ?? 0) >= opts.maxPerUser) throw new HttpError(429, 'too many open streams');

      reply.hijack();
      const res: ServerResponse = reply.raw;
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        // the socket is not reused once the stream ends (lifetime, shutdown)
        connection: 'close',
        // nginx: do not buffer this response (proxy_buffering off for /api/events does the same)
        'x-accel-buffering': 'no',
      });
      perUser.set(viewer.id, (perUser.get(viewer.id) ?? 0) + 1);

      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        res.write(chunk);
        if (res.writableLength > MAX_BUFFERED_BYTES) {
          request.log.warn({ userId: viewer.id }, 'event stream: client too slow, dropped');
          close();
        }
      };

      const unsubscribe = deps.events.subscribe((event) => write(toFrame(event, viewer.id)));
      const heartbeat = setInterval(() => write(': ping\n\n'), opts.heartbeatMs);
      const lifetime = setTimeout(() => close(), opts.maxLifetimeMs * (0.9 + Math.random() * 0.2));

      function close(shutdown = false) {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        clearTimeout(lifetime);
        open.delete(close);
        const left = (perUser.get(viewer.id) ?? 1) - 1;
        if (left > 0) perUser.set(viewer.id, left);
        else perUser.delete(viewer.id);
        if (!res.writableEnded) res.end();
        // on shutdown the connection must not linger as an idle keep-alive one
        if (shutdown) res.once('finish', () => res.socket?.destroy());
      }
      open.add(close);
      res.on('close', () => close());
      res.on('error', () => close());

      // the first bytes go out at once, so the browser fires `open` and proxies pass the headers on
      write(`retry: ${opts.retryMs}\n: connected\n\n`);
    });
  };
