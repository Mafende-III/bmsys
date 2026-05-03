#!/usr/bin/env bash
#
# scripts/setup-rclone.sh
# Interactive Google Drive auth for rclone.
# Run this ONCE on the VPS, follow the prompts.
#
# Creates a remote named 'gdrive' with a folder dedicated to BMS backups.
set -euo pipefail

cat <<'EOF'
==========================================================
rclone Google Drive setup
==========================================================

You are about to authorize rclone to write to a Google Drive folder.

Steps:
  1. rclone will give you a URL.
  2. Open it on your laptop, sign in with the Google account that
     should hold the backups.
  3. Allow access. rclone gets a token and finishes setup.

When rclone asks:
  - name: gdrive
  - storage: drive
  - client_id: leave blank (uses rclone defaults)
  - client_secret: leave blank
  - scope: 1 (Full access)
  - service_account_file: leave blank
  - Edit advanced config: no
  - Use auto config: no  (because this is a remote VPS, not your laptop)
  - Configure as headless: yes
==========================================================
EOF

read -p "Press Enter to launch rclone config..."
rclone config

echo
echo "Verifying the remote works..."
rclone mkdir gdrive:bms-backups
rclone lsd gdrive:bms-backups || {
  echo "Could not access gdrive:bms-backups. Re-run this script." >&2
  exit 1
}

echo
echo "OK. Backups will go to: gdrive:bms-backups/"
