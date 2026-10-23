import webpush from 'web-push';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PushSubscriptionGoneError, WebPushSender } from './sender.js';

const vapid = { publicKey: 'pub', privateKey: 'priv', subject: 'mailto:support@flicktips.ru' };
const target = { endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys: { p256dh: 'p', auth: 'a' } };
const message = { payload: { title: 't', body: 'b', url: '/' }, ttl: 60, topic: 'fv1', urgency: 'low' as const };

describe('WebPushSender', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the JSON payload with the VAPID keys and options', async () => {
    const send = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} });
    await new WebPushSender(vapid).send(target, message);
    expect(send).toHaveBeenCalledWith(target, JSON.stringify(message.payload), {
      vapidDetails: vapid,
      TTL: 60,
      topic: 'fv1',
      urgency: 'low',
      contentEncoding: 'aes128gcm',
      timeout: 10_000,
    });
  });

  it.each([404, 410])('turns %i into PushSubscriptionGoneError', async (status) => {
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(
      new webpush.WebPushError('gone', status, {}, '', target.endpoint),
    );
    await expect(new WebPushSender(vapid).send(target, message)).rejects.toBeInstanceOf(PushSubscriptionGoneError);
  });

  it('passes other failures through', async () => {
    const error = new webpush.WebPushError('rate limited', 429, {}, '', target.endpoint);
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(error);
    await expect(new WebPushSender(vapid).send(target, message)).rejects.toBe(error);
  });
});
