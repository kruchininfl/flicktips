// Port of api/src/Repositories/MovieRepository.php (plus the SQL that lived in IndexController).
// The PHP built one big JOIN per page and folded it with Mapper::group; here the nested lists
// (genres, countries, staff, votes) come from their own queries, which gives the same items without
// the row explosion, and every value is a bound parameter.
import { schema, type Db } from '@flicktips/db';
import type { KpFilmListItem, KpFilmType } from '@flicktips/kinopoisk';
import { eq, inArray, sql, type SQL } from 'drizzle-orm';

import { groupRows, phpCast, type FieldOptions, type Row } from '../lib/group-rows.js';
import { inList, joinViewer, selectRows, viewerFlags } from './sql.js';

const VIEWER_FLAG_FIELDS: Record<string, FieldOptions> = {
  isSuper: { type: 'bool' },
  isLiked: { type: 'bool' },
  isNeutral: { type: 'bool' },
  isDisliked: { type: 'bool' },
  inBookmarks: { type: 'bool' },
};

// Casts of the `movie.*` rows (findByTmdbId, getTrends, getFilm, findByUserId).
const MOVIE_FIELDS: Record<string, FieldOptions> = {
  id: { type: 'int' },
  super: { type: 'int' },
  likes: { type: 'int' },
  neutral: { type: 'int' },
  dislikes: { type: 'int' },
  ...VIEWER_FLAG_FIELDS,
  tmdb_popularity: { type: 'float' },
  kp_rating_value: { type: 'float' },
  kp_rating_count: { type: 'int' },
  imdb_rating_value: { type: 'float' },
  imdb_rating_count: { type: 'int' },
};

// Columns and casts of the `movie_*` rows (getFilmsOrderedByVotes, PersonRepository::getPerson).
const PREFIXED_COLUMNS: [column: string, options: FieldOptions][] = [
  ['id', { type: 'int' }],
  ['type', {}],
  ['title', {}],
  ['original_title', {}],
  ['tmdb_poster_path', {}],
  ['kp_id', { type: 'int' }],
  ['release_date', {}],
  ['first_air_date', {}],
  ['tmdb_overview', {}],
  ['original_language', {}],
  ['tmdb_popularity', { type: 'float' }],
  ['super', { type: 'int' }],
  ['likes', { type: 'int' }],
  ['neutral', { type: 'int' }],
  ['dislikes', { type: 'int' }],
  ['kp_rating_value', { type: 'float' }],
  ['imdb_rating_value', { type: 'float' }],
];

export const prefixedMovieColumns = sql.raw(
  [...PREFIXED_COLUMNS.map(([c]) => `movie.${c} AS movie_${c}`), 'movie.kp_overview AS movie_kp_overview'].join(', '),
);

export const PREFIXED_MOVIE_FIELDS: Record<string, FieldOptions> = Object.fromEntries([
  ...PREFIXED_COLUMNS.map(([c, o]) => [`movie_${c}`, { ...o, rename: c }]),
  ...Object.entries(VIEWER_FLAG_FIELDS).map(([f, o]) => [`movie_${f}`, { ...o, rename: f }]),
]);

const VOTE_FIELDS: Record<string, FieldOptions> = {
  timestamp: { type: 'int' },
  value: { type: 'int' },
  user_id: { type: 'int' },
};

const FRIEND_VOTE_FIELDS: Record<string, FieldOptions> = {
  vote: { type: 'int' },
  vote_timestamp: { type: 'int' },
  user_id: { type: 'int' },
};

// Casts and renames the fields of flat rows (Mapper::group without groups).
const castAll = (rows: Row[], fields: Record<string, FieldOptions>) =>
  rows.map((row) => {
    const out: Row = {};
    for (const [field, value] of Object.entries(row)) {
      const opts = fields[field];
      out[opts?.rename ?? field] = opts?.type ? phpCast(value, opts.type) : value;
    }
    return out;
  });

