# BMSys — Project Context for Claude Code

This file is loaded on every Claude Code session. Read it before generating code.

## What this project is

A web-based management system for a beverage retail business in Kigali, Rwanda. Single-tenant, single-user (the owner). Self-hosted on a VPS at `bmsys.streamlinexperts.rw`.

**The full specification is `docs/spec.md`. Read that file before making any architectural decision.** It is the source of truth.

## Stack (locked)

- **Next.js 15 App Router** + TypeScript strict mode (`noUncheckedIndexedAccess` enabled)
- **PostgreSQL 16** in a Docker container alongside the app (production: `bmsys-postgres` on the internal compose network; local dev: `bmsys-pg` on host port 5434)
- **Prisma 6** ORM, migrations in git, applied at container start by `scripts/docker-entrypoint.sh`
- **Auth.js v5** with PIN-based credentials, argon2 hashing
- **Tailwind CSS** + minimal custom components (no shadcn yet, can add later)
- **Server Actions** for all mutations, never API routes for internal use
- **pg-boss** for background jobs (subscriptions, recurring expenses, reconciliation)
- **Vitest** for tests, **Playwright** for end-to-end
- **Docker Compose** + shared **Traefik** in production (Hostinger VPS), Cloudflare Origin Cert for TLS — same convention as `D-RNEC` and `IEWRS`. Deploy runbook: `docs/HOSTINGER_DEPLOYMENT.md`.
- Currency: **integer RWF, no decimals anywhere**. Use `formatRWF()` from `src/lib/format.ts` for display.

Do not introduce new frameworks, ORMs, or styling libraries without asking.

## The seven non-negotiable rules

These come from `docs/spec.md` Section 2. They are CRITICAL and apply to every change.

1. **Immutable ledgers everywhere.** Never write to a balance column. Stock = `SUM(qty_units) FROM stock_moves`. Customer credit = `SUM(amount) FROM credit_movements`. Loyalty points = `SUM(points) FROM loyalty_movements`. Helpers are in `src/lib/balances.ts`. Use them.

2. **Database transactions on every multi-step write.** A sale touches sales, sale_lines, stock_moves, possibly credit_movements, possibly loyalty_movements, possibly cash sessions. All inside one `prisma.$transaction(...)` or fail.

3. **Database constraints, not just app validation.** Foreign keys, CHECK, NOT NULL, UNIQUE all in the schema. App validation (Zod) is a UX nicety. Schema is the wall.

4. **Idempotency keys on every mutating endpoint.** Use the `IdempotencyKey` model. A retried server action with the same key returns the prior result, never duplicates.

5. **Nightly reconciliation job** (build in Phase 2): recompute every balance from its ledger, alert on discrepancy.

6. **Audit log on everything.** Every INSERT/UPDATE/DELETE writes an `audit_log` row with user, table, record, action, and JSON diff. Build a Prisma middleware for this.

7. **The golden test** at `src/tests/golden.test.ts` runs the full purchase → carton open → unit sale → carton sale → adjustment cycle and asserts every balance. CI blocks merges if it fails. **Never weaken this test to make code pass.** If you change the schema or workflows, update the test to reflect the new reality, but the integrity assertions stay.

## Architectural conventions

- **Stock is always in units.** Cartons convert to units at write time.
- **Money is always integer RWF.** No floats, no decimals, no `Decimal` type. Multiply if you need precision (e.g., percentages: store basis points).
- **Use `cuid()` for primary keys** (already configured in schema).
- **Server Actions return `{ ok: true, data } | { ok: false, error }`** for predictable client handling.
- **Validate inputs with Zod** at the entry of every Server Action. Reuse schemas where possible.
- **Mobile-first responsive.** Owner uses phone and laptop, no shop tablet. Every screen must work at 380px wide.
- **No client-side database access.** Prisma only on the server.

## What is in the repo right now (the skeleton)

