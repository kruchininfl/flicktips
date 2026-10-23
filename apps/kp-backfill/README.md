# kp-backfill

Fills `movie.kp_id` for the movies that have none, so the v2 API can work from Кинопоиск
(kinopoiskapiunofficial.tech) alone. In production 21 231 of 102 510 movies have `kp_id IS NULL` and almost
none have an `imdb_id` (see `packages/db/SCHEMA_NOTES.md`), so they are matched by title + year + kind
(film / series), the same way kp-parser searches, with `bestMatch` from `@flicktips/kinopoisk`. It also fixes
the `kp_id`s that several movies share, so that `movie.kp_id` can get a `UNIQUE` key.

**Dry run is the default**: `match`, `duplicates` and `dedupe-plan` write reports and nothing else. Only
`match --apply` and `apply-report` set `kp_id`, and only on a row where it is still `NULL`, never to a `kp_id`
another movie already has (those rows are reported as `duplicate`). Only `dedupe-apply` clears `kp_id`, on the
movies a reviewed plan names, after checking that nothing changed since the plan. No command deletes a movie.

## Commands

| command                        | DB access             | Кинопоиск | what it does                                                   |
| ------------------------------ | --------------------- | --------- | -------------------------------------------------------------- |
| `match`                        | read                  | yes       | search every movie with `kp_id NULL`, write the report         |
| `match --apply`                | read + `UPDATE kp_id` | yes       | the same, and write `kp_id` for `confident` matches            |
| `apply-report <dry-run.jsonl>` | read + `UPDATE kp_id` | no        | write the `confident` rows of a (reviewed) dry-run report      |
| `duplicates`                   | read                  | optional  | movies sharing a `kp_id`, their usage and which one keeps it   |
| `dedupe-plan`                  | read                  | optional  | per shared `kp_id`: the movie that keeps it, the ones to clear |
| `dedupe-apply <plan.jsonl>`    | read + `UPDATE kp_id` | no        | clear `kp_id` on the `auto_safe` / approved groups of a plan   |

`node apps/kp-backfill/dist/cli.js --help` lists every option. The main ones for `match`:

- `--skip-errored` — skip movies kp-parser already marked with `kp_error` (`not_found`, `search_error`). By
  default they are searched too: in production every one of the 21 231 movies with `kp_id NULL` has
  `kp_error='not_found'`, so skipping them selects nothing. (`--include-errored`, the old opt-in, is still
  accepted and changes nothing.) A checkpoint written without `--include-errored` by an older version is
  refused with a hint: resume it with `--skip-errored`, or start over with `--restart`.
- `--batch-size 100` — movies per batch; the checkpoint is written after every batch.
- `--concurrency 2`, `--rps 4` — movies searched at once, Кинопоиск requests per second. The client also
  retries 429/5xx with back-off.
- `--limit N` — stop after N movies; `--max-requests N` — stop before going over N requests (daily quota).
- `--from-id`, `--max-id`, `--ids 1,2,3` — choose the movies; `--restart` — ignore the checkpoint and start
  new report files; `--out-dir` (default `./kp-backfill-out`; every `kp-backfill-out*` directory is
  git-ignored).

`duplicates` and `dedupe-plan` take `--fetch-kp` (see below), with `--max-requests` and `--rps`.

Environment: `DB_NAME` (required, no default on purpose), `DB_HOST` (`127.0.0.1`), `DB_PORT` (`3306`),
`DB_USER` (`flicktips`), `DB_PASSWORD`, and `KP_API_KEY` for `match` and `--fetch-kp`. Nothing prints them; the
tool logs `user@host:port/database (password set)` only.

Exit codes: 0 done or stopped by `--limit`/`--max-requests`/Ctrl-C, 2 stopped by a Кинопоиск error
(401/402/403: bad key or quota used up) or 5 failed searches in a row, 64 bad arguments, 1 other errors
(also `dedupe-apply` when a group failed with a database error).

