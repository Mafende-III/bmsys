#!/usr/bin/env bash
#
# scripts/backup-rclone.sh
# Copy the latest local backup to Google Drive and apply rotation:
#   daily/   keep last 30
#   weekly/  keep last 12  (one per Sunday)
#   monthly/ keep last 12  (one per 1st of month)
#
# Runs after backup-local.sh.
set -euo pipefail

BACKUP_DIR="/var/backups/bms"
REMOTE="gdrive:bms-backups"

DATE=$(date +%Y-%m-%d)
DOW=$(date +%u)  # 1=Monday ... 7=Sunday
DOM=$(date +%-d) # 1..31

# The latest backup file
LATEST=$(ls -1t "$BACKUP_DIR"/bms-*.sql.gz 2>/dev/null | head -n1 || true)
if [[ -z "$LATEST" ]]; then
  echo "No local backup found in $BACKUP_DIR" >&2
  exit 1
fi

# Always copy to daily/
rclone copy "$LATEST" "$REMOTE/daily/" --no-traverse

# On Sunday, also copy to weekly/
if [[ "$DOW" == "7" ]]; then
  rclone copy "$LATEST" "$REMOTE/weekly/" --no-traverse
fi

# On the 1st, also copy to monthly/
if [[ "$DOM" == "1" ]]; then
  rclone copy "$LATEST" "$REMOTE/monthly/" --no-traverse
fi

# ---- Rotation ----

# daily/ keep 30
mapfile -t DAILY_FILES < <(rclone lsf "$REMOTE/daily/" --files-only | sort)
if (( ${#DAILY_FILES[@]} > 30 )); then
  TO_DELETE=$(( ${#DAILY_FILES[@]} - 30 ))
  for f in "${DAILY_FILES[@]:0:$TO_DELETE}"; do
    rclone deletefile "$REMOTE/daily/$f"
  done
fi

# weekly/ keep 12
mapfile -t WEEKLY_FILES < <(rclone lsf "$REMOTE/weekly/" --files-only | sort)
if (( ${#WEEKLY_FILES[@]} > 12 )); then
  TO_DELETE=$(( ${#WEEKLY_FILES[@]} - 12 ))
  for f in "${WEEKLY_FILES[@]:0:$TO_DELETE}"; do
    rclone deletefile "$REMOTE/weekly/$f"
  done
fi

# monthly/ keep 12
mapfile -t MONTHLY_FILES < <(rclone lsf "$REMOTE/monthly/" --files-only | sort)
if (( ${#MONTHLY_FILES[@]} > 12 )); then
  TO_DELETE=$(( ${#MONTHLY_FILES[@]} - 12 ))
  for f in "${MONTHLY_FILES[@]:0:$TO_DELETE}"; do
    rclone deletefile "$REMOTE/monthly/$f"
  done
fi

echo "Pushed $(basename "$LATEST") to Google Drive."
