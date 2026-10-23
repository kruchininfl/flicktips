// Port of api/src/Repositories/PersonRepository.php
import type { Db } from '@flicktips/db';
import { sql } from 'drizzle-orm';

import { groupRows, phpCast, type Row } from '../lib/group-rows.js';
import { PREFIXED_MOVIE_FIELDS, prefixedMovieColumns, withOverview } from './movies.js';
import { inList, joinViewer, selectRows, viewerFlags } from './sql.js';

// A person with their movies, one entry per (movie, role group), newest first; null when the person is
// missing, suspended or has no movies (the PHP answered 404 for all three).
export async function getPerson(db: Db, id: number, viewerId: number | null): Promise<Row | null> {
  const [person] = await selectRows(db, sql`SELECT people.* FROM people WHERE id = ${id}`);
  if (!person || person.suspend === '1') return null;

  const rows = await selectRows(
    db,
    sql`SELECT \`group\`.id AS movie_group_id, \`group\`.title_singular AS movie_group_title, ${prefixedMovieColumns}
        ${viewerId ? sql`, ${viewerFlags('movie_')}` : sql``}
      FROM movie_people
      JOIN movie ON movie.id = movie_people.movie_id
      LEFT JOIN \`group\` ON \`group\`.id = movie_people.group_id
      ${viewerId ? joinViewer(viewerId) : sql``}
      WHERE movie_people.people_id = ${id} AND movie.suspend <> 1
      ORDER BY IF(movie.type = 'movie', movie.release_date, movie.first_air_date) DESC, movie.id DESC,
        movie_people.group_id`,
  );
  if (!rows.length) return null;

  const movies = groupRows<Row>(rows, ['movie_id', 'movie_group_id'], {
    ...PREFIXED_MOVIE_FIELDS,
    movie_group_id: { type: 'int', rename: 'group_id' },
    movie_group_title: { type: 'string', rename: 'group_title' },
  }).map((movie) => {
    const kpOverview = movie.movie_kp_overview;
    delete movie.movie_kp_overview;
    return withOverview(movie, kpOverview, movie.tmdb_overview);
  });

  const movieIds = [...new Set(movies.map((m) => m.id as number))];
  const votes = await selectRows(
    db,
    sql`SELECT v.movie_id, UNIX_TIMESTAMP(v.timestamp) AS timestamp, v.vote AS value, u.id AS user_id,
        u.username AS user_name, u.avatar_source AS user_avatar
      FROM movie_vote v JOIN \`user\` u ON u.id = v.user_id
      WHERE v.movie_id IN (${inList(movieIds)})
      ORDER BY v.timestamp DESC, v.id DESC`,
  );
  for (const movie of movies) {
    const list = votes
      .filter((v) => Number(v.movie_id) === movie.id)
      .map((v) => ({
        timestamp: phpCast(v.timestamp, 'int'),
        value: phpCast(v.value, 'int'),
        user_id: phpCast(v.user_id, 'int'),
        user_name: v.user_name,
        user_avatar: v.user_avatar,
      }));
    if (list.length) movie.votes = list;
  }

  delete person.kp_id;
  return { ...person, movies };
}

export interface FoundPerson {
  id: number;
  name: string | null;
  original_name: string | null;
  kp_photo: string | null;
  // the role with the most movies, «Режиссер» or «Актер»
  role: string | null;
  movies_count: number;
}

// The search's «Люди»: by the Russian or the original name, prefix matches first, then whoever has more movies.
export async function searchPeople(db: Db, query: string, limit: number): Promise<FoundPerson[]> {
  const like = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await selectRows(
    db,
    sql`SELECT people.id, people.name, people.original_name, people.kp_photo,
        COUNT(DISTINCT movie_people.movie_id) AS movies_count,
        (SELECT \`group\`.title_singular FROM movie_people role
          INNER JOIN \`group\` ON \`group\`.id = role.group_id
          WHERE role.people_id = people.id
          GROUP BY role.group_id ORDER BY COUNT(*) DESC, role.group_id LIMIT 1) AS role
      FROM people
      INNER JOIN movie_people ON movie_people.people_id = people.id
      INNER JOIN movie ON movie.id = movie_people.movie_id AND movie.suspend <> 1
      WHERE people.suspend <> 1 AND (people.name LIKE ${`%${like}%`} OR people.original_name LIKE ${`%${like}%`})
      GROUP BY people.id
      ORDER BY MAX(people.name LIKE ${`${like}%`} OR people.original_name LIKE ${`${like}%`}) DESC,
        movies_count DESC, people.id
      LIMIT ${limit}`,
  );
  return rows.map((row) => ({
    id: phpCast(row.id, 'int'),
    name: row.name as string | null,
    original_name: row.original_name as string | null,
    kp_photo: row.kp_photo as string | null,
    role: row.role as string | null,
    movies_count: phpCast(row.movies_count, 'int'),
  }));
}
