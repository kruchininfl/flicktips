// push_subscription (migration 002): browser push subscriptions, each bound to the session that created it.
import { createHash } from 'node:crypto';

import { schema, type Db } from '@flicktips/db';
import { and, desc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';

const { pushSubscription, session, userFriends, user, movie } = schema;

// A user keeps at most this many subscriptions (browsers × devices); older ones are dropped on subscribe.
export const MAX_SUBSCRIPTIONS_PER_USER = 20;

export const endpointId = (endpoint: string) => createHash('sha256').update(endpoint).digest('hex');

const now = sql`NOW()` as unknown as Date;

export interface NewSubscription {
  userId: number;
  sessionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | undefined;
}

// Insert, or move an existing endpoint (same browser, maybe another user now) to this user and session.
export async function saveSubscription(db: Db, sub: NewSubscription): Promise<void> {
  const id = endpointId(sub.endpoint);
  const values = {
    userId: sub.userId,
    sessionId: sub.sessionId,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
    userAgent: sub.userAgent ? sub.userAgent.slice(0, 255) : null,
    updatedAt: now,
  };
  await db
    .insert(pushSubscription)
    .values({ id, createdAt: now, ...values })
    .onDuplicateKeyUpdate({ set: values });

  // rows of this user whose session has ended, and the oldest beyond MAX_SUBSCRIPTIONS_PER_USER (never this one)
  await db
    .delete(pushSubscription)
    .where(
      and(
        eq(pushSubscription.userId, sub.userId),
        sql`NOT EXISTS (SELECT 1 FROM ${session} WHERE ${session.id} = ${pushSubscription.sessionId} AND ${session.expiresAt} > NOW())`,
      ),
    );
  const keep = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(and(eq(pushSubscription.userId, sub.userId), ne(pushSubscription.id, id)))
    .orderBy(desc(pushSubscription.updatedAt), desc(pushSubscription.id))
    .limit(MAX_SUBSCRIPTIONS_PER_USER - 1);
  await db
    .delete(pushSubscription)
    .where(
      and(eq(pushSubscription.userId, sub.userId), notInArray(pushSubscription.id, [id, ...keep.map((row) => row.id)])),
    );
}

export async function deleteSubscription(db: Db, userId: number, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscription)
    .where(and(eq(pushSubscription.id, endpointId(endpoint)), eq(pushSubscription.userId, userId)));
}

export async function deleteSubscriptionsById(db: Db, ids: string[]): Promise<void> {
  if (ids.length) await db.delete(pushSubscription).where(inArray(pushSubscription.id, ids));
}

// Whether this endpoint delivers this user's notifications from this session.
export async function isSubscribed(db: Db, userId: number, sessionId: string, endpoint: string): Promise<boolean> {
  const [row] = await db
    .select({ id: pushSubscription.id })
    .from(pushSubscription)
    .where(
      and(
        eq(pushSubscription.id, endpointId(endpoint)),
        eq(pushSubscription.userId, userId),
        eq(pushSubscription.sessionId, sessionId),
      ),
    )
    .limit(1);
  return !!row;
}

export interface StoredTarget {
  id: string;
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Subscriptions of everyone who follows `userId` (user_friends.user_2 = userId, subscribed = 1), signed in by a
// session that is still alive. The same people whose bell counts this user's votes (new_notifications).
export async function followerTargets(db: Db, userId: number): Promise<StoredTarget[]> {
  return db
    .select({
      id: pushSubscription.id,
      userId: pushSubscription.userId,
      endpoint: pushSubscription.endpoint,
      p256dh: pushSubscription.p256dh,
      auth: pushSubscription.auth,
    })
    .from(pushSubscription)
    .innerJoin(
      userFriends,
      and(eq(userFriends.user1, pushSubscription.userId), eq(userFriends.user2, userId), eq(userFriends.subscribed, 1)),
    )
    .innerJoin(session, and(eq(session.id, pushSubscription.sessionId), sql`${session.expiresAt} > NOW()`))
    .orderBy(pushSubscription.id);
}

// The names a friend-vote notification shows.
export async function voteNames(
  db: Db,
  userId: number,
  movieId: number,
): Promise<{ username: string | null; title: string | null } | null> {
  const [voter] = await db.select({ username: user.username }).from(user).where(eq(user.id, userId)).limit(1);
  const [film] = await db
    .select({ title: movie.title, kpTitle: movie.kpTitle })
    .from(movie)
    .where(eq(movie.id, movieId))
    .limit(1);
  if (!voter || !film) return null;
  return { username: voter.username, title: film.title || film.kpTitle };
}
