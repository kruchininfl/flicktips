# v2 deploy runbook

How the v2 stack (`apps/api` Fastify, `apps/web` Next.js, `apps/tg-bot`) goes to the server: first on a test domain
next to the running production, then the switchover of flicktips.ru. Deploys are **manual only** (Actions → Deploy v2
→ Run workflow); nothing deploys on push or on a schedule. The legacy deploy (`deploy.yml`, `tools/deploy.sh`,
`docker-compose.yml`) is unchanged and keeps running production until the switchover. `ft-parser` and `kp-parser`
stay in the legacy project and keep writing to the same MySQL before and after.

Files:

| file                                           | what                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/api/Dockerfile`, `apps/web/Dockerfile`   | multi-stage, Node 22 slim, `pnpm deploy` / Next standalone, non-root, health |
| `apps/tg-bot/Dockerfile`                       | unchanged build; now also takes `NODE_IMAGE`, runs as `node`                 |
| `docker-compose.v2.yml`                        | api, web, tg-bot (profile `bot`), nginx (profile `edge`)                     |
| `.env.v2.example`                              | the target's `.env`: required variables above `# Optional`                   |
| `nginx/conf.d/flicktips.v2.conf.example`       | production edge config (flicktips.ru, www → apex, tg-brew)                   |
| `nginx/conf.d/flicktips.v2-test.conf.template` | test-domain vhost, `@SERVER_NAME@`, `@WEB_PORT@`, `@API_PORT@`               |
| `.github/workflows/deploy-v2.yml`              | manual workflow: target `test` / `prod`, rollback                            |
| `tools/deploy-v2.sh`                           | builds and pushes the images, syncs files, runs `docker/v2.sh up`            |
| `docker/v2.sh`                                 | server side: `up`, `rollback`, `prune`, `vhost`, `compose …`                 |

## Layout on the server

| what              | legacy (today)                      | v2 test                          | v2 prod                          |
| ----------------- | ----------------------------------- | -------------------------------- | -------------------------------- |
| directory         | `/var/www/flicktips.ru`             | `/var/www/flicktips-v2/test`     | `/var/www/flicktips-v2/prod`     |
| compose project   | `flicktipsru`                       | `flicktips-v2-test`              | `flicktips-v2-prod`              |
| web               | `:3001` (Node 16 SSR)               | `127.0.0.1:3201`                 | `127.0.0.1:3101`                 |
| api               | `:9000` (php-fpm)                   | `127.0.0.1:3202`                 | `127.0.0.1:3102`                 |
| edge nginx        | legacy `nginx` service, `:80/:443`  | vhost added to the running edge  | `nginx` service (profile `edge`) |
| Telegram bot      | legacy `tg-bot`                     | off, or a separate test bot      | `tg-bot` (profile `bot`)         |
| database          | `flicktips`                         | `flicktips_test` (`DB_NAME`)     | `flicktips`                      |
| images            | `infamoustill/flicktips-*:<sha>`    | `flicktips2-{api,tg-bot}:<sha>`, `flicktips2-web:test-<sha>` | `…`, `flicktips2-web:prod-<sha>` |
| tag in `.env`     | `TAG`, `PREV_TAG`                   | `V2_TAG`, `V2_PREV_TAG`          | `V2_TAG`, `V2_PREV_TAG`          |

- `:3002` stays tg-brew's (the API's dev default port is not used on the server).
- Everything uses `network_mode: host` like the legacy stack, so MySQL is `127.0.0.1:3306`; Node listens on
  `127.0.0.1` only, nginx is the only public listener.
- The v2 images are `flicktips2-*`, not `flicktips-*`: the legacy `docker/deploy.sh prune` deletes every
  `infamoustill/flicktips-*` image it does not deploy. `docker/v2.sh prune` keeps the `V2_TAG`/`V2_PREV_TAG` of
  every directory under `/var/www/flicktips-v2`.
- The web image bakes `NEXT_PUBLIC_SITE_URL` and the API port in (rewrites, canonical URLs, robots.txt, invite links),
  so each target has its own web image. `docker/v2.sh up` refuses an image whose labels do not match the `.env`.