- `prisma/schema.prisma` — full v0.2 data model
- `prisma/seed.ts` — channels, expense categories, owner user
- `src/app/login/page.tsx` — PIN login (Server Action calling Auth.js `signIn`)
- `src/app/dashboard/page.tsx` — placeholder dashboard
- `src/lib/prisma.ts` — Prisma singleton
- `src/lib/auth.ts` — Auth.js v5 config
- `src/lib/balances.ts` — derivation helpers (use these, never recompute manually)
- `src/lib/format.ts` — RWF formatter
- `src/tests/golden.test.ts` — the integrity test
- `scripts/` — VPS setup, deploy, backups
- Caddyfile, ecosystem.config.js, GitHub Actions deploy workflow

## What does NOT yet exist (Phase 1 work, in order)

Build these in this order. Ship each one to production before starting the next.

1. **Products CRUD** — list, create, edit, archive. Includes carton/unit pricing and the `sellable_as_unit` / `sellable_as_carton` flags. UI mobile-first.
2. **Channels CRUD** — list, create, edit, deactivate. Channels are dynamic, never hard-coded.
3. **Channel price overrides** — per-product per-channel optional price overrides, sparse table.
4. **Suppliers CRUD** — basic.
5. **Purchases** — draft → receive flow. On receive, transactionally creates `stock_moves` rows. Cannot edit a received purchase, only cancel.
6. **Carton open** — pick product, enter unique tag, open. Warns if an OPENED carton exists. Atomic transaction.
7. **Sales: retail by unit** — counter sale screen. Pulls from OPENED carton. Payment methods: CASH, MOMO, BANK, CREDIT, MIXED. Decrements `unitsRemaining`, sets EMPTY when zero. Updates cash session.
8. **Sales: wholesale by carton** — same screen with toggle, sells full sealed cartons.
9. **Cash sessions** — open with float, close with physical count, computed variance.
10. **Adjustments** — predefined reasons (BREAKAGE, EXPIRY, PERSONAL, THEFT, SAMPLE), required note, transactional with stock_moves.
11. **Expenses** — categories CRUD + expense entry + recurring expense scheduler (uses pg-boss).
12. **Daily summary report** — sales by channel, cash variance, expenses, stock movements, top products.

After Phase 1 ships, see `docs/spec.md` Section 5 for Phase 2 (delivery + customers + subscriptions), Phase 3 (loyalty + receipts), Phase 4 (customer portal + online ordering).

## Things you should ALWAYS do

- Read `docs/spec.md` when in doubt about data model, workflow, or scope.
- Wrap multi-step writes in `prisma.$transaction`.
- Add a corresponding test for any new business logic touching the ledger.
- Run `pnpm test` before committing.
- Run `pnpm typecheck` before committing.
- Use `formatRWF()` for displaying any money amount.
- Use `getStockUnits()`, `getCreditBalance()`, `getLoyaltyPoints()` from `src/lib/balances.ts` for reads.

## Things you should NEVER do

- Never add a column like `stock_count`, `balance`, or `points` to a table that has a ledger. Always derive.
- Never write multi-step logic outside a transaction.
- Never mutate the schema without writing a Prisma migration.
- Never weaken the golden test.
- Never commit secrets. `.env` is gitignored. PATs and DB passwords stay out of git.
- Never use floating point for money.
- Never bypass auth on server actions. Every action calls `auth()` and checks the session.
- Never catch and silently swallow errors in business logic. Bubble up.

## Conventions for commits and branches

- Branch per feature: `feat/products-crud`, `feat/sales-retail-unit`, etc.
- Commit messages: imperative mood, scoped. e.g. `feat(products): add CRUD with carton/unit pricing`.
- One feature per PR. CI runs the golden test plus typecheck.

## Useful commands

```bash
pnpm dev                       # local dev server
pnpm test                      # run vitest including golden test
pnpm typecheck                 # tsc --noEmit
pnpm prisma migrate dev        # create migration after schema change
pnpm prisma:seed               # seed initial data
pnpm prisma studio             # browse DB visually
```

## When in doubt

Read `docs/spec.md`. Then ask the human if still unclear. Do not invent scope.
