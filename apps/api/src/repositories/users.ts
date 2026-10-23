// Users, follows, invites: port of the non-auth parts of api/src/Repositories/UserRepository.php.
import { randomBytes } from 'node:crypto';

import { schema, type Db } from '@flicktips/db';
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';

import { phpCast } from '../lib/group-rows.js';
import { pdoRows } from '../lib/pdo-rows.js';

const { user, userFriends } = schema;

// UserRepository::$safety_fields: what other people may see of a user.
export const publicUserFields = {
  id: user.id,
  username: user.username,
  avatar: user.avatarSource,
  gender: user.gender,
  registration_date: user.registrationDate,
};

const publicUserSql = sql.raw(
  'user.id, user.username, user.avatar_source AS avatar, user.gender, user.registration_date',
);

export interface PublicUser {
  id: number;
  username: string | null;
  avatar: string | null;
  gender: string | null;
  registration_date: string | null;
}

// The signed-in user as getByCredentials returned it (validateToken, updateUser).
export interface ViewerProfile extends PublicUser {
  new_notifications: number;
  hide_viewed: boolean;
  votes_count: number;
  friend_requests: number;
}

export interface ListedUser extends PublicUser {
  subscribed: boolean;
}

export type FriendsType = 'following' | 'followers';

export const LOGIN_SERVICES = ['vkontakte', 'yandex'] as const;
export type LoginService = (typeof LOGIN_SERVICES)[number];

export async function findPublicUser(db: Db, id: number): Promise<PublicUser | null> {
  const [row] = await db.select(publicUserFields).from(user).where(eq(user.id, id)).limit(1);
  return row ?? null;
}

/**
 * getByCredentials without the token check: the profile plus `new_notifications` (votes of the people the
 * user follows newer than last_seen_notifications), `hide_viewed`, and for the sidebar (new in v2) `votes_count`
 * and `friend_requests`.
 */
