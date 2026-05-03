# LOCAL_SETUP.md — Get from zero to coding in 10 minutes

This file walks you through setting up the project locally, pushing to GitHub, opening Claude Code, and starting Phase 1 development.

---

## 0. Prerequisites

On your local machine you need:
- Node.js 20+ (`node --version`)
- pnpm 9+ (`npm install -g pnpm@9`)
- Git
- Postgres 16 (locally, for development) — or skip and develop against the VPS DB
- Claude Code installed (https://claude.com/product/claude-code)

---

## 1. Confirm the local folder

If you are reading this file, you are already inside the project folder. Confirm:

```bash
pwd
# .../bmsys

ls -la
# Should show: prisma/, src/, scripts/, docs/, CLAUDE.md, README.md, package.json, etc.
```

If you are setting up on a fresh machine and only have the tarball, extract it first:

```bash
mkdir -p ~/Projects/bmsys && cd ~/Projects/bmsys
tar -xzf ~/Downloads/bmsys-skeleton.tar.gz --strip-components=1
```

---

## 2. Initialize git and connect to GitHub

```bash
git init
git branch -M main
git add .
git commit -m "feat: initial skeleton (schema, auth, golden test, deploy scripts)"

# Add the remote (HTTPS)
git remote add origin https://github.com/Mafende-III/bmsys.git
```

### First push (uses your PAT once)

When git asks for username and password during the push:
- **Username:** `Mafende-III`
- **Password:** paste your PAT (the long `github_pat_...` string)

```bash
git push -u origin main
```

After this push, git on your machine remembers the credentials (depending on your OS keychain / credential helper). You won't need to paste the PAT again on this machine.

**On rotation:** when you rotate the PAT after go-live, run `git config --unset-all credential.helper` (or update via your OS keychain) and re-push to refresh the saved token.

> The PAT is **never** stored in any file in the repo. It only ever lives in your OS credential store. Verify by running `grep -r "github_pat" .` and confirming nothing is found.

---

## 3. Set up local Postgres (optional, recommended for dev)

If you have Postgres 16 locally:

```bash
createdb bmsys_dev
```

If you don't, you can install it via Homebrew (Mac), `apt` (Linux), or Docker:

```bash
docker run --name bmsys-pg -e POSTGRES_PASSWORD=devpass \
  -e POSTGRES_DB=bmsys_dev -p 5432:5432 -d postgres:16
```

---

## 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Local dev
DATABASE_URL="postgresql://USERNAME:PASSWORD@localhost:5432/bmsys_dev?schema=public"

# Generate a long random secret
AUTH_SECRET="$(openssl rand -base64 32)"   # paste the actual output
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST=true

# Initial owner
OWNER_NAME="Owner"
OWNER_PHONE="+250788000000"
OWNER_PIN="1234"
```

---

## 5. Install dependencies and initialize the database

```bash
pnpm install
pnpm prisma migrate dev --name init
pnpm prisma:seed
```

You should see:
```
  Owner user: +250788000000
  Channels: retail, wholesale, delivery, online
  Expense categories: 7 seeded
Seed complete.
```

---

## 6. Run the golden test (sanity check)

```bash
pnpm test
```

The golden test runs the full purchase → carton open → sales → adjustment cycle and asserts every balance matches the immutable ledger.

If this passes, the foundation is sound and you are ready to code.

---

## 7. Start the dev server

```bash
pnpm dev
```

Browse to `http://localhost:3000`. Sign in with:
- Phone: `+250788000000`
- PIN: `1234`

You will land on the placeholder dashboard.

---

## 8. Open Claude Code in this folder

```bash
cd ~/projects/bmsys
claude
```

Claude Code automatically reads `CLAUDE.md` (project context) and `docs/spec.md` is one tool call away. The skeleton is now ready for Phase 1 development.

---

## 9. The initial prompt to paste into Claude Code

See `INITIAL_PROMPT.md` in this repo. Paste its entire contents as your first message to Claude Code. It will:
1. Verify the skeleton compiles and tests pass
2. Read the spec and understand the integrity rules
3. Start **Phase 1, Sprint 1: Products CRUD**

---

## 10. VPS deployment (do AFTER Phase 1 Sprint 1 is working locally)

When you are ready to deploy to `bmsys.streamlinexperts.rw`:

```bash
# SSH to the VPS
ssh root@187.124.115.162

# Clone (the repo is now on GitHub)
git clone https://github.com/Mafende-III/bmsys.git /var/www/bmsys
cd /var/www/bmsys

# Run the one-time VPS setup
sudo bash scripts/setup-vps.sh
# SAVE THE PRINTED DB PASSWORD

# Configure
cp .env.example .env
nano .env   # paste DATABASE_URL, generate AUTH_SECRET, set AUTH_URL

# Build and start
pnpm install --frozen-lockfile
pnpm prisma migrate deploy
pnpm prisma:seed
pnpm build
pm2 start ecosystem.config.js && pm2 save && pm2 startup

# HTTPS
sudo cp Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy

# Backups (Google Drive)
sudo bash scripts/setup-rclone.sh
sudo BACKUP_NOTIFY_EMAIL=you@example.com bash scripts/install-cron.sh
```

DNS is already pointed (`bmsys.streamlinexperts.rw → 187.124.115.162`). Caddy auto-issues the Let's Encrypt cert on first request.

Browse to `https://bmsys.streamlinexperts.rw`.

---

## Troubleshooting

**`pnpm test` fails on golden test:**
- Verify Postgres is running and `DATABASE_URL` in `.env` is correct
- Check that migrations ran: `pnpm prisma migrate status`

**Auth.js error about AUTH_SECRET:**
- Make sure `AUTH_SECRET` is set in `.env` and is at least 32 chars

**Prisma client error after schema change:**
- Run `pnpm prisma generate` then restart dev server

**Push to GitHub asks for credentials every time:**
- Mac: install `gh` CLI and run `gh auth login`
- Linux: `git config --global credential.helper store` (less secure, plain text in `~/.git-credentials`)
- Windows: Git Credential Manager handles this automatically
