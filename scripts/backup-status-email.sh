#!/usr/bin/env bash
#
# scripts/backup-status-email.sh
# Sends a short status email after backups run.
#
# Subject: "BMS backup OK 2026-05-04" or "BMS backup FAILED 2026-05-04"
# Body:    last backup file size, both local + Drive, plus tail of any error log
#
# Requires `mail` (apt install mailutils) configured to send via SMTP.
# Or substitute curl + your provider's API.
set -uo pipefail

DATE=$(date +%Y-%m-%d)
TO="${BACKUP_NOTIFY_EMAIL:-}"
LOG="/var/log/bms-backup.log"
BACKUP_DIR="/var/backups/bms"
REMOTE="gdrive:bms-backups"

if [[ -z "$TO" ]]; then
  echo "BACKUP_NOTIFY_EMAIL not set; skipping email."
  exit 0
fi

LATEST_LOCAL=$(ls -1t "$BACKUP_DIR"/bms-*.sql.gz 2>/dev/null | head -n1 || true)

if [[ -z "$LATEST_LOCAL" || ! -s "$LATEST_LOCAL" ]]; then
  STATUS="FAILED"
  BODY="No local backup found for ${DATE}.

Last 50 lines of ${LOG}:
$(tail -n 50 "$LOG" 2>/dev/null || echo '(no log)')"
else
  LOCAL_SIZE=$(du -h "$LATEST_LOCAL" | cut -f1)
  REMOTE_LISTING=$(rclone lsl "$REMOTE/daily/" 2>&1 | tail -n 5 || echo "(rclone error)")

  if grep -qi "error\|failed" "$LOG" 2>/dev/null; then
    STATUS="WARN"
  else
    STATUS="OK"
  fi

  BODY="Backup ${STATUS} for ${DATE}.

Local file: ${LATEST_LOCAL}
Local size: ${LOCAL_SIZE}

Recent on Google Drive (daily/):
${REMOTE_LISTING}

Last 20 lines of ${LOG}:
$(tail -n 20 "$LOG" 2>/dev/null || echo '(no log)')"
fi

SUBJECT="BMS backup ${STATUS} ${DATE}"

echo "$BODY" | mail -s "$SUBJECT" "$TO" || {
  echo "mail command failed. Is mailutils configured?" >&2
  exit 1
}
