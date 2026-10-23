// Browser side of Web Push: the service worker registered by PwaProvider (/serwist/sw.js) holds the subscription;
// the API stores it for the signed-in session (apps/api/docs/push.md). Client Components only.
import type { PushSubscriptionJson } from '@flicktips/shared';

import { api } from '@/api/browser';

import { base64UrlToBytes } from '@/lib/pwa';

// Push needs a service worker, the Push API and notifications. iOS/iPadOS Safari has them only in a web app added to
// the home screen (16.4+), so in a Safari tab this is false and the site offers nothing.
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration('/')) ?? null;
}

export async function getBrowserSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? reg.pushManager.getSubscription() : null;
}

// Asks for permission when needed, subscribes the browser and registers it with the API. Resolves false when the
// user did not allow notifications.
export async function subscribePush(publicKey: string): Promise<boolean> {
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = (await registration()) ?? (await navigator.serviceWorker.ready);
  const key = base64UrlToBytes(publicKey);
  let subscription = await reg.pushManager.getSubscription();
  // a subscription made with another VAPID key (keys were rotated) cannot be reused
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api.me.push.subscribe(subscription.toJSON() as PushSubscriptionJson);
  return true;
}

export async function unsubscribePush(): Promise<void> {
  const subscription = await getBrowserSubscription();
  if (!subscription) return;
  try {
    await api.me.push.unsubscribe(subscription.endpoint);
  } finally {
    await subscription.unsubscribe();
  }
}

// On sign-out: the API already stops sending to this browser (the session is gone); drop the browser side too.
export async function forgetBrowserPush(): Promise<void> {
  try {
    await (await getBrowserSubscription())?.unsubscribe();
  } catch {
    // best effort
  }
}

function sameKey(current: ArrayBuffer | null, wanted: Uint8Array): boolean {
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === wanted.length && bytes.every((b, i) => b === wanted[i]);
}