## How a match is classified

For each movie the tool searches `GET /api/v2.2/films?keyword=…&yearFrom=year-2&yearTo=year+2` with the
original title, and if that gives no confident match, with the Russian title (" (сериал)" removed). The year
comes from `release_date` (films) or `first_air_date` (series); the kind from `movie.type` (`movie` → `FILM`,
`tv` → `TV_SERIES`/`MINI_SERIES`/`TV_SHOW`).

`bestMatch` (Dice similarity of title bigrams, ±2 years, same kind, similarity ≥ 0.8) picks the candidate;
among equally similar candidates the one closest in year wins. Both are in `packages/kinopoisk/src/match.ts`, so
the API's search uses the same rules. Titles are normalised before they are compared: case, `ё`/`е`,
punctuation, ellipses, quotes and dashes do not count, and Roman numerals II–XIII read as digits
(`Прощай, любимая...` = `Прощай, любимая`, `Rocky II` = `Rocky 2`). Titles whose numbers differ (`Матрица` vs
`Матрица 4`) get 0.7 × their similarity, which keeps a sequel below 0.8. Then:

- **confident** — all of: similarity ≥ 0.9 and the same year, or similarity ≥ 0.97 and the year off by 1;
  the movie has a year and a type; no other candidate within 0.05 similarity that is as close in year. An
  equal `imdb_id` is confident on its own.
- **ambiguous** — a candidate passed `bestMatch` but one of the rules above failed; `reasons` says which. Also
  **`kind_mismatch`** (then the first reason): no result of the right kind matched, but one has the exact title
  and the same year and is of the other kind — our `movie` vs Кинопоиск `MINI_SERIES`/`TV_SERIES`, or our `tv`
  vs `FILM` (about 11 in 200 in production). Its `kp_id` is in the row and in the candidates for a human to
  check; it is never confident, so `apply-report` does not write it. To accept one, set its `status` to
  `confident` in the reviewed JSONL.
- **not_found** — no results, or none passed `bestMatch`; `reasons` names the closest result and how many
  similar titles were excluded for kind or year.

Thresholds are in `src/classify.ts` (`DEFAULT_THRESHOLDS`).

## Duplicate kp_ids: dedupe-plan and dedupe-apply

In production 2 324 `kp_id`s are shared by 5 115 movies (up to 7 per `kp_id`). They are not the same film
imported twice (no group shares a `tmdb_id`, and votes/bookmarks almost never sit on two movies of a group):
mostly kp-parser gave making-ofs, namesakes and films of another year the `kp_id` of a better known film. So
the fix is not a merge: one movie keeps the `kp_id`, the others lose it and are searched again.

**Which movie keeps it** (`src/dedupe-score.ts`). The Кинопоиск film is what kp-parser stored on the rows
(`kp_title`, `kp_original_title`, the year from `kp_start_year` or `kp_release_date`; the most common value in
the group). With `--fetch-kp` the film is fetched from Кинопоиск for the groups where the database has no
title or no year (one request per group, cached in `<out-dir>/kp-films.json`); only a fetched film has a kind.
Each movie scores its best title similarity to the film (both its titles, the same normalisation as `match`),
+0.3 for the same year, +0.15 for a year off by 1, −0.3 for more than 2 years off, +0.1 / −0.2 for the same /
another kind. The highest score keeps the `kp_id`; votes + bookmarks only break ties, then not suspended, has a
TMDb id, oldest. For kp 316, 57250 «Матрица: Революция» (The Matrix Revolutions) keeps it and 19475 "The Rev"
(2002) loses it, although it is older.

A group is **`auto_safe`** when the keep matches well (title ≥ 0.9, year at most 1 off, kind not different),
scores at least 0.1 more than every other movie of the group, and the movies that lose the `kp_id` have no
votes and no bookmarks. Otherwise it is **`needs_review`**, and `reasons` says why: usage on a movie that would
lose the `kp_id`, no movie matching the film well, no clear winner (e.g. two equal titles of the same year), or
no Кинопоиск title to compare with (run with `--fetch-kp`). `duplicates` shows the same keep and status
(`suggest_keep`, `group_status`).

