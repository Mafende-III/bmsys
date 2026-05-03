# Beverage Business Management System — Specification

**Version:** 0.2 (draft)
**Owner:** Single-tenant, single-user
**Purpose:** Source of truth for Claude Code. Read this on every session before generating code.

---

## 1. Overview

A web-based system for managing a beverage retail business in Kigali. Covers six core jobs:

1. **Purchase** — order from suppliers, record what was paid
2. **Receive** — log goods received, increment stock
3. **Stock-take** — count physical inventory, reconcile against ledger
4. **Sales** — record sales across multiple channels with multiple payment methods
5. **Expenses** — record operational costs (rent, salaries, transport, utilities)
6. **Customer engagement** — delivery subscriptions, loyalty, customer portal, online ordering

The business sells across multiple channels (retail walk-ins, wholesale to traders, bicycle delivery to homes), with the ability to add new channels over time.

---

## 2. Core Principles

These are non-negotiable and must be enforced from day one. Every code change must respect them.

### 2.1 Immutable ledgers everywhere
No code anywhere mutates a balance directly. Every change appends a row to the relevant ledger. Current values are derived:
- Stock: `SUM(qty_units) FROM stock_moves WHERE product_id = X`
- Customer credit balance: `SUM(amount) FROM credit_movements WHERE customer_id = X`
- Customer loyalty points: `SUM(points) FROM loyalty_movements WHERE customer_id = X`
- Cash position: `SUM(...)` from sales and cash sessions

The ledger is the source of truth; if anything else disagrees, the ledger wins.

### 2.2 Database transactions on every multi-step write
A sale that decrements stock, records cash, updates a customer balance, and awards loyalty points either commits all parts or commits none. The database enforces this, not the application.

### 2.3 Database-level constraints, not just app validation
Foreign keys, CHECK constraints, NOT NULL, UNIQUE indexes are defined in Postgres. App validation is a UX nicety; the schema is the wall.

### 2.4 Idempotency keys on writes
Every mutating endpoint accepts an idempotency key. A retried request never produces duplicate writes. Critical for online orders and subscription auto-generation.

### 2.5 Nightly reconciliation
A scheduled job recomputes stock from the ledger, recomputes cash from sessions, recomputes customer balances, recomputes loyalty points, and alerts on any discrepancy.

### 2.6 Audit log on everything
Every INSERT, UPDATE, DELETE writes a row to `audit_log` with who, when, and what changed.

### 2.7 The golden test
One test that creates a purchase, opens a carton, makes two sales (one by unit, one by carton), records a breakage, logs an expense, and asserts every balance is correct. Runs on every commit. If it fails, the system is lying about money.

---

## 3. Data Model

### 3.1 Users
Single role for now: `owner`. Customer-facing portal users (Phase 4) are stored separately in `customer_users`.
```
users
  id, name, phone, pin_hash, role, created_at
```

### 3.2 Channels (dynamic, not fixed)
```
channels
  id, name, slug, active, created_at
```
Seeded with: `retail`, `wholesale`, `delivery`, `online`. New channels added via admin UI without schema change.

### 3.3 Products (fully dynamic, no hardcoding)
```
products
  id, sku, name, category,
  units_per_carton,
  cost_per_carton,
  unit_price, carton_price,
  sellable_as_unit, sellable_as_carton,
  low_stock_threshold_units,
  loyalty_points_per_unit,   -- 0 by default; product-specific
  active, created_at, updated_at
```

### 3.4 Channel price overrides
```
channel_price_overrides
  id, product_id, channel_id,
  unit_price (nullable), carton_price (nullable)
```

### 3.5 Customers
```
customers
  id, name, phone,
  primary_channel_id,
  delivery_group, delivery_route_order,
  notes, active, created_at
```
Balances and points are derived, never stored as columns.

### 3.6 Suppliers
```
suppliers
  id, name, phone, notes, created_at
```

