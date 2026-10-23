#!/usr/bin/env bash
# Server-side half of .github/workflows/deploy-v2.yml, run in a v2 target directory
# (/var/www/flicktips-v2/test or /var/www/flicktips-v2/prod, see docs/v2-deploy.md). Images come from Docker Hub
# (public repos infamoustill/flicktips2-*); the active tag lives in .env (V2_TAG, V2_PREV_TAG).
#
#   docker/v2.sh current            print the active tag
#   docker/v2.sh up <tag>           pull <tag>, check it against .env, switch the target to it, wait until healthy;
#                                   on test also (re)installs the test vhost into the edge nginx (see `vhost`)
#   docker/v2.sh rollback           `up` with V2_PREV_TAG
#   docker/v2.sh prune              remove flicktips2 images no target directory uses as V2_TAG / V2_PREV_TAG
#   docker/v2.sh vhost              render nginx/flicktips.v2-test.conf.template for SITE_URL's host and install it
#                                   into the running edge nginx (legacy or v2) after `nginx -t`
#   docker/v2.sh vhost-remove       take the test vhost out of the edge nginx again
#   docker/v2.sh compose <args...>  docker compose for this target (ps, logs -f web, stop, ...)
#
# Never touches the legacy project (/var/www/flicktips.ru) except `vhost`, which adds one file to its nginx.
set -euo pipefail

cd "$(dirname "$0")/.."

PREFIX="infamoustill/flicktips2-"
COMPOSE=(docker compose -f docker-compose.v2.yml)
# sorts after every other conf.d file, so it never becomes the default server of the legacy edge (no default_server there)
VHOST_NAME="zz-flicktips-v2-test.conf"

# value of a .env variable without surrounding quotes (the server's .env quotes values: DB_PASSWORD="...")
unquote() {
  sed -E "s/^\"(.*)\"\$/\\1/; s/^'(.*)'\$/\\1/"
}

env_get() {
  [[ -f .env ]] && sed -n "s/^$1=//p" .env | tail -1 | unquote || true
}

env_set() {
  touch .env
  if grep -q "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    echo "$1=$2" >> .env
  fi
}

die() {
  echo "$*" >&2
  exit 1
}

