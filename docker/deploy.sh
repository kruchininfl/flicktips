#!/usr/bin/env bash
# Server-side deploy script. Run after rsync has copied the repo to DEPLOY_PATH.
#
#   TAG=<git-sha> ./docker/deploy.sh
#
# Pulls the images built by CI and recreates changed containers.
set -euo pipefail

cd "$(dirname "$0")/.."

TAG="${TAG:-latest}"
export TAG

if [[ -n "${DOCKERHUB_USER:-}" && -n "${DOCKERHUB_TOKEN:-}" ]]; then
  echo "Logging in to Docker Hub as ${DOCKERHUB_USER}..."
  echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USER" --password-stdin
fi

echo "Pulling images for tag ${TAG}..."
docker compose pull

echo "Recreating containers..."
docker compose up -d --remove-orphans

echo "Cleaning up dangling images..."
docker image prune -f

echo "Running containers:"
docker compose ps
