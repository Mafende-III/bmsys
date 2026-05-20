# bmsys Deployment (Traefik-integrated)

Deploy bmsys to the shared Hostinger VPS (`187.124.115.162`) behind the central Traefik reverse proxy.

**Prereqs:** Traefik already running at `/docker/traefik/` and owning ports 80/443. The `proxy` Docker network exists. Same conventions as `D-RNEC` and `IEWRS`.

---

## Step 1 — Cloudflare DNS

A record for `streamlinexperts.rw` zone, **Proxied (orange cloud)**:

| Name | Value |
|------|-------|
| `bmsys` | 187.124.115.162 |

Cloudflare SSL/TLS mode: **Full (strict)**.

DNS is already set per the user's note (`bmsys.streamlinexperts.rw → 187.124.115.162`). Confirm it's proxied through Cloudflare, not DNS-only.

## Step 2 — Cloudflare Origin Cert into Traefik

Generate or reuse a Cloudflare Origin Certificate covering `bmsys.streamlinexperts.rw` (or a wildcard `*.streamlinexperts.rw` if you have one). Place it on the VPS:

```bash
# On the VPS as root
mkdir -p /docker/traefik/certs
# Paste cert contents:
nano /docker/traefik/certs/bmsys.crt
nano /docker/traefik/certs/bmsys.key
chmod 600 /docker/traefik/certs/bmsys.key
```

Then declare it for Traefik:

```bash
cat > /docker/traefik/dynamic/bmsys-tls.yml <<'EOF'
tls:
  certificates:
    - certFile: /certs/bmsys.crt
      keyFile: /certs/bmsys.key
EOF
```

Traefik auto-reloads — `docker logs traefik --tail 5` should be quiet.

## Step 3 — Clone the repo

```bash
mkdir -p /docker/bmsys
git clone https://github.com/Mafende-III/bmsys.git /docker/bmsys
cd /docker/bmsys
```

For private-repo access, use a fine-grained PAT scoped to this repo:
```bash
git clone https://<PAT>@github.com/Mafende-III/bmsys.git /docker/bmsys
# Immediately scrub the PAT from .git/config:
git -C /docker/bmsys remote set-url origin https://github.com/Mafende-III/bmsys.git
```

## Step 4 — Create `.env`

```bash
cat > /docker/bmsys/.env <<EOF
# DB
DB_NAME=bmsys
DB_USER=bmsys
DB_PASSWORD=$(openssl rand -hex 24)

# Auth.js
AUTH_SECRET=$(openssl rand -base64 32)

# Owner seed
OWNER_NAME=Owner
OWNER_PHONE=+250788000000
OWNER_PIN=1234

# App
PUBLIC_URL=https://bmsys.streamlinexperts.rw
EOF
chmod 600 /docker/bmsys/.env
```

Save the printed `DB_PASSWORD` and `AUTH_SECRET` in a password manager.

## Step 5 — Build and start

```bash
cd /docker/bmsys
docker compose -f docker-compose.prod.yml up -d --build
```

First build: ~3 min. The app container runs `prisma migrate deploy` on start (idempotent), then `node server.js`.

Verify:
```bash
docker compose -f docker-compose.prod.yml ps
# Should show:
#   bmsys-postgres  Up (healthy)
#   bmsys-app       Up (healthy)
```

Seed the owner user (one-time, on first deploy only):
```bash
docker compose -f docker-compose.prod.yml exec app \
  node ./node_modules/prisma/build/index.js db seed
```

## Step 6 — Traefik routing

```bash
cp /docker/bmsys/infrastructure/traefik-dynamic.yml /docker/traefik/dynamic/bmsys.yml
```

Traefik picks it up via the file provider's watcher.

## Step 7 — Verify

```bash
# Traefik picked up the routes
docker logs traefik --tail 10

# HTTPS responds
curl -I https://bmsys.streamlinexperts.rw
# Expect: HTTP/2 200 (or 307 if it redirects to /login)
```

Open `https://bmsys.streamlinexperts.rw` in a browser. Sign in with the seeded credentials. **Change the PIN immediately** after first login.

---

## Redeploying after code changes

GitHub Actions does this automatically on push to `main` (see `.github/workflows/deploy.yml`). Manual:

```bash
cd /docker/bmsys
bash scripts/deploy.sh
```

That pulls, rebuilds the app image, restarts. Postgres is preserved.

## GitHub Actions secrets

Set in `Settings → Secrets and variables → Actions`:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `187.124.115.162` (or `bmsys.streamlinexperts.rw`) |
| `VPS_USER` | `root` (or a deploy user) |
| `VPS_SSH_KEY` | Private key whose public half is in `~/.ssh/authorized_keys` on the VPS |
| `VPS_SSH_PORT` | `22` (omit if default) |

Generate a dedicated deploy keypair locally:
```bash
ssh-keygen -t ed25519 -f ~/.ssh/bmsys_deploy -C "bmsys-deploy" -N ""
# Public half → paste into VPS root's ~/.ssh/authorized_keys
# Private half → paste into the VPS_SSH_KEY GitHub secret
```

---

## Architecture

```
Internet → Cloudflare edge (SSL, WAF) → Traefik :443 (Origin Cert)
                                              │
    ┌─────────────────────────────────────────┤
    │  Host: bmsys.streamlinexperts.rw        │
    │  → bmsys-app :3000                      │
    └─────────────────────────────────────────┘

Internal only (not on proxy):
  bmsys-postgres :5432
```

bmsys-app and bmsys-postgres share the `internal` network. Only bmsys-app is on the `proxy` network. Postgres has no public port.

---

## Backups

The bare-metal `pg_dump` cron from the legacy Caddy setup no longer applies. Backups in the Docker world:

```bash
docker compose -f /docker/bmsys/docker-compose.prod.yml exec -T postgres \
  pg_dump -U bmsys bmsys | gzip > /var/backups/bmsys/bmsys-$(date +%F).sql.gz
```

Wire this into a cron + rclone push, similar to the prior `scripts/backup-*.sh`. Out of scope for the initial deploy; tackle once the app is up.

## Restoring

```bash
gunzip -c /var/backups/bmsys/bmsys-YYYY-MM-DD.sql.gz | \
  docker compose -f /docker/bmsys/docker-compose.prod.yml exec -T postgres \
    psql -U bmsys -d bmsys
```
