# INITIAL_PROMPT.md

Paste the contents below as your **first message to Claude Code** after opening it in this project folder.

---

## Copy from here

You are working on **BMSys**, a beverage business management system for a single-owner retail shop in Kigali. Before doing anything else, do the following in order:

**Step 1: Read the project context.**
Read `CLAUDE.md` (project rules and conventions) and `docs/spec.md` (the full specification, version 0.2). Confirm you understand:
- The seven non-negotiable integrity rules (immutable ledgers, transactions, etc.)
- The data model (25 tables in `prisma/schema.prisma`)
- The Phase 1 scope and the order it must be built in
- The currency convention (integer RWF, no decimals, ever)

**Step 2: Verify the skeleton works.**
Run these commands and report any failures:
```
pnpm install
pnpm typecheck
pnpm prisma generate
pnpm prisma migrate status
pnpm test
```
The golden test (`src/tests/golden.test.ts`) MUST pass before we proceed. If it fails, stop and tell me what is wrong.

**Step 3: Begin Phase 1, Sprint 1: Products CRUD.**

Build a complete Products management feature with these screens:
1. `/products` — List page. Mobile-first table showing SKU, name, category, unit price, carton price, sealed cartons in stock, opened-carton units, active toggle. Filter by category and active status. Search by name or SKU.
2. `/products/new` — Create form. All fields from the schema, with sensible defaults and validation. `units_per_carton`, `cost_per_carton`, `unit_price`, `carton_price` are required. `sellable_as_unit` and `sellable_as_carton` default to true. Show a live margin preview (sell vs cost).
3. `/products/[id]` — Edit form. Same fields as create. Cannot change SKU after creation. Show recent stock movements for this product (last 20 entries from `stock_moves`).
4. `/products/[id]/archive` — Soft-delete via setting `active=false`. Cannot archive a product with non-zero stock or open cartons.

Requirements:
- Use **Server Actions** for all mutations, never API routes.
- Validate input with **Zod** schemas at the entry of each Server Action.
- Server Actions return `{ ok: true, data } | { ok: false, error: string }`.
- Use the helpers in `src/lib/balances.ts` (`getStockUnits`, `getSealedCartonCount`) for stock display.
- Use `formatRWF()` from `src/lib/format.ts` for all money display.
- Mobile-first responsive (works at 380px wide).
- Tailwind for styling, match the look of the existing login and dashboard pages.
- Every screen requires auth. Call `auth()` at the top, redirect to `/login` if no session.
- Add Vitest tests for the Zod schemas and the Server Actions (CRUD happy paths plus the "cannot archive product with stock" rule).

What you do NOT need to do in this sprint:
- Stock movement entries (that comes with Purchases, Sprint 4)
- Channel price overrides UI (that comes after channels)
- Image uploads or barcode scanning

After implementing, run `pnpm typecheck` and `pnpm test`. Confirm both pass. Then summarize:
- Files created or changed
- New routes
- Any open questions or decisions you made
- A suggested commit message

When that is done, wait for my review before starting Sprint 2 (Channels CRUD).

## Stop copying here

---

After Sprint 1 is reviewed and committed, your next prompt to Claude Code is simply:

> Begin Sprint 2: Channels CRUD. Same conventions as Sprint 1. List, create, edit, deactivate. Cannot deactivate a channel with active sales in the last 30 days.

The full sprint sequence is in `CLAUDE.md` under "What does NOT yet exist (Phase 1 work, in order)".
