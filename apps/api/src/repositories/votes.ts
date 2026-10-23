// Movie votes of the signed-in user: UserController::toggleVote, TelegramRepository::queueVote and
// UserRepository::getFriendsVotes.
import { schema, type Db } from '@flicktips/db';
import { and, eq, sql, type SQL } from 'drizzle-orm';

import { groupRows, phpCast, type Row } from '../lib/group-rows.js';
import { pdoRows } from '../lib/pdo-rows.js';

const { movie, movieVote, tgChat, tgChatMember, voteEvent } = schema;

// movie_vote.vote values
export const VOTE_VALUES = { super: 3, like: 2, neutral: 1, dislike: 0 } as const;
export type VoteName = keyof typeof VOTE_VALUES;
export type VoteValue = (typeof VOTE_VALUES)[VoteName];

// movie counter column per vote value
const COUNTERS = ['dislikes', 'neutral', 'likes', 'super'] as const;

export interface ToggleVoteResult {
  id: number;
  super: number;
  likes: number;
  neutral: number;
  dislikes: number;
  isSuper: boolean;
  isLiked: boolean;
  isNeutral: boolean;
  isDisliked: boolean;
}

/**
 * Sets the vote, or removes it when the same vote is sent again, and moves the movie counters. The vote
 * row and both counters change in one transaction, with the current vote row locked, so parallel toggles
 * cannot double count. Null when the movie does not exist.
 */
export async function toggleVote(
  db: Db,
  uid: number,
  movieId: number,
  value: VoteValue,
): Promise<{ result: ToggleVoteResult; vote: VoteValue | null } | null> {
  const outcome = await db.transaction(async (tx) => {
    // lock the movie row first: it serializes toggles of the same movie and tells whether it exists
    const [target] = await tx.select({ id: movie.id }).from(movie).where(eq(movie.id, movieId)).for('update');
    if (!target) return null;

    const [current] = await tx
      .select({ vote: movieVote.vote })
      .from(movieVote)
      .where(and(eq(movieVote.movieId, movieId), eq(movieVote.userId, uid)))
      .for('update');
    const previous = current ? current.vote : null;
    const removed = previous === value;

    if (removed) {
      await tx.delete(movieVote).where(and(eq(movieVote.movieId, movieId), eq(movieVote.userId, uid)));
    } else {
      await tx
        .insert(movieVote)
        .values({ movieId, userId: uid, vote: value })
        .onDuplicateKeyUpdate({ set: { vote: value } });
    }

    // the old vote's counter goes down, the new one's up (the same column when only removing)
    const set: Partial<Record<(typeof COUNTERS)[number], SQL>> = {};
    const prevCounter = previous === null ? undefined : COUNTERS[previous];
    if (prevCounter) set[prevCounter] = sql`${movie[prevCounter]} - 1`;
    if (!removed) set[COUNTERS[value]] = sql`${movie[COUNTERS[value]]} + 1`;
    await tx.update(movie).set(set).where(eq(movie.id, movieId));

    return { removed };
  });
  if (!outcome) return null;

  const [counts] = await db
    .select({ id: movie.id, super: movie.super, likes: movie.likes, neutral: movie.neutral, dislikes: movie.dislikes })
    .from(movie)
    .where(eq(movie.id, movieId));
  const isSet = !outcome.removed;
  return {
    vote: isSet ? value : null,
    result: {
      id: counts!.id,
      super: counts!.super,
      likes: counts!.likes,
      neutral: counts!.neutral,
      dislikes: counts!.dislikes,
      isSuper: isSet && value === 3,
      isLiked: isSet && value === 2,
      isNeutral: isSet && value === 1,
      isDisliked: isSet && value === 0,
    },
  };
}

/**
 * TelegramRepository::queueVote: queues the rating change for tg-bot, but only for users who take part in
 * at least one active Telegram group. `vote` is the new value, null when the vote was removed.
 */
export async function queueVoteEvent(db: Db, uid: number, movieId: number, vote: number | null): Promise<void> {
  const [member] = await db
    .select({ one: sql`1` })
    .from(tgChatMember)
    .innerJoin(tgChat, and(eq(tgChat.chatId, tgChatMember.chatId), eq(tgChat.active, 1)))
    .where(eq(tgChatMember.userId, uid))
    .limit(1);
  if (!member) return;
  await db.insert(voteEvent).values({ userId: uid, movieId, vote });
}

export async function countFriendsVotes(db: Db, uid: number): Promise<number> {
  const [row] = await pdoRows(
    db,
    sql`SELECT COUNT(mv.id) AS num FROM user_friends us
    INNER JOIN movie_vote mv ON mv.user_id = us.user_2
    WHERE us.user_1 = ${uid} AND us.subscribed = 1`,
  );
  return phpCast(row?.num, 'int');
}

