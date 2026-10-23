# IndexController port (movies, people, feeds)

Ported from `api/src/Controllers/IndexController.php`, `Repositories/MovieRepository.php`,
`Repositories/PersonRepository.php` and `Services/Mapper.php`. Code: `src/routes/{movies,people,feed}.ts`
(registered together by `src/routes/index-controller.ts`), queries in `src/repositories/{movies,people,sql}.ts`,
`Mapper::group` in `src/lib/group-rows.ts`.

## Routes

| PHP route                                      | New route                            | Notes                                                 |
| ---------------------------------------------- | ------------------------------------ | ----------------------------------------------------- |
| `GET /api/`                                    | `GET /api/`                          | `{version: '0.0.1'}`                                  |
| `GET /api/search/{query}`                      | `GET /api/movies/search?query=`      | Кинопоиск search instead of TMDB multi search         |
| `GET /api/get_trends/`                         | `GET /api/movies/trends`             |                                                       |
| `GET /api/get_film/{mid}`                      | `GET /api/movies/:id`                |                                                       |
| `GET /api/get_film_votes/{mid}`                | `GET /api/movies/:id/votes`          |                                                       |
| `GET /api/update_poster/{mid}`                 | —                                    | dropped (posters come from `/poster/kp/<kp_id>.jpg`)  |
| `GET /api/get_person/{pid}`                    | `GET /api/people/:id`                |                                                       |
| `GET /api/votes/user/{uid}?page&size`          | `GET /api/users/:id/votes?page&size` | `:id` = `me` for the signed-in viewer (PHP: no `uid`) |
| `GET /api/get_last_graded_films/?page`         | `GET /api/feed/last-graded?page`     |                                                       |
| `GET /api/get_last_graded_films_friends/?page` | `GET /api/feed/friends?page`         | 401 without a viewer, as before                       |
| `GET /api/get_digital/?page&quality&voice&...` | `GET /api/movies/digital?...`        | same query params                                     |
| `GET /api/get_datasets/`                       | `GET /api/datasets`                  |                                                       |
| `GET /api/updateGenres/`                       | —                                    | dropped (TMDB genre sync)                             |

Viewer: `request.viewer` (legacy `uid` + `access-token` headers for now) replaces `getByCredentials`.

## Response shapes