### 3.7 Stock moves (the spine of inventory)
```
stock_moves
  id, product_id,
  qty_units,            -- SIGNED delta in units
  reason,               -- enum
  ref_type, ref_id,
  note, user_id, created_at
```
**Reason enum:** `PURCHASE`, `SALE_UNIT`, `SALE_CARTON`, `RETURN`, `ADJUSTMENT_BREAKAGE`, `ADJUSTMENT_EXPIRY`, `ADJUSTMENT_PERSONAL`, `ADJUSTMENT_THEFT`, `ADJUSTMENT_SAMPLE`, `STOCKTAKE_VARIANCE`.

### 3.8 Cartons (only OPENED and EMPTY tracked individually)
```
cartons
  id, product_id, tag, state,        -- 'OPENED' | 'EMPTY'
  units_remaining,
  opened_at, opened_by_user_id,
  closed_at, source_purchase_id,
  created_at
```

### 3.9 Purchases
```
purchases
  id, supplier_id, date, status,    -- DRAFT | RECEIVED | CANCELLED
  total_cost, note, user_id, created_at

purchase_lines
  id, purchase_id, product_id,
  qty_cartons, qty_loose_units,
  unit_cost, line_total
```

### 3.10 Sales
```
sales
  id, channel_id, customer_id (nullable),
  date, total,
  payment_method,         -- CASH | MOMO | BANK | CREDIT | MIXED
  payment_reference,
  amount_paid, amount_credit,
  source,                 -- 'IN_PERSON' | 'ONLINE' | 'SUBSCRIPTION_AUTO'
  status,                 -- COMPLETE | PENDING | CONFIRMED | OUT_FOR_DELIVERY | DELIVERED | CANCELLED
  note, user_id, created_at

sale_lines
  id, sale_id, product_id,
  sale_unit,              -- UNIT | CARTON
  qty, unit_price, line_total,
  carton_id               -- required when sale_unit=UNIT
```

### 3.11 Credit movements
```
credit_movements
  id, customer_id,
  amount,                 -- SIGNED
  ref_type, ref_id, note, user_id, created_at
```

### 3.12 Cash sessions
```
cash_sessions
  id, opened_at, opened_by, opening_float,
  closed_at, closed_by, closing_count,
  expected_cash, variance, note
```

### 3.13 Adjustments
```
adjustments
  id, product_id, qty_units (signed),
  reason, note, user_id, created_at
```

### 3.14 Audit log
```
audit_log
  id, table_name, record_id, action,
  changes (JSON), user_id, created_at
```

### 3.15 Expenses (NEW)
Operational costs that hit the bottom line.
```
expense_categories
  id, name, slug, active, created_at
  -- Seeded: RENT, SALARIES, UTILITIES, TRANSPORT, SUPPLIES, MARKETING, OTHER

expenses
  id, date, amount, category_id, description,
  payment_method,         -- CASH | MOMO | BANK
  payment_reference,
  supplier_id (nullable),
  recurring_id (nullable),
  user_id, created_at

recurring_expenses
  id, category_id, amount, description,
  frequency,              -- MONTHLY | WEEKLY
  day_of_period,          -- e.g., 1 for first of month
  active, last_run_at, created_at
```
Recurring rent and salaries auto-generate `expenses` rows on schedule. Cash payments hit the cash session.

### 3.16 Subscriptions (NEW)
Delivery customers who order on a recurring schedule (e.g., weekly 5L water).
```
subscriptions
  id, customer_id, product_id,
  frequency,              -- WEEKLY | BIWEEKLY | MONTHLY
  qty, sale_unit,         -- UNIT | CARTON
  day_of_week,            -- 0-6 for weekly/biweekly
  unit_price_override (nullable),
  start_date, end_date (nullable),
  status,                 -- ACTIVE | PAUSED | CANCELLED
  paused_until (nullable),
  created_at
```
A scheduled job creates a sale row in PENDING status on each subscription's day.

