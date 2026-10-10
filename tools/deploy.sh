#!/usr/bin/env bash
# Manual deploy. Builds images locally for linux/amd64 (the server has 1 vCPU / <1 GB RAM,
# too small to build), ships them over SSH with docker save/load (no registry), then
# switches the server to the new tag via docker/deploy.sh.
#
#   tools/deploy.sh                 build and deploy all services
#   tools/deploy.sh api web         rebuild only these; the rest are re-tagged on the server
#   tools/deploy.sh --rollback      switch the server back to PREV_TAG
#
# Env: DEPLOY_HOST (default root@45.15.252.159), DEPLOY_PATH (default /var/www/flicktips.ru),
#      ALLOW_DIRTY=1 to deploy uncommitted changes (tag gets a -dirty suffix).
set -euo pipefail

cd "$(dirname "$0")/.."

DEPLOY_HOST="${DEPLOY_HOST:-root@45.15.252.159}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/flicktips.ru}"
SITE_URL="${SITE_URL:-https://flicktips.ru}"
ALL_SERVICES=(web api kp-parser ft-parser nginx)
PREFIX="infamoustill/flicktips-"
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=15 "$DEPLOY_HOST")

remote() {
  "${SSH[@]}" "cd '$DEPLOY_PATH' && $*"
}

health_check() {
  local url code failed=0
  for url in "$SITE_URL/" "$SITE_URL/api/"; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$url" || true)"
    echo "  $url -> $code"
    [[ "$code" == 2* || "$code" == 3* ]] || failed=1
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
if [[ -n "$(git status --porcelain)" ]]; then
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

echo "==> Building ${services[*]} for linux/amd64 (tag $TAG)"
TAG="$TAG" DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build "${services[@]}"

echo "==> Syncing compose config to $DEPLOY_HOST:$DEPLOY_PATH"
rsync -az docker-compose.yml docker "$DEPLOY_HOST:$DEPLOY_PATH/"

current="$(remote 'docker/deploy.sh current')"
echo "==> Server is on ${current:-<unknown>}; removing older flicktips images"
remote "docker/deploy.sh prune '$current'"

images=()
for svc in "${services[@]}"; do
  images+=("$PREFIX$svc:$TAG")
done
echo "==> Uploading ${images[*]}"
docker save "${images[@]}" | gzip | "${SSH[@]}" 'gunzip | docker load'

echo "==> Switching to $TAG"
remote "docker/deploy.sh up '$TAG'"

echo "==> Health check"
sleep 5
health_check
echo "Deployed $TAG"
