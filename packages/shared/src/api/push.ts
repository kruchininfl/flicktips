// Web Push (apps/api/docs/push.md): the API routes and the payload the service worker shows.

// GET /api/push/key: the VAPID public key (base64url) for PushManager.subscribe(); null when the server has
// no keys configured, and then the site offers no notifications.
export interface PushKeyResponse {
  success: true;
  publicKey: string | null;
}

// PushSubscription.toJSON() as the browser gives it.
export interface PushSubscriptionJson {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

// GET /api/me/push?endpoint=, POST /api/me/push/subscriptions, DELETE /api/me/push/subscriptions: whether this
// browser's subscription delivers the viewer's notifications.
export interface PushStatusResponse {
  success: true;
  subscribed: boolean;
}

// The JSON body of a push message; the service worker turns it into a notification.
export interface PushNotificationPayload {
  title: string;
  body: string;
  // same-origin path opened on click
  url: string;
  // notifications with the same tag replace each other on the device
  tag?: string;
}
