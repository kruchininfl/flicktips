// Plain helpers of the service worker (src/sw/sw.ts) and the push toggle, kept free of DOM/worker types so the
// unit tests can run them.
import type { PushNotificationPayload } from '@flicktips/shared';

// Same-origin paths the service worker never answers from a cache: the API (JSON, the /api/events SSE stream),
// the OAuth redirects and the worker's own files.
const NETWORK_ONLY_PREFIXES = ['/api/', '/auth/', '/serwist/'];

export function isNetworkOnlyPath(pathname: string): boolean {
  return pathname === '/api' || pathname === '/auth' || NETWORK_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
}

// Whether a page response may be kept for offline use. Every page of the site renders per viewer and is sent with
// `Cache-Control: private, no-store` (dynamic rendering), so in practice nothing is stored and a cached page can
// never show one person's data to another; a page that becomes explicitly public and cacheable would be.
export function isSharedCacheable(status: number, cacheControl: string | null, setCookie = false): boolean {
  if (status !== 200 || setCookie || !cacheControl) return false;
  const directives = cacheControl.toLowerCase();
  if (/(^|[\s,])(private|no-store|no-cache)\b/.test(directives)) return false;
  return /(^|[\s,])public\b/.test(directives) || /(^|[\s,])s-maxage=\d*[1-9]/.test(directives);
}

const DEFAULT_PAYLOAD: PushNotificationPayload = { title: 'FlickTips', body: 'Новые оценки друзей', url: '/' };

// The JSON body of a push message (apps/api/docs/push.md); anything unexpected still shows a notification,
// since a push without one breaks the userVisibleOnly promise.
export function parsePushPayload(text: string | null | undefined): PushNotificationPayload {
  if (!text) return DEFAULT_PAYLOAD;
  try {
    const data = JSON.parse(text) as Partial<PushNotificationPayload> | null;
    if (!data || typeof data !== 'object' || typeof data.title !== 'string' || !data.title) return DEFAULT_PAYLOAD;
    return {
      title: data.title,
      body: typeof data.body === 'string' ? data.body : '',
      url: typeof data.url === 'string' ? data.url : '/',
      ...(typeof data.tag === 'string' && data.tag ? { tag: data.tag } : {}),
    };
  } catch {
    return DEFAULT_PAYLOAD;
  }
}

// Where a click on a notification goes: a path of this site, never another origin.
export function notificationTarget(url: string, origin: string): string {
  try {
    const target = new URL(url, origin);
    if (target.origin === origin) return target.href;
  } catch {
    // fall through
  }
  return new URL('/', origin).href;
}

// The VAPID key (base64url) as PushManager.subscribe() wants it.
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
