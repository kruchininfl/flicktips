import {
  mysqlTable,
  primaryKey,
  unique,
  int,
  timestamp,
  varchar,
  date,
  index,
  mediumtext,
  longtext,
  float,
  year,
  tinyint,
  bigint,
  datetime,
  tinytext,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const bookmark = mysqlTable(
  'bookmark',
  {
    id: int().autoincrement().notNull(),
    userId: int('user_id')
      .notNull()
      .references(() => user.id),
    movieId: int('movie_id')
      .notNull()
      .references(() => movie.id),
    timestamp: timestamp({ mode: 'string' }).defaultNow().onUpdateNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: 'bookmark_id' }),
    unique('user_id_movie_id').on(table.userId, table.movieId),
  ],
);

export const country = mysqlTable(
  'country',
  {
    id: int().autoincrement().notNull(),
    name: varchar({ length: 250 }),
  },
  (table) => [primaryKey({ columns: [table.id], name: 'country_id' }), unique('name').on(table.name)],
);

export const ftFilm = mysqlTable(
  'ft_film',
  {
    id: int().autoincrement().notNull(),
    ftId: int('ft_id').notNull(),
    kpId: int('kp_id').notNull(),
    name: varchar({ length: 250 }).notNull(),
    originalName: varchar('original_name', { length: 250 }).notNull(),
    slug: varchar({ length: 250 }).notNull(),
    // you can use { mode: 'date' }, if you want to have Date as type for this column
    dateAdd: date('date_add', { mode: 'string' }).notNull(),
    // you can use { mode: 'date' }, if you want to have Date as type for this column
    dateUpdate: date('date_update', { mode: 'string' }).notNull(),
    // you can use { mode: 'date' }, if you want to have Date as type for this column
    matchDate: date('match_date', { mode: 'string' }),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: 'ft_film_id' }),
    unique('ft_id').on(table.ftId),
    unique('kp_id').on(table.kpId),
  ],
);

export const ftFilmTorrent = mysqlTable(
  'ft_film_torrent',
  {
    filmId: int('film_id')
      .notNull()
      .references(() => ftFilm.id),
    torrentId: int('torrent_id')
      .notNull()
      .references(() => ftTorrent.id),
  },
  (table) => [unique('film_id_torrent_id').on(table.filmId, table.torrentId)],
);

export const ftQuality = mysqlTable(
  'ft_quality',
  {
    id: int().autoincrement().notNull(),
    name: varchar({ length: 250 }).notNull(),
    description: varchar({ length: 250 }),
    ratio: int().default(1).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id], name: 'ft_quality_id' }), unique('name').on(table.name)],
);

export const ftTorrent = mysqlTable(
  'ft_torrent',
  {
    id: int().autoincrement().notNull(),
    ftId: int('ft_id'),
    quality: int().references(() => ftQuality.id, { onDelete: 'restrict' }),
    voice: int().references(() => ftVoice.id, { onDelete: 'restrict' }),
    size: varchar({ length: 250 }).notNull(),
    link: mediumtext().notNull(),
    // you can use { mode: 'date' }, if you want to have Date as type for this column
    created: date({ mode: 'string' }),
    checked: tinyint().default(0).notNull(),
  },
  (table) => [
    index('created').on(table.created),
    primaryKey({ columns: [table.id], name: 'ft_torrent_id' }),
    unique('ft_id').on(table.ftId),
  ],
);

export const ftVoice = mysqlTable(
  'ft_voice',
  {
    id: int().autoincrement().notNull(),
    name: varchar({ length: 250 }).notNull(),
    alias: varchar({ length: 250 }).notNull(),
    sort: int().default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id], name: 'ft_voice_id' }), unique('name').on(table.name)],
);

export const genre = mysqlTable(
  'genre',
  {
    id: int().autoincrement().notNull(),
    tmdbId: int('tmdb_id').default(0).notNull(),
    name: longtext(),
  },
  (table) => [primaryKey({ columns: [table.id], name: 'genre_id' }), unique('tmdb_id').on(table.tmdbId)],
);

export const group = mysqlTable(
  'group',
  {
    id: int().autoincrement().notNull(),
    type: varchar({ length: 255 }).notNull(),
    title: varchar({ length: 255 }),
    titleSingular: varchar('title_singular', { length: 255 }),
  },
  (table) => [primaryKey({ columns: [table.id], name: 'group_id' }), unique('kp_id').on(table.type)],
);

export const kpGenre = mysqlTable(
  'kp-genre',
  {
    id: int().autoincrement().notNull(),
    name: varchar({ length: 250 }),
  },
  (table) => [primaryKey({ columns: [table.id], name: 'kp-genre_id' }), unique('name').on(table.name)],
);

