#!/bin/sh
# bmsys app container entrypoint.
# Applies pending Prisma migrations, then execs `next start`.
# `prisma migrate deploy` is idempotent — no-op if the DB is up to date.
set -e

echo "==> Applying Prisma migrations"
pnpm prisma migrate deploy

echo "==> Starting Next.js on :${PORT:-3000}"
exec pnpm start
