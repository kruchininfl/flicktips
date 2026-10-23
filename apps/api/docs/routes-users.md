# User routes: PHP → v2

Port of `api/src/Controllers/UserController.php` (with `UserRepository`, `Mapper::group` and
`TelegramRepository::queueVote`) to `apps/api/src/routes/users.ts`. Repositories:
`src/repositories/users.ts`, `votes.ts`, `bookmarks.ts`; `Mapper::group` is `src/lib/group-rows.ts`.

Auth is the `ft_session` cookie (`request.viewer`, see `auth.md`; stage 3 used the legacy `uid` + `access-token`
headers). A route that needs a viewer answers `401 {success: false, msg: 'authorization required'}`, as PHP did.

## Route mapping

Query parameters and JSON body fields keep their PHP names.

| PHP                                | v2                                  | params / body                               |
| ---------------------------------- | ----------------------------------- | ------------------------------------------- |
| `GET /api/user/{uid}`              | `GET /api/users/:id`                |                                             |
| `PUT /api/user/`                   | `PATCH /api/me`                     | `{data: {hide_viewed}}`                     |
| `GET /api/user/friends/`           | `GET /api/me/friends`               | `?page&size&type=following\|followers`      |
| `GET /api/user/friends_votes/`     | `GET /api/me/friends/votes`         | `?page&size`                                |
| `GET /api/user/bookmarks/`         | `GET /api/me/bookmarks`             | `?page&size`                                |
| `POST /api/user/vote/`             | `POST /api/me/votes`                | `{id, vote: super\|like\|neutral\|dislike}` |
| `POST /api/user/toggle_bookmark/`  | `POST /api/me/bookmarks/toggle`     | `{movieId}`                                 |
| `POST /api/user/toggle_subscribe/` | `POST /api/me/subscriptions/toggle` | `{friendId}`                                |
| `POST /api/user/subscribe/`        | `POST /api/me/subscriptions`        | `{userId, subscribed}`                      |
| `GET /api/user/invite/`            | `GET /api/me/invite`                |                                             |
| `POST /api/user/accept_invite/`    | `POST /api/me/invite/accept`        | `{code}`                                    |
| `GET /api/invite/{code}`           | `GET /api/invites/:code`            |                                             |
| `GET /api/user/recommendations/`   | `GET /api/me/recommendations`       |                                             |
| `GET /api/users/search/`           | `GET /api/users/search`             | `?q=` (kept from PHP, not `query`)          |
| `GET /api/user/accounts/`          | `GET /api/me/accounts`              |                                             |

Not here: `GET /api/checkUser/`, OAuth, `/api/user/accounts/{link,merge,unlink}/` (stage 4, sign-in);
`GET /api/votes/user/{uid}` (movie routes); `/api/user/telegram/*` (Telegram routes).

## Response shapes

Same keys, nesting and types as PHP after its `settype` calls. PDO (emulated prepares) fetched every column
as a string, so fields PHP never cast are strings here too (`src/lib/pdo-rows.ts`): for example `kp_id`,
`kp_duration`, `kp_start_year`, `suspend` in bookmarks, and `friendId` / `subscribed` (`"0"`/`"1"`) from
`toggle_subscribe`. `pages` is `Math.ceil(total / size)` (PHP's `ceil` float serializes to the same JSON
number). Groups from `Mapper::group` (`genres`, `friend_votes`, `movie.genres`) are left out when empty,
as before.

Кинопоиск fields (TMDB is going away): bookmarks return every `movie` column as PHP's `movie.*` did, which
includes `kp_id` and `kp_overview`; friends' votes now also return `movie.kp_overview` (PHP had only
`movie.kp_id`). The `tmdb_*` columns stay as PHP returned them.

## Intentional differences from PHP

- **Validation.** Bodies and queries are checked with zod; bad input answers
  `400 {success: false, msg}` instead of PHP notices, SQL errors or 500s: `id` / `movieId` / `friendId` /
  `userId` must be positive integers (number or numeric string); `vote` must be one of the four names;
  `subscribed` and `hide_viewed` take `true/false/1/0/"1"/"0"` (PHP's `(bool) "false"` was `true`);
  `page` / `size` must be non-negative integers (missing, `''` and `0` mean the default, as PHP's `?:`).
  `size` is capped at 100 (PHP had no limit). Values are read from the JSON body only (Silex `get()` also
  looked at the query string).
- **Unknown movies.** `POST /api/me/votes` and `/api/me/bookmarks/toggle` answer
  `404 {success: false, err: 'Movie not found'}`; PHP failed on the foreign key with a 500 in both cases. The vote 500 for other DB errors keeps `{success: false, msg: 'something went
wrong'}` but no longer includes the `error` object.
- **Vote toggle is atomic.** PHP read the current vote outside its transaction. Now the movie row and the
  vote row are locked (`SELECT … FOR UPDATE`) inside one transaction with the `movie_vote` write and the
  `movie.super/likes/neutral/dislikes` update, so parallel toggles cannot double count. The `vote_event`
  row for tg-bot is written after the commit, exactly as `queueVote` did (same columns: `user_id`,
  `movie_id`, `vote` = new value 0–3 or `NULL` when removed; only for members of an active `tg_chat`); its
  failure is logged and does not fail the vote.
- **Bookmark toggle** deletes first and inserts (`INSERT IGNORE`) only when nothing was deleted, instead of
  SELECT then DELETE/INSERT; same result, no duplicate-key error on double clicks.
- **Friends' votes.** PHP's derived table `LEFT JOIN`ed `movie_vote`, so a followed user without votes
  produced one garbage entry (all `movie`/`user` fields `0`/`null`, key `""`) at the end of the list.
  It is an inner join now. Rows are ordered explicitly (`timestamp DESC, id DESC`); PHP relied on the join
  order of its derived table. Page N still returns all entries from the first one up to the end of page N
  (`LIMIT size * page OFFSET 0`), and the call still sets `last_seen_notifications = NOW()` when there is
  at least one vote.
- **Bookmarks.** The outer query is ordered by bookmark time (`DESC`, then bookmark id) — PHP had no outer
  `ORDER BY`. The ungrouped helper column `friends_votes_group_id` that leaked into every movie object
  (with the value of an arbitrary last row) is gone; grouping uses (movie id, friend id) as before.
- **Invite codes.** A user whose `invite_code` is `''` (not `NULL`) made PHP recurse forever; the empty
  string now counts as missing and gets replaced. An empty `code` in `accept` / `GET /invites/:code` is
  "not found" (PHP matched users whose code was `''`).
- **Profile numbers (new).** `GET /api/users/:id/stats` answers `{success, stats: {votes: {super, like,
neutral, dislike}, friends, bookmarks?}}` for the profile header: votes per kind, mutual follows, and the
  bookmark count only on the viewer's own profile.
- **Profile id.** `GET /api/users/:id` answers 404 for a non-numeric id (MySQL cast `'12abc'` to 12).
- **Search** keeps `q`, PHP `trim` (ASCII whitespace only) and the 2–64 character window counted in code
  points (`mb_strlen` / `mb_substr`).
- **`PATCH /api/me`** returns the same `data` as PHP's `getByCredentials` (`id, username, avatar, gender,
registration_date, new_notifications, hide_viewed`), loaded by id; `new_notifications` counts votes of
  followed users newer than `last_seen_notifications` with a `COUNT(*)` subquery instead of the
  `SUM(IF(…))` over a join (same number).
- All SQL is parameterized (PHP inlined the excluded ids in `getRecommendations` and column names in the
  vote counter update).