### 3.17 Loyalty (NEW)
Points ledger for delivery subscribers and other repeat customers.
```
loyalty_movements
  id, customer_id, points (signed),
  reason,                 -- EARNED_PURCHASE | EARNED_SUBSCRIPTION_TENURE | REDEEMED | BONUS | EXPIRY
  ref_type, ref_id, note, user_id, created_at

loyalty_rewards
  id, name, description,
  points_required, discount_amount, discount_percent,
  active, created_at
```
Points balance = `SUM(points)`. Tenure bonus: a job awards extra points monthly to subscribers in good standing.

### 3.18 Customer portal users (Phase 4)
Separate auth namespace from internal users.
```
customer_users
  id, customer_id, email, phone,
  password_hash, last_login_at,
  email_verified_at, phone_verified_at,
  created_at
```

### 3.19 Receipts (Phase 3)
```
receipts
  id, sale_id,
  format,                 -- 'PRINT' | 'SMS' | 'WHATSAPP' | 'EMAIL'
  destination,            -- phone or email when digital
  delivered_at, delivery_status, delivery_error,
  created_at
```

---

## 4. Key Workflows

### 4.1 Open a sealed carton
Select product, see sealed-carton count. Confirm if an OPENED carton already exists. Enter or scan a unique tag. Transaction: insert `cartons` (OPENED, units_remaining=units_per_carton, tag), insert `stock_moves` (CARTON_OPEN, qty_units=0).

### 4.2 Sale of a unit
Transaction: insert `sales` + `sale_lines` (sale_unit=UNIT, carton_id), decrement `cartons.units_remaining`, set EMPTY if zero, insert `stock_moves` (SALE_UNIT, negative), insert `credit_movements` if CREDIT, update cash session expected, insert `loyalty_movements` if customer enrolled.

### 4.3 Sale of a sealed carton (wholesale)
Transaction: insert `sales` + `sale_lines` (sale_unit=CARTON), insert `stock_moves` (SALE_CARTON, negative). Same payment + credit + cash + loyalty logic.

### 4.4 Receive a purchase
Transaction: for each line, insert `stock_moves` (PURCHASE, qty=cartons*units_per_carton + loose_units). Update purchase status.

### 4.5 Adjustment
Transaction: insert `adjustments` row + matching `stock_moves` row.

### 4.6 Daily cash close
Open session with float, close with physical count, system computes variance and locks.

### 4.7 Delivery sales entry (no cyclist login)
Owner picks customers from the route, enters items per customer, each entry follows the standard sale workflow. Cyclist's paper sheet is the source document.

### 4.8 Log an expense (NEW)
Pick category, enter amount and description, choose payment method. Transaction: insert `expenses`. If CASH, decrement cash session expected.

### 4.9 Recurring expense run (NEW)
Daily job: for each active `recurring_expense` due today, insert an `expenses` row and update `last_run_at`.

### 4.10 Subscription auto-create (NEW)
Daily job at 6am: for each `subscription` whose next delivery is today, insert a `sales` row in PENDING with line items. Owner sees them on the dashboard, confirms, cyclist delivers, owner marks DELIVERED on return.

### 4.11 Loyalty earn and redeem (NEW)
Earn: every sale awards `points = SUM(qty * loyalty_points_per_unit)` for enrolled customers. Tenure bonus: monthly job awards bonus points to subscribers active for 3+ months.
Redeem: at sale time, if customer has enough points for a reward, applied as a discount, negative `loyalty_movements` row inserted.

### 4.12 Online order (Phase 4)
Customer logs in via portal, places order, cart becomes a `sales` row (source=ONLINE, status=PENDING). Owner confirms → CONFIRMED, cyclist takes → OUT_FOR_DELIVERY, returns → DELIVERED.

### 4.13 Receipt issue (Phase 3)
On sale completion: PRINT for in-shop thermal printer, SMS/WHATSAPP/EMAIL for digital. Insert `receipts` row, queue delivery, retry on failure.