const byMovie = (rows: Row[]) => {
  const map = new Map<number, Row[]>();
  for (const { movie_id, ...rest } of rows) {
    const id = Number(movie_id);
    const list = map.get(id) ?? [];
    list.push(rest);
    map.set(id, list);
  }
  return map;
};

// overview: Кинопоиск first, TMDB text as a fallback (what the pages showed).
export const withOverview = <T extends Row>(movie: T, kpOverview: unknown, tmdbOverview: unknown) => {
  const kp = typeof kpOverview === 'string' ? kpOverview.trim() : '';
  const tmdb = typeof tmdbOverview === 'string' ? tmdbOverview : null;
  return Object.assign(movie, { overview: kp ? (kpOverview as string) : tmdb || null });
};

// Genres of each movie: the TMDB genres it has (genre/movie_genre), else its Кинопоиск genres
// (kp-genre/movie_kp-genre). Items are {id, name}; the key is left out when there are none, like
// Mapper::group did.
export async function attachGenres(db: Db, movies: Row[], idKey = 'id') {
  const ids = [...new Set(movies.map((m) => Number(m[idKey])).filter((id) => id > 0))];
  if (!ids.length) return movies;
  const rows = await selectRows(
    db,
    sql`SELECT g.movie_id, g.id, g.name FROM (
        SELECT movie_genre.movie_id, genre.id, genre.name, 0 AS kp
        FROM movie_genre JOIN genre ON genre.id = movie_genre.genre_id
        WHERE movie_genre.movie_id IN (${inList(ids)})
        UNION ALL
        SELECT mk.movie_id, kg.id, kg.name, 1 AS kp
        FROM \`movie_kp-genre\` mk JOIN \`kp-genre\` kg ON kg.id = mk.\`kp-genre_id\`
        WHERE mk.movie_id IN (${inList(ids)})
          AND NOT EXISTS (SELECT 1 FROM movie_genre mg WHERE mg.movie_id = mk.movie_id)
      ) g ORDER BY g.movie_id, g.kp, g.id`,
  );
  const genres = byMovie(castAll(rows, { id: { type: 'int' }, movie_id: { type: 'int' } }));
  for (const movie of movies) {
    const list = genres.get(Number(movie[idKey]));
    if (list?.length) movie.genres = list;
  }
  return movies;
}

// Votes of the viewer's friends on the given movies, newest first.
async function friendVotes(db: Db, movieIds: number[], viewerId: number) {
  if (!movieIds.length) return new Map<number, Row[]>();
  const rows = await selectRows(
    db,
    sql`SELECT fv.movie_id, friend.id AS user_id, friend.username AS user_name, friend.avatar_source AS user_avatar,
        fv.vote AS vote, UNIX_TIMESTAMP(fv.timestamp) AS vote_timestamp
      FROM movie_vote fv JOIN \`user\` friend ON friend.id = fv.user_id
      WHERE fv.movie_id IN (${inList(movieIds)})
        AND fv.user_id IN (SELECT user_2 FROM user_friends WHERE user_1 = ${viewerId} AND subscribed = 1)
      ORDER BY fv.timestamp DESC, fv.id DESC`,
  );
  return byMovie(castAll(rows, FRIEND_VOTE_FIELDS));
}

// All votes on the given movies (or only those of the viewer's friends), newest first, as
// {timestamp, value, user_id, user_name, user_avatar}.
async function movieVotes(db: Db, movieIds: number[], onlyFriendsOf?: number) {
  if (!movieIds.length) return new Map<number, Row[]>();
  const friends =
    onlyFriendsOf === undefined
      ? sql``
      : sql`AND v.user_id IN (SELECT user_2 FROM user_friends WHERE user_1 = ${onlyFriendsOf})`;
  const rows = await selectRows(
    db,
    sql`SELECT v.movie_id, UNIX_TIMESTAMP(v.timestamp) AS timestamp, v.vote AS value, u.id AS user_id,
        u.username AS user_name, u.avatar_source AS user_avatar
      FROM movie_vote v JOIN \`user\` u ON u.id = v.user_id
      WHERE v.movie_id IN (${inList(movieIds)}) ${friends}
      ORDER BY v.timestamp DESC, v.id DESC`,
  );
  return byMovie(castAll(rows, VOTE_FIELDS));
}

