#!/usr/bin/env bash
# Copy the production DB (flicktips) into the test DB (flicktips_test) on the server.
# Everything runs on the server over SSH: the data never leaves it (uploads to it are slow).
#
#   tools/copy-prod-to-test.sh         ask for confirmation, then copy
#   tools/copy-prod-to-test.sh -y      no confirmation
#
# Production is only read (mysqldump --single-transaction, no locks). flicktips_test is
# overwritten: all its tables are dropped first, so first it is backed up to
# BACKUP_DIR/flicktips_test-<date>.sql.gz on the server. Restore:
#   gunzip -c <file> | mysql --defaults-extra-file=... flicktips_test
# DB credentials are DB_USER/DB_PASSWORD from the server's .env (the same the API uses).
#
# Env: DEPLOY_HOST (default root@45.15.252.159), DEPLOY_PATH (default /var/www/flicktips.ru),
#      BACKUP_DIR (default /root/db-backups),
#      EXCLUDE_TABLES="t1 t2" to skip prod tables (they are left absent in flicktips_test).
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-root@45.15.252.159}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/flicktips.ru}"
BACKUP_DIR="${BACKUP_DIR:-/root/db-backups}"
EXCLUDE_TABLES="${EXCLUDE_TABLES:-}"

if [[ "${1:-}" != "-y" ]]; then
  echo "This OVERWRITES flicktips_test on $DEPLOY_HOST with a copy of flicktips (prod)."
  echo "flicktips_test is backed up to $BACKUP_DIR first."
  read -r -p "Type 'yes' to continue: " answer
  [[ "$answer" == "yes" ]] || { echo "Aborted"; exit 1; }
fi

ssh -o BatchMode=yes -o ConnectTimeout=15 "$DEPLOY_HOST" \
  DEPLOY_PATH="'$DEPLOY_PATH'" BACKUP_DIR="'$BACKUP_DIR'" EXCLUDE_TABLES="'$EXCLUDE_TABLES'" \
  bash -s <<'REMOTE'
set -euo pipefail

env_value() {
  sed -n "s/^$1=//p" "$DEPLOY_PATH/.env" | tail -n 1 | sed -e 's/^["'\'']//' -e 's/["'\'']$//'
}

# credentials go through a 0600 option file, not the command line (visible in ps)
CNF="$(mktemp)"
trap 'rm -f "$CNF"' EXIT
chmod 600 "$CNF"
printf '[client]\nhost=127.0.0.1\nport=3306\nuser=%s\npassword="%s"\n' \
  "$(env_value DB_USER || true)" "$(env_value DB_PASSWORD)" > "$CNF"
grep -q '^user=.' "$CNF" || sed -i 's/^user=$/user=flicktips/' "$CNF"

MYSQL=(mysql --defaults-extra-file="$CNF")
MYSQLDUMP=(mysqldump --defaults-extra-file="$CNF" --single-transaction --quick
           --no-tablespaces --triggers --default-character-set=utf8mb4)

mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/flicktips_test-$(date +%Y%m%d-%H%M%S).sql.gz"
df -h / | tail -n 1 | awk '{print "Free disk space: " $4}'
echo "Backing up flicktips_test to $BACKUP"
"${MYSQLDUMP[@]}" flicktips_test | gzip > "$BACKUP"

IGNORE=()
for t in $EXCLUDE_TABLES; do IGNORE+=("--ignore-table=flicktips.$t"); done

echo "Dropping tables and views in flicktips_test"
DROP="$("${MYSQL[@]}" -N -B -e "
  SELECT CONCAT(IF(table_type = 'VIEW', 'DROP VIEW ', 'DROP TABLE '), '\`', table_name, '\`;')
  FROM information_schema.tables WHERE table_schema = 'flicktips_test'")"
"${MYSQL[@]}" flicktips_test -e "SET FOREIGN_KEY_CHECKS = 0; $DROP"

# streamed, not saved to a file: the server's disk is nearly full
echo "Copying flicktips into flicktips_test (prod is read in a single transaction)"
"${MYSQLDUMP[@]}" "${IGNORE[@]}" flicktips | "${MYSQL[@]}" --default-character-set=utf8mb4 flicktips_test

echo "Row counts (flicktips / flicktips_test):"
"${MYSQL[@]}" -N -B -e "
  SELECT p.table_name, p.table_rows, t.table_rows
  FROM information_schema.tables p
  LEFT JOIN information_schema.tables t
    ON t.table_schema = 'flicktips_test' AND t.table_name = p.table_name
  WHERE p.table_schema = 'flicktips' AND p.table_type = 'BASE TABLE'
  ORDER BY p.table_name" | column -t
echo "(table_rows is an InnoDB estimate; small differences are normal)"
echo "Done. Backup of the old flicktips_test: $BACKUP"
REMOTE
