#!/usr/bin/env bash
#
# scripts/deploy.sh
# Run on the VPS to deploy a new version. Pull, rebuild app image, restart.
# Postgres is preserved (volume not touched). Migrations run automatically
# in docker-entrypoint.sh on app container start.
set -euo pipefail

cd /docker/bmsys

echo "=== Pulling latest ==="
git pull origin main

echo "=== Rebuilding app + restarting ==="
docker compose -f docker-compose.prod.yml up -d --build app

echo "=== Status ==="
docker compose -f docker-compose.prod.yml ps

echo "Done."
