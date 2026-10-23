// What the site notifies about, and to whom (docs/push.md). Routes call `notify()` after their own work is done;
// it never throws and never delays the response.
//
// Legacy parity: the only notifications the old site had were the header bell's `new_notifications`, i.e. votes
// of the people you follow made since you last opened the friends' feed. A push goes out on the same event.
import type { Db } from '@flicktips/db';
import type { PushNotificationPayload } from '@flicktips/shared';
import type { FastifyBaseLogger } from 'fastify';

import { deleteSubscriptionsById, followerTargets, voteNames } from '../repositories/push.js';
import type { VoteValue } from '../repositories/votes.js';
import { PushSubscriptionGoneError, type PushMessage, type PushSender } from './sender.js';

// A user set or changed a vote (removals notify nobody).
export interface FriendVotePushEvent {
  type: 'friend-vote';
  userId: number;
  movieId: number;
  vote: VoteValue;
}

export type PushEvent = FriendVotePushEvent;

export interface PushNotifier {
  // Resolves when every message has been handed to the push services (tests wait for it); never rejects.
  notify(event: PushEvent): Promise<void>;
}

export const noopPushNotifier: PushNotifier = { notify: async () => {} };

// Texts of the four votes (0–3), as the site shows them (apps/web/src/lib/movies.ts VOTE_TEXTS).
const VOTE_TEXTS = ['Очень плохо', 'Средне', 'Хорошо', 'Супер'] as const;

// how long the push service keeps a message for an offline device
const FRIEND_VOTE_TTL_SECONDS = 12 * 3600;
// messages handed to the push services at the same time
const CONCURRENCY = 8;

export function friendVotePayload(
  username: string | null,
  title: string | null,
  event: FriendVotePushEvent,
): PushNotificationPayload {
  return {
    title: username || 'FlickTips',
    body: `«${title || 'Фильм'}» — ${VOTE_TEXTS[event.vote] ?? 'оценка'}`,
    url: `/movie/${event.movieId}`,
    // one notification per friend on the device: a newer vote of the same friend replaces the shown one
    tag: `friend-vote-${event.userId}`,
  };
}

export function createPushNotifier(db: Db, sender: PushSender, log: FastifyBaseLogger): PushNotifier {
  async function deliver(targets: Awaited<ReturnType<typeof followerTargets>>, message: PushMessage) {
    const gone: string[] = [];
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((t) => sender.send({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, message)),
      );
      results.forEach((result, j) => {
        if (result.status === 'fulfilled') return;
        if (result.reason instanceof PushSubscriptionGoneError) gone.push(batch[j]!.id);
        else log.warn({ err: result.reason }, 'push delivery failed');
      });
    }
    await deleteSubscriptionsById(db, gone);
  }

  return {
    async notify(event) {
      try {
        const targets = (await followerTargets(db, event.userId)).filter((t) => t.userId !== event.userId);
        if (!targets.length) return;
        const names = await voteNames(db, event.userId, event.movieId);
        if (!names) return;
        await deliver(targets, {
          payload: friendVotePayload(names.username, names.title, event),
          ttl: FRIEND_VOTE_TTL_SECONDS,
          // undelivered pushes about the same friend collapse at the push service too
          topic: `fv${event.userId}`,
          urgency: 'low',
        });
      } catch (error) {
        log.error({ err: error }, 'push notify failed');
      }
    },
  };
}
