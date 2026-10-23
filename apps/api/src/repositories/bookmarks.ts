// Bookmarks of the signed-in user: UserController::toggleBookmark and UserRepository::getBookmarks.
import { schema, type Db } from '@flicktips/db';
import { and, eq, sql, type SQL } from 'drizzle-orm';

import { groupRows, phpCast, type Row } from '../lib/group-rows.js';
import { pdoRows } from '../lib/pdo-rows.js';

const { bookmark, movie } = schema;

/**
 * Removes the bookmark, or adds it when there was none. Returns the new state, or null when the movie does
 * not exist.
 */
export async function toggleBookmark(db: Db, uid: number, movieId: number): Promise<boolean | null> {
  const [deleted] = await db.delete(bookmark).where(and(eq(bookmark.userId, uid), eq(bookmark.movieId, movieId)));
  if (deleted.affectedRows) return false;

  const [target] = await db.select({ id: movie.id }).from(movie).where(eq(movie.id, movieId)).limit(1);
  if (!target) return null;
  // IGNORE: a parallel toggle may have added it in the meantime
  await db.insert(bookmark).ignore().values({ userId: uid, movieId });
  return true;
}

// New in v2: «Фильмы / Сериалы» and «Друзьям понравилось» (someone the user follows voted like or super).
export interface BookmarkFilter {
  type?: 'movie' | 'tv';
  liked?: boolean;
}

// conditions on a `bookmark` row, ANDed after `bookmark.user_id = uid`
function filterSql(uid: number, { type, liked }: BookmarkFilter): SQL {
  const parts: SQL[] = [];
  if (type) {
    parts.push(sql` AND bookmark.movie_id IN (SELECT movie.id FROM movie WHERE movie.type = ${type})`);
  }
  if (liked) {
    parts.push(sql` AND EXISTS (
      SELECT 1 FROM movie_vote AS liked_vote
      WHERE liked_vote.movie_id = bookmark.movie_id AND liked_vote.vote >= 2 AND liked_vote.user_id IN (
        SELECT user_friends.user_2 FROM user_friends WHERE user_friends.user_1 = ${uid} AND user_friends.subscribed = 1
      )
    )`);
  }
  return sql.join(parts, sql``);
}

export async function countBookmarks(db: Db, uid: number, filter: BookmarkFilter = {}): Promise<number> {
  const [row] = await pdoRows(
    db,
    sql`SELECT COUNT(bookmark.id) AS num FROM bookmark WHERE bookmark.user_id = ${uid}${filterSql(uid, filter)}`,
  );
  return phpCast(row?.num, 'int');
}

const bookmarkFields = {
  id: { type: 'int' },
  tmdb_popularity: { type: 'float' },
  super: { type: 'int' },
  likes: { type: 'int' },
  neutral: { type: 'int' },
  dislikes: { type: 'int' },
  isSuper: { type: 'bool' },
  isLiked: { type: 'bool' },
  isNeutral: { type: 'bool' },
  isDisliked: { type: 'bool' },
  inBookmarks: { type: 'bool' },
  kp_rating_count: { type: 'int' },
  imdb_rating_count: { type: 'int' },
  kp_rating_value: { type: 'float' },
  imdb_rating_value: { type: 'float' },
  genre_id: { group: 'genres', groupIdField: 'genre_id', rename: 'id', type: 'int' },
  genre_name: { group: 'genres', groupIdField: 'genre_id', rename: 'name' },
  // PHP grouped by CONCAT_WS('_', movie.id, friend.id) when friend.id is set: the same as both ids non-empty
  friends_votes_user_id: {
    group: 'friend_votes',
    groupIdField: ['id', 'friends_votes_user_id'],
    rename: 'user_id',
    type: 'int',
  },
  friends_votes_user_name: {
    group: 'friend_votes',
    groupIdField: ['id', 'friends_votes_user_id'],
    rename: 'user_name',
  },
  friends_votes_user_avatar: {
    group: 'friend_votes',
    groupIdField: ['id', 'friends_votes_user_id'],
    rename: 'user_avatar',
  },
  friends_votes_val: {
    group: 'friend_votes',
    groupIdField: ['id', 'friends_votes_user_id'],
    rename: 'vote',
    type: 'int',
  },
  friends_votes_timestamp: {
    group: 'friend_votes',
    groupIdField: ['id', 'friends_votes_user_id'],
    rename: 'vote_timestamp',
    type: 'int',
  },
} as const;

/**
 * A page of bookmarked movies, newest bookmark first: every movie column (as PHP's `movie.*`), the viewer's
 * vote flags, `genres` and `friend_votes` (votes of the people the user follows, newest first).
 */
export async function listBookmarks(
  db: Db,
  uid: number,
  limit: number,
  offset: number,
  filter: BookmarkFilter = {},
): Promise<Row[]> {
  const rows = await pdoRows(
    db,
    sql`SELECT
      movie.*,
      friend_votes.vote AS friends_votes_val,
      friend.id AS friends_votes_user_id,
      friend.username AS friends_votes_user_name,
      friend.avatar AS friends_votes_user_avatar,
      UNIX_TIMESTAMP(friend_votes.timestamp) AS friends_votes_timestamp,
      IF(movie_vote.vote = 3, true, false) AS isSuper,
      IF(movie_vote.vote = 2, true, false) AS isLiked,
      IF(movie_vote.vote = 1, true, false) AS isNeutral,
      IF(movie_vote.vote = 0, true, false) AS isDisliked,
      TRUE AS inBookmarks,
      genre.id AS genre_id,
      genre.name AS genre_name
    FROM (
      SELECT bookmark.id AS bookmark_id, bookmark.movie_id, bookmark.timestamp AS bookmark_timestamp
      FROM bookmark WHERE bookmark.user_id = ${uid}${filterSql(uid, filter)}
      ORDER BY bookmark.timestamp DESC, bookmark.id DESC LIMIT ${limit} OFFSET ${offset}
    ) bookmarks
    INNER JOIN movie ON movie.id = bookmarks.movie_id
    LEFT JOIN movie_genre ON movie_genre.movie_id = movie.id
    LEFT JOIN genre ON genre.id = movie_genre.genre_id
    LEFT JOIN movie_vote ON (movie_vote.user_id = ${uid} AND movie_vote.movie_id = movie.id)
    LEFT JOIN movie_vote AS friend_votes ON friend_votes.movie_id = movie.id AND friend_votes.user_id IN (
      SELECT user_friends.user_2 FROM user_friends WHERE user_friends.user_1 = ${uid} AND user_friends.subscribed = 1
    )
    LEFT JOIN user AS friend ON friend.id = friend_votes.user_id
    ORDER BY bookmarks.bookmark_timestamp DESC, bookmarks.bookmark_id DESC, genre.id, friend.id`,
  );

  const movies = groupRows<Row & { friend_votes?: { vote_timestamp: number }[] }>(rows, 'id', bookmarkFields);
  for (const item of movies) {
    item.friend_votes?.sort((a, b) => b.vote_timestamp - a.vote_timestamp);
  }
  return movies;
}
