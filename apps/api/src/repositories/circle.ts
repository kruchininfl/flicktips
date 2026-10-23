// The friends page of v2 (docs/routes-users.md): friends are people who follow each other, a request is
// someone who follows the user while the user has no row for them, «outgoing» are follows not returned yet.
import type { Db } from '@flicktips/db';
import { sql, type SQL } from 'drizzle-orm';

import { phpCast } from '../lib/group-rows.js';
import { pdoRows } from '../lib/pdo-rows.js';

// fewer common movies than this and the taste match is not shown
const MIN_COMMON_FOR_MATCH = 3;
// a page shows at most this many people per list
const CIRCLE_LIMIT = 500;

export interface CircleUser {
  id: number;
  username: string | null;
  avatar: string | null;
  gender: string | null;
  registration_date: string | null;
  votes_count: number;
  // the latest vote: movie id, title, vote value
  last_vote: { movie_id: number; title: string | null; vote: number } | null;
  // how close the votes on common movies are, 0–100; null with too few common movies
  match: number | null;
  // people both follow
  common_friends: number;
}

export interface Circle {
  friends: CircleUser[];
  requests: CircleUser[];
  outgoing: CircleUser[];
}

const userColumns = sql.raw(
  'user.id, user.username, user.avatar_source AS avatar, user.gender, user.registration_date, ' +
    '(SELECT COUNT(*) FROM movie_vote WHERE movie_vote.user_id = user.id) AS votes_count',
);

const idList = (ids: number[]) =>
  sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );

export async function getCircle(db: Db, uid: number): Promise<Circle> {
  const list = (query: SQL) => pdoRows(db, sql`${query} LIMIT ${CIRCLE_LIMIT}`);
  const [friendRows, requestRows, outgoingRows] = await Promise.all([
    list(sql`SELECT ${userColumns} FROM user_friends mine
      INNER JOIN user_friends back ON back.user_1 = mine.user_2 AND back.user_2 = ${uid} AND back.subscribed = 1
      INNER JOIN user ON user.id = mine.user_2
      WHERE mine.user_1 = ${uid} AND mine.subscribed = 1`),
    list(sql`SELECT ${userColumns} FROM user_friends theirs
      INNER JOIN user ON user.id = theirs.user_1
      LEFT JOIN user_friends mine ON mine.user_1 = ${uid} AND mine.user_2 = theirs.user_1
      WHERE theirs.user_2 = ${uid} AND theirs.subscribed = 1 AND mine.user_1 IS NULL AND theirs.user_1 <> ${uid}
      ORDER BY user.id DESC`),
    list(sql`SELECT ${userColumns} FROM user_friends mine
      INNER JOIN user ON user.id = mine.user_2
      LEFT JOIN user_friends back ON back.user_1 = mine.user_2 AND back.user_2 = ${uid}
      WHERE mine.user_1 = ${uid} AND mine.subscribed = 1 AND IFNULL(back.subscribed, 0) = 0
      ORDER BY user.id DESC`),
  ]);

  const ids = [...friendRows, ...requestRows, ...outgoingRows].map((row) => phpCast(row.id, 'int'));
  const lastVotes = new Map<number, CircleUser['last_vote']>();
  const matches = new Map<number, number>();
  const common = new Map<number, number>();
  if (ids.length) {
    const [voteRows, matchRows, commonRows] = await Promise.all([
      pdoRows(
        db,
        sql`SELECT movie_vote.user_id, movie_vote.movie_id, movie_vote.vote,
          COALESCE(movie.title, movie.kp_title, movie.original_title) AS title
        FROM movie_vote INNER JOIN movie ON movie.id = movie_vote.movie_id
        WHERE movie_vote.id IN (
          SELECT (SELECT latest.id FROM movie_vote latest WHERE latest.user_id = u.id
            ORDER BY latest.timestamp DESC, latest.id DESC LIMIT 1)
          FROM user u WHERE u.id IN (${idList(ids)})
        )`,
      ),
      pdoRows(
        db,
        sql`SELECT theirs.user_id, COUNT(*) AS common, AVG(ABS(theirs.vote - mine.vote)) AS diff
        FROM movie_vote mine
        INNER JOIN movie_vote theirs ON theirs.movie_id = mine.movie_id
        WHERE mine.user_id = ${uid} AND theirs.user_id IN (${idList(ids)})
        GROUP BY theirs.user_id`,
      ),
      pdoRows(
        db,
        sql`SELECT theirs.user_1 AS user_id, COUNT(*) AS num
        FROM user_friends theirs
        INNER JOIN user_friends mine ON mine.user_1 = ${uid} AND mine.user_2 = theirs.user_2 AND mine.subscribed = 1
        WHERE theirs.user_1 IN (${idList(ids)}) AND theirs.subscribed = 1
        GROUP BY theirs.user_1`,
      ),
    ]);
    for (const row of voteRows) {
      lastVotes.set(phpCast(row.user_id, 'int'), {
        movie_id: phpCast(row.movie_id, 'int'),
        title: row.title as string | null,
        vote: phpCast(row.vote, 'int'),
      });
    }
    for (const row of matchRows) {
      // votes go 0..3: the same vote is 100%, opposite ends 0%
      if (phpCast(row.common, 'int') >= MIN_COMMON_FOR_MATCH) {
        matches.set(phpCast(row.user_id, 'int'), Math.round(100 * (1 - Number(row.diff) / 3)));
      }
    }
    for (const row of commonRows) common.set(phpCast(row.user_id, 'int'), phpCast(row.num, 'int'));
  }

  const toUser = (row: Record<string, unknown>): CircleUser => {
    const id = phpCast(row.id, 'int');
    return {
      id,
      username: row.username as string | null,
      avatar: row.avatar as string | null,
      gender: row.gender as string | null,
      registration_date: row.registration_date as string | null,
      votes_count: phpCast(row.votes_count, 'int'),
      last_vote: lastVotes.get(id) ?? null,
      match: matches.get(id) ?? null,
      common_friends: common.get(id) ?? 0,
    };
  };

  // friends: closest taste first, then the most active
  const friends = friendRows
    .map(toUser)
    .sort((a, b) => (b.match ?? -1) - (a.match ?? -1) || b.votes_count - a.votes_count || a.id - b.id);
  return { friends, requests: requestRows.map(toUser), outgoing: outgoingRows.map(toUser) };
}

// «Отклонить»: a row with subscribed = 0, so the follower is no longer a request (and is not followed).
export async function declineRequest(db: Db, uid: number, userId: number): Promise<void> {
  await db.execute(sql`INSERT IGNORE INTO user_friends (user_1, user_2, subscribed) VALUES (${uid}, ${userId}, 0)`);
}