### Memory (1 vCPU, < 1 GB RAM)

Caps (`mem_limit` = `memswap_limit`) and V8 heaps, overridable in `.env`:

| container | cap    | heap (`--max-old-space-size`) | measured idle |
| --------- | ------ | ----------------------------- | ------------- |
| api       | 160 MB | 96 MB                         | ~40 MB        |
| web       | 256 MB | 160 MB                        | ~60 MB        |
| tg-bot    | 128 MB | 96 MB (as before)             | ~27 MB        |
| nginx     | 64 MB  | —                             | ~9 MB         |

Production v2 caps add up to 608 MB, about what the legacy web + php-fpm + tg-bot + nginx use today, and replace them
at the switchover. The **test target runs on top of production** (+416 MB of caps, ~100 MB real use idle). On today's
box that only fits with lower caps (`V2_WEB_MEM=192m`, `V2_WEB_HEAP_MB=128`, `V2_API_MEM=128m`, `V2_API_HEAP_MB=80`
in the test `.env`) and is still risky next to MySQL: prefer to upgrade the server (2 GB) before the test run. Check
with `free -m` and `docker stats --no-stream` while it runs.

## Environment variables

`.env.v2.example` is the reference. Values may be quoted (`DB_PASSWORD="…"`, as in the legacy `.env`); compose and the
scripts strip the quotes. **New** = not in the legacy `.env`.

### api (`apps/api/src/config.ts`), from `env_file: .env`

| variable                                                            | required | notes                                                                                 |
| ------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `SITE_URL`                                                          | yes      | **New** for the API. Origin for OAuth redirect URIs and the CSRF check; prod `https://flicktips.ru` |
| `AUTH_SECRET`                                                       | yes\*    | **New.** `openssl rand -hex 32`, different per target. \*Derived from the OAuth secrets if empty; set it |
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`   | no       | **New** (stage 6). Push is off until all three are set; generate once (below)         |
| `DB_NAME`                                                           | yes here | `flicktips` / `flicktips_test`. Required by `.env.v2.example`: an empty value would be taken as `''` |
| `DB_USER`, `DB_PASSWORD`                                            | yes      | as legacy                                                                             |
| `DB_HOST`, `DB_PORT`                                                | no       | default `127.0.0.1:3306`                                                              |
| `VKONTAKTE_API_KEY`, `VKONTAKTE_API_SECRET`                         | yes      | as legacy (VK ID app id, PKCE secret)                                                 |
| `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`                          | yes      | as legacy                                                                             |
| `KP_API_KEY`                                                        | yes      | as legacy (now also used by the API's Кинопоиск client)                               |
| `TELEGRAM_BOT_USERNAME`                                             | no       | default `FlickTipsBot`                                                                |
| `APP_ENV`                                                           | no       | `prod` (default): Secure cookies. Keep `prod` on the HTTPS test domain too            |
| `API_HOST`, `API_PORT`                                              | —        | set by compose: `127.0.0.1`, `V2_API_PORT`                                            |

The API needs outbound HTTPS to `id.vk.ru`, `oauth.yandex.ru`, `login.yandex.ru`, `kinopoiskapiunofficial.tech` and,
with push on, the browsers' push services (`fcm.googleapis.com`, `android.googleapis.com`, `*.push.services.mozilla.com`,
`*.notify.windows.com`, `*.push.apple.com`; list in `apps/api/docs/push.md`).

### web (`apps/web`): no secrets, no `env_file`

| variable               | when             | notes                                                                         |
| ---------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | build arg        | **New.** = `SITE_URL` of the target; inlined into server and browser bundles  |
| `API_INTERNAL_URL`     | build arg + run  | **New.** `http://127.0.0.1:<V2_API_PORT>`; rewrites (build), server fetches (run) |
| `HOSTNAME`, `PORT`     | run (compose)    | `127.0.0.1`, `V2_WEB_PORT`                                                    |

### tg-bot (`apps/tg-bot/src/env.ts`, `db.ts`), from `env_file: .env`