const friendsVotesFields = {
  vote: { type: 'int' },
  timestamp: { type: 'int' },
  movie_id: { type: 'int' },
  movie_kp_id: { type: 'int' },
  movie_tmdb_popularity: { type: 'float' },
  movie_super: { type: 'int' },
  movie_likes: { type: 'int' },
  movie_neutral: { type: 'int' },
  movie_dislikes: { type: 'int' },
  movie_isSuper: { type: 'bool' },
  movie_isLiked: { type: 'bool' },
  movie_isNeutral: { type: 'bool' },
  movie_isDisliked: { type: 'bool' },
  movie_inBookmarks: { type: 'bool' },
  movie_genre_id: { group: 'movie_genres', groupIdField: 'movie_genre_id', rename: 'id', type: 'int' },
  movie_genre_name: { group: 'movie_genres', groupIdField: 'movie_genre_id', rename: 'name' },
  user_id: { type: 'int' },
  isNew: { type: 'bool' },
} as const;

/**
 * Latest votes of the people `uid` follows, newest first, one entry per (friend, movie) with `movie` and
 * `user` sub-objects, as UserRepository::getFriendsVotes built them.
 */
export async function listFriendsVotes(db: Db, uid: number, limit: number, offset: number): Promise<Row[]> {
  const rows = await pdoRows(
    db,
    sql`SELECT
      votes.vote,
      UNIX_TIMESTAMP(votes.timestamp) AS timestamp,
      movie.id AS movie_id,
      movie.title AS movie_title,
      movie.original_title AS movie_original_title,
      movie.tmdb_poster_path AS movie_tmdb_poster_path,
      movie.kp_id AS movie_kp_id,
      movie.release_date AS movie_release_date,
      movie.first_air_date AS movie_first_air_date,
      movie.tmdb_overview AS movie_tmdb_overview,
      movie.kp_overview AS movie_kp_overview,
      movie.original_language AS movie_original_language,
      movie.tmdb_popularity AS movie_tmdb_popularity,
      movie.super AS movie_super,
      movie.likes AS movie_likes,
      movie.neutral AS movie_neutral,
      movie.dislikes AS movie_dislikes,
      IF(movie_vote.vote = 3, true, false) AS movie_isSuper,
      IF(movie_vote.vote = 2, true, false) AS movie_isLiked,
      IF(movie_vote.vote = 1, true, false) AS movie_isNeutral,
      IF(movie_vote.vote = 0, true, false) AS movie_isDisliked,
      IF(bookmark.timestamp IS NULL, false, true) AS movie_inBookmarks,
      IF(u.last_seen_notifications <= votes.timestamp, true, false) AS isNew,
      genre.id AS movie_genre_id,
      genre.name AS movie_genre_name,
      user.id AS user_id,
      user.username AS user_name,
      user.avatar_source AS user_avatar,
      user.gender AS user_gender,
      CONCAT(user.id, '_', movie.id) AS group_id
    FROM (
      SELECT mv.*
      FROM user_friends us
      INNER JOIN movie_vote mv ON mv.user_id = us.user_2
      WHERE us.user_1 = ${uid} AND us.subscribed = 1
      ORDER BY mv.timestamp DESC, mv.id DESC LIMIT ${limit} OFFSET ${offset}
    ) votes
    LEFT JOIN movie ON movie.id = votes.movie_id
    LEFT JOIN movie_genre ON movie_genre.movie_id = movie.id
    LEFT JOIN genre ON genre.id = movie_genre.genre_id
    LEFT JOIN movie_vote ON (movie_vote.user_id = ${uid} AND movie_vote.movie_id = movie.id)
    LEFT JOIN bookmark ON (bookmark.user_id = ${uid} AND bookmark.movie_id = movie.id)
    LEFT JOIN user ON user.id = votes.user_id
    LEFT JOIN user u ON u.id = ${uid}
    ORDER BY votes.timestamp DESC, votes.id DESC, genre.id`,
  );

  return groupRows(rows, 'group_id', friendsVotesFields).map((vote) => {
    // movie_* and user_* fields move into `movie` and `user`, like the PHP array_map
    const out: Row = {};
    const movieOut: Row = {};
    const userOut: Row = {};
    for (const [key, value] of Object.entries(vote)) {
      if (key.startsWith('movie')) movieOut[key.replaceAll('movie_', '')] = value;
      else if (key.startsWith('user')) userOut[key.replaceAll('user_', '')] = value;
      else out[key] = value;
    }
    return { ...out, movie: movieOut, user: userOut };
  });
}