**`dedupe-plan`** is read-only and writes `dedupe-plan.csv` (one row per movie, for reading) and
`dedupe-plan.jsonl`, one line per `kp_id`: `kpId`, `kp` (the film compared with, and whether it came from the
`db` or the `api`), `status`, `approve` (`false`), `keepId`, `clearIds` (every other movie of the group),
`reasons`, and the `movies` with their scores, usage and a `note`. The log prints how many groups are
`auto_safe` and how many `needs_review`.

**`dedupe-apply <plan.jsonl>`** applies the `auto_safe` lines and the lines a human set to `"approve": true`
(after checking or changing `keepId`; `clearIds` must then be every other movie of the group) and refuses the
rest (`not_approved`). Each group is one transaction: it locks the rows and checks that every movie of the plan
still exists with the same `tmdb_id`, the keep and the movies to clear still have the planned `kp_id`, no other
movie has got that `kp_id` since, and the movies to clear have no more votes/bookmarks than in the plan (none,
for `auto_safe`). Otherwise the group is refused as `changed` (`invalid_plan` for an inconsistent line,
`wrong_database` for a plan made on another `DB_NAME`) and nothing of it is written. The report is
`dedupe-apply.csv` / `.jsonl`; the JSONL keeps the cleared columns as they were (`before`), to undo a group by
hand. Re-running the same plan is safe: applied groups are reported as `already_applied`.

A cleared movie gets the state kp-parser writes when its search finds nothing (`insertError` in
`kp-parser/app.js`): `kp_id NULL`, `kp_error='not_found'`, `kp_check_date` today, `kp_force_check 0`, and the
Кинопоиск columns of the wrong film (`kp_title`, `kp_original_title`, ratings, dates, overview, duration)
`NULL`. kp-parser does not read `kp_error`: it searches a movie again once its `kp_check_date` is 7 days old, so
it re-checks these a week later, and `match` (which takes `kp_error` rows by default now) can search them at
once. Their `movie_country`, `movie_kp-genre` and `movie_people` rows are left alone; kp-parser rewrites or
deletes them on that re-check.

## UNIQUE key on movie.kp_id

`packages/db/migrations/003-movie-kp-id-unique.sql` replaces the plain `kp_id` index with a `UNIQUE KEY`. It is
marked `-- status: pending`: it is not applied anywhere, and the test databases skip it. The sequence:

1. `dedupe-plan` → review → `dedupe-apply`, repeated until `duplicates` logs `0 kp_ids are shared`.
2. Make kp-parser cope with a duplicate key first. Today its `updateFilm` catches the error, logs it and goes
   on without touching `kp_check_date`, so it would pick the same movie again at once, forever, spending
   Кинопоиск requests each time; and its loose title search, which produced most of the wrong `kp_id`s, will
   find some of them again for the cleared movies a week later. On `ER_DUP_ENTRY` it should call
   `insertError(id, 'not_found')` (or a new `duplicate_kp_id`). The same check applies to the other writers
   of `kp_id` (ft-parser's `insertMyMovie`, the v2 API); kp-backfill never writes a `kp_id` in use.
3. Right before applying: `SELECT kp_id, COUNT(*) FROM movie WHERE kp_id IS NOT NULL GROUP BY kp_id HAVING
COUNT(*) > 1;` must return nothing (otherwise the `ALTER` fails and changes nothing).
4. Apply by hand to `flicktips_test`, then to `flicktips` (it rebuilds the table, ~100 000 rows):
   `mysql flicktips < packages/db/migrations/003-movie-kp-id-unique.sql`.
5. In one commit: delete the `-- status: pending` line (the test databases then get the key too) and change
   `index('kp_id')` to `unique('kp_id')` on `movie` in `packages/db/src/schema/schema.ts`.

Rollback: `ALTER TABLE movie DROP INDEX kp_id, ADD KEY kp_id (kp_id);`.

## Reports

All in `--out-dir`. CSV files start with a UTF-8 BOM, so Numbers/Excel show Cyrillic.

- `match-dry-run.csv` / `.jsonl` (`match-apply.*` with `--apply`, `match-*-ids.*` with `--ids`): one row per
  movie: `status` (`confident` / `ambiguous` / `not_found` / `error`), `action` (`would_apply`, `applied`,
  `duplicate`, `kp_id_already_set`, `skipped`, `error`), the chosen `kp_id`, similarity, year difference,
  Кинопоиск name/year/type, a kinopoisk.ru link, `conflict_movie_ids` for duplicates, `reasons` and the other
  candidates. The JSONL has the same data with every candidate.
- `match-dry-run.checkpoint.json`: the last movie id done, the database and the totals. A run resumes from it
  automatically; it refuses a checkpoint made for another host/database (use `--restart` or another
  `--out-dir`). Reports are appended, so after a crash a batch can appear twice; the later line wins.
- `apply-report.csv` / `.jsonl`: what `apply-report` did with each confident row.
- `duplicates.csv` (one row per movie) and `duplicates.jsonl` (one line per `kp_id`): `votes`
  (`movie_vote`), `bookmarks`, `tg_posts`, the vote counters of the row, `group_shared_voters` /
  `group_shared_bookmarkers` (users who voted for / bookmarked several movies of the group), and
  `suggest_keep`, `group_status`, `title_similarity`, `score`, `group_reasons` as in `dedupe-plan`.
- `dedupe-plan.*`, `dedupe-apply.*` (above); `kp-films.json`, the films `--fetch-kp` fetched.

## Build

```sh
pnpm install
pnpm --filter @flicktips/kp-backfill... build
```

## Tests

Unit tests cover the title normalisation, the classification and the dedupe scoring; the integration tests run
`match`, `--apply`, resume, `apply-report`, `duplicates`, `dedupe-plan` (with a fake `--fetch-kp` client),
`dedupe-apply` with its refusals, and migration 003 on throwaway databases with a fake Кинопоиск client (no
network):

```sh
docker run -d --name ft-mysql -e MYSQL_ROOT_PASSWORD=test -p 3307:3306 mysql:8.4   # once
TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3307 TEST_DB_PASSWORD=test pnpm --filter @flicktips/kp-backfill test
```

## Running against production from the Mac

Production MySQL listens on the server's `127.0.0.1:3306`. Forward it to local port 3307 (the same tunnel
`tools/local.sh` uses; if it is already open for the local stack, reuse it) and run from the repo root. The
order is: duplicates and the dedupe plan → small dry run → full dry run → review → apply. The duplicates can be
resolved independently of the matching.