`TELEGRAM_BOT_TOKEN` (empty = bot idles), `TELEGRAM_BOT_USERNAME`, `SITE_URL` (links in posts), `DB_*` (`DB_PASSWORD`
required), `TELEGRAM_API_ROOT` (optional). One token can be polled by one process only: the legacy and v2 bots never run
together with the same token; a test target uses its own bot from @BotFather or stays off.

### compose / scripts only

`V2_TARGET` (`test`/`prod`, must match the directory name), `V2_WEB_PORT`, `V2_API_PORT`, `COMPOSE_PROFILES`
(`bot`, `edge`), `V2_*_MEM`, `V2_*_HEAP_MB`, `CERTBOT_DIR` (default `/var/www/flicktips.ru/data/certbot`),
`V2_TAG`/`V2_PREV_TAG` (written by `docker/v2.sh`).

## One-time preparation

1. **Workflow.** GitHub only offers "Run workflow" for workflows on the default branch: copy
   `.github/workflows/deploy-v2.yml` to `master` (the file alone is enough; it checks out the branch chosen in "Use
   workflow from", so run it from `master_v2`). Secrets are the existing ones (`DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`,
   `DOCKERHUB_TOKEN`, optional `DEPLOY_HOST`); optional new `DEPLOY_V2_PATH` (default `/var/www/flicktips-v2`).
2. **Docker Hub.** The first push creates `infamoustill/flicktips2-api`, `-web`, `-tg-bot`. Check on hub.docker.com
   that they are **public** (the server pulls without a login); make them public if the account default is private.
3. **Target directory and `.env`** (on the server, for each target before its first deploy). Copy the shared secrets
   from the legacy `.env` without printing them:

   ```sh
   T=test   # or prod
   mkdir -p /var/www/flicktips-v2/$T && cd /var/www/flicktips-v2/$T
   # .env.v2.example is synced by the first deploy; take it from the repo for now
   curl -fsSL https://raw.githubusercontent.com/kruchininfl/flicktips/master_v2/.env.v2.example -o .env.v2.example
   cp .env.v2.example .env && chmod 600 .env
   for k in DB_USER DB_PASSWORD VKONTAKTE_API_KEY VKONTAKTE_API_SECRET YANDEX_CLIENT_ID YANDEX_CLIENT_SECRET KP_API_KEY; do
     v="$(grep "^$k=" /var/www/flicktips.ru/.env | tail -1)"; [ -n "$v" ] && sed -i "s|^$k=.*|$(printf '%s' "$v" | sed 's/[&|]/\\&/g')|" .env
   done
   sed -i "s|^AUTH_SECRET=.*|AUTH_SECRET=$(openssl rand -hex 32)|" .env
   ```

   Then edit `.env` by hand: `V2_TARGET`, `SITE_URL`, ports and `DB_NAME` per the table above
   (prod: `V2_TARGET=prod`, `SITE_URL=https://flicktips.ru`, `V2_WEB_PORT=3101`, `V2_API_PORT=3102`,
   `DB_NAME=flicktips`, `COMPOSE_PROFILES=` empty until the switchover). If the repo is private, copy
   `.env.v2.example` with `scp` instead of `curl`.
4. **Web Push keys** (once, on any machine with the repo; keep the pair, a new pair drops all subscriptions):
   `pnpm --filter @flicktips/api exec web-push generate-vapid-keys`, then put `WEB_PUSH_PUBLIC_KEY`,
   `WEB_PUSH_PRIVATE_KEY` and `WEB_PUSH_SUBJECT=mailto:…` into the `.env` of each target (the same pair for both is
   fine; a subscription made on the test domain only works there anyway).
5. **OAuth redirect URLs** (see "OAuth" below): add the test domain's to VK ID and Yandex ID.

Steps 3 and 4 for the test target, plus the backup and migrations below, are scripted for the Mac:
`tools/v2-test-setup.sh env|vapid|check|backup|migrate` (idempotent; secrets stay on the server).

## Database migrations (manual, backup first)