---

## 5. Phasing

### Phase 1 (MVP, weeks 1 to 4)
The shop must be able to operate using only this.

- Auth (owner login with PIN)
- Products CRUD with carton/unit pricing and channel overrides
- Channels CRUD (seeded retail, wholesale, delivery)
- Suppliers CRUD
- Purchases: draft → receive
- Carton open with tag entry
- Sales: walk-in retail (units) and wholesale (cartons), all four payment methods
- Cash sessions: open and close with variance
- Adjustments with predefined reasons
- **Expenses** CRUD with categories and recurring entries
- Daily summary report: sales by channel, cash variance, expenses, stock movements, top products
- Stock movements ledger view
- Nightly `pg_dump` backup off-server

### Phase 2 (weeks 5 to 8)
Delivery channel and customer accounts.

- Customers CRUD with delivery group and route order
- Delivery sales entry (owner enters after cyclist returns)
- Credit movements and customer balances
- **Subscriptions**: weekly/biweekly/monthly recurring orders
- Subscription auto-create job (daily 6am)
- Low-stock alerts (WhatsApp or email)
- Stock levels report with reorder suggestions
- Customer balances report

### Phase 3 (weeks 9 to 12)
Engagement and operational maturity.

- Stock-takes with variance reconciliation
- P&L vs projection report
- **Loyalty program**: points, rewards, tenure bonuses
- **Digital receipts** (SMS/WhatsApp/Email)
- **Receipt thermal printer** support (Bluetooth ESC/POS)
- Mobile Money API integration (auto-record MoMo)

### Phase 4 (weeks 13+)
Customer-facing.

- **Customer portal**: balance, order history, manage subscription
- **Online ordering**: customer places delivery orders directly
- Order status flow (PENDING → CONFIRMED → OUT_FOR_DELIVERY → DELIVERED)
- Customer notifications (order confirmed, out for delivery, delivered)

---

## 6. Tech Stack

- **Frontend + Backend:** Next.js 15 (App Router), TypeScript strict mode, Server Actions for mutations
- **Database:** PostgreSQL self-hosted on the same VPS as the app, accessed via `localhost:5432`
- **ORM:** Prisma with migrations checked into git
- **Auth (internal):** Auth.js v5 with PIN credentials, argon2 hashing
- **Auth (customer portal, Phase 4):** Auth.js with email/phone OTP
- **UI:** Tailwind + shadcn/ui, mobile-first responsive (phone + laptop)
- **Validation:** Zod schemas shared between client and server
- **Background jobs:** Postgres-backed queue (`pg-boss`) for subscription auto-create, recurring expenses, reconciliation, alerts
- **Testing:** Vitest for unit + integration, Playwright for the golden test
- **Receipt printing (Phase 3):** Bluetooth ESC/POS thermal printer via WebBluetooth or companion mobile app
- **Backup:** `pg_dump` cron, copied to off-server destination (separate VPS or S3-compatible storage)
- **Deployment:** PM2 on existing VPS, Caddy in front for HTTPS, GitHub Actions for CI

---

## 7. Open Questions

1. Domain name for this system?
2. Backup destination: separate VPS or cloud (Backblaze B2, S3-compatible)?
3. Currency formatting: always RWF with no decimals, comma thousands separator?
4. SMS/WhatsApp provider for digital receipts and alerts (Africa's Talking, Twilio, direct WhatsApp Business API)?
5. Recurring expenses to seed (rent amount, salary amounts, utilities) so they auto-log from day one?

---

## 8. Out of Scope

These are intentionally not built. They can be added later without breaking the core model.

- Multi-currency
- Multi-language UI
- Barcode scanning hardware (we use manual entry and tags)
- Tax/VAT handling
- Payroll calculation (salaries are recorded as expenses, not computed)
- Accounting export (QuickBooks, Xero, etc.)
- Multi-location (single shop only)
- General-purpose e-commerce (online ordering is delivery-customers-only)