export async function getViewerProfile(db: Db, id: number): Promise<ViewerProfile | null> {
  const [row] = await db
    .select({
      ...publicUserFields,
      // drizzle renders ${user.id} as a bare `id`, which inside these subqueries means movie_vote.id: bind the id
      new_notifications: sql<string>`(
        SELECT COUNT(*) FROM movie_vote
        WHERE movie_vote.user_id IN (
          SELECT user_friends.user_2 FROM user_friends WHERE user_friends.user_1 = ${id} AND user_friends.subscribed = 1
        ) AND movie_vote.timestamp > ${user.lastSeenNotifications}
      )`,
      hide_viewed: user.hideViewed,
      votes_count: sql<string>`(SELECT COUNT(*) FROM movie_vote WHERE movie_vote.user_id = ${id})`,
      // followers without a row back (repositories/circle.ts)
      friend_requests: sql<string>`(
        SELECT COUNT(*) FROM user_friends theirs
        INNER JOIN user requester ON requester.id = theirs.user_1
        LEFT JOIN user_friends mine ON mine.user_1 = ${id} AND mine.user_2 = theirs.user_1
        WHERE theirs.user_2 = ${id} AND theirs.subscribed = 1 AND mine.user_1 IS NULL AND theirs.user_1 <> ${id}
      )`,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    new_notifications: phpCast(row.new_notifications, 'int'),
    hide_viewed: !!row.hide_viewed,
    votes_count: phpCast(row.votes_count, 'int'),
    friend_requests: phpCast(row.friend_requests, 'int'),
  };
}

export async function setHideViewed(db: Db, id: number, hideViewed: 0 | 1): Promise<void> {
  await db.update(user).set({ hideViewed }).where(eq(user.id, id));
}

export async function markNotificationsSeen(db: Db, id: number): Promise<void> {
  await db
    .update(user)
    .set({ lastSeenNotifications: sql`NOW()` })
    .where(eq(user.id, id));
}

// Follow state between the viewer and another user: subscribed = viewer follows, followsMe = user follows viewer.
export async function getRelation(db: Db, viewerId: number, userId: number) {
  const rows = await db
    .select({ user1: userFriends.user1, subscribed: userFriends.subscribed })
    .from(userFriends)
    .where(
      or(
        and(eq(userFriends.user1, viewerId), eq(userFriends.user2, userId)),
        and(eq(userFriends.user1, userId), eq(userFriends.user2, viewerId)),
      ),
    );
  const relation = { subscribed: false, followsMe: false };
  for (const row of rows) {
    relation[row.user1 === viewerId ? 'subscribed' : 'followsMe'] = !!row.subscribed;
  }
  return relation;
}

/**
 * People `uid` follows ('following') or people following `uid` ('followers'). `subscribed` is always "does
 * uid see this user's votes". Unfollowed users keep their row with subscribed = 0 and drop out of both lists.
 */
export async function listFriends(
  db: Db,
  uid: number,
  type: FriendsType,
  limit: number,
  offset: number,
): Promise<ListedUser[]> {
  if (type === 'followers') {
    const back = alias(userFriends, 'back');
    const rows = await db
      .select({ ...publicUserFields, subscribed: sql<number>`IFNULL(${back.subscribed}, 0)` })
      .from(userFriends)
      .innerJoin(user, eq(user.id, userFriends.user1))
      .leftJoin(back, and(eq(back.user1, uid), eq(back.user2, userFriends.user1)))
      .where(and(eq(userFriends.user2, uid), eq(userFriends.subscribed, 1)))
      .orderBy(asc(user.id))
      .limit(limit)
      .offset(offset);
    return rows.map((row) => ({ ...row, subscribed: phpCast(row.subscribed, 'bool') }));
  }
  const rows = await db
    .select({ ...publicUserFields, subscribed: userFriends.subscribed })
    .from(userFriends)
    .innerJoin(user, eq(user.id, userFriends.user2))
    .where(and(eq(userFriends.user1, uid), eq(userFriends.subscribed, 1)))
    .orderBy(asc(user.id))
    .limit(limit)
    .offset(offset);
  return rows.map((row) => ({ ...row, subscribed: !!row.subscribed }));
}

export async function countFriends(db: Db, uid: number, type: FriendsType): Promise<number> {
  const [row] =
    type === 'followers'
      ? await db
          .select({ num: sql<number>`COUNT(*)` })
          .from(userFriends)
          .innerJoin(user, eq(user.id, userFriends.user1))
          .where(and(eq(userFriends.user2, uid), eq(userFriends.subscribed, 1)))
      : await db
          .select({ num: sql<number>`COUNT(*)` })
          .from(userFriends)
          .innerJoin(user, eq(user.id, userFriends.user2))
          .where(and(eq(userFriends.user1, uid), eq(userFriends.subscribed, 1)));
  return phpCast(row?.num, 'int');
}

/**
 * toggleSubscribe: flips an existing follow row. Null when there is no row. The values are strings, as the
 * PHP endpoint returned them straight from PDO.
 */
export async function toggleSubscribed(
  db: Db,
  uid: number,
  friendId: number,
): Promise<{ friendId: string; subscribed: string } | null> {
  return db.transaction(async (tx) => {
    const where = and(eq(userFriends.user1, uid), eq(userFriends.user2, friendId));
    const [res] = await tx
      .update(userFriends)
      .set({ subscribed: sql`IF(${userFriends.subscribed} = 1, 0, 1)` })
      .where(where);
    if (!res.affectedRows) return null;
    const [row] = await tx
      .select({ subscribed: userFriends.subscribed, friendId: userFriends.user2 })
      .from(userFriends)
      .where(where)
      .limit(1);
    return row ? { friendId: String(row.friendId), subscribed: String(row.subscribed) } : null;
  });
}

export async function setSubscribed(db: Db, uid: number, userId: number, subscribed: boolean): Promise<void> {
  await db
    .insert(userFriends)
    .values({ user1: uid, user2: userId, subscribed: subscribed ? 1 : 0 })
    .onDuplicateKeyUpdate({ set: { subscribed: sql`VALUES(${userFriends.subscribed})` } });
}

/**
 * Users whose name contains `query`, prefix matches first. `viewerId` (0 for anonymous) is excluded and
 * gets a `subscribed` flag per user.
 */
export async function searchUsers(db: Db, query: string, viewerId: number, limit: number): Promise<ListedUser[]> {
  const like = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  const uf = alias(userFriends, 'uf');
  const rows = await db
    .select({ ...publicUserFields, subscribed: sql<number>`IFNULL(${uf.subscribed}, 0)` })
    .from(user)
    .leftJoin(uf, and(eq(uf.user1, viewerId), eq(uf.user2, user.id)))
    .where(and(sql`${user.username} LIKE ${`%${like}%`}`, sql`${user.id} <> ${viewerId}`))
    .orderBy(desc(sql`${user.username} LIKE ${`${like}%`}`), asc(user.username))
    .limit(limit);
  return rows.map((row) => ({ ...row, subscribed: phpCast(row.subscribed, 'bool') }));
}

export async function getInviteCode(db: Db, uid: number): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const [row] = await db.select({ code: user.inviteCode }).from(user).where(eq(user.id, uid)).limit(1);
    if (!row) return null;
    if (row.code) return row.code;
    // only set it while still empty, so two parallel requests end up with the same code
    await db
      .update(user)
      .set({ inviteCode: randomBytes(6).toString('hex') })
      .where(and(eq(user.id, uid), or(isNull(user.inviteCode), eq(user.inviteCode, ''))));
  }
  throw new Error(`could not set an invite code for user ${uid}`);
}

export async function findByInviteCode(db: Db, code: string): Promise<PublicUser | null> {
  if (!code) return null;
  const [row] = await db.select(publicUserFields).from(user).where(eq(user.inviteCode, code)).limit(1);
  return row ?? null;
}

// An accepted invite makes both users follow each other.
export async function makeFriends(db: Db, uid: number, friendId: number): Promise<void> {
  await db
    .insert(userFriends)
    .values([
      { user1: uid, user2: friendId, subscribed: 1 },
      { user1: friendId, user2: uid, subscribed: 1 },
    ])
    .onDuplicateKeyUpdate({ set: { subscribed: 1 } });
}