`packages/db/migrations/001-v2-tmdb-optional-and-sessions.sql` (`movie.tmdb_id` nullable, `session` table) and
`002-push-subscriptions.sql` (`push_subscription` table). Both are compatible with the legacy PHP API and parsers,
so they can be applied any time before the v2 target that uses the database starts, and stay applied after a
rollback. Order: `flicktips_test` first, check, then `flicktips`.

**Production `sql_mode` is strict** (`STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,…`) and `movie` has
`'0000-00-00'` column defaults, so `ALTER TABLE movie …` fails there with `ERROR 1067 Invalid default value for
'kp_release_date'` (reproduced on MySQL 8.4). Run the migrations with an empty session `sql_mode`, as the test helpers
do:

```sh
cd /tmp && DB=flicktips_test     # then DB=flicktips
df -h /                          # the disk is nearly full: check room for the dump
# 1. backup (the whole DB; or at least `movie`, the only table that is altered). Better: stream it to the Mac:
#    ssh root@45.15.252.159 "mysqldump --single-transaction --quick $DB | gzip" > ~/$DB-$(date +%F).sql.gz
mysqldump --single-transaction --quick "$DB" | gzip > "/root/$DB-$(date +%F).sql.gz"
# 2. the migrations (files from the repo, e.g. scp'd to /tmp)
mysql --init-command="SET SESSION sql_mode=''" "$DB" < 001-v2-tmdb-optional-and-sessions.sql
mysql --init-command="SET SESSION sql_mode=''" "$DB" < 002-push-subscriptions.sql
# 3. check
mysql "$DB" -e "SHOW COLUMNS FROM movie LIKE 'tmdb_id'; SHOW TABLES LIKE 'session'; SHOW TABLES LIKE 'push_subscription';"
```

(Use the MySQL admin login you normally use on the host, e.g. `-u root -p`.) The `ALTER` rebuilds `movie` (~100k
rows) online; parsers may keep running. Both files use `CREATE TABLE IF NOT EXISTS`, and re-running the `ALTER` is
harmless.

`003-movie-kp-id-unique.sql` (UNIQUE `movie.kp_id`) is **not** part of the switchover: it is marked
`status: pending` and has its own prerequisites (no duplicate `kp_id` left after `kp-backfill dedupe-*`, kp-parser
handling the duplicate-key error; see the file header and `apps/kp-backfill/README.md`). v2 runs without it. When
it is due, apply it the same way (backup, `flicktips_test` first); it sets its own session `sql_mode`.

## Test domain run (side by side with production)

Example name `dev.flicktips.ru`; any name works (`test_site_url` input of the workflow = `SITE_URL` of the test `.env`).

1. DNS: `A dev.flicktips.ru → 45.15.252.159`. Wait until it resolves.
2. Certificate, through the legacy nginx (its first `:80` server answers ACME challenges for any name):

   ```sh
   cd /var/www/flicktips.ru
   docker run --rm -v "$PWD/data/certbot/conf:/etc/letsencrypt" -v "$PWD/data/certbot/www:/var/www/certbot" \
     certbot/certbot certonly --webroot --webroot-path /var/www/certbot --email <you> --agree-tos --no-eff-email \
     --non-interactive -d dev.flicktips.ru
   ```

   The existing renewal cron (`docker/certbot-renew.sh`) renews it with the others.
3. Migrations on `flicktips_test` (above). The test target uses `flicktips_test`; to try it on real data set
   `DB_NAME=flicktips` (then votes and sign-ins on the test domain are real; apply the migrations to `flicktips` first).
4. Test `.env` ready (preparation step 3, `V2_TARGET=test`, `SITE_URL=https://dev.flicktips.ru`, ports 3201/3202,
   lower memory caps on the small box). Bot: leave `COMPOSE_PROFILES` empty, or a separate test bot token +
   `COMPOSE_PROFILES=bot`.
