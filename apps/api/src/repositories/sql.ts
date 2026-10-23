import type { Db } from '@flicktips/db';
import { sql, type SQL } from 'drizzle-orm';

import type { Row } from '../lib/group-rows.js';
import { pdoRows } from '../lib/pdo-rows.js';

// Runs a raw query and returns its rows the way PHP's PDO saw them (non-NULL values as strings),
// so that groupRows/phpCast reproduce the legacy response types.
export async function selectRows(db: Db, query: SQL): Promise<Row[]> {
  return pdoRows(db, query);
}

// `IN (...)` list of bound values; callers make sure the list is not empty.
export const inList = (values: readonly (number | string)[]) =>
  sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );

// The viewer's own vote and bookmark as the flags the pages use (`prefix` = 'movie_' in the
// prefixed queries). Needs `my_vote` and `bookmark` joined with joinViewer().
export const viewerFlags = (prefix = '') =>
  sql.raw(`IF(my_vote.vote = 3, 1, 0) AS ${prefix}isSuper,
    IF(my_vote.vote = 2, 1, 0) AS ${prefix}isLiked,
    IF(my_vote.vote = 1, 1, 0) AS ${prefix}isNeutral,
    IF(my_vote.vote = 0, 1, 0) AS ${prefix}isDisliked,
    IF(bookmark.timestamp IS NULL, 0, 1) AS ${prefix}inBookmarks`);

export const joinViewer = (viewerId: number) =>
  sql`LEFT JOIN movie_vote AS my_vote ON my_vote.movie_id = movie.id AND my_vote.user_id = ${viewerId}
    LEFT JOIN bookmark ON bookmark.user_id = ${viewerId} AND bookmark.movie_id = movie.id`;
