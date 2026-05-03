#!/usr/bin/env bash
#
# scripts/install-cron.sh
# Installs the nightly backup pipeline as a root cron job.
#
# Schedule: 02:30 local time every night.
#   1. backup-local.sh  (pg_dump, rotate local)
#   2. backup-rclone.sh (push to Google Drive, rotate)
#   3. backup-status-email.sh (notify)
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

REPO_DIR="${REPO_DIR:-/var/www/bms}"
LOG="/var/log/bms-backup.log"
touch "$LOG" && chmod 644 "$LOG"

CRON_LINE="30 2 * * * cd ${REPO_DIR} && bash scripts/backup-local.sh >> ${LOG} 2>&1 && bash scripts/backup-rclone.sh >> ${LOG} 2>&1; bash scripts/backup-status-email.sh >> ${LOG} 2>&1"

# Add (or replace) the cron line
(crontab -l 2>/dev/null | grep -v "scripts/backup-local.sh" ; echo "$CRON_LINE") | crontab -

echo "Cron installed:"
crontab -l | grep backup

echo
echo "Set BACKUP_NOTIFY_EMAIL in /etc/environment or in root's crontab if you want emails:"
echo "  echo 'BACKUP_NOTIFY_EMAIL=you@example.com' >> /etc/environment"