5. Actions → **Deploy v2** → Run workflow from `master_v2`, target `test`, `test_site_url=https://dev.flicktips.ru`.
   The workflow builds and pushes the images, syncs `docker-compose.v2.yml`, `.env.v2.example`, `docker/v2.sh` and
   the nginx files, starts api + web, waits for their health checks, then `docker/v2.sh vhost` renders the test vhost
   into the running legacy nginx as `conf.d/zz-flicktips-v2-test.conf` (last in include order, so it never becomes
   the default server), runs `nginx -t` (on failure it removes the file again and does not reload) and reloads.
   Finally it checks `https://dev.flicktips.ru/`, `/robots.txt` and `/api/health` from the runner.
6. The vhost lives inside the legacy nginx container: a legacy deploy recreates that container and drops it. Re-add it
   with `cd /var/www/flicktips-v2/test && docker/v2.sh vhost` (or run the v2 test deploy again).
   Remove it with `docker/v2.sh vhost-remove`; stop the test stack with `docker/v2.sh compose down`.
7. The test vhost sends `X-Robots-Tag: noindex` and a `Disallow: /` robots.txt, so it is not indexed. Optional basic
   auth is prepared (commented) in the template.

## Smoke test checklist

Run on the test domain before the switchover and on flicktips.ru right after it (`H=https://dev.flicktips.ru` or
`H=https://flicktips.ru`):

- [ ] `curl -s $H/api/health` → `{"status":"ok","db":"up"}`
- [ ] `curl -sI $H/` → 200; `/movie/<real id>` → 200 with the title in `<title>`; `/movie/999999999` → 404 page
- [ ] `/person/<id>`, `/user/<id>`, `/about`, `/telegram` render; `/profile/friends` without login → `/signin?next=…`
- [ ] `curl -s $H/robots.txt` (prod: `Sitemap: https://flicktips.ru/sitemaps/sitemap.xml`; test: `Disallow: /`)
- [ ] `curl -s $H/sitemaps/sitemap.xml` → index; one `movies-N.xml` opens; prod: `X-Sitemap-Cache: HIT` on repeat
- [ ] posters: `curl -sI $H/poster/kp/<kp_id>.jpg` → 200 image, `X-Poster-Cache`
- [ ] `curl -sI $H$(curl -s $H/ | grep -o '/_next/static/[^"]*\.js' | head -1)` → `cache-control: public, max-age=31536000, immutable`
- [ ] PWA: `/serwist/sw.js` → `cache-control: no-cache`, `service-worker-allowed: /`; `/manifest.webmanifest`, `/offline.html` → 200
- [ ] prod: `curl -sI https://www.flicktips.ru/movie/1` → 301 `https://flicktips.ru/movie/1`; `http://` → 301 https
- [ ] sign in with VK and with Yandex (browser) → back on the page, `/api/me` → 200; logout works
- [ ] vote on a movie in two tabs: the other tab updates live (SSE `/api/events`, not buffered: no 30–60 s delay)
- [ ] bookmarks, follow/unfollow, profile edit; account link/unlink on `/profile/accounts/`
- [ ] push (if keys set): enable it on `/profile/accounts/`; a vote of someone you follow brings a notification
- [ ] Telegram (prod, after the bot switch): `/start` answers; a rating change appears in a group within ~1 min
- [ ] a cross-site POST is rejected: `curl -s -X POST -H 'Origin: https://evil.example' $H/api/auth/logout` → 403
- [ ] `docker stats --no-stream`, `free -m`: no container near its cap; `docker/v2.sh compose logs --tail 100 api web`

## Switchover (flicktips.ru → v2)

Prerequisites: migrations 001 and 002 on `flicktips`; prod `.env` complete (`docker/v2.sh` checks); the OAuth URLs
(below); the test run passed the checklist; a quiet hour; announce the one forced re-login (below).

1. **Warm up v2 prod on loopback.** Prod `.env` with `COMPOSE_PROFILES=` empty. Actions → Deploy v2, target `prod`.
   api + web start on `127.0.0.1:3102/3101` against `flicktips`; the public site is still legacy. Check on the server:
   `curl -s 127.0.0.1:3102/api/health; curl -s -o /dev/null -w '%{http_code}\n' 127.0.0.1:3101/movie/1`.
