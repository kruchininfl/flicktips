#!/usr/bin/env bash
# One-time setup of the v2 test target (docs/v2-deploy.md, "One-time preparation" and "Database migrations"),
# run from the owner's Mac in a checkout of master_v2 / the v2 branch:
#   tools/v2-test-setup.sh env      # /var/www/flicktips-v2/test/.env (secrets copied on the server, never printed)
#   tools/v2-test-setup.sh vapid    # Web Push key pair: kept in ./.vapid-keys.json, written to the test .env
#   tools/v2-test-setup.sh check    # names of the test .env, values only for non-secrets
#   tools/v2-test-setup.sh shrink   # flicktips_test cut down to the 10 oldest users and the movies they voted for
#   tools/v2-test-setup.sh backup   # mysqldump of flicktips_test streamed to ~/flicktips_test-<date>.sql.gz
#   tools/v2-test-setup.sh migrate  # migrations 001 and 002 on flicktips_test (needs a backup from today)
# Every step is idempotent. Production (`flicktips`) is never touched.
set -euo pipefail

SERVER="${SERVER:-root@45.15.252.159}"
TEST_DIR="${TEST_DIR:-/var/www/flicktips-v2/test}"
LEGACY_ENV="${LEGACY_ENV:-/var/www/flicktips.ru/.env}"
DB=flicktips_test
BACKUP="$HOME/$DB-$(date +%F).sql.gz"
cd "$(dirname "$0")/.."

# set_kv KEY VALUE in ./.env (server side); defined once and sent with every remote script
SET_KV='set_kv() { local k=$1 v=$2; if grep -q "^$k=" .env; then
  sed -i "s|^$k=.*|$k=$(printf "%s" "$v" | sed "s/[&|\\\\]/\\\\&/g")|" .env; else printf "%s=%s\n" "$k" "$v" >> .env; fi; }'

step_env() {
  ssh "$SERVER" "mkdir -p $TEST_DIR && cat > $TEST_DIR/.env.v2.example" < .env.v2.example
  ssh "$SERVER" "bash -s" <<EOF
set -euo pipefail
cd $TEST_DIR
[ -f .env ] || { cp .env.v2.example .env; }
chmod 600 .env
$SET_KV
for k in DB_USER DB_PASSWORD VKONTAKTE_API_KEY VKONTAKTE_API_SECRET YANDEX_CLIENT_ID YANDEX_CLIENT_SECRET KP_API_KEY TELEGRAM_BOT_USERNAME; do
  line="\$(grep "^\$k=" $LEGACY_ENV | tail -1 || true)"
  [ -n "\$line" ] && set_kv "\$k" "\${line#*=}"
done
grep -q '^AUTH_SECRET=.' .env || set_kv AUTH_SECRET "\$(openssl rand -hex 32)"
set_kv V2_TARGET test
set_kv SITE_URL https://dev.flicktips.ru
set_kv V2_WEB_PORT 3201
set_kv V2_API_PORT 3202
set_kv DB_NAME $DB
set_kv COMPOSE_PROFILES ''
set_kv V2_WEB_MEM 192m
set_kv V2_WEB_HEAP_MB 128
set_kv V2_API_MEM 128m
set_kv V2_API_HEAP_MB 80
echo "env: ok"
EOF
}

step_vapid() {
  if [ ! -s .vapid-keys.json ]; then
    pnpm install --frozen-lockfile > /dev/null
    (umask 077 && pnpm -s --filter @flicktips/api exec web-push generate-vapid-keys --json > .vapid-keys.json)
  fi
  exclude="$(git rev-parse --git-path info/exclude)"
  grep -qx '.vapid-keys.json' "$exclude" 2> /dev/null || echo '.vapid-keys.json' >> "$exclude"
  node -e 'const k = require("./.vapid-keys.json"); console.log(k.publicKey); console.log(k.privateKey)' |
    ssh "$SERVER" "bash -c 'set -euo pipefail; cd $TEST_DIR; $SET_KV; read -r pub; read -r priv
      set_kv WEB_PUSH_PUBLIC_KEY \"\$pub\"; set_kv WEB_PUSH_PRIVATE_KEY \"\$priv\"
      set_kv WEB_PUSH_SUBJECT mailto:support@flicktips.ru; echo \"vapid: ok\"'"
}

step_check() {
  ssh "$SERVER" "bash -s" <<EOF
cd $TEST_DIR
for k in V2_TARGET SITE_URL V2_WEB_PORT V2_API_PORT DB_NAME COMPOSE_PROFILES APP_ENV V2_WEB_MEM V2_API_MEM WEB_PUSH_SUBJECT TELEGRAM_BOT_USERNAME; do
  grep "^\$k=" .env || echo "\$k: missing"
done
for k in DB_USER DB_PASSWORD AUTH_SECRET KP_API_KEY VKONTAKTE_API_KEY VKONTAKTE_API_SECRET YANDEX_CLIENT_ID YANDEX_CLIENT_SECRET WEB_PUSH_PUBLIC_KEY WEB_PUSH_PRIVATE_KEY; do
  v="\$(grep "^\$k=" .env | tail -1 | cut -d= -f2- | tr -d "\"'")"; [ -n "\$v" ] && echo "\$k: set" || echo "\$k: EMPTY"
done
ls -l .env
EOF
}

step_shrink() {
  ssh "$SERVER" "df -h / | tail -1; mysql $DB -e \"SELECT COUNT(*) AS users FROM \\\`user\\\`; SELECT COUNT(*) AS movies FROM movie;\""
  ssh "$SERVER" "mysql --table $DB" < tools/v2-shrink-test-db.sql
  ssh "$SERVER" "df -h / | tail -1"
}

step_backup() {
  ssh "$SERVER" "mysqldump --single-transaction --quick $DB | gzip" > "$BACKUP"
  gunzip -t "$BACKUP"
  ls -lh "$BACKUP"
}

step_migrate() {
  [ -s "$BACKUP" ] || { echo "no backup from today ($BACKUP): run the backup step first" >&2; exit 1; }
  for f in packages/db/migrations/001-*.sql packages/db/migrations/002-*.sql; do
    ssh "$SERVER" "mysql --init-command=\"SET SESSION sql_mode=''\" $DB" < "$f"
    echo "applied $(basename "$f")"
  done
  ssh "$SERVER" "mysql $DB -e \"SHOW COLUMNS FROM movie LIKE 'tmdb_id'; SHOW TABLES LIKE 'session'; SHOW TABLES LIKE 'push_subscription';\""
}

case "${1:-}" in
  env | vapid | check | shrink | backup | migrate) "step_$1" ;;
  *) sed -n '2,10p' "$0" >&2; exit 2 ;;
esac
