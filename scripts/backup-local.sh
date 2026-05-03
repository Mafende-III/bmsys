#!/usr/bin/env bash
#
# scripts/backup-local.sh
# Nightly Postgres dump to /var/backups/bms/.
# Keeps last 7 days locally; older ones get pruned by this script.
set -euo pipefail

BACKUP_DIR="/var/backups/bms"
DATE=$(date +%Y-%m-%d)
RETENTION_DAYS=7
DB_NAME="bms"
DB_USER="bms_user"

mkdir -p "$BACKUP_DIR"

# Read DATABASE_URL from /var/www/bms/.env if available, else require env
if [[ -f /var/www/bms/.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source /var/www/bms/.env
  set +a
fi

OUTFILE="$BACKUP_DIR/bms-${DATE}.sql.gz"

# Use connection URL if available, else local socket.
if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump --no-owner --no-acl "$DATABASE_URL" | gzip -9 > "$OUTFILE"
else
  sudo -u postgres pg_dump --no-owner --no-acl "$DB_NAME" | gzip -9 > "$OUTFILE"
fi

# Sanity check
if [[ ! -s "$OUTFILE" ]]; then
  echo "Backup file is empty: $OUTFILE" >&2
  exit 1
fi

# Prune local files older than RETENTION_DAYS
find "$BACKUP_DIR" -name "bms-*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# Print path so the next step (rclone) can pick it up
echo "$OUTFILE"
