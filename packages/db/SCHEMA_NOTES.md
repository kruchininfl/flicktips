# Database schema notes

Collected on 2026-10-23 with read-only queries (`SELECT`, `SHOW`, `information_schema`) through an SSH
tunnel to the server's MySQL 8.4.11. `src/schema/schema.ts` and `src/schema/relations.ts` come from
`drizzle-kit pull` against `flicktips_test`.

## Movies without kp_id

```sql
SELECT COUNT(*) total, SUM(kp_id IS NULL) no_kp, SUM(tmdb_id IS NULL) no_tmdb FROM movie;
SELECT COUNT(*) FROM movie WHERE kp_id IS NULL AND imdb_id IS NOT NULL;
```

| database       | total   | no kp_id | no tmdb_id | no kp_id but imdb_id set |
| -------------- | ------- | -------- | ---------- | ------------------------ |
| flicktips      | 102 510 | 21 231   | 0          | 2                        |
| flicktips_test | 102 498 | 21 228   | 0          | 2                        |

- About 20.7% of movies have no `kp_id`. Almost none of them have an `imdb_id` (2 rows), so IMDb is
  not a way to match them to Кинопоиск.
- `kp_id = 0` occurs nowhere; a missing id is always `NULL`.
- `tmdb_id` is never `NULL` or empty (`varchar(50) NOT NULL`, unique).

## movie and genre

`movie` (utf8mb3_unicode_ci, InnoDB):

- `tmdb_id varchar(50) NOT NULL`, `UNIQUE KEY tmdb_id`. It is a string, not an int.
- `kp_id int DEFAULT NULL`, plain `KEY kp_id` (not unique).
- `imdb_id varchar(50) DEFAULT NULL`, no index.
- `kp_release_date`, `kp_release_date_dvd`, `kp_release_date_rus` are `date DEFAULT '0000-00-00'`. The zero
  date is invalid under strict `sql_mode` (`NO_ZERO_DATE`), so v2 should treat these columns as nullable
  strings and never rely on the default.
- Text columns (`title`, `original_title`, `tmdb_overview`, `kp_*` texts…) are `longtext`, nullable.
- Counters `super`, `likes`, `neutral`, `dislikes` are `int NOT NULL DEFAULT 0`; `kp_force_check`, `suspend` are
  `tinyint(1) NOT NULL DEFAULT 0`.

`genre`: `id int AUTO_INCREMENT`, `tmdb_id int NOT NULL DEFAULT 0` with `UNIQUE KEY tmdb_id`,
`name longtext NULL`.

## Tables

`TABLE_ROWS` is the InnoDB estimate, not an exact count.

| table           | flicktips | flicktips_test | collation          |
| --------------- | --------- | -------------- | ------------------ |
| bookmark        | 138       | 138            | utf8mb3_unicode_ci |
| country         | 208       | 210            | utf8mb3_unicode_ci |
| ft_film         | 45 870    | 44 682         | utf8mb3_general_ci |
| ft_film_torrent | 195 720   | 206 487        | utf8mb3_general_ci |
| ft_quality      | 17        | 17             | utf8mb3_general_ci |
| ft_torrent      | 216 547   | 215 307        | utf8mb3_general_ci |
| ft_voice        | 12        | 12             | utf8mb3_general_ci |
| genre           | 28        | 28             | utf8mb3_unicode_ci |
| group           | 12        | 12             | utf8mb3_unicode_ci |
| kp-genre        | 33        | 33             | utf8mb3_unicode_ci |
| movie           | 88 231    | 99 238         | utf8mb3_unicode_ci |
| movie_country   | 109 478   | 120 200        | utf8mb3_unicode_ci |
| movie_genre     | 121 522   | 166 205        | utf8mb3_unicode_ci |
| movie_kp-genre  | 211 275   | 173 518        | utf8mb3_unicode_ci |
| movie_people    | 4 996 514 | 4 112 560      | utf8mb3_unicode_ci |
| movie_vote      | 1 597     | 1 599          | utf8mb3_unicode_ci |
| people          | 1 371 900 | 1 413 945      | utf8mb3_unicode_ci |
| tg_chat         | 1         | 0              | utf8mb4_0900_ai_ci |
| tg_chat_member  | 0         | 0              | utf8mb4_0900_ai_ci |
| tg_link_code    | 0         | 11             | utf8mb4_0900_ai_ci |
| tg_post         | 2         | 0              | utf8mb4_0900_ai_ci |
| tg_poster       | 2         | 0              | utf8mb4_0900_ai_ci |
| user            | 643       | 642            | utf8mb3_unicode_ci |
| user_friends    | 184       | 189            | utf8mb3_unicode_ci |
| vote_event      | 5         | 0              | utf8mb4_0900_ai_ci |

25 tables, no views. Legacy tables are utf8mb3 (emoji cannot be stored there); only the Telegram tables are
utf8mb4.

## flicktips vs flicktips_test

`information_schema.COLUMNS` (type, nullability, default, extra, key, collation) and
`information_schema.STATISTICS` (indexes) match for every table in both databases: the schema is the same,
only the data differs. The generated Drizzle schema therefore applies to production as well.

## drizzle-kit pull notes

- `title varchar(255) NOT NULL DEFAULT ''` in `tg_chat` was emitted as `.default(')` (broken string literal);
  fixed by hand to `.default('')`.
- Unused imports (`mysqlSchema`, `AnyMySqlColumn`, `foreignKey`) were removed for ESLint, and `relations.ts`
  imports `./schema.js` for `nodenext`.
- The generated SQL migration and `meta/` snapshot were deleted: the database is not managed by drizzle-kit
  migrations.
- Hyphenated tables `kp-genre` and `movie_kp-genre` become `kpGenre` and `movieKpGenre`; `group` is a reserved
  word and is quoted by Drizzle.
- The unique index on `group.type` is named `kp_id` in the database.
- Dates and timestamps are generated with `mode: 'string'`, `bigint` columns with `mode: 'number'`.

After a re-introspection the manual fixes above have to be applied again.
