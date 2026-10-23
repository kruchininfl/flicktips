#!/usr/bin/env bash
# Manual deploy of the v2 stack (docker-compose.v2.yml) to one target. Run by .github/workflows/deploy-v2.yml, or by
# hand from a dev Mac (needs `docker login` as infamoustill and SSH to the server). Runbook: docs/v2-deploy.md.
#
#   tools/deploy-v2.sh test              build api, web (for the test URL), tg-bot; switch the test target
#   tools/deploy-v2.sh prod              the same for production (web built for https://flicktips.ru)
#   tools/deploy-v2.sh <target> --rollback
#
# Images are built here for linux/amd64 (the server is too small to build) and pushed to Docker Hub as
# infamoustill/flicktips2-{api,tg-bot}:<sha> and infamoustill/flicktips2-web:<target>-<sha>. The flicktips2- prefix
# keeps them out of the legacy docker/deploy.sh prune (it removes every infamoustill/flicktips-* image it does not
# deploy). Images must stay secret-free: secrets live only in the target's .env on the server.
#
# Env: DEPLOY_HOST (default root@45.15.252.159), DEPLOY_V2_PATH (default /var/www/flicktips-v2; the target directory
#      is $DEPLOY_V2_PATH/<target>), V2_TEST_SITE_URL (default https://dev.flicktips.ru), ALLOW_DIRTY=1,
#      BUILDX_CACHE=gha (set by the workflow), NODE_IMAGE (base image, default node:22-slim).
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET="${1:-}"
DEPLOY_HOST="${DEPLOY_HOST:-root@45.15.252.159}"
DEPLOY_V2_PATH="${DEPLOY_V2_PATH:-/var/www/flicktips-v2}"
REMOTE_DIR="$DEPLOY_V2_PATH/$TARGET"
PREFIX="infamoustill/flicktips2-"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 "$DEPLOY_HOST")

case "$TARGET" in
  # ports: docker-compose.v2.yml header; the web image bakes the API port in
  prod) SITE_URL="https://flicktips.ru" API_PORT=3102 ;;
  test) SITE_URL="${V2_TEST_SITE_URL:-https://dev.flicktips.ru}" API_PORT=3202 ;;
  *) sed -n '2,18p' "$0"; exit 1 ;;
esac
SITE_URL="${SITE_URL%/}"
[[ "$TARGET" == prod || ( "$SITE_URL" != https://flicktips.ru && "$SITE_URL" != https://www.flicktips.ru ) ]] \
  || { echo "The test target cannot use the production URL" >&2; exit 1; }

remote() {
  "${SSH[@]}" "cd '$REMOTE_DIR' && $*"
}

# a non-secret value from the target's .env, without the quotes the server's .env puts around values
remote_env() {
  remote "test -f .env && sed -n 's/^$1=//p' .env | tail -1" | sed -E "s/^\"(.*)\"\$/\\1/; s/^'(.*)'\$/\\1/"
}

public_check() {
  local url code body failed=0
  for url in "$SITE_URL/" "$SITE_URL/robots.txt"; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url" || true)"
    echo "  $url -> $code"
    [[ "$code" == 2* ]] || failed=1
  done
  body="$(curl -s --max-time 20 "$SITE_URL/api/health" || true)"
  echo "  $SITE_URL/api/health -> $body"
  [[ "$body" == *'"status":"ok"'* ]] || failed=1
  if [[ "$failed" == 1 ]]; then
    echo "Public check failed. Roll back with: tools/deploy-v2.sh $TARGET --rollback" >&2
    exit 1
  fi
}

# the public URL shows v2 on test always, on prod only once the `edge` profile (v2 nginx) is on
check_public_if_live() {
  local profiles
  profiles="$(remote_env COMPOSE_PROFILES)"
  if [[ "$TARGET" == test || ",$profiles," == *",edge,"* ]]; then
    echo "==> Public check of $SITE_URL"
    public_check
  else
    echo "==> $SITE_URL is still served by the legacy stack (no 'edge' profile); v2 runs on loopback only"
  fi
}

# fail before building when the target directory is not prepared (docs/v2-deploy.md, "Server preparation")
remote_site="$(remote_env SITE_URL || true)"
if [[ -z "$remote_site" ]]; then
  echo "$DEPLOY_HOST:$REMOTE_DIR/.env is missing or has no SITE_URL; create it from .env.v2.example first" >&2
  exit 1
fi
if [[ "$remote_site" != "$SITE_URL" ]]; then
  echo "Server .env has SITE_URL=$remote_site, this build is for $SITE_URL" >&2
  exit 1
fi

if [[ "${2:-}" == "--rollback" ]]; then
  echo "==> Rolling back $TARGET"
  remote "docker/v2.sh rollback"
  check_public_if_live
  exit 0
fi

TAG="$(git rev-parse HEAD)"
if [[ -n "$(git status --porcelain -- . ':!.claude')" ]]; then
  if [[ -z "${ALLOW_DIRTY:-}" ]]; then
    echo "Working tree has uncommitted changes; commit them or set ALLOW_DIRTY=1" >&2
    exit 1
  fi
  TAG="$TAG-dirty"
fi

build() {
  local name="$1" ref="$2" scope="$3"
  shift 3
  local cache=()
  if [[ "${BUILDX_CACHE:-}" == gha ]]; then
    cache=(--cache-from "type=gha,scope=$scope" --cache-to "type=gha,mode=max,scope=$scope")
  fi
  echo "==> Building and pushing $ref for linux/amd64"
  docker buildx build --platform linux/amd64 --push ${cache[@]+"${cache[@]}"} \
    --build-arg "NODE_IMAGE=${NODE_IMAGE:-node:22-slim}" "$@" -t "$ref" -f "apps/$name/Dockerfile" .
}

build api "${PREFIX}api:$TAG" v2-api
build tg-bot "${PREFIX}tg-bot:$TAG" v2-tg-bot
build web "${PREFIX}web:$TARGET-$TAG" "v2-web-$TARGET" \
  --build-arg "NEXT_PUBLIC_SITE_URL=$SITE_URL" --build-arg "API_INTERNAL_URL=http://127.0.0.1:$API_PORT"

echo "==> Syncing compose config to $DEPLOY_HOST:$REMOTE_DIR"
"${SSH[@]}" "mkdir -p '$REMOTE_DIR/docker' '$REMOTE_DIR/nginx'"
rsync -az docker-compose.v2.yml .env.v2.example "$DEPLOY_HOST:$REMOTE_DIR/"
rsync -az docker/v2.sh "$DEPLOY_HOST:$REMOTE_DIR/docker/"
rsync -az nginx/conf.d/flicktips.v2.conf.example "$DEPLOY_HOST:$REMOTE_DIR/nginx/flicktips.v2.conf"
rsync -az nginx/conf.d/flicktips.v2-test.conf.template "$DEPLOY_HOST:$REMOTE_DIR/nginx/"

echo "==> Removing flicktips2 images no target uses"
remote "docker/v2.sh prune"

echo "==> Switching $TARGET to $TAG"
remote "docker/v2.sh up '$TAG'"

check_public_if_live
echo "Deployed $TAG to $TARGET"
