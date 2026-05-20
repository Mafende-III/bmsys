# BMS — Beverage Business Management System

Internal management system for a beverage retail business in Kigali.
See `docs/spec.md` (in your project) for the full specification.

This repo is the **Step 2 skeleton**: schema, auth, golden test, deployment scripts. Phase 1 features build on top.

---

## Stack

- Next.js 15 (App Router) + TypeScript strict mode
- PostgreSQL 16 self-hosted on the same VPS, accessed via `localhost:5432`
- Prisma 6 ORM
- Auth.js v5 with PIN-based credentials, argon2 hashing
- Tailwind CSS
- Vitest for tests (including the **golden test**)
- pg-boss for background jobs (Phase 2+)
- PM2 for process management
- Caddy for HTTPS reverse proxy
- rclone to Google Drive for off-server backups

---

## Local development

Requires Node 20+, pnpm 9+, and a Postgres database.

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env template and fill in DATABASE_URL + AUTH_SECRET
cp .env.example .env
# Generate AUTH_SECRET: openssl rand -base64 32

# 3. Run migrations and seed
pnpm prisma migrate dev
pnpm prisma:seed

# 4. Run the golden test
pnpm test

# 5. Start dev server
pnpm dev
```

Default login after seeding:
- Phone: `+250788000000`
- PIN:   `1234`

Change these in `.env` (`OWNER_PHONE`, `OWNER_PIN`) before seeding, and CHANGE THE PIN immediately on first login.

---

## VPS deployment (`bmsys.streamlinexperts.rw`)

bmsys ships as a 2-container Docker stack (`postgres` + Next.js `app`) behind the **shared Traefik proxy** on the Hostinger VPS — the same convention as `D-RNEC` and `IEWRS`. Cloudflare provides edge SSL; Traefik terminates TLS with a Cloudflare Origin Cert.

**Full runbook:** `docs/HOSTINGER_DEPLOYMENT.md`. Short version:

```bash
# On the VPS, with Traefik already running at /docker/traefik/
git clone https://github.com/Mafende-III/bmsys.git /docker/bmsys
cd /docker/bmsys

# Create .env (DB_PASSWORD, AUTH_SECRET, OWNER_*) — see docs/HOSTINGER_DEPLOYMENT.md
nano .env

# Build + start
docker compose -f docker-compose.prod.yml up -d --build

# Seed the owner user (one time)
docker compose exec app node ./node_modules/prisma/build/index.js db seed

# Wire Traefik routing
cp infrastructure/traefik-dynamic.yml /docker/traefik/dynamic/bmsys.yml
```

Migrations run automatically on every container start (`scripts/docker-entrypoint.sh` → `prisma migrate deploy`).

### Ongoing deployments

Push to `main`. GitHub Actions runs the golden test, then SSHes to the VPS and runs `scripts/deploy.sh`, which pulls, rebuilds the app image, and restarts. Postgres volume is preserved.

Required GitHub Actions secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_SSH_PORT` (optional).

---

## Backups

```bash
# Manual snapshot
docker compose -f /docker/bmsys/docker-compose.prod.yml exec -T postgres \
  pg_dump -U bmsys bmsys | gzip > /var/backups/bmsys/bmsys-$(date +%F).sql.gz
```

A nightly cron + off-server push (rclone to Google Drive) replicating the previous bare-metal pattern is a follow-up task — the docker-compose stack persists Postgres in the named `pg_data` volume, so day-1 data isn't at risk, but off-server copies are not yet wired.

### Restoring

```bash
gunzip -c /var/backups/bmsys/bmsys-YYYY-MM-DD.sql.gz | \
  docker compose -f /docker/bmsys/docker-compose.prod.yml exec -T postgres \
    psql -U bmsys -d bmsys
```

---

## The golden test

`src/tests/golden.test.ts` runs through a full purchase, carton-open, sale-by-unit, sale-by-carton, and adjustment cycle, then asserts every balance matches the immutable ledger.

It runs on every commit via GitHub Actions. **If this test fails, the system is lying about money.** CI blocks the merge.

---

## Phase 1 scope (what comes next)

Now that the skeleton is up, Phase 1 features build on top:

- Products, channels, suppliers CRUD
- Purchases (draft → receive)
- Carton open with tag entry
- Sales (retail by unit, wholesale by carton), all four payment methods
- Cash sessions
- Adjustments
- Expenses with categories and recurring entries
- Daily summary report

See `docs/spec.md` Section 5 for the full phase breakdown.

---

## Project structure

```
bms/
├── prisma/
│   ├── schema.prisma          # Data model (matches spec v0.2)
│   └── seed.ts                # Channels, expense categories, owner user
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Redirects to login or dashboard
│   │   ├── globals.css
│   │   ├── login/page.tsx
│   │   └── dashboard/page.tsx
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── auth.ts            # Auth.js v5 config
│   │   ├── balances.ts        # Stock/credit/loyalty derivation helpers
│   │   └── format.ts          # RWF currency formatting
│   └── tests/
│       └── golden.test.ts     # The integrity test
├── scripts/
│   ├── setup-vps.sh           # One-time VPS bootstrap
│   ├── setup-rclone.sh        # Interactive Google Drive auth
│   ├── deploy.sh              # Pull, migrate, build, restart
│   ├── backup-local.sh        # Nightly pg_dump
│   ├── backup-rclone.sh       # Push to Google Drive with rotation
│   ├── backup-status-email.sh # Morning notification
│   └── install-cron.sh        # Wires the backup pipeline
├── .github/workflows/
│   └── deploy.yml             # CI: test then SSH-deploy
├── Caddyfile                  # HTTPS reverse proxy config
├── ecosystem.config.js        # PM2 config
├── package.json
├── tsconfig.json              # strict + noUncheckedIndexedAccess
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── .env.example
└── .gitignore
```

---

## Conventions

- All money is stored as **integer RWF**. No decimals anywhere. `formatRWF()` handles display.
- All stock is stored in **units**. Cartons convert to units at write time.
- Stock balance is **always** computed from `stock_moves`. Never read a stock-count column (there is none).
- Customer credit and loyalty balances are **always** computed from their ledgers.
- Every multi-step write is wrapped in a Prisma `$transaction`.
- Mutating endpoints accept idempotency keys (see `IdempotencyKey` model).