export const movie = mysqlTable(
  'movie',
  {
    id: int().autoincrement().notNull(),
    tmdbId: varchar('tmdb_id', { length: 50 }).notNull(),
    type: varchar({ length: 50 }),
    title: longtext(),
    originalTitle: longtext('original_title'),
    tmdbPosterPath: varchar('tmdb_poster_path', { length: 50 }),
    releaseDate: varchar('release_date', { length: 50 }),
    firstAirDate: varchar('first_air_date', { length: 50 }),
    tmdbOverview: longtext('tmdb_overview'),
    originalLanguage: varchar('original_language', { length: 50 }),
    tmdbTrailers: longtext('tmdb_trailers'),
    tmdbPopularity: float('tmdb_popularity'),
    kpId: int('kp_id'),
    kpTitle: longtext('kp_title'),
    kpOriginalTitle: longtext('kp_original_title'),
    kpStartYear: year('kp_start_year'),
    kpFinishYear: year('kp_finish_year'),
    kpOverview: longtext('kp_overview'),
    kpDuration: int('kp_duration'),
    // you can use { mode: 'date' }, if you want to have Date as type for this column
    kpReleaseDate: date('kp_release_date', { mode: 'string' }).default('0000-00-00'),
    // you can use { mode: 'date' }, if you want to have Date as type for this column
    kpReleaseDateDvd: date('kp_release_date_dvd', { mode: 'string' }).default('0000-00-00'),
    // you can use { mode: 'date' }, if you want to have Date as type for this column
    kpReleaseDateRus: date('kp_release_date_rus', { mode: 'string' }).default('0000-00-00'),
    kpRatingValue: float('kp_rating_value'),
    kpRatingCount: int('kp_rating_count'),
    imdbId: varchar('imdb_id', { length: 50 }),
    imdbRatingValue: float('imdb_rating_value'),
    imdbRatingCount: int('imdb_rating_count'),
    // you can use { mode: 'date' }, if you want to have Date as type for this column
    kpCheckDate: date('kp_check_date', { mode: 'string' }),
    kpError: varchar('kp_error', { length: 50 }),
    kpTitleSimilarity: float('kp_title_similarity'),
    kpForceCheck: tinyint('kp_force_check').default(0).notNull(),
    super: int().default(0).notNull(),
    likes: int().default(0).notNull(),
    neutral: int().default(0).notNull(),
    dislikes: int().default(0).notNull(),
    suspend: tinyint().default(0).notNull(),
  },
  (table) => [
    index('kp_id').on(table.kpId),
    primaryKey({ columns: [table.id], name: 'movie_id' }),
    unique('tmdb_id').on(table.tmdbId),
  ],
);

export const movieCountry = mysqlTable(
  'movie_country',
  {
    movieId: int('movie_id')
      .notNull()
      .references(() => movie.id),
    countryId: int('country_id')
      .notNull()
      .references(() => country.id),
  },
  (table) => [
    index('FK_movie_countrymovie_countrymovie').on(table.countryId),
    primaryKey({ columns: [table.movieId, table.countryId], name: 'movie_country_movie_id_country_id' }),
  ],
);

export const movieGenre = mysqlTable(
  'movie_genre',
  {
    movieId: int('movie_id')
      .notNull()
      .references(() => movie.id),
    genreId: int('genre_id')
      .notNull()
      .references(() => genre.id),
  },
  (table) => [
    index('FK_movie_genremovie_genremovie').on(table.genreId),
    primaryKey({ columns: [table.movieId, table.genreId], name: 'movie_genre_movie_id_genre_id' }),
  ],
);

export const movieKpGenre = mysqlTable(
  'movie_kp-genre',
  {
    movieId: int('movie_id')
      .notNull()
      .references(() => movie.id),
    kpGenreId: int('kp-genre_id')
      .notNull()
      .references(() => kpGenre.id),
  },
  (table) => [
    index('FK_movie_kp-genremovie_kp-genremovie').on(table.kpGenreId),
    primaryKey({ columns: [table.movieId, table.kpGenreId], name: 'movie_kp-genre_movie_id_kp-genre_id' }),
  ],
);

export const moviePeople = mysqlTable(
  'movie_people',
  {
    movieId: int('movie_id')
      .notNull()
      .references(() => movie.id),
    peopleId: int('people_id')
      .notNull()
      .references(() => people.id),
    groupId: int('group_id')
      .notNull()
      .references(() => group.id),
    order: int().default(0).notNull(),
    description: longtext(),
  },
  (table) => [
    primaryKey({
      columns: [table.movieId, table.peopleId, table.groupId],
      name: 'movie_people_movie_id_people_id_group_id',
    }),
  ],
);

export const movieVote = mysqlTable(
  'movie_vote',
  {
    id: int().autoincrement().notNull(),
    movieId: int('movie_id')
      .notNull()
      .references(() => movie.id),
    userId: int('user_id')
      .notNull()
      .references(() => user.id),
    vote: int().notNull(),
    timestamp: timestamp({ mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id], name: 'movie_vote_id' }),
    unique('movie_id_user_id').on(table.movieId, table.userId),
  ],
);

export const people = mysqlTable(
  'people',
  {
    id: int().autoincrement().notNull(),
    kpId: int('kp_id').notNull(),
    name: longtext(),
    originalName: longtext('original_name'),
    kpPhoto: longtext('kp_photo'),
    suspend: tinyint().default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.id], name: 'people_id' }), unique('kp_id').on(table.kpId)],
);

