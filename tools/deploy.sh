#!/usr/bin/env bash
# Manual deploy. Builds images locally for linux/amd64 (the server has 1 vCPU / <1 GB RAM,
# too small to build) and pushes them to Docker Hub; the server pulls them and switches to
# the new tag via docker/deploy.sh. Uploading straight to the server is not an option:
# traffic from abroad to it is throttled to ~50 KB/s, while its Docker Hub pulls are fast.
#
#   tools/deploy.sh                 build and deploy all services
#   tools/deploy.sh api web         rebuild only these; the rest are re-tagged on the server
#   tools/deploy.sh --rollback      switch the server back to PREV_TAG
#
# Needs `docker login` as infamoustill locally; the repos are public, so the server pulls
# without credentials. Images must stay secret-free: secrets live only in the server's .env.
#
# Env: DEPLOY_HOST (default root@45.15.252.159), DEPLOY_PATH (default /var/www/flicktips.ru),
#      ALLOW_DIRTY=1 to deploy uncommitted changes (tag gets a -dirty suffix),
#      BUILDX_CACHE=gha to use the GitHub Actions build cache (set by .github/workflows/deploy.yml).
set -euo pipefail

cd "$(dirname "$0")/.."

DEPLOY_HOST="${DEPLOY_HOST:-root@45.15.252.159}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/flicktips.ru}"
SITE_URL="${SITE_URL:-https://flicktips.ru}"
ALL_SERVICES=(web api kp-parser ft-parser tg-bot nginx)
PREFIX="infamoustill/flicktips-"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 "$DEPLOY_HOST")

remote() {
  "${SSH[@]}" "cd '$DEPLOY_PATH' && $*"
}

health_check() {
  local url code failed attempt
  # web (SSR) needs up to a minute to boot on the 1-vCPU server, so retry before failing.
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
    failed=0
    for url in "$SITE_URL/" "$SITE_URL/api/"; do
      code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url" || true)"
      [[ "$code" == 2* || "$code" == 3* ]] || failed=1
    done
    [[ "$failed" == 0 ]] && break
    sleep 5
  done
  for url in "$SITE_URL/" "$SITE_URL/api/"; do
    echo "  $url -> $(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url" || true)"
  done
  if [[ "$failed" == 1 ]]; then
    echo "Health check failed. Roll back with: tools/deploy.sh --rollback" >&2
    exit 1
  fi
}

if [[ "${1:-}" == "--rollback" ]]; then
  prev="$(remote "sed -n 's/^PREV_TAG=//p' .env 2>/dev/null | tail -1")"
  if [[ -z "$prev" ]]; then
    echo "No PREV_TAG in $DEPLOY_PATH/.env" >&2
    exit 1
  fi
  echo "==> Rolling back to $prev"
  remote "docker/deploy.sh up '$prev'"
  health_check
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

services=("$@")
[[ ${#services[@]} -gt 0 ]] || services=("${ALL_SERVICES[@]}")
for svc in "${services[@]}"; do
  [[ " ${ALL_SERVICES[*]} " == *" $svc "* ]] || { echo "Unknown service: $svc" >&2; exit 1; }
done

for svc in "${services[@]}"; do
  echo "==> Building and pushing $PREFIX$svc:$TAG for linux/amd64"
  cache=()
  if [[ "${BUILDX_CACHE:-}" == gha ]]; then
    cache=(--cache-from "type=gha,scope=$svc" --cache-to "type=gha,mode=max,scope=$svc")
  fi
  if [[ "$svc" == api ]]; then
    docker buildx build --platform linux/amd64 --push ${cache[@]+"${cache[@]}"} -t "$PREFIX$svc:$TAG" -f api/Dockerfile .
  else
    docker buildx build --platform linux/amd64 --push ${cache[@]+"${cache[@]}"} -t "$PREFIX$svc:$TAG" "./$svc"
  fi
done

echo "==> Syncing compose config to $DEPLOY_HOST:$DEPLOY_PATH"
rsync -az docker-compose.yml .env.example docker "$DEPLOY_HOST:$DEPLOY_PATH/"

current="$(remote 'docker/deploy.sh current')"
echo "==> Server is on ${current:-<unknown>}; removing older flicktips images"
remote "docker/deploy.sh prune '$current'"

echo "==> Switching to $TAG"
remote "docker/deploy.sh up '$TAG' ${services[*]}"

echo "==> Health check"
health_check
echo "Deployed $TAG"
