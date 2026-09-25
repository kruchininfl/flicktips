#!/usr/bin/env bash
# Renew the Let's Encrypt certificate via webroot and reload nginx.
# Intended to run from cron once or twice a day.
set -euo pipefail

cd "$(dirname "$0")/.."

DATA_DIR="$PWD/data/certbot"

docker run --rm \
  -v "$DATA_DIR/conf:/etc/letsencrypt" \
  -v "$DATA_DIR/www:/var/www/certbot" \
  certbot/certbot renew \
  --webroot --webroot-path /var/www/certbot \
  --quiet

docker compose exec -T nginx nginx -s reload