export const tgChat = mysqlTable(
  'tg_chat',
  {
    chatId: bigint('chat_id', { mode: 'number' }).notNull(),
    title: varchar({ length: 255 }).default('').notNull(),
    active: tinyint().default(1).notNull(),
    welcomeMessageId: int('welcome_message_id'),
    welcomeDirty: tinyint('welcome_dirty').default(0).notNull(),
    createdAt: datetime('created_at', { mode: 'string' })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.chatId], name: 'tg_chat_chat_id' })],
);

export const tgChatMember = mysqlTable(
  'tg_chat_member',
  {
    chatId: bigint('chat_id', { mode: 'number' }).notNull(),
    userId: int('user_id').notNull(),
    joinedAt: datetime('joined_at', { mode: 'string' })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    checkedAt: datetime('checked_at', { mode: 'string' }),
  },
  (table) => [
    index('idx_user_id').on(table.userId),
    primaryKey({ columns: [table.chatId, table.userId], name: 'tg_chat_member_chat_id_user_id' }),
  ],
);

export const tgLinkCode = mysqlTable(
  'tg_link_code',
  {
    code: varchar({ length: 32 }).notNull(),
    userId: int('user_id'),
    tgUserId: bigint('tg_user_id', { mode: 'number' }),
    tgUsername: varchar('tg_username', { length: 64 }),
    chatId: bigint('chat_id', { mode: 'number' }),
    expiresAt: datetime('expires_at', { mode: 'string' }).notNull(),
  },
  (table) => [
    index('idx_expires_at').on(table.expiresAt),
    primaryKey({ columns: [table.code], name: 'tg_link_code_code' }),
  ],
);

export const tgPost = mysqlTable(
  'tg_post',
  {
    userId: int('user_id').notNull(),
    movieId: int('movie_id').notNull(),
    chatId: bigint('chat_id', { mode: 'number' }).notNull(),
    messageId: int('message_id').notNull(),
    vote: tinyint().notNull(),
    createdAt: datetime('created_at', { mode: 'string' })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updatedAt: datetime('updated_at', { mode: 'string' })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
  },
  (table) => [
    index('idx_chat_id').on(table.chatId),
    primaryKey({ columns: [table.userId, table.movieId, table.chatId], name: 'tg_post_user_id_movie_id_chat_id' }),
  ],
);

export const tgPoster = mysqlTable(
  'tg_poster',
  {
    movieId: int('movie_id').notNull(),
    fileId: varchar('file_id', { length: 255 }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.movieId], name: 'tg_poster_movie_id' })],
);

export const user = mysqlTable(
  'user',
  {
    id: int().autoincrement().notNull(),
    username: varchar({ length: 255 }),
    token: varchar({ length: 255 }),
    avatar: varchar({ length: 255 }),
    avatarSource: varchar('avatar_source', { length: 255 }),
    gender: tinytext(),
    registrationDate: datetime('registration_date', { mode: 'string' }),
    lastSeenNotifications: timestamp('last_seen_notifications', { mode: 'string' }),
    enabled: tinyint().default(1).notNull(),
    vkontakteId: varchar('vkontakte_id', { length: 255 }),
    vkontakteToken: varchar('vkontakte_token', { length: 255 }),
    facebookId: varchar('facebook_id', { length: 255 }),
    facebookToken: varchar('facebook_token', { length: 255 }),
    hideViewed: tinyint('hide_viewed').default(0).notNull(),
    yandexId: varchar('yandex_id', { length: 255 }),
    yandexToken: varchar('yandex_token', { length: 255 }),
    inviteCode: varchar('invite_code', { length: 16 }),
    tgUserId: bigint('tg_user_id', { mode: 'number' }),
    tgUsername: varchar('tg_username', { length: 64 }),
  },
  (table) => [
    index('idx_username').on(table.username),
    primaryKey({ columns: [table.id], name: 'user_id' }),
    unique('oauth_service_vkontakte_id').on(table.vkontakteId),
    unique('oauth_service_facebook_id').on(table.facebookId),
    unique('oauth_service_yandex_id').on(table.yandexId),
    unique('invite_code_UNIQUE').on(table.inviteCode),
    unique('tg_user_id_UNIQUE').on(table.tgUserId),
  ],
);

export const userFriends = mysqlTable(
  'user_friends',
  {
    user1: int('user_1').notNull(),
    user2: int('user_2').notNull(),
    subscribed: tinyint().default(1).notNull(),
  },
  (table) => [index('idx_user_2').on(table.user2), unique('user_1_user_2').on(table.user1, table.user2)],
);

export const voteEvent = mysqlTable(
  'vote_event',
  {
    id: bigint({ mode: 'number' }).autoincrement().notNull(),
    userId: int('user_id').notNull(),
    movieId: int('movie_id').notNull(),
    vote: tinyint(),
    createdAt: datetime('created_at', { mode: 'string' })
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    processedAt: datetime('processed_at', { mode: 'string' }),
    attempts: int().default(0).notNull(),
  },
  (table) => [
    index('idx_queue').on(table.processedAt, table.createdAt),
    index('idx_user_movie').on(table.userId, table.movieId),
    primaryKey({ columns: [table.id], name: 'vote_event_id' }),
  ],
);
