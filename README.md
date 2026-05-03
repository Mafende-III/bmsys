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

### One-time VPS setup (~15 minutes)

SSH to the VPS as root.

```bash
# 1. Clone the repo (cloned dir is /var/www/bms even though the repo is bmsys —
#    deploy paths, DB name, and PM2 app are intentionally named "bms" internally)
git clone https://github.com/Mafende-III/bmsys.git /var/www/bms
cd /var/www/bms

# 2. Install Postgres, Node, pnpm, PM2, Caddy, rclone, firewall
sudo bash scripts/setup-vps.sh
# This creates the bms database and prints DATABASE_URL. SAVE IT.

# 3. Configure environment
cp .env.example .env
# Edit .env: paste DATABASE_URL, set AUTH_SECRET, OWNER_PHONE, OWNER_PIN
nano .env

# 4. Install dependencies, run migrations, seed, build
pnpm install --frozen-lockfile
pnpm prisma migrate deploy
pnpm prisma:seed
pnpm build

# 5. Start the app via PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed instruction

# 6. Configure Caddy for HTTPS
sudo cp Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
# DNS: point bmsys.streamlinexperts.rw A record to this VPS's IP.
# Caddy will auto-issue Let's Encrypt cert on first request.

# 7. Set up Google Drive backups (interactive, one time)
sudo bash scripts/setup-rclone.sh

# 8. Install nightly backup cron
sudo BACKUP_NOTIFY_EMAIL=you@example.com bash scripts/install-cron.sh
```

After step 8, browse to `https://bmsys.streamlinexperts.rw` and sign in.

### Ongoing deployments

Push to `main` on GitHub. The workflow runs the golden test, then SSHes into the VPS and runs `scripts/deploy.sh` which pulls, migrates, builds, and restarts PM2.

Required GitHub Actions secrets:
- `VPS_HOST` — e.g. `bmsys.streamlinexperts.rw` or the IP
- `VPS_USER` — e.g. `root` or a deploy user with sudo for PM2
- `VPS_SSH_KEY` — private key with access
- `VPS_SSH_PORT` — optional, default 22

---

## Backups

Three layers, one cron line at 02:30 every night:

1. **Local** (`/var/backups/bms/`): nightly `pg_dump`, gzipped, last 7 days kept.
2. **Google Drive** (`gdrive:bms-backups/`): pushed via rclone with rotation:
   - `daily/` keeps last 30
   - `weekly/` keeps last 12 (Sundays only)
   - `monthly/` keeps last 12 (1st of month only)
3. **Email status** every morning. Subject says `OK`, `WARN`, or `FAILED` so you know in seconds.

Set `BACKUP_NOTIFY_EMAIL` in `/etc/environment` or root's crontab. Requires `mailutils` configured to send via SMTP, or swap in your provider's API in `scripts/backup-status-email.sh`.

### Restoring

```bash
# Pick a file from /var/backups/bms/ or download from Google Drive
gunzip -c /var/backups/bms/bms-2026-05-04.sql.gz \
  | psql "$DATABASE_URL"
```

For point-in-time recovery, you would need WAL archiving. Out of scope for Phase 1.

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
