#!/usr/bin/env bash
# Issue the first Let's Encrypt certificate for flicktips.ru (webroot mode).
# Run once, AFTER DNS points flicktips.ru at this server and nginx is up.
#
#   ./docker/certbot-init.sh you@example.com
#
# Then uncomment the HTTPS server block in nginx/conf.d/flicktips.conf and restart nginx.
set -euo pipefail

cd "$(dirname "$0")/.."

EMAIL="${1:?usage: $0 <email>}"
DOMAINS=(-d flicktips.ru -d www.flicktips.ru)

mkdir -p data/certbot/conf data/certbot/www

docker run --rm \
  -v "$PWD/data/certbot/conf:/etc/letsencrypt" \
  -v "$PWD/data/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --email "$EMAIL" --agree-tos --no-eff-email \
  --non-interactive \
  "${DOMAINS[@]}"

echo "Certificate issued. Uncomment the 443 block in nginx/conf.d/flicktips.conf, then:"
echo "  docker compose restart nginx"
