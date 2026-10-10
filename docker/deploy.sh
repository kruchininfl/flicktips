#!/usr/bin/env bash
# Server-side half of tools/deploy.sh. Images arrive via `docker load`; nothing is
# pulled from a registry. The active tag lives in .env (TAG, PREV_TAG).
#
#   docker/deploy.sh current               print the active tag
#   docker/deploy.sh up <tag>              switch all services to <tag>; services without
#                                          an image for <tag> are re-tagged from the current one
#   docker/deploy.sh prune <keep-tag...>   remove flicktips images with any other tag
#
# Rollback: docker/deploy.sh up "$(sed -n 's/^PREV_TAG=//p' .env)"
set -euo pipefail

cd "$(dirname "$0")/.."

SERVICES=(web api kp-parser ft-parser nginx)
PREFIX="infamoustill/flicktips-"

env_get() {
  [[ -f .env ]] && sed -n "s/^$1=//p" .env | tail -1 || true
}

env_set() {
  touch .env
  if grep -q "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    echo "$1=$2" >> .env
  fi
}

current_tag() {
  local tag id
  tag="$(env_get TAG)"
  if [[ -z "$tag" ]]; then
    id="$(docker compose ps -q web 2>/dev/null || true)"
    [[ -n "$id" ]] && tag="$(docker inspect --format '{{.Config.Image}}' "$id" | sed 's/.*://')"
  fi
  echo "$tag"
}

cmd_up() {
  local new="$1" cur svc
  cur="$(current_tag)"

  for svc in "${SERVICES[@]}"; do
    if ! docker image inspect "$PREFIX$svc:$new" > /dev/null 2>&1; then
      if [[ -z "$cur" ]]; then
        echo "No image $PREFIX$svc:$new and no current tag to re-tag from" >&2
        exit 1
      fi
      echo "Re-tagging $PREFIX$svc:$cur -> $new"
      docker tag "$PREFIX$svc:$cur" "$PREFIX$svc:$new"
    fi
  done

  if [[ -n "$cur" && "$cur" != "$new" ]]; then
    env_set PREV_TAG "$cur"
  fi
  env_set TAG "$new"

  docker compose up -d --pull never --remove-orphans
  docker compose ps
}

cmd_prune() {
  local ref tag keep
  docker images --format '{{.Repository}}:{{.Tag}}' | grep "^$PREFIX" | while read -r ref; do
    tag="${ref##*:}"
    for keep in "$@"; do
      [[ "$tag" == "$keep" ]] && continue 2
    done
    docker rmi "$ref" > /dev/null 2>&1 && echo "Removed $ref" || true
  done
  docker image prune -f > /dev/null
  df -h / | tail -1
}

case "${1:-}" in
  current) current_tag ;;
  up) cmd_up "${2:?tag required}" ;;
  prune) shift; cmd_prune "$@" ;;
  *) sed -n '2,10p' "$0"; exit 1 ;;
esac