interface LoadOptions {
  viewerId: number | null;
  // `false AS isSuper, ...` defaults for anonymous viewers (findByTmdbId, getTrends, getFilm)
  anonymousFlags: boolean;
  skipSuspended: boolean;
  // name and item shape of the friends' votes list (findByTmdbId: 'votes', getTrends: 'friend_votes')
  friendVotesAs?: 'votes' | 'friend_votes';
  extraColumns?: SQL;
  from?: SQL;
  order?: SQL;
}

// `movie.*` rows of the given movies in the given order, cast like the PHP did.
async function loadMovies(db: Db, ids: number[], opts: LoadOptions): Promise<Row[]> {
  if (!ids.length) return [];
  const flags = opts.viewerId
    ? sql`, ${viewerFlags()}`
    : opts.anonymousFlags
      ? sql`, 0 AS isSuper, 0 AS isLiked, 0 AS isNeutral, 0 AS isDisliked`
      : sql``;
  const rows = await selectRows(
    db,
    sql`SELECT ${opts.extraColumns ?? sql``} movie.* ${flags}
      FROM ${opts.from ?? sql`movie`}
      ${opts.viewerId ? joinViewer(opts.viewerId) : sql``}
      WHERE movie.id IN (${inList(ids)}) ${opts.skipSuspended ? sql`AND movie.suspend <> 1` : sql``}
      ORDER BY ${opts.order ?? sql`FIELD(movie.id, ${inList(ids)})`}`,
  );
  const movies = rows.map((row) => {
    const [movie] = groupRows<Row>([row], 'id', MOVIE_FIELDS);
    return withOverview(movie!, row.kp_overview, row.tmdb_overview);
  });
  await attachGenres(db, movies);

  if (opts.viewerId && opts.friendVotesAs) {
    const votes = await friendVotes(
      db,
      movies.map((m) => m.id as number),
      opts.viewerId,
    );
    for (const movie of movies) {
      const list = votes.get(movie.id as number);
      if (!list?.length) continue;
      movie[opts.friendVotesAs] =
        opts.friendVotesAs === 'votes'
          ? list.map((v) => ({
              user_id: v.user_id,
              user_name: v.user_name,
              user_avatar: v.user_avatar,
              value: v.vote,
              timestamp: v.vote_timestamp,
            }))
          : list;
    }
  }
  return movies;
}

// MovieRepository::findByTmdbId, keyed by movie.id now (search and the digital releases).
export function findMoviesByIds(db: Db, ids: number[], viewerId: number | null) {
  return loadMovies(db, [...new Set(ids)], {
    viewerId,
    anonymousFlags: true,
    skipSuspended: true,
    friendVotesAs: 'votes',
  });
}

// MovieRepository::getTrends: the most voted films of the last 1/2/3/7 days, then of all time.
export async function getTrends(db: Db, limit: number, viewerId: number | null) {
  const top = await selectRows(
    db,
    sql`SELECT movie_id FROM movie_vote GROUP BY movie_id
      ORDER BY
        SUM(IF(timestamp >= DATE_SUB(NOW(), INTERVAL 1 DAY), 1, 0)) DESC,
        SUM(IF(timestamp >= DATE_SUB(NOW(), INTERVAL 2 DAY), 1, 0)) DESC,
        SUM(IF(timestamp >= DATE_SUB(NOW(), INTERVAL 3 DAY), 1, 0)) DESC,
        SUM(IF(timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY), 1, 0)) DESC,
        COUNT(*) DESC, movie_id DESC
      LIMIT ${limit}`,
  );
  return loadMovies(
    db,
    top.map((r) => Number(r.movie_id)),
    { viewerId, anonymousFlags: true, skipSuspended: false, friendVotesAs: 'friend_votes' },
  );
}

