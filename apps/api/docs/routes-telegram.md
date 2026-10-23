# Telegram routes

Port of `api/src/Controllers/TelegramController.php` and `api/src/Repositories/TelegramRepository.php`
(except `queueVote`, which moves with the vote route). Code: `src/routes/telegram.ts`,
`src/repositories/telegram.ts`. Tests: `src/routes/telegram.test.ts`.

| Old (PHP)                                   | New (Fastify)                            |
| ------------------------------------------- | ---------------------------------------- |
| `GET /api/user/telegram/`                   | `GET /api/me/telegram`                   |
| `POST /api/user/telegram/link/`             | `POST /api/me/telegram/link`             |
| `POST /api/user/telegram/confirm/`          | `POST /api/me/telegram/confirm`          |
| `DELETE /api/user/telegram/groups/{chatId}` | `DELETE /api/me/telegram/groups/:chatId` |
| `DELETE /api/user/telegram/`                | `DELETE /api/me/telegram`                |

Bodies, params and response JSON are unchanged: `{success, linked, username, botUsername, groups[]}`,
`{success, code, startUrl, groupUrl}`, `{success, group}`, `{success}`; 401 is
`{success:false, msg:'authorization required'}`, an unknown/expired confirm code is 404
`{success:false, err:'Code not found or expired'}`. Group items are `{chat_id: string, title, active: boolean}`.

## «Что публиковать» (new, migration 004)

- `GET /api/me/telegram` also answers `publish`: the votes the bot posts, from `dislike`, `neutral`, `like`, `super`
  (all of them unless changed).
- `PATCH /api/me/telegram` with `{publish: [...]}` changes them and answers `{success, publish}`; anything but a list
  of those names is 400.
- Stored in `user.tg_publish_votes`, bit `1 << movie_vote.vote`. The bot (`apps/tg-bot/src/publisher.ts`) skips a vote
  whose bit is off, like a removed vote: its earlier posts stay as they are.

## Chat ids

`tg_chat.chat_id` is `bigint`. Responses carry it as a string (as PHP did). Queries pass the id from the
URL as a string parameter and read it back with `CAST(... AS CHAR)`, so values beyond 2^53 are never
rounded by a JS number. `chatId` is validated as `-?\d+`.

## Intentional differences

- Paths: `/api/user/telegram/...` becomes `/api/me/telegram...` (no trailing slash).
- Auth comes from `request.viewer` (`requireViewer`) instead of `getByCredentials`; same 401 body.
- `confirm`: the code is read from the JSON body, or from the query string when the body has none (PHP's
  `Request::get` also read form-encoded bodies, which Fastify does not parse; the web client sends JSON).
- `confirm` runs the whole flow, including joining the group and marking the welcome message dirty, in one
  transaction (PHP committed the account link first and joined the group afterwards).
- `leaveGroup` and `unlink` run in a transaction (PHP issued separate statements).
- `DELETE /groups/:chatId` with a non-integer id answers 404 `{success:false, err:'Not found'}` (PHP: Silex
  route mismatch, 404). Auth is checked first for valid ids, as before.
- An empty body with `Content-Type: application/json` is accepted on these routes (PHP ignored it; Fastify's
  default parser would answer 400); malformed JSON gives 400 `{success:false, msg}`.
- Link code format is unchanged (16 hex chars, 15 minute TTL via `DATE_ADD(NOW(), ...)`), so the bot reads
  the rows exactly as before.
