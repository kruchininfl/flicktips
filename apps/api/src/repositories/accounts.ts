// Sign-in accounts of a user: creating/finding a user by provider id (PHP Security\OAuthUserProvider), linking,
// unlinking and merging accounts (the sign-in parts of api/src/Repositories/UserRepository.php).
import { schema, type Db } from '@flicktips/db';
import { and, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';

import type { LoginService, OAuthIdentity } from '../auth/oauth.js';
import { revokeUserSessions } from '../auth/sessions.js';
import { phpCast } from '../lib/group-rows.js';
import { LOGIN_SERVICES, publicUserFields, type PublicUser } from './users.js';

const { user } = schema;

type Executor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

// user.<service>_id columns and their Drizzle field names
const serviceColumn = { vkontakte: user.vkontakteId, yandex: user.yandexId } as const;
const serviceField = { vkontakte: 'vkontakteId', yandex: 'yandexId' } as const;

/**
 * The user signing in with this provider account, created on first sign-in (OAuthUserProvider::createUser:
 * `INSERT … ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)` on the unique <service>_id column). As in PHP,
 * an existing user's name, avatar and gender are left alone. Returns the user id.
 */
export async function findOrCreateUser(db: Executor, service: LoginService, identity: OAuthIdentity): Promise<number> {
  const [res] = await db
    .insert(user)
    .values({
      username: identity.username,
      avatar: '',
      avatarSource: identity.avatar,
      gender: identity.gender,
      registrationDate: sql`NOW()` as unknown as string,
      [serviceField[service]]: identity.id,
    })
    .onDuplicateKeyUpdate({ set: { id: sql`LAST_INSERT_ID(${user.id})` } });
  return res.insertId;
}

export async function findIdByService(db: Executor, service: LoginService, serviceId: string): Promise<number | null> {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(serviceColumn[service], serviceId)).limit(1);
  return row?.id ?? null;
}

// Links a provider account nobody uses yet. False if `uid` already has another account of that service.
export async function linkService(
  db: Executor,
  uid: number,
  service: LoginService,
  serviceId: string,
): Promise<boolean> {
  const [res] = await db
    .update(user)
    .set({ [serviceField[service]]: serviceId })
    .where(and(eq(user.id, uid), isNull(serviceColumn[service])));
  return res.affectedRows > 0;
}

// False if it is the user's last sign-in method.
export async function unlinkService(db: Executor, uid: number, service: LoginService): Promise<boolean> {
  const others = LOGIN_SERVICES.filter((s) => s !== service).map((s) => isNotNull(serviceColumn[s]));
  const [res] = await db
    .update(user)
    .set({ [serviceField[service]]: null })
    .where(and(eq(user.id, uid), or(...others)));
  return res.affectedRows > 0;
}

export interface MergeSummary {
  user: PublicUser | null;
  votes: number;
  bookmarks: number;
  following: number;
  // movies both have rated differently
  conflicts: number;
  // services both have linked to different provider accounts: the merge is refused then
  blocking: LoginService[];
}

const count = async (db: Executor, query: ReturnType<typeof sql>) => {
  const [rows] = (await db.execute(query)) as unknown as [{ n: unknown }[]];
  return phpCast(rows[0]?.n, 'int');
};

// What merging `otherId` into `uid` would bring (UserRepository::getMergeSummary).
export async function getMergeSummary(db: Executor, uid: number, otherId: number): Promise<MergeSummary> {
  const [other] = await db.select(publicUserFields).from(user).where(eq(user.id, otherId)).limit(1);
  return {
    user: other ?? null,
    votes: await count(db, sql`SELECT COUNT(*) AS n FROM movie_vote WHERE user_id = ${otherId}`),
    bookmarks: await count(db, sql`SELECT COUNT(*) AS n FROM bookmark WHERE user_id = ${otherId}`),
    following: await count(
      db,
      sql`SELECT COUNT(*) AS n FROM user_friends WHERE user_1 = ${otherId} AND user_2 <> ${uid} AND subscribed = 1`,
    ),
    conflicts: await count(
      db,
      sql`SELECT COUNT(*) AS n FROM movie_vote a
        INNER JOIN movie_vote b ON b.movie_id = a.movie_id AND b.user_id = ${otherId}
        WHERE a.user_id = ${uid} AND a.vote <> b.vote`,
    ),
    blocking: await getBlockingServices(db, uid, otherId),
  };
}

// Services linked in both accounts to different provider accounts.
async function getBlockingServices(db: Executor, uid: number, otherId: number): Promise<LoginService[]> {
  const rows = await db
    .select({ id: user.id, vkontakte: user.vkontakteId, yandex: user.yandexId })
    .from(user)
    .where(inArray(user.id, [uid, otherId]));
  if (rows.length !== 2) return [];
  const [a, b] = rows as [(typeof rows)[number], (typeof rows)[number]];
  return LOGIN_SERVICES.filter((s) => a[s] !== null && b[s] !== null && a[s] !== b[s]);
}

/**
 * Moves everything of `otherId` into `uid` and deletes `otherId` (UserRepository::mergeInto). `uid` keeps its
 * name, avatar, settings and id (profile URL); it takes over the other user's sign-in methods, Telegram link,
 * and its invite code / avatar if `uid` has none. A movie rated in both accounts keeps the newer vote (the
 * current account's on a tie); movie counters lose the dropped vote. Bookmarks and follows are united, follows
 * between the two accounts are dropped. Telegram group memberships, posts and queued vote events move over.
 * Every session of the merged-away user is revoked. False when the accounts cannot be merged.
 */
