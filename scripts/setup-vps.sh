#!/usr/bin/env bash
#
# scripts/setup-vps.sh
# One-time setup on a fresh Ubuntu 22.04 / 24.04 VPS.
# Installs: Postgres 16, Node 20 LTS, pnpm, PM2, Caddy, rclone.
# Creates the bms database and user.
#
# Usage: sudo bash scripts/setup-vps.sh
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root (use sudo)." >&2
  exit 1
fi

echo "=== Updating apt and installing base packages ==="
apt-get update
apt-get install -y curl ca-certificates gnupg lsb-release ufw fail2ban git unzip

echo "=== Installing PostgreSQL 16 ==="
install -d /etc/apt/keyrings
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | gpg --dearmor -o /etc/apt/keyrings/postgres.gpg
echo "deb [signed-by=/etc/apt/keyrings/postgres.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list
apt-get update
apt-get install -y postgresql-16 postgresql-client-16
systemctl enable --now postgresql

echo "=== Installing Node 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

echo "=== Installing pnpm and PM2 ==="
npm install -g pnpm@9 pm2@latest

echo "=== Installing Caddy ==="
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

echo "=== Installing rclone (for Google Drive backups) ==="
curl -fsSL https://rclone.org/install.sh | bash

echo "=== Setting up firewall ==="
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "=== Creating bms Postgres database and user ==="
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-24)

sudo -u postgres psql <<EOF
CREATE USER bms_user WITH ENCRYPTED PASSWORD '${DB_PASSWORD}';
CREATE DATABASE bms OWNER bms_user;
GRANT ALL PRIVILEGES ON DATABASE bms TO bms_user;
EOF

echo
echo "=========================================================="
echo "Setup complete."
echo
echo "Postgres database created:"
echo "  database: bms"
echo "  user:     bms_user"
echo "  password: ${DB_PASSWORD}"
echo
echo "Save the password. Add it to your .env file as:"
echo "  DATABASE_URL=\"postgresql://bms_user:${DB_PASSWORD}@localhost:5432/bms?schema=public\""
echo
echo "Next:"
echo "  1. Clone the repo into /var/www/bms"
echo "  2. Create /var/www/bms/.env from .env.example"
echo "  3. cd /var/www/bms && pnpm install && pnpm prisma migrate deploy && pnpm prisma:seed && pnpm build"
echo "  4. pm2 start ecosystem.config.js && pm2 save && pm2 startup"
echo "  5. cp Caddyfile /etc/caddy/Caddyfile && systemctl reload caddy"
echo "  6. bash scripts/setup-rclone.sh   # interactive Google Drive auth"
echo "  7. bash scripts/install-cron.sh   # installs nightly backup + status email"
echo "=========================================================="