export async function countVotedMovies(db: Db) {
  const [row] = await selectRows(db, sql`SELECT COUNT(DISTINCT movie_id) AS num FROM movie_vote`);
  return phpCast(row?.num, 'int') as number;
}

// MovieRepository::getFilm
export async function getFilm(db: Db, id: number, viewerId: number | null): Promise<Row | null> {
  const [movie] = await loadMovies(db, [id], { viewerId, anonymousFlags: true, skipSuspended: true });
  if (!movie) return null;
  delete movie.kp_check_date;
  delete movie.kp_error;

  const countries = await selectRows(
    db,
    sql`SELECT country.id, country.name FROM movie_country JOIN country ON country.id = movie_country.country_id
      WHERE movie_country.movie_id = ${id} ORDER BY country.id`,
  );
  if (countries.length) movie.countries = castAll(countries, { id: { type: 'int' } });

  // Suspended people are left out (the PHP kept an empty {id: 0, name: null} entry per group for them).
  const staffRows = await selectRows(
    db,
    sql`SELECT people.id, people.name, people.original_name, people.kp_photo AS photo, movie_people.description,
        movie_people.\`order\`, \`group\`.type AS group_type, \`group\`.title AS group_title
      FROM movie_people
      JOIN people ON people.id = movie_people.people_id AND people.suspend = 0
      LEFT JOIN \`group\` ON \`group\`.id = movie_people.group_id
      WHERE movie_people.movie_id = ${id}
      ORDER BY movie_people.\`order\`, movie_people.group_id, people.id`,
  );
  if (staffRows.length) {
    const groups = new Map<string, { type: unknown; title: unknown; people: Row[] }>();
    for (const { group_type, group_title, ...person } of staffRows) {
      delete person.order;
      const key = String(group_type ?? '');
      let group = groups.get(key);
      if (!group) {
        group = { type: group_type, title: group_title, people: [] };
        groups.set(key, group);
      }
      group.people.push({ ...person, id: phpCast(person.id, 'int') });
    }
    movie.staff = [...groups.values()];
  }

  const votes = (await movieVotes(db, [id])).get(id);
  if (votes?.length) movie.votes = votes;
  return movie;
}

// MovieRepository::getFilmVotes
export async function getFilmVotes(db: Db, id: number, viewerId: number | null) {
  const rows = await selectRows(
    db,
    sql`SELECT mv.id, mv.vote, mv.timestamp, mv.user_id,
        u.avatar_source AS user_avatar, u.gender AS user_gender, u.username AS user_username,
        ${viewerId ? sql`IF(uf.user_1 IS NULL, 0, 1)` : sql`0`} AS user_isFriend
      FROM movie_vote mv
      LEFT JOIN \`user\` u ON u.id = mv.user_id
      ${viewerId ? sql`LEFT JOIN user_friends uf ON uf.user_1 = ${viewerId} AND uf.user_2 = u.id` : sql``}
      WHERE mv.movie_id = ${id}
      ORDER BY mv.timestamp DESC, mv.id DESC`,
  );
  const group = { group: 'user', groupIdField: 'user_id' };
  return groupRows<Row & { user: Row[] }>(rows, 'id', {
    id: { type: 'int' },
    vote: { type: 'int' },
    user_id: { ...group, rename: 'id', type: 'int' },
    user_avatar: { ...group, rename: 'avatar', type: 'string' },
    user_gender: { ...group, rename: 'gender', type: 'string' },
    user_username: { ...group, rename: 'username', type: 'string' },
    user_isFriend: { ...group, rename: 'isFriend', type: 'bool' },
  }).map((vote) => ({ ...vote, user: vote.user[0] }));
}

