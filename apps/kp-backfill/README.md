# kp-backfill

Fills `movie.kp_id` for the movies that have none, so the v2 API can work from Кинопоиск
(kinopoiskapiunofficial.tech) alone. In production 21 231 of 102 510 movies have `kp_id IS NULL` and almost
none have an `imdb_id` (see `packages/db/SCHEMA_NOTES.md`), so they are matched by title + year + kind
(film / series), the same way kp-parser searches, with `bestMatch` from `@flicktips/kinopoisk`.

**Dry run is the default**: `match` writes a report and nothing else. Only `match --apply` and `apply-report`
write, and they only ever set `kp_id` on a row where it is still `NULL`, never to a `kp_id` another movie
already has (those rows are reported as `duplicate`).

## Commands

| command                        | DB access             | Кинопоиск | what it does                                                     |
| ------------------------------ | --------------------- | --------- | ---------------------------------------------------------------- |
| `match`                        | read                  | yes       | search every movie with `kp_id NULL`, write the report           |
| `match --apply`                | read + `UPDATE kp_id` | yes       | the same, and write `kp_id` for `confident` matches              |
| `apply-report <dry-run.jsonl>` | read + `UPDATE kp_id` | no        | write the `confident` rows of a (reviewed) dry-run report        |
| `duplicates`                   | read                  | no        | movies sharing a `kp_id`, with their votes/bookmarks, for merges |

`node apps/kp-backfill/dist/cli.js --help` lists every option. The main ones for `match`:

- `--include-errored` — also take movies kp-parser already marked with `kp_error` (`not_found`,
  `search_error`); by default they are skipped, since kp-parser's search already failed on them.
- `--batch-size 100` — movies per batch; the checkpoint is written after every batch.
- `--concurrency 2`, `--rps 4` — movies searched at once, Кинопоиск requests per second. The client also
  retries 429/5xx with back-off.
- `--limit N` — stop after N movies; `--max-requests N` — stop before going over N requests (daily quota).
- `--from-id`, `--max-id`, `--ids 1,2,3` — choose the movies; `--restart` — ignore the checkpoint and start
  new report files; `--out-dir` (default `./kp-backfill-out`, git-ignored).

Environment: `DB_NAME` (required, no default on purpose), `DB_HOST` (`127.0.0.1`), `DB_PORT` (`3306`),
`DB_USER` (`flicktips`), `DB_PASSWORD`, and `KP_API_KEY` for `match`. Nothing prints them; the tool logs
`user@host:port/database (password set)` only.

Exit codes: 0 done or stopped by `--limit`/`--max-requests`/Ctrl-C, 2 stopped by a Кинопоиск error
(401/402/403: bad key or quota used up) or 5 failed searches in a row, 64 bad arguments, 1 other errors.

## How a match is classified

For each movie the tool searches `GET /api/v2.2/films?keyword=…&yearFrom=year-2&yearTo=year+2` with the
original title, and if that gives no confident match, with the Russian title (" (сериал)" removed). The year
comes from `release_date` (films) or `first_air_date` (series); the kind from `movie.type` (`movie` → `FILM`,
`tv` → `TV_SERIES`/`MINI_SERIES`/`TV_SHOW`).

`bestMatch` (Dice similarity of title bigrams, ±2 years, same kind, similarity ≥ 0.8) picks the candidate; among
equally similar candidates the one closest in year wins. Then:

- **confident** — all of: similarity ≥ 0.9 and the same year, or similarity ≥ 0.97 and the year off by 1;
  the movie has a year and a type; the numbers in the two titles are the same (`Матрица` vs `Матрица 4` is
  0.92 similar); no other candidate within 0.05 similarity that is as close in year. An equal `imdb_id` is
  confident on its own.
- **ambiguous** — a candidate passed `bestMatch` but one of the rules above failed; `reasons` says which.
- **not_found** — no results, or none passed `bestMatch`; `reasons` names the closest result and how many
  similar titles were excluded for kind or year.

Thresholds are in `src/classify.ts` (`DEFAULT_THRESHOLDS`).

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
  `group_shared_bookmarkers` (users who voted for / bookmarked several movies of the group, which a merge must
  resolve because those tables are unique per movie and user) and `suggest_keep` (most used, not suspended,
  has a TMDb id, oldest — only a hint).