2. **Keep legacy services from coming back.** In `/var/www/flicktips.ru` create `docker-compose.override.yml`
   (compose reads it automatically; the legacy deploy's rsync leaves it alone):

   ```yaml
   # v2 switchover: web, api, nginx and tg-bot run from /var/www/flicktips-v2/prod. Delete this file to roll back.
   services:
     web: { profiles: [legacy] }
     api: { profiles: [legacy] }
     nginx: { profiles: [legacy] }
     tg-bot: { profiles: [legacy] }
   ```

   A later legacy `docker compose up -d --remove-orphans` (legacy Deploy for the parsers) then leaves these four
   stopped instead of restarting them on the v2 ports.
3. **Switch** (downtime = the few seconds between the two commands):

   ```sh
   cd /var/www/flicktips.ru && docker compose stop nginx web api tg-bot
   cd /var/www/flicktips-v2/prod && sed -i 's/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=bot,edge/' .env \
     && docker/v2.sh up "$(docker/v2.sh current)"
   ```

   The v2 nginx binds `:80/:443` with the same certificates (`CERTBOT_DIR`), serves flicktips.ru, redirects
   `www.flicktips.ru` and `http://` to `https://flicktips.ru`, keeps the tg-brew vhost (`45.15.252.159` → `:3002`).
   The v2 bot takes over the token (the legacy bot is stopped).
4. Smoke test (checklist) on `https://flicktips.ru`. If the test target still runs, re-add its vhost into the new edge:
   `cd /var/www/flicktips-v2/test && docker/v2.sh vhost` (written to `prod/nginx/`, survives restarts).
5. **Certificate renewal cron**: `docker/certbot-renew.sh` reloads the legacy nginx (`docker compose exec nginx`),
   which is now stopped, so the script fails after renewing. Change the cron line's reload to
   `cd /var/www/flicktips-v2/prod && docker/v2.sh compose exec -T nginx nginx -s reload` (renewal itself still writes
   to `/var/www/flicktips.ru/data/certbot`, which the v2 nginx mounts).
6. Later deploys: Deploy v2, target `prod`. The legacy Deploy is only for the parsers now: services
   `kp-parser ft-parser`.

### Rollback

Data stays compatible both ways (the legacy code ignores `session` and `push_subscription`, the nullable `tmdb_id` is
harmless to it); do not revert the migrations.

- Bad v2 release, v2 still serving: Actions → Deploy v2, target `prod`, `rollback` (or on the server
  `docker/v2.sh rollback`): back to `V2_PREV_TAG`.
- Back to the legacy stack (images are still on the server under its `TAG`):

  ```sh
  cd /var/www/flicktips-v2/prod && sed -i 's/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=/' .env \
    && docker/v2.sh compose stop nginx tg-bot
  cd /var/www/flicktips.ru && rm docker-compose.override.yml && docker compose up -d nginx web api tg-bot
  ```

  Undo the cron change. Users signed in on v2 sign in again on the legacy site (its token cookie may still be there).

## OAuth redirect URLs

The API sends `SITE_URL + /auth/<provider>/callback` (`apps/api/docs/auth.md`):

| provider                                            | production (same as PHP today)                 | test domain                                       |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| VK ID (id.vk.ru cabinet, «Доверенный redirect URL») | `https://flicktips.ru/auth/vkontakte/callback` | `https://dev.flicktips.ru/auth/vkontakte/callback` |
| Yandex ID (oauth.yandex.ru, «Redirect URI»)         | `https://flicktips.ru/auth/yandex/callback`    | `https://dev.flicktips.ru/auth/yandex/callback`    |

Check that the production ones are registered exactly like that (no `www`, https); add the test ones. VK ID may also
need the test domain as a trusted domain of the app.

## The one forced re-login

v2 signs in with an `ft_session` cookie backed by the `session` table; it does not read the legacy redux-oauth
`authHeaders` cookie / `user.token`. At the switchover **every user is signed out once** and signs in again with VK or
Yandex (same accounts, nothing is lost: the user is found by `vkontakte_id` / `yandex_id`). Announce it (Telegram
group, a line on the site) before the switch. Sessions made on the test domain are separate (host-only cookie).