// IndexController::getVotes total + MovieRepository::findByUserId: a user's votes, newest first.
// `vote`: only the votes of this value (null: all)
const voteFilter = (vote: number | null) => (vote === null ? sql`` : sql` AND movie_vote.vote = ${vote}`);

export async function countUserVotes(db: Db, userId: number, vote: number | null = null) {
  const [row] = await selectRows(
    db,
    sql`SELECT COUNT(*) AS num FROM movie_vote WHERE user_id = ${userId}${voteFilter(vote)}`,
  );
  return phpCast(row?.num, 'int') as number;
}

export async function findByUserId(
  db: Db,
  viewerId: number | null,
  userId: number,
  limit: number,
  offset: number,
  vote: number | null = null,
) {
  const page = await selectRows(
    db,
    sql`SELECT movie_vote.movie_id FROM movie_vote JOIN movie ON movie.id = movie_vote.movie_id
      WHERE movie_vote.user_id = ${userId}${voteFilter(vote)}
      ORDER BY movie_vote.timestamp DESC, movie_vote.id DESC LIMIT ${limit} OFFSET ${offset}`,
  );
  const ids = page.map((r) => Number(r.movie_id));
  const movies = await loadMovies(db, ids, {
    viewerId,
    anonymousFlags: false,
    skipSuspended: true,
    friendVotesAs: 'friend_votes',
    extraColumns: sql`UNIX_TIMESTAMP(movie_vote.timestamp) AS timestamp, movie_vote.vote AS vote,`,
    from: sql`movie_vote JOIN movie ON movie.id = movie_vote.movie_id AND movie_vote.user_id = ${userId}${voteFilter(vote)}`,
    order: sql`movie_vote.timestamp DESC, movie_vote.id DESC`,
  });
  // `vote` is cast to int; `timestamp` stays a string as in the PHP (it had no cast for it)
  for (const movie of movies) movie.vote = phpCast(movie.vote, 'int');
  return movies;
}

export interface FeedViewer {
  id: number;
  hideViewed: boolean;
}

export async function feedViewer(db: Db, viewerId: number | null): Promise<FeedViewer | null> {
  if (!viewerId) return null;
  const [row] = await db
    .select({ hideViewed: schema.user.hideViewed })
    .from(schema.user)
    .where(eq(schema.user.id, viewerId));
  return { id: viewerId, hideViewed: !!row?.hideViewed };
}

const feedWhere = (viewer: FeedViewer | null, onlyFriends: boolean) => {
  const parts: SQL[] = [sql`1 = 1`];
  if (onlyFriends && viewer) {
    parts.push(sql`user_id IN (SELECT user_2 FROM user_friends WHERE user_1 = ${viewer.id})`);
  }
  if (viewer?.hideViewed) {
    parts.push(sql`movie_id NOT IN (SELECT movie_id FROM movie_vote WHERE user_id = ${viewer.id})`);
  }
  return sql.join(parts, sql` AND `);
};

// Number of movies the feed can list (see docs/routes-movies.md: the PHP counted a different set
// for hide_viewed users).
export async function countFeed(db: Db, viewer: FeedViewer | null, onlyFriends: boolean) {
  const [row] = await selectRows(
    db,
    sql`SELECT COUNT(DISTINCT movie_id) AS num FROM movie_vote WHERE ${feedWhere(viewer, onlyFriends)}`,
  );
  return phpCast(row?.num, 'int') as number;
}

