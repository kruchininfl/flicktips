// Web Push subscriptions of the signed-in viewer (docs/push.md). The CSRF origin check of app.ts covers the POST
// and DELETE routes like every other state-changing request.
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { requireViewer } from '../auth/viewer.js';
import type { ResolvedDeps } from '../deps.js';
import { badRequest, HttpError, unauthorized } from '../lib/errors.js';
import { acceptEmptyJsonBody } from '../lib/json-body.js';
import { deleteSubscription, isSubscribed, saveSubscription } from '../repositories/push.js';

// The API POSTs to whatever endpoint a browser registers, so only the browsers' own push services are accepted
// (no requests to internal hosts on behalf of a client). Hosts match exactly or as a subdomain.
export const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com', // Chrome and most Chromium browsers (Opera, Samsung Internet, ...)
  'android.googleapis.com', // older Chrome subscriptions
  'push.services.mozilla.com', // Firefox
  'push.apple.com', // Safari (macOS, iOS 16.4+ home-screen apps)
  'notify.windows.com', // Microsoft Edge (WNS)
];

export function isPushServiceUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.some((allowed) => host === allowed || host.endsWith('.' + allowed));
}

const base64url = z
  .string()
  .min(1)
  .max(255)
  .regex(/^[A-Za-z0-9_-]+={0,2}$/, 'must be base64url');

const endpoint = z.string().min(1).max(2048).refine(isPushServiceUrl, 'unsupported push service');

const subscribeBody = z.object({
  subscription: z.object({
    endpoint,
    expirationTime: z.number().nullish(),
    keys: z.object({ p256dh: base64url, auth: base64url }),
  }),
});

const endpointBody = z.object({ endpoint: z.string().min(1).max(2048) });

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw badRequest(
      result.error.issues.map((i) => (i.path.length ? `${i.path.join('.')}: ` : '') + i.message).join('; '),
    );
  }
  return result.data;
}

export const pushRoutes =
  (deps: ResolvedDeps): FastifyPluginAsync =>
  async (app) => {
    const { db } = deps;
    const publicKey = deps.config.webPushPublicKey || null;
    const enabled = !!publicKey && !!deps.pushSender;

    acceptEmptyJsonBody(app);

    // a viewer signed in by a session cookie: subscriptions belong to that session
    const sessionViewer = (request: Parameters<typeof requireViewer>[0]) => {
      const viewer = requireViewer(request);
      if (!viewer.sessionId) throw unauthorized();
      return { id: viewer.id, sessionId: viewer.sessionId };
    };

    app.get('/push/key', async () => ({ success: true, publicKey: enabled ? publicKey : null }));

    // GET /api/me/push?endpoint=: is this browser subscribed for the viewer?
    app.get('/me/push', async (request) => {
      const viewer = sessionViewer(request);
      const { endpoint: value } = parse(endpointBody, request.query);
      return { success: true, subscribed: await isSubscribed(db, viewer.id, viewer.sessionId, value) };
    });

    app.post('/me/push/subscriptions', async (request) => {
      const viewer = sessionViewer(request);
      if (!enabled) throw new HttpError(503, 'push notifications are not configured');
      const { subscription } = parse(subscribeBody, request.body);
      await saveSubscription(db, {
        userId: viewer.id,
        sessionId: viewer.sessionId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: request.headers['user-agent'],
      });
      return { success: true, subscribed: true };
    });

    app.delete('/me/push/subscriptions', async (request) => {
      const viewer = sessionViewer(request);
      const { endpoint: value } = parse(endpointBody, request.body);
      await deleteSubscription(db, viewer.id, value);
      return { success: true, subscribed: false };
    });
  };