## Build

```sh
pnpm install
pnpm --filter @flicktips/kp-backfill... build
```

## Tests

Unit tests cover the classification; the integration test runs `match`, `--apply`, resume, `apply-report`
and `duplicates` on a throwaway database with a fake Кинопоиск client (no network):

```sh
docker run -d --name ft-mysql -e MYSQL_ROOT_PASSWORD=test -p 3307:3306 mysql:8.4   # once
TEST_DB_HOST=127.0.0.1 TEST_DB_PORT=3307 TEST_DB_PASSWORD=test pnpm --filter @flicktips/kp-backfill test
```

## Running against production from the Mac

Production MySQL listens on the server's `127.0.0.1:3306`. Forward it to local port 3307 (the same tunnel
`tools/local.sh` uses; if it is already open for the local stack, reuse it) and run from the repo root. The
order is: duplicates → small dry run → full dry run → review → apply.

```sh
# 1. Tunnel (keep this terminal open)
ssh -N -L 3307:127.0.0.1:3306 root@45.15.252.159

# 2. In another terminal, from the repo root: build and set the environment. The secrets are read from the
#    server's .env straight into variables, so they never reach the terminal or the shell history.
pnpm install && pnpm --filter @flicktips/kp-backfill... build
export DB_HOST=127.0.0.1 DB_PORT=3307 DB_NAME=flicktips
export DB_USER="$(ssh root@45.15.252.159 "sed -n 's/^DB_USER=//p' /var/www/flicktips.ru/.env")"
export DB_PASSWORD="$(ssh root@45.15.252.159 "sed -n 's/^DB_PASSWORD=//p' /var/www/flicktips.ru/.env")"
export KP_API_KEY="$(ssh root@45.15.252.159 "sed -n 's/^KP_API_KEY=//p' /var/www/flicktips.ru/.env")"

# 3. Read-only: movies that already share a kp_id (needed before a UNIQUE key on movie.kp_id)
node apps/kp-backfill/dist/cli.js duplicates
open kp-backfill-out/duplicates.csv

# 4. Dry run on a sample, then look at the CSV (filter by status, check the kinopoisk.ru links)
node apps/kp-backfill/dist/cli.js match --limit 200
open kp-backfill-out/match-dry-run.csv

# 5. Full dry run. It resumes from the checkpoint, so it can run over several days within the key's quota:
#    run the same command again each day (adjust --max-requests to the plan of the key).
node apps/kp-backfill/dist/cli.js match --max-requests 450

# 6. Apply the reviewed dry run without searching again. To leave a match out, delete its line from a copy
#    of the JSONL (the CSV is only for reading). Re-running is safe: rows already set are skipped.
cp kp-backfill-out/match-dry-run.jsonl kp-backfill-out/reviewed.jsonl
node apps/kp-backfill/dist/cli.js apply-report kp-backfill-out/reviewed.jsonl

# Optional: movies kp-parser gave up on, in their own out dir
node apps/kp-backfill/dist/cli.js match --include-errored --out-dir kp-backfill-out-errored
```

To try the whole flow on `flicktips_test` first, use `DB_NAME=flicktips_test` and a separate `--out-dir`: the
checkpoint refuses to mix databases, and `apply-report` skips rows whose `tmdb_id` differs (`movie_changed`),
so a production report cannot be applied to the test database by mistake.

`match --apply` (search and write in one go) also exists, with its own checkpoint `match-apply.checkpoint.json`;
it spends the quota again, so prefer dry run + `apply-report` for production.

Ctrl-C once lets the searches in flight finish and writes them and the checkpoint; twice quits at once.

## Notes

- The Кинопоиск quota is per day and per key, and depends on the key's plan; 21 231 movies need 1–2 requests
  each. Requests stop with exit code 2 on 402 (quota used up); run the same command the next day.
- The tool writes `kp_id` only. kp-parser picks the rows up on its next pass (it rechecks rows older than 7
  days and uses an existing `kp_id`), which fills `kp_title`, ratings, staff and clears `kp_error`.
- Two movies in this tool's run matching the same `kp_id` are most likely the same film imported twice from
  TMDb: the first one gets the `kp_id`, the second is reported as `duplicate` with the first one's id.