// MovieRepository::getFilmsOrderedByVotes: movies by their latest vote, with all their votes (or the
// friends' votes only).
export async function getFilmsOrderedByVotes(db: Db, limit: number, viewer: FeedViewer | null, onlyFriends = false) {
  const top = await selectRows(
    db,
    sql`SELECT movie_id FROM movie_vote WHERE ${feedWhere(viewer, onlyFriends)}
      GROUP BY movie_id ORDER BY MAX(timestamp) DESC, movie_id DESC LIMIT ${limit}`,
  );
  const ids = top.map((r) => Number(r.movie_id));
  if (!ids.length) return [];
  const rows = await selectRows(
    db,
    sql`SELECT ${prefixedMovieColumns} ${viewer ? sql`, ${viewerFlags('movie_')}` : sql``}
      FROM movie ${viewer ? joinViewer(viewer.id) : sql``}
      WHERE movie.id IN (${inList(ids)}) ORDER BY FIELD(movie.id, ${inList(ids)})`,
  );
  const movies = rows.map((row) => {
    const [movie] = groupRows<Row>([row], 'movie_id', PREFIXED_MOVIE_FIELDS);
    delete movie!.movie_kp_overview;
    return withOverview(movie!, row.movie_kp_overview, row.movie_tmdb_overview);
  });
  await attachGenres(db, movies);
  const votes = await movieVotes(db, ids, onlyFriends && viewer ? viewer.id : undefined);
  for (const movie of movies) {
    const list = votes.get(movie.id as number);
    if (list?.length) movie.votes = list;
  }
  return movies;
}

export interface DigitalFilters {
  quality: number[];
  voice: number[];
  ratingValue: number;
  ratingCount: number;
  dateFrom: string;
  dateTo: string;
}

// IndexController::getDigitalFilms: movies with torrents (ft-parser tables), by first torrent date.
export async function getDigital(db: Db, filters: DigitalFilters, limit: number, offset: number) {
  const torrentWhere: SQL[] = [];
  if (filters.quality.length) torrentWhere.push(sql`t2.quality IN (${inList(filters.quality)})`);
  if (filters.voice.length) torrentWhere.push(sql`t2.voice IN (${inList(filters.voice)})`);
  const from = sql`(SELECT ft.film_id, MIN(t2.created) AS created
      FROM ft_torrent t2 JOIN ft_film_torrent ft ON ft.torrent_id = t2.id
      ${torrentWhere.length ? sql`WHERE ${sql.join(torrentWhere, sql` AND `)}` : sql``}
      GROUP BY ft.film_id) t
    JOIN ft_film f ON f.id = t.film_id
    JOIN movie m_m ON m_m.kp_id = f.kp_id
    WHERE t.created IS NOT NULL AND m_m.kp_rating_value >= ${filters.ratingValue}
      AND m_m.kp_rating_count >= ${filters.ratingCount}
      AND m_m.release_date >= ${filters.dateFrom} AND m_m.release_date <= ${filters.dateTo}`;
  const [count] = await selectRows(db, sql`SELECT COUNT(*) AS num FROM ${from}`);
  const ids = await selectRows(
    db,
    sql`SELECT m_m.id FROM ${from} ORDER BY t.created DESC, m_m.id DESC LIMIT ${limit} OFFSET ${offset}`,
  );
  return { total: phpCast(count?.num, 'int') as number, ids: ids.map((r) => Number(r.id)) };
}

export async function getDatasets(db: Db) {
  return {
    quality: await selectRows(db, sql`SELECT * FROM ft_quality ORDER BY id`),
    voice: await selectRows(db, sql`SELECT * FROM ft_voice ORDER BY sort DESC, id`),
  };
}

export async function cacheTrailers(db: Db, id: number, trailers: string[]) {
  await db
    .update(schema.movie)
    .set({ tmdbTrailers: JSON.stringify(trailers) })
    .where(eq(schema.movie.id, id));
}

// --- search: Кинопоиск results stored as movies ---

export const kpMovieType = (type: KpFilmType): 'movie' | 'tv' =>
  type === 'TV_SERIES' || type === 'MINI_SERIES' || type === 'TV_SHOW' ? 'tv' : 'movie';

