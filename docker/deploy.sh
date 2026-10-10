#!/usr/bin/env bash
# Server-side half of tools/deploy.sh. Freshly built images are pulled from Docker Hub
# (public repos); the active tag lives in .env (TAG, PREV_TAG).
#
#   docker/deploy.sh current               print the active tag
#   docker/deploy.sh up <tag> [service...] pull <tag> for the listed services, re-tag the
#                                          rest from the current tag, switch all to <tag>
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

check_env() {
  local name missing=()
  for name in $(sed -n '/^# Optional/q; s/^\([A-Z_]*\)=.*/\1/p' .env.example); do
    [[ -n "$(env_get "$name")" ]] || missing+=("$name")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "Missing in .env (see .env.example): ${missing[*]}" >&2
    exit 1
  fi
}

cmd_up() {
  local new="$1" cur svc
  shift
  check_env
  cur="$(current_tag)"

  for svc in "$@"; do
    docker pull "$PREFIX$svc:$new"
  done

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
  up) shift; cmd_up "${1:?tag required}" "${@:2}" ;;
  prune) shift; cmd_prune "$@" ;;
  *) sed -n '2,10p' "$0"; exit 1 ;;
esac
