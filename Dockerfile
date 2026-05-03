# syntax=docker/dockerfile:1.7
# bmsys production Dockerfile — Next.js 15 + Prisma 6 + pnpm
#
# 3-stage build. The runner carries the full builder node_modules tree
# rather than re-installing or extracting standalone, because Next.js
# standalone tracing and pnpm's symlink layout don't get along.
#
# Build:
#   docker build -t bmsys-app .
# Run (behind shared Traefik on the proxy network):
#   docker compose -f docker-compose.prod.yml up -d --build

# ---- Stage 1: dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl \
    && corepack enable \
    && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Stage 2: build ----
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl \
    && corepack enable \
    && corepack prepare pnpm@9.15.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Prisma client must be generated before next build.
RUN pnpm prisma generate
RUN pnpm build

# ---- Stage 3: runner ----
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache curl libc6-compat openssl \
    && corepack enable \
    && corepack prepare pnpm@9.15.0 --activate \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Carry the full builder context so pnpm symlinks resolve at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml

COPY --chown=nextjs:nodejs scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:3000/login || exit 1

CMD ["./docker-entrypoint.sh"]
