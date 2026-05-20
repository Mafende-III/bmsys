#!/bin/sh
# bmsys app container entrypoint.
# Applies pending Prisma migrations, then execs `next start`.
# `prisma migrate deploy` is idempotent — no-op if the DB is up to date.
set -e

echo "==> Applying Prisma migrations"
pnpm prisma migrate deploy

# Ensure the uploads dir exists. Harmless if it already does.
# Ownership has to be fixed at the volume level when needed (see Dockerfile).
mkdir -p "${UPLOADS_DIR:-/app/uploads}" 2>/dev/null || true

echo "==> Starting Next.js on :${PORT:-3000}"
exec pnpm start