// Returns the movie.id of each Кинопоиск film (in the same order), adding the films we do not have
// yet as KP-only movies (tmdb_id NULL) with their Кинопоиск genres and countries.
export async function upsertKpFilms(db: Db, items: KpFilmListItem[]): Promise<number[]> {
  const kpIds = [...new Set(items.map((i) => i.kinopoiskId))];
  if (!kpIds.length) return [];
  const existing = new Map<number, number>();
  const rows = await db
    .select({ id: schema.movie.id, kpId: schema.movie.kpId })
    .from(schema.movie)
    .where(inArray(schema.movie.kpId, kpIds))
    .orderBy(schema.movie.id);
  for (const row of rows) if (row.kpId && !existing.has(row.kpId)) existing.set(row.kpId, row.id);

  for (const item of items) {
    if (existing.has(item.kinopoiskId)) continue;
    existing.set(item.kinopoiskId, await insertKpFilmOnce(db, item));
  }
  return kpIds.map((id) => existing.get(id)!);
}

// A concurrent search may insert the same film first; with the UNIQUE key on kp_id (migration 003) the
// loser gets ER_DUP_ENTRY and takes the winner's row.
async function insertKpFilmOnce(db: Db, item: KpFilmListItem): Promise<number> {
  try {
    return await insertKpFilm(db, item);
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
    const [row] = await db
      .select({ id: schema.movie.id })
      .from(schema.movie)
      .where(eq(schema.movie.kpId, item.kinopoiskId))
      .orderBy(schema.movie.id)
      .limit(1);
    if (!row) throw err;
    return row.id;
  }
}

// mysql2 error, possibly wrapped by Drizzle (DrizzleQueryError.cause)
export function isDuplicateKey(err: unknown): boolean {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === 'ER_DUP_ENTRY') return true;
  }
  return false;
}

async function insertKpFilm(db: Db, item: KpFilmListItem): Promise<number> {
  const type = kpMovieType(item.type);
  const title = item.nameRu || item.nameOriginal || item.nameEn || '';
  const originalTitle = item.nameOriginal || item.nameEn || null;
  // the pages take the year from release_date / first_air_date; Кинопоиск lists give only the year
  const date = item.year ? String(item.year) : null;
  return db.transaction(async (tx) => {
    const [res] = await tx.insert(schema.movie).values({
      tmdbId: null,
      type,
      title,
      originalTitle,
      releaseDate: type === 'movie' ? date : null,
      firstAirDate: type === 'tv' ? date : null,
      kpId: item.kinopoiskId,
      kpTitle: item.nameRu,
      kpOriginalTitle: item.nameOriginal,
      kpStartYear: item.year,
      kpRatingValue: item.ratingKinopoisk,
      imdbId: item.imdbId,
      imdbRatingValue: item.ratingImdb,
    });
    const movieId = res.insertId;

    const genres = [...new Set(item.genres.map((g) => g.genre).filter(Boolean))];
    if (genres.length) {
      await tx
        .insert(schema.kpGenre)
        .ignore()
        .values(genres.map((name) => ({ name })));
      const ids = await tx
        .select({ id: schema.kpGenre.id })
        .from(schema.kpGenre)
        .where(inArray(schema.kpGenre.name, genres));
      await tx
        .insert(schema.movieKpGenre)
        .ignore()
        .values(ids.map(({ id }) => ({ movieId, kpGenreId: id })));
    }

    const countries = [...new Set(item.countries.map((c) => c.country).filter(Boolean))];
    if (countries.length) {
      await tx
        .insert(schema.country)
        .ignore()
        .values(countries.map((name) => ({ name })));
      const ids = await tx
        .select({ id: schema.country.id })
        .from(schema.country)
        .where(inArray(schema.country.name, countries));
      await tx
        .insert(schema.movieCountry)
        .ignore()
        .values(ids.map(({ id }) => ({ movieId, countryId: id })));
    }
    return movieId;
  });
}

export async function userExists(db: Db, id: number) {
  const [row] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, id));
  return !!row;
}
