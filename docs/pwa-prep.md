# PWA Prep — Audit & Plan

Audit of the current codebase (branch `feat/ux-polish-v1`) ahead of the "institutional register" redesign:
bottom tab bar (Money / Stock / Reports / More) + center Sell FAB, persistent logo header, keycap buttons,
SLX tokens, installable PWA on iPhone. No code was changed for this document.

---

## 1. Codebase architecture map

**Layouts.** Exactly two: `src/app/layout.tsx` (root — `force-dynamic`, reads `Settings` for
`companyName`/`logoUrl`/`theme`, sets `data-theme` on `<html>`, wraps `NextIntlClientProvider` +
`TourLauncher`; no app chrome of its own) and `src/app/sell/layout.tsx` (POS shell: `.app-header` top bar
with logo + `ChannelPicker` + `QuickActionsMenu` + profile/sign-out, till-closed warning banner,
`CartProvider`, sticky bottom `CartHeader`, `max-w-2xl` content with `pb-32`).

**Routes** (all flat under `src/app`, no route groups; every feature keeps client components in a local
`_components/` and domain logic in `src/lib/<domain>/{actions,operations,queries,schema}.ts`):

| Route | Purpose | Local components | Key libs |
|---|---|---|---|
| `/` (`page.tsx`) | auth redirect → `/sell` (SELLER) or `/dashboard` | — | `lib/auth` |
| `/login` | PIN login card (logo + company name) | `_components/LanguageToggle` | `lib/auth`, `lib/settings/queries` |
| `/dashboard` | hub: hero Sell card, today numbers, `DashCard` grid of ~17 links | `WorkingCapitalCard` | `analytics`, `cash-sessions`, `treasury`, `settings` queries |
| `/sell`, `/sell/category/[slug]`, `/sell/product/[id]`, `/sell/checkout` | POS flow | `AddToCartForm`, `CartHeader`, `CartProvider`, `ChannelPicker`, `CheckoutForm`, `QuickActionsMenu` | `lib/sales`, `lib/permissions`, `lib/cash-sessions` |
| `/products`, `/new`, `/[id]`, `/[id]/archive`, `/[id]/prices` | catalog CRUD + channel price overrides | `ProductForm`, `PricingMatrix` | `lib/products`, `lib/channel-prices` |
| `/categories`, `/new`, `/[id]` | category CRUD | `CategoryForm` | `lib/categories` |
| `/channels`, `/new`, `/[id]`, `/[id]/deactivate` | channel CRUD | `ChannelForm` | `lib/channels` |
| `/suppliers`, `/new`, `/[id]` | supplier CRUD | `SupplierForm` | `lib/suppliers` |
| `/purchases`, `/new`, `/[id]` | draft → receive flow | `PurchaseForm` | `lib/purchases` |
| `/restock` | restock plan table | `RestockTable` | `lib/restock` |
| `/stock-take` | count + history | `StockTakeForm`, `StockTakeHistory` | `lib/stock-takes` |
| `/adjustments`, `/new` | losses | `AdjustmentForm` | `lib/adjustments` |
| `/expenses`, `/new`, `/recurring`, `/recurring/new`, `/recurring/[id]` | expenses + recurring | `ExpenseForm`, `RecurringForm`, `RunRecurringButton` | `lib/expenses` |
| `/cash-sessions`, `/[id]` | till open/close | `OpenSessionForm`, `CloseSessionForm` | `lib/cash-sessions` |
| `/coupons`, `/new` | coupon issue/void | `CouponForm`, `CouponList` | `lib/coupons` |
| `/sales`, `/[id]` | sales history + detail | — | `lib/sales/history` |
| `/analytics` | KPI tiles + charts | `DonutChart`, `SalesByDayChart`, `TopSellersChart` (recharts) | `lib/analytics` |
| `/reports` | daily summary | — | `lib/reports/daily` |
| `/reports/register` | purchase/sales register + CSV | `CsvButton` | `lib/reports/register` |
| `/audit` | audit log browser | — | `lib/audit` |
| `/my-day` | seller's own day | — | `lib/sales/my-day` |
| `/profile`, `/settings`, `/users` (+`/new`, `/[id]`) | profile, org config (logo/theme/name), user mgmt | `ProfileForm`, `SettingsForm`, `TreasuryCheckpointForm`, `UserForm` | `lib/settings`, `lib/users`, `lib/treasury` |
| `/uploads/[...path]` (route handler) | serves uploaded logo/icons from the uploads volume | — | `lib/settings/uploads` |

