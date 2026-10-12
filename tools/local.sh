#!/usr/bin/env bash
# Local development: http://localhost:8088 (LOCAL_HTTP_PORT) (see docker-compose.local.yml).
# The API uses the flicktips_test DB on the server through an SSH tunnel opened here.
#
#   tools/local.sh up [compose args...]    open the tunnel, build and start the stack
#   tools/local.sh down                    stop the stack and close the tunnel
#   tools/local.sh logs [service...]       follow logs
#
# Needs SSH access to the server and DB_USER/DB_PASSWORD (plus the other API secrets) in .env.
# Env: DEPLOY_HOST (default root@45.15.252.159), LOCAL_DB_PORT (default 3307),
#      LOCAL_HTTP_PORT (default 8088).
set -euo pipefail

cd "$(dirname "$0")/.."

DEPLOY_HOST="${DEPLOY_HOST:-root@45.15.252.159}"
export LOCAL_DB_PORT="${LOCAL_DB_PORT:-3307}"
export LOCAL_HTTP_PORT="${LOCAL_HTTP_PORT:-8088}"
CONTROL="${TMPDIR:-/tmp}/flicktips-db-tunnel.sock"
COMPOSE=(docker compose -f docker-compose.local.yml)

tunnel_up() {
  if ssh -S "$CONTROL" -O check "$DEPLOY_HOST" 2>/dev/null; then
    return
  fi
  # reuse a tunnel opened elsewhere (e.g. by a DB client) on the same port
  if nc -z 127.0.0.1 "$LOCAL_DB_PORT" 2>/dev/null; then
    echo "Port $LOCAL_DB_PORT is already listening, assuming it is a tunnel to the server's MySQL"
    return
  fi
  echo "Opening DB tunnel localhost:$LOCAL_DB_PORT -> $DEPLOY_HOST:3306"
  ssh -f -N -M -S "$CONTROL" -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 \
    -L "127.0.0.1:$LOCAL_DB_PORT:127.0.0.1:3306" "$DEPLOY_HOST"
}

tunnel_down() {
  ssh -S "$CONTROL" -O exit "$DEPLOY_HOST" 2>/dev/null || true
}

cmd="${1:-up}"
shift || true

case "$cmd" in
  up)
    [[ -f .env ]] || { echo ".env is missing: copy .env.example and fill in the secrets" >&2; exit 1; }
    tunnel_up
    echo "Site: http://localhost:$LOCAL_HTTP_PORT"
    "${COMPOSE[@]}" up --build --renew-anon-volumes "$@"
    ;;
  down)
    "${COMPOSE[@]}" down "$@"
    tunnel_down
    ;;
  logs)
    "${COMPOSE[@]}" logs -f "$@"
    ;;
  *)
    echo "usage: $0 up|down|logs [args...]" >&2
    exit 1
    ;;
esac