```sh
# 1. Tunnel (keep this terminal open)
ssh -N -L 3307:127.0.0.1:3306 root@45.15.252.159

# 2. In another terminal, from the repo root: build and set the environment. The secrets are read from the
#    server's .env straight into variables, so they never reach the terminal or the shell history. The values
#    there are quoted (DB_PASSWORD="..."): server_env strips one pair of surrounding "…" or '…' (and a CR).
pnpm install && pnpm --filter @flicktips/kp-backfill... build
server_env() {
  ssh root@45.15.252.159 "grep -E '^$1=' /var/www/flicktips.ru/.env | tail -n 1" |
    cut -d= -f2- | tr -d '\r' | sed -E "s/^\"(.*)\"\$/\1/; s/^'(.*)'\$/\1/"
}
export DB_HOST=127.0.0.1 DB_PORT=3307 DB_NAME=flicktips
export DB_USER="$(server_env DB_USER)"
export DB_PASSWORD="$(server_env DB_PASSWORD)"
export KP_API_KEY="$(server_env KP_API_KEY)"
for v in DB_USER DB_PASSWORD KP_API_KEY; do [ -n "$(printenv $v)" ] || echo "$v is empty"; done

# 3. Read-only: movies that already share a kp_id, and the plan to fix them (see "Duplicate kp_ids")
node apps/kp-backfill/dist/cli.js duplicates
node apps/kp-backfill/dist/cli.js dedupe-plan
open kp-backfill-out/dedupe-plan.csv

# 4. Dry run on a sample, then look at the CSV (filter by status, check the kinopoisk.ru links)
node apps/kp-backfill/dist/cli.js match --limit 200 --restart
open kp-backfill-out/match-dry-run.csv

# 5. Full dry run. It resumes from the checkpoint, so it can run over several days within the key's quota:
#    run the same command again each day (adjust --max-requests to the plan of the key).
node apps/kp-backfill/dist/cli.js match --max-requests 450

# 6. Apply the reviewed dry run without searching again. To leave a match out, delete its line from a copy
#    of the JSONL (the CSV is only for reading). Re-running is safe: rows already set are skipped.
cp kp-backfill-out/match-dry-run.jsonl kp-backfill-out/reviewed.jsonl
node apps/kp-backfill/dist/cli.js apply-report kp-backfill-out/reviewed.jsonl
```

The duplicates, in their own out dir:

```sh
# a. Plan. --fetch-kp fetches the film of the groups the database knows too little about (uses the quota):
#    run it again on the next days until the log says it fetched them all; kp-films.json keeps what it has.
node apps/kp-backfill/dist/cli.js dedupe-plan --fetch-kp --max-requests 400 --out-dir kp-backfill-out-dedupe
open kp-backfill-out-dedupe/dedupe-plan.csv     # filter status = needs_review; check the kinopoisk.ru links

# b. Review: in a copy of the JSONL, set "approve": true on the needs_review lines whose keepId is right
#    (change keepId and clearIds first if another movie should keep it). auto_safe lines need nothing.
cp kp-backfill-out-dedupe/dedupe-plan.jsonl kp-backfill-out-dedupe/reviewed.jsonl

# c. Apply (auto_safe + approved only; groups that changed since the plan are refused), then check
node apps/kp-backfill/dist/cli.js dedupe-apply kp-backfill-out-dedupe/reviewed.jsonl --out-dir kp-backfill-out-dedupe
node apps/kp-backfill/dist/cli.js duplicates --out-dir kp-backfill-out-dedupe
```

The groups left after that (refused as `changed`, or not approved) need a new `dedupe-plan` and another review.

To try the whole flow on `flicktips_test` first, use `DB_NAME=flicktips_test` and a separate `--out-dir`: the
checkpoint refuses to mix databases, `apply-report` skips rows whose `tmdb_id` differs (`movie_changed`), and
`dedupe-apply` refuses a plan made on another `DB_NAME` (`wrong_database`), so a production report cannot be
applied to the test database by mistake.

`match --apply` (search and write in one go) also exists, with its own checkpoint `match-apply.checkpoint.json`;
it spends the quota again, so prefer dry run + `apply-report` for production.

Ctrl-C once lets the searches in flight finish and writes them and the checkpoint; twice quits at once.

## Notes

- The Кинопоиск quota is per day and per key, and depends on the key's plan; 21 231 movies need 1–2 requests
  each. Requests stop with exit code 2 on 402 (quota used up); run the same command the next day.
- The tool writes `kp_id` only. kp-parser picks the rows up on its next pass (it rechecks rows older than 7
  days and uses an existing `kp_id`), which fills `kp_title`, ratings, staff and clears `kp_error`.
- Two movies of one `match` run matching the same `kp_id`: the first one gets it, the second is reported as
  `duplicate` with the first one's id, for a human to look at.