**Shared components** live in `src/app/_components/`: `IconPicker`, `IconImageUpload`, `LanguageToggle`,
`TourLauncher` (driver.js tours, registry at `src/lib/tour/registry.ts`). There is **no `src/components/`**.

**Current nav pattern (what the tab bar replaces).** Hub-and-spoke: `/dashboard` is the only menu
(inline `DashCard` grid, `src/app/dashboard/page.tsx:291`), and every page hand-rolls a text back link —
`← Dashboard` / `← Products` etc. — ~30 instances (grep `←` across `src/app/**/page.tsx`). Inside POS the
"nav" is `QuickActionsMenu` (bottom sheet, `src/app/sell/_components/QuickActionsMenu.tsx`) plus the
`CartHeader` fixed bottom bar. No persistent header outside `/sell`.

---

## 2. Screen resolution & responsiveness audit

- **Breakpoints actually used:** `sm:` ×168, `lg:` ×7 (dashboard/analytics/reports grids, sell category
  grid). **Zero `md:`/`xl:`/`2xl:`.** The codebase is genuinely mobile-first; `sm:` is the only real
  breakpoint.
- **Viewport:** no `viewport` export anywhere — Next 15 injects the default
  `width=device-width, initial-scale=1`. **Missing `viewport-fit=cover`** (needed for iPhone safe-area
  insets once standalone) and no `theme-color`.
- **Fixed widths:** none harmful. Only `max-w-[240px]`/`max-w-[280px]` truncation on table cells
  (`products/[id]`, `suppliers/[id]`, `adjustments`). Content containers are `max-w-{md,2xl,5xl}` + `p-4`.
- **Wide tables:** 14 files wrap tables in `overflow-x-auto` (register, audit, analytics breakdowns,
  restock, histories) — they scroll inside the card at 380px rather than breaking the page. Acceptable;
  the sweep can later convert the worst to stacked rows.
- **Watch items at 380px:**
  - `TopSellersChart.tsx:53` — recharts `YAxis width={130}` eats a third of the viewport (labels get
    tight; chart area ~210px).
  - `SalesByDayChart.tsx:65` — `YAxis width={48}`, fine.
  - `dashboard/page.tsx:120` — "today numbers" is a rigid `grid-cols-3` of `font-mono text-lg` RWF
    amounts; 6–7-digit amounts wrap/overflow around 380px.
  - `sell/layout.tsx` — content `pb-32` budget assumes only `CartHeader` at the bottom; a tab bar adds a
    second fixed layer (see §3 TabBar).
- Nothing else found that hard-breaks at 380px; the app already ships to a phone-first owner.

---

## 3. Reusable component inventory

Exists today vs. what the redesign needs:

