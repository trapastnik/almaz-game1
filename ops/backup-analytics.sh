#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/srv/projects/almaz-game1}"
BACKUP_DIR="${BACKUP_DIR:-/srv/backups/almaz-game1}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL_PATH="${BACKUP_DIR}/analytics-${TIMESTAMP}.sql.gz"
TEMP_PATH="${FINAL_PATH}.tmp"

install -d -m 700 "${BACKUP_DIR}"
umask 077

cleanup() {
  rm -f "${TEMP_PATH}"
}
trap cleanup EXIT

docker compose -f "${PROJECT_DIR}/compose.yaml" exec -T analytics-db \
  pg_dump --no-owner --no-privileges -U analytics -d analytics | gzip -9 > "${TEMP_PATH}"

gzip -t "${TEMP_PATH}"
mv "${TEMP_PATH}" "${FINAL_PATH}"
sha256sum "${FINAL_PATH}" > "${FINAL_PATH}.sha256"

find "${BACKUP_DIR}" -type f \( -name 'analytics-*.sql.gz' -o -name 'analytics-*.sql.gz.sha256' \) \
  -mtime "+${RETENTION_DAYS}" -delete

printf 'Analytics backup created: %s\n' "${FINAL_PATH}"
