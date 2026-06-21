# BMSys — Implementation Status

**Last updated:** 2026-05-20
**Phase 1:** ✅ Complete · 136 tests across 16 files, all green
**Production:** ✅ **LIVE** at https://bmsys.streamlinexperts.rw
**UX/UI polish:** 🚧 In progress
**Phase 2+:** Not yet started

---

## What works today

The shop can fully operate on bmsys: catalog → receive stock → sell → manage cash → close the day.

| Area | Status | Surface |
|---|---|---|
| Auth (PIN login, argon2, JWT) | ✅ | `/login` |
| Owner dashboard | ✅ | `/dashboard` |
| **Products** CRUD with archive guard | ✅ | `/products`, `/products/new`, `/products/[id]`, `/products/[id]/archive` |
| **Categories** with emoji + per-product icon override | ✅ | `/categories` |
| **Channels** CRUD with deactivate-on-recent-sales guard | ✅ | `/channels` |
| **Channel price overrides** (per-product per-channel) | ✅ | `/products/[id]/prices` |
| **Suppliers** CRUD | ✅ | `/suppliers` |
| **Users**: OWNER + SELLER roles, per-user channel permissions | ✅ | `/users` |
| **Purchases**: draft → receive (transactional stock writes), cancel with RETURN | ✅ | `/purchases` |
| **POS** (mobile-first): category tiles → product → cart → checkout, auto-open carton | ✅ | `/sell` |
| **Cash sessions**: open with float, close with variance (subtracts cash expenses) | ✅ | `/cash-sessions` |
| **Adjustments**: 5 reasons, mandatory note, ledger-safe | ✅ | `/adjustments` |
| **Stock-take**: count shelves vs system, single-transaction reconciliation, `STOCKTAKE_VARIANCE` moves | ✅ | `/stock-take` |
| **Expenses**: CASH/MOMO/BANK + supplier ref | ✅ | `/expenses` |
| **Recurring expenses**: WEEKLY/MONTHLY with manual "run now" | ✅ | `/expenses/recurring` |
| **Daily summary**: sales/expenses/top products/stock/cash by date | ✅ | `/reports` |
| **Golden integrity test** | ✅ | `src/tests/golden.test.ts` |
| **Docker + Traefik deploy** | ✅ **LIVE on VPS** | https://bmsys.streamlinexperts.rw — Cloudflare → Traefik (wildcard `*.streamlinexperts.rw` cert) → `bmsys-app:3000` → internal `bmsys-postgres:5432` |

## Architectural invariants honoured

All seven non-negotiable rules from `CLAUDE.md` are enforced in code:

1. **Immutable ledgers** — stock derives from `stock_moves` (SUM), never a stored column. Sessions derive expected cash live from sales+expenses.
2. **Multi-step writes in transactions** — every mutation wraps `prisma.$transaction(...)`. Tested.
3. **DB constraints** — FKs, UNIQUE on slugs/SKUs/phones, NOT NULL, partial indexes where useful.
4. **Idempotency keys** — every mutating Server Action uses `withIdempotency(key, endpoint, fn)`.
5. **Nightly reconciliation** — deferred to Phase 2 (will use `pg-boss` for the cron).
6. **Audit log on everything** — every INSERT/UPDATE through Server Actions writes an `AuditLog` row.
7. **Golden test** — still passing.

Plus:
- CASH sales require an open cash session.
- CASH expenses require an open cash session.
- Archiving a product is refused if stock > 0 or cartons OPENED.
- Deactivating a channel is refused if it had a sale in the last 30 days.
- Demoting/deactivating the last active OWNER is refused.
- SELLERs are bounced from any non-`/sell/*` route.
- POS auto-opens a carton only from sealed stock; UNIT line capped at unitsPerCarton.

## Tests by sprint

136 tests, 16 files:

```
golden                           1
products  (schema + actions)     14 + 9
channels  (schema + actions)     10 + 10
channel-prices                   8
roles + users                    14
suppliers (schema + actions)     6 + 6
purchases                        11
sales POS                        13
cash-sessions                    7
categories                       7
adjustments                      6
expenses + recurring             12
reports (daily)                  5
stock-takes                      8
```

## Branches / PRs ready to merge (in order)

These stack cleanly on each other and on `main`:

| # | Branch |
|---|---|
| 1 | `feat/products-crud` |
| 2 | `feat/channels-crud` |
| 3 | `feat/channel-prices` |
| 4 | `feat/roles-and-users` |
| 5 | `feat/suppliers-crud` |
| 6 | `feat/purchases` |
| 7 | `feat/sales-pos` |
| 8 | `feat/categories-table` |
| 9 | `feat/cash-sessions` |
| 10 | `feat/adjustments` |
| 11 | `feat/expenses` |
| 12 | `feat/daily-summary` |
| — | `feat/docker-traefik-deploy` (orthogonal, can merge anytime) |

## Phase 2 — what's next (per spec §5)

Not yet started:

- **Customers CRUD** with delivery group + route order
- **Delivery sales entry** (cyclist round) — owner enters after the route returns
- **Credit movements** + customer balance derivation (immutable ledger)
- **Subscriptions** (WEEKLY/BIWEEKLY/MONTHLY auto-orders)
- **Subscription auto-create** (daily 6am job — `pg-boss`)
- **Low-stock alerts** (WhatsApp or email)
- **Stock levels report** with reorder suggestions
- **Customer balances report**

## Phase 3 / 4 (out of immediate scope)

- ~~Stock-takes with variance reconciliation~~ — shipped early in Phase 1.5 (see `/stock-take`)
- P&L vs projection
- Loyalty (points + tenure bonuses + redemptions)
- Digital receipts (SMS / WhatsApp / Email)
- Thermal printer (ESC/POS Bluetooth)
- Mobile Money API integration
- Customer portal + online ordering (`customer_users`, Phase 4 auth namespace)

## UX / UI polish — Phase 1.5 (in progress)

Phase 1 shipped feature-complete but admin-tool-feel. The next pass
makes it usable by an owner / seller with no tech background, on
mostly phones, with clear language and primary actions.

Tracking in this section. Goals:

1. **Plain-language copy.** Replace dev terms with shopkeeper terms.
   - "SKU" → "Code" or just hide on small screens
   - "Sellable as unit / carton" → "Sell singles? · Sell whole cartons?"
   - "Deactivate channel" → "Hide channel from sale screen"
   - "ADJUSTMENT_BREAKAGE" → "Broken" (the enum stays in the DB; only labels change)
   - "Variance: -200 RWF (short)" → "Cash 200 RWF short" with clear OVER/SHORT/BALANCED tags
   - "Idempotency", "channel", "ledger" → never shown to user
2. **Simpler navigation.** Dashboard grouped into:
   - **Stock & Catalog** (Products, Categories, Suppliers)
   - **Operate the shop** (Sell, Cash sessions, Purchases, Adjustments, Expenses)
   - **Reports & People** (Daily summary, Users, Channels)
3. **Polish the dev/testing feel.** Bigger tap targets (44px min on mobile),
   primary CTA per screen, less monospace, friendlier empty states with
   a clear next action, consistent badge styling, color used semantically.
4. **Responsive sweep.** 360px phone (priority), 768px tablet, 1024px+ laptop.
   Tables → cards on phone (most pages already do; verify all). Forms
   stack vertically, single-column on phone.

Plan: per-surface critique + copy/tone redesign (Dashboard, /sell flow,
Products list/form, Cash sessions, Reports) — sign-off — then ship.

## Open follow-ups

| Item | Why | Suggested when |
|---|---|---|
| Move from manual "Run recurring now" → `pg-boss` cron | Was deferred to keep Sprint 9 tight. The runDueRecurringOp is idempotent so the cron can replace the button cleanly. | Before Phase 2 ships subscriptions, which also need pg-boss. |
| Backup script for Docker Postgres | The legacy `scripts/backup-*.sh` were for bare-metal Postgres. Docker version is a one-liner (`pg_dump` exec into the container). | Right after VPS deploy is verified. |
| Partial unique index on `CashSession (closedAt IS NULL)` | Currently enforced app-level only. Multi-user race wouldn't matter today (owner-only opens till). Add when SELLERs can open the till. | Whenever opens become non-OWNER. |
| Reseed dev with categories + product icons | Seed.ts seeds channels + expense categories + owner but not Category rows. Manual setup or one-shot script. | Before next dev cycle (cosmetic). |

## Spec rule status

Updated `CLAUDE.md` already has:
- Docker + Traefik in production (replaces PM2/Caddy)
- PostgreSQL in container alongside the app
- Migrations applied at container start via `scripts/docker-entrypoint.sh`

Everything else in `CLAUDE.md` and `docs/spec.md` (v0.2) still holds.
