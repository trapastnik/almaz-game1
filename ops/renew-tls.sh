#!/usr/bin/env bash
set -euo pipefail

INFRA_DIR="${INFRA_DIR:-/srv/infrastructure}"
RENEWED_MARKER="${INFRA_DIR}/certbot-webroot/.certificate-renewed"

rm -f "${RENEWED_MARKER}"

docker run --rm \
  -v "${INFRA_DIR}/certbot-webroot:/var/www/certbot" \
  -v /etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot:latest renew \
  --webroot \
  --webroot-path /var/www/certbot \
  --deploy-hook "touch /var/www/certbot/.certificate-renewed" \
  --quiet

if [[ ! -f "${RENEWED_MARKER}" ]]; then
  exit 0
fi

docker compose -f "${INFRA_DIR}/docker-compose.yml" exec proxy nginx -t
docker compose -f "${INFRA_DIR}/docker-compose.yml" restart proxy
rm -f "${RENEWED_MARKER}"
