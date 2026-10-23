// Delivery of one Web Push message to one browser subscription (docs/push.md). The notifier only sees the
// PushSender interface; tests pass a fake, main.ts a WebPushSender built from the VAPID keys.
import webpush from 'web-push';

import type { PushNotificationPayload } from '@flicktips/shared';

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushMessage {
  payload: PushNotificationPayload;
  // seconds the push service keeps an undelivered message
  ttl: number;
  // undelivered messages with the same topic replace each other at the push service (≤ 32 base64url chars)
  topic?: string;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

// The push service says the subscription no longer exists (404/410): the row must be deleted.
export class PushSubscriptionGoneError extends Error {
  constructor(readonly statusCode: number) {
    super(`push subscription gone (${statusCode})`);
  }
}

export interface PushSender {
  // Rejects with PushSubscriptionGoneError when the subscription is gone, with another error otherwise.
  send(target: PushTarget, message: PushMessage): Promise<void>;
}

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  // mailto: or https: contact of the sender, required by the push services
  subject: string;
}

export class WebPushSender implements PushSender {
  constructor(
    private readonly vapid: VapidKeys,
    private readonly timeoutMs = 10_000,
  ) {}

  async send(target: PushTarget, message: PushMessage): Promise<void> {
    try {
      await webpush.sendNotification(target, JSON.stringify(message.payload), {
        vapidDetails: this.vapid,
        TTL: message.ttl,
        topic: message.topic,
        urgency: message.urgency,
        contentEncoding: 'aes128gcm',
        timeout: this.timeoutMs,
      });
    } catch (error) {
      if (error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        throw new PushSubscriptionGoneError(error.statusCode);
      }
      throw error;
    }
  }
}