| Needed primitive | Closest today | Verdict |
|---|---|---|
| **AppHeader** (logo + status pill) | three ad-hoc headers: `sell/layout.tsx:141` (`.app-header` + logo img + name), `dashboard/page.tsx:50`, `login/page.tsx:14` | **Net-new**, consolidates all three |
| **TabBar + Sell FAB** | nothing; nearest relatives: `CartHeader.tsx` (fixed bottom bar, sell-only, `z-20`) and the dashboard `DashCard` hub | **Net-new**; must stack with `CartHeader` (cart bar sits above tab bar; revisit `pb-32`) |
| **KeycapButton** (3D raised, pressed/inset) | nothing — zero `shadow-[…]` / `active:translate` / `active:shadow` in the repo | **Net-new** |
| **StatusPill** (icon + word + color) | inline pills only: `rounded-full bg-zinc-100/green-100 px-2 py-0.5 text-[10px]` ×7 (coupons, purchases, products…); no normaliser; color-alone in places | **Net-new**, replaces inline instances |
| **MoneyField** (RWF suffix, tabular-nums) | **exists locally**: `ProductForm.tsx:53` (`MoneyField` + `BIG_MONEY` class, right-aligned, mono, RWF suffix) | **Extract** to shared |
| **Stepper** | **exists inline**: qty −/+ in `sell/_components/AddToCartForm.tsx:143–160`; ProductForm uses bare number inputs | **Extract/unify** |
| **CaptionLabel** | **exists as const**: `CAPTION` in `ProductForm.tsx:46`; the same `text-[10px]/text-xs uppercase tracking-wide text-zinc-500` string is hand-typed across dashboard, tables, sell | **Extract** (tiny component or `@apply` class) |
| **Card** (hairline ring) | `DashCard` (inline in `dashboard/page.tsx:291`); `rounded-2xl border border-zinc-200 bg-white` repeated everywhere | **Extract**; swap `border` → `ring-1 ring-inset ring-rule-hair` per handout §3 |
| **FilterChips** | nothing generic (sales/audit filters are plain links; `ChannelPicker` is a select) | **Net-new** |
| **BottomSheet** | **exists inline**: `QuickActionsMenu.tsx:76–84` (`fixed inset-0 bg-black/40 items-end` + `rounded-t-3xl` panel, Escape handling) | **Extract** into `BottomSheet`, reuse for Receive-stock quick-create |

**Duplicated inline patterns worth extracting** (counts from grep):

- Input: `mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm` ×27 (+8 with focus ring,
  +9/+5 variants) → one `Input`/`inputClass`.
- Error banner: `rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700` ×12 (+3 `-xl`);
  success banner ×5 → `Banner tone=…`.
- Secondary button: `rounded-lg border border-zinc-300 bg-white … hover:bg-zinc-50` ×11+5+4+3 → `Button variant=…`.
- `ProductForm.tsx` module-scope `CAPTION`/`BIG_TEXT`/`BIG_MONEY` and `PricingMatrix.tsx` inputs duplicate
  each other — both should consume the shared primitives.

Suggested home: new `src/components/ui/` (or `src/app/_components/ui/`) — decide once, before slice 2.

---

## 4. Theme / token setup plan

**Today:** Tailwind **v3.4.17** (`package.json`) with a classic `tailwind.config.ts` (nearly empty — only
`fontFamily.sans`); not v4 CSS-first, so tokens go in `theme.extend` + CSS vars, **not** `@theme`.
`src/app/globals.css` already runs a CSS-variable theme system: 10 `[data-theme="…"]` palettes defining
`--app-bg/-bg-soft/-accent/-accent-soft/-ring`, switched via `Settings.theme` on `<html>` — but components
still hardcode `zinc-*` classes almost everywhere, so the var system only tints chrome.

**Plan:** keep the `data-theme` mechanism, add an `slx` theme (make it the default), define role tokens as
CSS vars in `globals.css`, and map them in `tailwind.config.ts` so classes like `bg-surface`,
`text-ink-2`, `ring-rule-hair`, `rounded-card` exist. The screen sweeps then replace `zinc-*`/`rounded-2xl`
with token classes.

Proposed `:root` / `[data-theme="slx"]` values (SLX palette → semantic names):

