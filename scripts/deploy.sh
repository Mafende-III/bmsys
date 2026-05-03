#!/usr/bin/env bash
#
# scripts/deploy.sh
# Run on the VPS to deploy a new version after `git pull`.
set -euo pipefail

cd /var/www/bms

echo "=== Pulling latest ==="
git pull origin main

echo "=== Installing dependencies ==="
pnpm install --frozen-lockfile

echo "=== Running migrations ==="
pnpm prisma migrate deploy

echo "=== Generating Prisma client ==="
pnpm prisma generate

echo "=== Building ==="
pnpm build

echo "=== Restarting PM2 ==="
pm2 reload ecosystem.config.js --update-env

echo "Done."