Keys, nesting and types are those of the PHP responses, including PDO's habit of returning every column
without a `settype` cast as a string: in `movie.*` rows `kp_id`, `kp_start_year`, `kp_duration`,
`kp_force_check`, `suspend` … are strings (`"41519"`), in the `movie_*`-prefixed rows (feeds, person page)
`kp_id` is an int. `GET /api/people/:id` returns `person.id` as a string, `GET /api/datasets` all columns
as strings, `GET /api/users/:id/votes` the vote `timestamp` as a string, `GET /api/movies/:id/votes` the
raw `timestamp` (`'YYYY-MM-DD HH:MM:SS'`). NULL counters cast to `0`, missing groups (`genres`,
`countries`, `staff`, `votes`, `friend_votes`) are left out of the object rather than `[]`, and the viewer
flags appear exactly where the PHP had them (e.g. no `isSuper` at all for anonymous viewers on the feeds,
the person page and a user's votes; `false` defaults on the film page, trends, search and digital).

## Intentional differences from the PHP

TMDB is gone; everything it provided now comes from Кинопоиск or from columns already in the database.

- **Posters**: unchanged columns (`kp_id`, `tmdb_poster_path` where the PHP returned them); nothing new
  depends on `tmdb_poster_path`. `update_poster` is dropped.
- **Overview**: every movie object gets a new `overview` key: `kp_overview` when it is not empty, else
  `tmdb_overview` (null when both are empty). The original columns stay.
- **Trailers** (`GET /api/movies/:id`): `tmdb_trailers` keeps its shape (`["YouTube:<key>", …]`) but is
  built from `kp.getVideos(kp_id)`: YouTube links only, the key parsed from `watch?v=`, `youtu.be/`,
  `/embed/`, `/v/` URLs, duplicates removed. It is still cached in the `movie.tmdb_trailers` column (NULL =
  not fetched yet; values cached by the PHP from TMDB are in the same format and are served as is). A 404
  from Кинопоиск caches `[]`; other Кинопоиск errors return `[]` without caching; a movie without `kp_id`
  returns `[]` without caching (kp-parser may find its id later). List endpoints still return the raw
  column string, as before.
- **Search**: `kp.searchFilms({keyword, order: 'NUM_VOTE'})` (first page, up to 20 films) instead of the TMDB
  multi search. Each film is looked up by `kp_id` (lowest `movie.id` if several rows share it); missing
  ones are inserted with `tmdb_id = NULL`, `type` `movie`/`tv` (`TV_SERIES`, `MINI_SERIES`, `TV_SHOW` → `tv`,
  everything else → `movie`), `title` = nameRu ‖ nameOriginal ‖ nameEn, `original_title` = nameOriginal ‖
  nameEn, `kp_title`, `kp_original_title`, `kp_start_year`, `kp_rating_value`, `imdb_id`,
  `imdb_rating_value`, the year as `release_date` (movies) or `first_air_date` (tv) — the pages only take
  the year from these — and the Кинопоиск genres (`kp-genre` / `movie_kp-genre`) and countries
  (`country` / `movie_country`) the way kp-parser and ft-parser store them. Existing rows are not updated
  (the PHP refreshed `tmdb_popularity`). kp-parser later fills the rest because the rows have a `kp_id`.
  When Кинопоиск fails the route answers `502 {success: false, msg: 'Kinopoisk is unavailable'}` (PHP: 500).
  An empty query answers `{total: 0, results: []}` without calling Кинопоиск.
- **TV detection**: the `type` column is returned as before (`'movie'` / `'tv'`); `tmdb_id` stays in the
  payload as is (NULL for KP-only movies), so nothing should parse the `tv_` prefix any more.
- **Genres**: a movie's TMDB genres (`genre` / `movie_genre`); a movie with none gets its Кинопоиск genres
  (`kp-genre` / `movie_kp-genre`), whose `id` is then a `kp-genre` id. Ordered by id. `updateGenres` is
  dropped.
- **Digital releases**: ordered by first torrent date, then `movie.id DESC` (PHP: `tmdb_id DESC`). The
  movies are looked up by `movie.id` instead of `tmdb_id`. The debug key `results.sth` (the SQL text) is no
  longer returned. `pages` uses `DIGITAL_LIST_SIZE` (24, same value as the `HOME_LIST_SIZE` the PHP used).
- `GET /api/people/search?q=` (new) answers `{success, results}` for the search's «Люди»: up to 5 people
  whose Russian or original name contains `q` (2 characters or more), prefix matches first, then more movies.
  Each is `{id, name, original_name, kp_photo, role, movies_count}`, `role` being the `title_singular` of the
  group with the most movies. Suspended people and movies are left out.
- `GET /api/users/:id/votes` takes a new optional `vote=super|like|neutral|dislike`: only the votes of
  that kind (`total` and `pages` count those too).
- `GET /api/users/me/votes` without a viewer: `401 {success: false, msg: 'Access denied'}` (PHP: 200 with
  the same body).
- Malformed ids (`/api/movies/abc`) answer `404 {success: false, msg: 'Not found'}`; malformed `page` /
  `size` answer 400 (PHP: SQL errors or PHP warnings).
- Internal grouping keys are not returned: `votes_field_group` on the film page (it held whatever the
  last joined row had).

## Bugs fixed on the way

- All SQL is parameterized (the PHP concatenated `mid`, `pid`, user ids and the search results into SQL).
- `GET /api/people/:id` took the viewer's bookmarks from user 1 (`bookmark.user_id=1`); now the viewer's.
- `votes/user/` without `uid` counted the votes of user `''`, so it always returned an empty list; `me`
  now lists the viewer's votes.
- `votes/user/{uid}` took the viewer flags from the unverified `uid` header (no token check); now
  `request.viewer`.
- The film page's staff kept a blank `{id: 0, name: null, …}` entry for suspended people; they are now
  left out.
- Film page with deleted users: their votes collapsed into one entry; votes of missing users are now skipped.
- Friend votes on search/digital results (`votes` key) were never sorted (the PHP sorted a key that did not
  exist); they are newest first now, like everywhere else. All nested lists have a stable order
  (`ORDER BY` with tie-breakers) instead of MySQL's join order.
- Feeds for `hide_viewed` users: `total` counted movies voted by other users, while the list leaves out
  the movies the viewer voted on; `total` now counts the movies the list can contain.
- `get_digital` checked `date_from` instead of `date_to` before using `date_to`.
- Queries that relied on `ONLY_FULL_GROUP_BY` being off (`movie_vote.*` with `GROUP BY movie_id`, the
  torrent subquery) are rewritten to select only grouped or aggregated columns.