```css
--ink: #0D1B2A;            /* also the cover — deep shell + primary CTA fill */
--ink-2: #475569;
--ground: #F4F8FA;         /* page background */
--surface: #FFFFFF;        /* cards */
--surface-sunk: #EEF7FB;   /* wells, read-only fields */
--primary: #11779E;        /* structure, links, headings */
--primary-fill: #1FB8E8;   /* vivid fill (gauges, active marks) */
--accent: #F59E0B;         /* ONE job, light surfaces only */
--rule-hair: #E2E8F0;      /* row separators, card rings */
--rule: #CBD5E1;           /* region borders */
--success: #15803D;  --success-wash: #DCFCE7;
--warning: #92400E;  --warning-wash: #FEF3C7;
--error:   #B91C1C;  --error-wash:   #FEE2E2;
--cover: #0D1B2A;
```

`tailwind.config.ts` additions:

```ts
theme: {
  extend: {
    colors: {
      ink: "var(--ink)", "ink-2": "var(--ink-2)",
      ground: "var(--ground)", surface: "var(--surface)", "surface-sunk": "var(--surface-sunk)",
      primary: "var(--primary)", "primary-fill": "var(--primary-fill)", accent: "var(--accent)",
      "rule-hair": "var(--rule-hair)", rule: "var(--rule)", cover: "var(--cover)",
      success: "var(--success)", "success-wash": "var(--success-wash)",
      warning: "var(--warning)", "warning-wash": "var(--warning-wash)",
      error: "var(--error)", "error-wash": "var(--error-wash)",
    },
    borderRadius: {
      control: "6px", well: "6px", panel: "10px", sheet: "12px", card: "20px", pill: "999px",
    },
  },
}
```

**Numbers:** the `font-mono tabular-nums text-right` convention already exists (`formatRWF` call sites,
handout §1). Codify as one recipe/utility (e.g. `.num { @apply font-mono tabular-nums; }`) so MoneyField,
tables, and KPI tiles all share it. Per handout §6: tokens only — the sweeps delete literal `zinc-*` hex
roles and free-styled radii as they go; status pills become colour **+ icon + word**.

---

## 5. PWA setup plan (Next.js 15 App Router)

- **Manifest:** add `src/app/manifest.ts` exporting `MetadataRoute.Manifest` (it may be async — can read
  `getSettings()` for the live company name, falling back to "HydroMart"):
  `{ name: "HydroMart", short_name: "BMSys", start_url: "/", display: "standalone", theme_color: "#0D1B2A", background_color: "#F4F8FA", icons: [192, 512, 192-maskable, 512-maskable] }`.
  `start_url: "/"` is right — `src/app/page.tsx` already routes by role.
- **Icons needed:** `icon-192.png`, `icon-512.png`, maskable 192/512 (logo inside the 80% safe zone on a
  `#0D1B2A` or `#F4F8FA` plate), `apple-touch-icon` 180×180 (opaque — iOS black-fills transparency).
  Today the repo has **no `public/` directory and no icon files at all**; favicons come from the uploaded
  logo via `generateMetadata` in `src/app/layout.tsx:21`. Ship static files in a new `public/` (simplest)
  or `app/icon.tsx`/`app/apple-icon.tsx` ImageResponse generators; static preferred — the logo rarely changes.
- **iOS specifics:**
  - `metadata.appleWebApp = { capable: true, statusBarStyle: "black-translucent", title: "HydroMart" }`
    (emits `apple-mobile-web-app-capable` etc.).
  - `export const viewport = { themeColor: "#0D1B2A", viewportFit: "cover" }` in the root layout.
  - Tab bar and `CartHeader` need `padding-bottom: env(safe-area-inset-bottom)`; the header needs
    `env(safe-area-inset-top)` under the translucent status bar.
  - In standalone mode there is no browser back button — the tab bar + per-screen back affordance becomes
    mandatory, which is exactly the planned shell.
