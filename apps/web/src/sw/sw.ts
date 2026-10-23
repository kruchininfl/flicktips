// The service worker (served as /serwist/sw.js by app/serwist/[path]/route.ts, scope /). Typechecked with its
// own tsconfig (WebWorker lib); the pure helpers live in src/lib/pwa.ts.
//
// Caching rules (apps/web/PORTING.md, "PWA"):
// - precache: the build's /_next/static files, /offline.html and a few images (manifest injected at build time);
// - page navigations: network first; a response is stored only if it is explicitly public, which no page of this
//   site is (they render per viewer, `private, no-store`), so no one ever gets another person's page; offline
//   and not stored -> /offline.html;
// - /api/*, /auth/* (OAuth redirects), /serwist/*: always the network, never a cache. Navigations there are
//   answered with the navigation-preload response so the browser makes exactly one request (OAuth state cookie);
//   non-navigation requests (fetch, the /api/events SSE stream) are not touched by the worker at all;
// - same-origin images (/poster/kp/*, /public/*): stale-while-revalidate; Google Fonts: as Serwist's defaults.
// - RSC requests of client-side navigations are left to the browser: offline, Next.js falls back to a full
//   navigation, which gets /offline.html.
import type { PushNotificationPayload, PushSubscriptionJson } from '@flicktips/shared';
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
  type SerwistPlugin,
} from 'serwist';

import { isNetworkOnlyPath, isSharedCacheable, notificationTarget, parsePushPayload } from '../lib/pwa';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_URL = '/offline.html';
const ICON_URL = '/public/android-chrome-192x192.png';

// Keeps per-viewer pages out of the cache (see isSharedCacheable).
const sharedOnly: SerwistPlugin = {
  cacheWillUpdate: async ({ response }) =>
    isSharedCacheable(response.status, response.headers.get('cache-control'), response.headers.has('set-cookie'))
      ? response
      : null,
};

const DAY = 24 * 3600;

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ request, sameOrigin, url }) =>
      request.mode === 'navigate' && sameOrigin && isNetworkOnlyPath(url.pathname),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ request, sameOrigin }) => request.mode === 'navigate' && sameOrigin,
    handler: new NetworkFirst({
      cacheName: 'pages',
      plugins: [sharedOnly, new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: DAY })],
    }),
  },
  {
    matcher: ({ request, sameOrigin, url }) =>
      sameOrigin && request.destination === 'image' && !isNetworkOnlyPath(url.pathname),
    handler: new StaleWhileRevalidate({
      cacheName: 'images',
      plugins: [
        // only real same-origin 200s (a poster redirected to TMDb comes back opaque and is not stored)
        new CacheableResponsePlugin({ statuses: [200] }),
        new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * DAY, maxAgeFrom: 'last-used' }),
      ],
    }),
  },
  {
    matcher: /^https:\/\/fonts\.gstatic\.com\/.*/i,
    handler: new CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 365 * DAY, maxAgeFrom: 'last-used' }),
      ],
    }),
  },
  {
    matcher: /^https:\/\/fonts\.googleapis\.com\/.*/i,
    handler: new StaleWhileRevalidate({
      cacheName: 'google-fonts-stylesheets',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 7 * DAY }),
      ],
    }),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching,
  fallbacks: {
    entries: [{ url: OFFLINE_URL, matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();

// Web Push (apps/api/docs/push.md): the API sends {title, body, url, tag}.
self.addEventListener('push', (event) => {
  const payload: PushNotificationPayload = parsePushPayload(event.data?.text());
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: ICON_URL,
      lang: 'ru',
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | null;
  const target = notificationTarget(typeof data?.url === 'string' ? data.url : '/', self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => client.url === target);
      if (open) {
        await open.focus();
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

// The push service rotated the subscription: register the new one with the same session (the request carries the
// session cookie; same-origin, so it passes the API's CSRF origin check). Best effort; the profile toggle can
// always subscribe again.
self.addEventListener('pushsubscriptionchange', (event) => {
  const change = event as Event & {
    oldSubscription?: PushSubscription | null;
    newSubscription?: PushSubscription | null;
    waitUntil(promise: Promise<unknown>): void;
  };
  change.waitUntil(
    (async () => {
      const key = change.oldSubscription?.options.applicationServerKey;
      const next =
        change.newSubscription ??
        (key
          ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
          : null);
      if (!next) return;
      const headers = { 'Content-Type': 'application/json' };
      await fetch('/api/me/push/subscriptions', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({ subscription: next.toJSON() as PushSubscriptionJson }),
      });
      if (change.oldSubscription && change.oldSubscription.endpoint !== next.endpoint) {
        await fetch('/api/me/push/subscriptions', {
          method: 'DELETE',
          credentials: 'same-origin',
          headers,
          body: JSON.stringify({ endpoint: change.oldSubscription.endpoint }),
        });
      }
    })().catch(() => {}),
  );
});