check_env() {
  local name missing=() target
  [[ -f .env ]] || die "No .env here ($PWD); create it from .env.v2.example"
  for name in $(sed -n '/^# Optional/q; s/^\([A-Z0-9_]*\)=.*/\1/p' .env.v2.example); do
    [[ -n "$(env_get "$name")" ]] || missing+=("$name")
  done
  [[ ${#missing[@]} -eq 0 ]] || die "Missing in .env (see .env.v2.example): ${missing[*]}"
  target="$(env_get V2_TARGET)"
  [[ "$target" == test || "$target" == prod ]] || die "V2_TARGET must be test or prod, not '$target'"
  [[ "$(basename "$PWD")" == "$target" ]] || die "V2_TARGET=$target but this directory is $PWD"
}

health_of() {
  local id
  id="$("${COMPOSE[@]}" ps -q "$1" 2>/dev/null || true)"
  [[ -n "$id" ]] || { echo missing; return; }
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$id"
}

wait_healthy() {
  local svc status attempt
  for svc in "$@"; do
    for attempt in $(seq 1 40); do
      status="$(health_of "$svc")"
      [[ "$status" == healthy || "$status" == running ]] && break
      sleep 3
    done
    echo "  $svc: $status"
    [[ "$status" == healthy || "$status" == running ]] || die "$svc is not healthy; logs: docker/v2.sh compose logs $svc"
  done
}

cmd_up() {
  local new="$1" cur target site api_url label_site label_api svc
  check_env
  target="$(env_get V2_TARGET)"
  site="$(env_get SITE_URL)"
  api_url="http://127.0.0.1:$(env_get V2_API_PORT)"
  cur="$(env_get V2_TAG)"

  # V2_NO_PULL=1: use images already present (local dry runs of this script)
  if [[ -z "${V2_NO_PULL:-}" ]]; then
    docker pull "${PREFIX}api:$new"
    docker pull "${PREFIX}web:$target-$new"
    docker pull "${PREFIX}tg-bot:$new"
  fi

  # the web image bakes its public URL and API port in (apps/web/Dockerfile)
  label_site="$(docker image inspect --format '{{index .Config.Labels "ru.flicktips.site-url"}}' "${PREFIX}web:$target-$new")"
  label_api="$(docker image inspect --format '{{index .Config.Labels "ru.flicktips.api-internal-url"}}' "${PREFIX}web:$target-$new")"
  [[ "$label_site" == "$site" ]] || die "web image was built for $label_site, .env has SITE_URL=$site"
  [[ "$label_api" == "$api_url" ]] || die "web image expects the API at $label_api, .env gives $api_url"

  if [[ -n "$cur" && "$cur" != "$new" ]]; then
    env_set V2_PREV_TAG "$cur"
  fi
  env_set V2_TAG "$new"

  "${COMPOSE[@]}" up -d --pull never --remove-orphans
  echo "Waiting for the containers"
  wait_healthy api web
  for svc in tg-bot nginx; do
    if [[ -n "$("${COMPOSE[@]}" ps -q "$svc" 2>/dev/null || true)" ]]; then
      wait_healthy "$svc"
    fi
  done
  if [[ -n "$("${COMPOSE[@]}" ps -q nginx 2>/dev/null || true)" ]]; then
    # the config directory is a bind mount: pick up a changed flicktips.v2.conf
    "${COMPOSE[@]}" exec -T nginx nginx -t -q && "${COMPOSE[@]}" exec -T nginx nginx -s reload
  fi
  "${COMPOSE[@]}" ps

  if [[ "$target" == test ]]; then
    cmd_vhost || echo "Test vhost not installed (see above); the containers run on loopback only." >&2
  fi
}

cmd_prune() {
  local keep=() file tag ref
  for file in ../*/.env; do
    [[ -f "$file" ]] || continue
    for tag in $(sed -n 's/^V2_TAG=//p; s/^V2_PREV_TAG=//p' "$file" | unquote); do
      keep+=("$tag")
    done
  done
  docker images --format '{{.Repository}}:{{.Tag}}' | grep "^$PREFIX" | while read -r ref; do
    tag="${ref##*:}"
    for t in ${keep[@]+"${keep[@]}"}; do
      [[ "$tag" == "$t" || "$tag" == "test-$t" || "$tag" == "prod-$t" ]] && continue 2
    done
    docker rmi "$ref" > /dev/null 2>&1 && echo "Removed $ref" || true
  done
  docker image prune -f > /dev/null
  df -h / | tail -1
}

edge_nginx() {
  local names
  if [[ -n "${EDGE_NGINX:-}" ]]; then
    echo "$EDGE_NGINX"
    return
  fi
  # the one nginx bound to :80/:443: the legacy project's before the switchover, flicktips-v2-prod's after it
  names="$(docker ps --filter label=com.docker.compose.service=nginx --format '{{.Names}}')"
  [[ -n "$names" && "$(wc -l <<< "$names")" -eq 1 ]] || die "Cannot tell the edge nginx from: ${names:-<none>}; set EDGE_NGINX=<container>"
  echo "$names"
}

cmd_vhost() {
  local host certs nginx rendered conf_dir
  check_env
  [[ "$(env_get V2_TARGET)" == test ]] || die "vhost is for the test target only"
  host="$(env_get SITE_URL | sed -E 's#^https?://##; s#[:/].*$##')"
  [[ "$host" != flicktips.ru && "$host" != www.flicktips.ru ]] || die "SITE_URL of the test target is the production host"
  certs="$(env_get CERTBOT_DIR)"
  certs="${certs:-/var/www/flicktips.ru/data/certbot}"
  [[ -f "$certs/conf/live/$host/fullchain.pem" ]] \
    || die "No certificate for $host in $certs/conf/live (docs/v2-deploy.md, \"Test domain\")"
  nginx="$(edge_nginx)"

  rendered="$(mktemp)"
  sed -e "s/@SERVER_NAME@/$host/g" \
      -e "s/@WEB_PORT@/$(env_get V2_WEB_PORT)/g" \
      -e "s/@API_PORT@/$(env_get V2_API_PORT)/g" \
      nginx/flicktips.v2-test.conf.template > "$rendered"

  conf_dir="$(conf_mount "$nginx")"
  if [[ -n "$conf_dir" ]]; then
    install -m 644 "$rendered" "$conf_dir/$VHOST_NAME"
  else
    docker cp "$rendered" "$nginx:/etc/nginx/conf.d/$VHOST_NAME"
  fi
  rm -f "$rendered"
  if ! docker exec "$nginx" nginx -t -q; then
    remove_vhost_file "$nginx"
    die "nginx -t failed in $nginx; the test vhost was removed again, nginx was not reloaded"
  fi
  docker exec "$nginx" nginx -s reload
  if [[ -n "$conf_dir" ]]; then
    echo "Test vhost for $host installed in $nginx ($conf_dir/$VHOST_NAME)"
  else
    echo "Test vhost for $host installed in $nginx (lost when that container is recreated: run docker/v2.sh vhost again)"
  fi
}

# host directory bind-mounted as the container's conf.d (the v2 edge), empty for the legacy image
conf_mount() {
  docker inspect --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx/conf.d"}}{{.Source}}{{end}}{{end}}' "$1"
}

remove_vhost_file() {
  local conf_dir
  conf_dir="$(conf_mount "$1")"
  if [[ -n "$conf_dir" ]]; then
    rm -f "$conf_dir/$VHOST_NAME"
  else
    docker exec "$1" rm -f "/etc/nginx/conf.d/$VHOST_NAME"
  fi
}

cmd_vhost_remove() {
  local nginx
  nginx="$(edge_nginx)"
  remove_vhost_file "$nginx"
  docker exec "$nginx" nginx -t -q
  docker exec "$nginx" nginx -s reload
  echo "Test vhost removed from $nginx"
}

case "${1:-}" in
  current) env_get V2_TAG ;;
  up) cmd_up "${2:?tag required}" ;;
  rollback)
    prev="$(env_get V2_PREV_TAG)"
    [[ -n "$prev" ]] || die "No V2_PREV_TAG in .env"
    cmd_up "$prev"
    ;;
  prune) cmd_prune ;;
  vhost) cmd_vhost ;;
  vhost-remove) cmd_vhost_remove ;;
  compose) shift; "${COMPOSE[@]}" "$@" ;;
  *) sed -n '2,16p' "$0"; exit 1 ;;
esac