- **Service worker:** **not required for installability** — iOS needs only HTTPS + manifest + apple metas,
  and Chrome no longer demands offline support for install. Skip it in slice 1. What one would add later:
  an offline app shell / splash and cached static assets. Full offline is out of scope anyway — every page
  is `force-dynamic` against Postgres (though the existing `IdempotencyKey` model is the natural base for
  a future offline sales queue).
- **HTTPS:** already live at `bmsys.streamlinexperts.rw` (Traefik + Cloudflare origin cert,
  `docker-compose.prod.yml`), so the app is installable the moment manifest + icons ship.

---

## 6. Logo

**No logo asset exists in the repo.** No `public/`, no favicon, nothing in `src/`. Findings:

- The logo is a **runtime upload via the config page** `/settings` (`SettingsForm.tsx` → `LogoSection`,
  `data-tour="settings-logo"`), saved by `src/lib/settings/uploads.ts:saveLogoFile` as
  `uploads/logo.<png|jpg|webp|svg>` (max 2 MB).
- Storage: `UPLOADS_DIR` env, in production the Docker volume `bmsys_uploads` mounted at `/app/uploads`
  (`docker-compose.prod.yml:63`). The relative path is stored in `Settings.logoPath`
  (`prisma/schema.prisma`, `model Settings`).
- Serving: `src/app/uploads/[...path]/route.ts`; `getSettings()` (`src/lib/settings/queries.ts:39`) builds
  a cache-busted `logoUrl` consumed by the root layout metadata icons, `/login`, `/dashboard`, and
  `sell/layout.tsx`.
- "Still the one in the config page of SLX" ⇒ the real mark is **the file uploaded on production** — it
  lives only in the `bmsys_uploads` volume on the VPS, not in git.

**What we need to generate PWA icons:** the source file. Either
(a) pull it from the VPS — `docker cp bmsys-app:/app/uploads/logo.<ext> .` (or read it at
`https://bmsys.streamlinexperts.rw/uploads/logo.<ext>`), or
(b) better, get the original from the user (SVG or ≥1024 px PNG) since the upload may be small.
Generate 192/512/maskable/apple-touch from that one source. The in-app header keeps using the dynamic
`logoUrl`; the PWA icon set is a build-time artifact.

---

## 7. Suggested implementation order (small, shippable slices)

1. **Tokens** — `globals.css` SLX vars + `tailwind.config.ts` color/radius mapping; alias the legacy
   `--app-*` vars to the new tokens so existing chrome picks up SLX immediately. No component changes.
2. **Primitives** — create `src/components/ui/`: extract `MoneyField`, `Stepper`, `CaptionLabel`, `Card`,
   `Input`, `Button`, `Banner`, `StatusPill`, `BottomSheet` (from `QuickActionsMenu`), `FilterChips`;
   net-new `KeycapButton`. Swap into `ProductForm`/`PricingMatrix` first (they define the duplicates).
3. **Shell** — `AppHeader` (logo + status pill) + `TabBar` (Money/Stock/Reports/More) + center Sell FAB in
   the root layout for authenticated routes (not `/login`); coordinate z-index/padding with `CartHeader`
   inside `/sell`; retire the per-page `←` links tab-by-tab. Add `data-tour` anchors + tour entries for the
   new shell (tour-sync rule).
4. **Screen sweeps** — one tab per PR: Money (cash-sessions, expenses, sales), Stock (products, purchases,
   restock, stock-take, adjustments, categories, suppliers), Reports (analytics, reports, register, audit),
   More (settings, users, channels, coupons, profile, my-day). Fix the §2 watch items in their sweep
   (TopSellersChart YAxis, dashboard 3-col numbers).
5. **PWA** — `manifest.ts`, `public/` icon set generated from the real logo (§6), `viewport` +
   `appleWebApp` metadata, safe-area padding on header/tab bar/cart bar; verify install + standalone nav
   on an iPhone against production.

Each slice passes `pnpm test` + `pnpm typecheck` and a clean-browser pass at 380 px before push.