export interface RecommendedUser extends PublicUser {
  reason: 'friends' | 'votes' | 'random';
  reason_count: number;
  subscribed: false;
}

/**
 * Up to `limit` people for `uid` to follow: friends of friends first (most mutual follows), then people who
 * voted the same way on the same movies (at least 2), then random users (those with votes first).
 */
export async function getRecommendations(db: Db, uid: number, limit: number): Promise<RecommendedUser[]> {
  const following = await db
    .select({ id: userFriends.user2 })
    .from(userFriends)
    .where(and(eq(userFriends.user1, uid), eq(userFriends.subscribed, 1)));
  const exclude = new Set([...following.map((r) => r.id), uid]);
  const result: RecommendedUser[] = [];
  const notIn = () =>
    sql.join(
      [...exclude].map((id) => sql`${id}`),
      sql`, `,
    );

  const add = (rows: Record<string, unknown>[], reason: RecommendedUser['reason']) => {
    for (const row of rows) {
      const id = phpCast(row.id, 'int');
      if (result.length >= limit || exclude.has(id)) continue;
      exclude.add(id);
      result.push({
        id,
        username: row.username as string | null,
        avatar: row.avatar as string | null,
        gender: row.gender as string | null,
        registration_date: row.registration_date as string | null,
        reason,
        reason_count: row.reason_count === undefined ? 0 : phpCast(row.reason_count, 'int'),
        subscribed: false,
      });
    }
  };

  // people followed by the people I follow
  add(
    await pdoRows(
      db,
      sql`SELECT ${publicUserSql}, COUNT(DISTINCT mine.user_2) AS reason_count
      FROM user_friends mine
      INNER JOIN user_friends theirs ON theirs.user_1 = mine.user_2 AND theirs.subscribed = 1
      INNER JOIN user ON user.id = theirs.user_2
      WHERE mine.user_1 = ${uid} AND mine.subscribed = 1 AND user.id NOT IN (${notIn()})
      GROUP BY user.id ORDER BY reason_count DESC, user.id DESC LIMIT ${limit}`,
    ),
    'friends',
  );

  // same vote on the same movie, at least 2 such movies
  if (result.length < limit) {
    add(
      await pdoRows(
        db,
        sql`SELECT ${publicUserSql}, COUNT(*) AS reason_count
        FROM movie_vote mine
        INNER JOIN movie_vote theirs ON theirs.movie_id = mine.movie_id AND theirs.vote = mine.vote
        INNER JOIN user ON user.id = theirs.user_id
        WHERE mine.user_id = ${uid} AND user.id NOT IN (${notIn()})
        GROUP BY user.id HAVING reason_count >= 2 ORDER BY reason_count DESC LIMIT ${limit - result.length}`,
      ),
      'votes',
    );
  }

  if (result.length < limit) {
    add(
      await pdoRows(
        db,
        sql`SELECT ${publicUserSql} FROM user
        WHERE user.id NOT IN (${notIn()})
        ORDER BY EXISTS (SELECT 1 FROM movie_vote WHERE movie_vote.user_id = user.id) DESC, RAND()
        LIMIT ${limit - result.length}`,
      ),
      'random',
    );
  }

  return result;
}

// {vkontakte: bool, yandex: bool}: which sign-in methods the user has linked.
export async function getLoginServices(db: Db, uid: number): Promise<Record<LoginService, boolean>> {
  const [row] = await db
    .select({ vkontakte: user.vkontakteId, yandex: user.yandexId })
    .from(user)
    .where(eq(user.id, uid))
    .limit(1);
  return { vkontakte: !!row && row.vkontakte !== null, yandex: !!row && row.yandex !== null };
}

export interface ProfileStats {
  // votes per kind; the keys are VOTE_VALUES names
  votes: { super: number; like: number; neutral: number; dislike: number };
  // mutual follows
  friends: number;
}

// The numbers in a profile header (new in v2): votes per kind and how many friends.
export async function getProfileStats(db: Db, uid: number): Promise<ProfileStats> {
  const back = alias(userFriends, 'back');
  const [voteRows, [friends]] = await Promise.all([
    pdoRows(
      db,
      sql`SELECT movie_vote.vote AS vote, COUNT(*) AS num FROM movie_vote WHERE movie_vote.user_id = ${uid} GROUP BY movie_vote.vote`,
    ),
    db
      .select({ num: sql<number>`COUNT(*)` })
      .from(userFriends)
      .innerJoin(back, and(eq(back.user1, userFriends.user2), eq(back.user2, uid), eq(back.subscribed, 1)))
      .innerJoin(user, eq(user.id, userFriends.user2))
      .where(and(eq(userFriends.user1, uid), eq(userFriends.subscribed, 1))),
  ]);
  const votes = { super: 0, like: 0, neutral: 0, dislike: 0 };
  const names = ['dislike', 'neutral', 'like', 'super'] as const;
  for (const row of voteRows) {
    const name = names[Number(row.vote)];
    if (name) votes[name] = Number(row.num);
  }
  return { votes, friends: phpCast(friends?.num, 'int') };
}
