#!/usr/bin/env bash
# Local development: https://flicktips.local (LOCAL_HOST)
# (see docker-compose.local.yml).
# The API uses the flicktips_test DB on the server through an SSH tunnel opened here.
#
#   tools/local.sh up [compose args...]    open the tunnel, build and start the stack
#   tools/local.sh down                    stop the stack and close the tunnel
#   tools/local.sh logs [service...]       follow logs
#
# Needs SSH access to the server and DB_USER/DB_PASSWORD (plus the other API secrets) in .env,
# LOCAL_HOST -> 127.0.0.1 in /etc/hosts and mkcert (brew install mkcert && mkcert -install, once).
# `up` starts Colima if the Docker daemon is not running.
# Env: DEPLOY_HOST (default root@45.15.252.159), LOCAL_DB_PORT (default 3307),
#      LOCAL_HOST (default flicktips.local).
set -euo pipefail

cd "$(dirname "$0")/.."

DEPLOY_HOST="${DEPLOY_HOST:-root@45.15.252.159}"
export LOCAL_DB_PORT="${LOCAL_DB_PORT:-3307}"
export LOCAL_HOST="${LOCAL_HOST:-flicktips.local}"
CERTS=docker/local/certs
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

# HTTPS certificate for LOCAL_HOST, signed by the mkcert CA the host browser trusts; its root
# goes along so SSR in the web container trusts it too
certs_up() {
  if ! grep -qE "^[^#]*[[:space:]]$LOCAL_HOST([[:space:]]|$)" /etc/hosts; then
    echo "Add '127.0.0.1 $LOCAL_HOST' (and '::1 $LOCAL_HOST') to /etc/hosts" >&2
    exit 1
  fi
  # macOS ships LibreSSL without -checkhost/-ext, so look for the name in the SAN text instead
  if [[ -f "$CERTS/cert.pem" ]] && openssl x509 -in "$CERTS/cert.pem" -noout -checkend 86400 >/dev/null \
      && openssl x509 -in "$CERTS/cert.pem" -noout -text | grep -qF "DNS:$LOCAL_HOST"; then
    return
  fi
  command -v mkcert >/dev/null || { echo "Install mkcert: brew install mkcert && mkcert -install" >&2; exit 1; }
  mkdir -p "$CERTS"
  mkcert -cert-file "$CERTS/cert.pem" -key-file "$CERTS/key.pem" "$LOCAL_HOST" localhost
  cp "$(mkcert -CAROOT)/rootCA.pem" "$CERTS/rootCA.pem"
}

# start Colima if the Docker daemon is not reachable (left running on `down`: other projects may use it)
docker_up() {
  if docker info >/dev/null 2>&1; then
    return
  fi
  command -v colima >/dev/null || { echo "Docker daemon is not running; start it first" >&2; exit 1; }
  # after sleep/crash Colima may report "Running" with a dead socket, and `colima start` skips it
  if colima list 2>/dev/null | grep -qE '^default[[:space:]]+Running'; then
    echo "Docker daemon is not responding though Colima looks running, restarting Colima"
    colima stop --force
  else
    echo "Docker daemon is not running, starting Colima"
  fi
  colima start
}

tunnel_down() {
  ssh -S "$CONTROL" -O exit "$DEPLOY_HOST" 2>/dev/null || true
}

cmd="${1:-up}"
shift || true

case "$cmd" in
  up)
    [[ -f .env ]] || { echo ".env is missing: copy .env.example and fill in the secrets" >&2; exit 1; }
    certs_up
    docker_up
    tunnel_up
    echo "Site: https://$LOCAL_HOST"
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