export async function mergeInto(db: Db, uid: number, otherId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const locked = await tx
      .select()
      .from(user)
      .where(inArray(user.id, [uid, otherId]))
      .for('update');
    const mine = locked.find((row) => row.id === uid);
    const theirs = locked.find((row) => row.id === otherId);
    if (!mine || !theirs || (await getBlockingServices(tx, uid, otherId)).length) {
      return false;
    }

    // votes for the same movie: drop the older one
    const [both] = (await tx.execute(sql`SELECT a.movie_id, a.vote AS my_vote, b.vote AS other_vote,
        b.timestamp > a.timestamp AS other_is_newer
        FROM movie_vote a
        INNER JOIN movie_vote b ON b.movie_id = a.movie_id AND b.user_id = ${otherId}
        WHERE a.user_id = ${uid}`)) as unknown as [
      { movie_id: number; my_vote: unknown; other_vote: unknown; other_is_newer: unknown }[],
    ];
    const columns = ['dislikes', 'neutral', 'likes', 'super'] as const;
    for (const row of both) {
      const otherIsNewer = phpCast(row.other_is_newer, 'bool');
      await tx.execute(
        sql`DELETE FROM movie_vote WHERE movie_id = ${row.movie_id} AND user_id = ${otherIsNewer ? uid : otherId}`,
      );
      const column = columns[phpCast(otherIsNewer ? row.my_vote : row.other_vote, 'int')];
      if (column) {
        await tx.execute(
          sql`UPDATE movie SET ${sql.identifier(column)} = GREATEST(${sql.identifier(column)} - 1, 0) WHERE id = ${row.movie_id}`,
        );
      }
    }
    // `timestamp = timestamp` keeps the vote/bookmark time in case the column auto-updates
    await tx.execute(sql`UPDATE movie_vote SET user_id = ${uid}, timestamp = timestamp WHERE user_id = ${otherId}`);

    await tx.execute(sql`DELETE b FROM bookmark b
        INNER JOIN bookmark a ON a.movie_id = b.movie_id AND a.user_id = ${uid}
        WHERE b.user_id = ${otherId}`);
    await tx.execute(sql`UPDATE bookmark SET user_id = ${uid}, timestamp = timestamp WHERE user_id = ${otherId}`);

    // follows both ways; a follow wins over an unfollow
    await tx.execute(sql`INSERT INTO user_friends (user_1, user_2, subscribed)
        SELECT ${uid}, src.user_2, src.subscribed FROM user_friends src
        WHERE src.user_1 = ${otherId} AND src.user_2 NOT IN (${uid}, ${otherId})
        ON DUPLICATE KEY UPDATE subscribed = GREATEST(user_friends.subscribed, VALUES(subscribed))`);
    await tx.execute(sql`INSERT INTO user_friends (user_1, user_2, subscribed)
        SELECT src.user_1, ${uid}, src.subscribed FROM user_friends src
        WHERE src.user_2 = ${otherId} AND src.user_1 NOT IN (${uid}, ${otherId})
        ON DUPLICATE KEY UPDATE subscribed = GREATEST(user_friends.subscribed, VALUES(subscribed))`);
    await tx.execute(sql`DELETE FROM user_friends WHERE user_1 = ${otherId} OR user_2 = ${otherId}`);

    // Telegram bot (tg-bot): group memberships and posts; vote_event rows still waiting for the bot
    await tx.execute(sql`INSERT IGNORE INTO tg_chat_member (chat_id, user_id, joined_at, checked_at)
        SELECT chat_id, ${uid}, joined_at, checked_at FROM tg_chat_member WHERE user_id = ${otherId}`);
    await tx.execute(sql`DELETE FROM tg_chat_member WHERE user_id = ${otherId}`);
    await tx.execute(sql`UPDATE IGNORE tg_post SET user_id = ${uid} WHERE user_id = ${otherId}`);
    await tx.execute(sql`DELETE FROM tg_post WHERE user_id = ${otherId}`);
    await tx.execute(sql`UPDATE vote_event SET user_id = ${uid} WHERE user_id = ${otherId}`);

    // the merged-away user cannot sign in any more (v2: sessions instead of user.token)
    await revokeUserSessions(tx, otherId);

    // unique columns move over: clear them on the other user first (it is deleted)
    const take: Partial<typeof user.$inferInsert> = {};
    if (mine.vkontakteId === null && theirs.vkontakteId !== null) take.vkontakteId = theirs.vkontakteId;
    if (mine.yandexId === null && theirs.yandexId !== null) take.yandexId = theirs.yandexId;
    if (mine.tgUserId === null && theirs.tgUserId !== null) {
      take.tgUserId = theirs.tgUserId;
      take.tgUsername = theirs.tgUsername;
    }
    if (!mine.inviteCode && theirs.inviteCode) take.inviteCode = theirs.inviteCode;
    if (!mine.avatarSource && theirs.avatarSource) take.avatarSource = theirs.avatarSource;

    await tx.delete(user).where(eq(user.id, otherId));

    const registered = theirs.registrationDate;
    await tx
      .update(user)
      .set({
        ...take,
        registrationDate: sql`LEAST(COALESCE(registration_date, ${registered}), COALESCE(${registered}, registration_date))`,
      })
      .where(eq(user.id, uid));

    return true;
  });
}
