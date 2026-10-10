# Design Handout (keep this next to you)

A portable design *method* — the structure and rules to respect across projects. It prescribes **how** the system is built, **not** a specific palette. Every colour here is a **token**; each project supplies its own values. Never hardcode hex or a fixed theme.

---

## 0. The one sentence
**Build it like an institutional register, not an app.** Calm, authoritative, legible, and a little *squarer* than a typical SaaS product. No playfulness, no float, no "AI product" cues. If a choice makes it feel more like an official ledger and less like a startup dashboard, it's probably right.

**Betrayals to avoid:** rounded-everything softness, drop-shadows that make things float, rainbow colour, decorative icons, robot/sparkle/AI imagery, raw enum text on screen.

---

## 1. Type
- **One primary sans** (UI, body, headings) with full Latin + diacritics coverage.
- **One monospace** — reference numbers, IDs, codes **only**. Always with **`tabular-nums`** so digits align.
- **Numerals rule:** any column or KPI of numbers uses `tabular-nums`.
- **Caption rule (the signature):** small uppercase labels with letter-spacing introduce blocks and fields — e.g. `text-[11px] font-semibold uppercase tracking-wide text-neutral-400`.
- **Case:** sentence case for most labels/buttons; Title Case for proper names; UPPERCASE only for the caption labels and status pills.

---

## 2. Colour — define it as tokens, never hex
The handout fixes the **roles**, not the hues. Define each of these as a CSS variable / token and pick the actual colour per brand. Never put a hex value in a component.

**Ramps (define all steps 50→900):**
- `primary` — structure, headings, links, primary surfaces.
- `accent` — exactly **one** vivid hue with **one job** (the deadline / "due"); reserved for **light/white surfaces only**.
- `neutral` — text, rules, grounds.
- `cover` — the deep shell behind the app frame + the primary-CTA fill.

**Semantic (reserved — never reused as "a decorative colour"):** `success`, `warning`, `error`, `info` — each with a **`-light`** (tint background) and **`-dark`** (text-on-light) variant.

**Role tokens (prefer these over raw ramp steps):**
`ink` / `ink-2` / `ink-3` (text) · `ground` (the page) · `surface` (cards) · `surface-sunk` (wells) · `surface-hover` · `surface-sel` (selected row / active nav) · `rule-hair` (between table rows) · `rule` (region borders) · `rule-active` (selected/active border) · `cover` / `cover-deep` (the deep shell).

**Hard colour rules:**
- **Accent only on light/white surfaces** — never on the deep cover.
- **Status is never colour-alone** — always pair the colour with an **icon + a word** (colour-blind + print safe).
- **Text wears ink tokens, never a chart/series colour.** A coloured mark sits *beside* the label; the label stays ink.
- Charts: one hue light→dark for magnitude; an "Other" bucket folds to a neutral — never invent a category hue.

---

## 3. Form — radius, border, shadow (the most distinctive part)
**Radius is assigned by element type — don't free-style it.** Define a token per role and keep the scale squarer than the SaaS default:

| Token | Role | Used on |
|-------|------|---------|
| `radius-pill` | fully round | status pills, counters, chips — **only** these |
| `radius-control` | small (~6px) | buttons, inputs, selects, tabs, toolbar chips, nav items |
| `radius-well` | small (~6px) | inset wells, read-only value fields, code/ref blocks |
| `radius-panel` | medium (~10px) | panels, figure blocks, workspace shell, **modals** |
| `radius-sheet` | one size up (~12px) | the inset sheet + auth card — the single "soft" radius |
| `radius-card` | large (~20px) | dashboard cards (KPI tiles, desk cards, chart cards) |
| `radius-well-lg` | large (~22px) | content well inside the frame, header/hero card |
| `radius-frame` | largest (~28px) | the light app frame floating on the cover (lg+ only) |

- **Borders = hairline rings, not heavy borders:** `ring-1 ring-inset ring-rule-hair`. Region boundaries use `ring-rule`; a selected/active edge uses `ring-rule-active`.
- **Shadows: the register does not float.** A card is defined by its ring + surface, not a drop-shadow. The only motion-shadow is a subtle `hover:shadow-md` on interactive cards.

---

## 4. The blocks (recipes — all token-based)

**Card (KPI tile / desk card / chart card):**
```
rounded-card bg-surface p-5 ring-1 ring-inset ring-rule-hair
```
(interactive variant adds `transition-shadow hover:shadow-md`)

**Primary CTA button:**
```
inline-flex h-10 items-center gap-2 rounded-pill bg-cover px-5 text-sm font-semibold text-white hover:bg-cover-deep transition-colors
```

**Secondary / neutral button:**
```
rounded-control border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50
```

**Status pill (always colour + word, optional icon):**
```
inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-semibold bg-<semantic>-light text-<semantic>
```

**Table:** header row = caption style (`text-[11px] uppercase tracking-wide text-neutral-400`); body rows `divide-y divide-rule-hair`, `hover:bg-surface-hover`; selected row `bg-surface-sel` + `ring-rule-active`. Numbers right-aligned, `tabular-nums`, mono for references.

**Section caption above a block:**
```
px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400
```

**Sidebar nav item:** `rounded-control`; active = `bg-surface-sel text-primary-700`; idle = `text-neutral-600 hover:bg-surface-hover`. Grouped under uppercase section captions.

**The shell:** a deep **cover** field with a light **frame** (`rounded-frame`, lg+) floating on it; the content well (`rounded-well-lg`) sits inside; the header/hero is a `rounded-well-lg` card; the body opens onto a row of KPI `rounded-card` tiles.

---

## 5. Space & density
- Comfortable but dense — a work tool for people who open it daily. Card padding `p-4`/`p-5`; row min-height ~`h-16`; consistent `gap-3`/`gap-4`.
- Must work at phone width: 16px side gutter, no horizontal page scroll, cards stack 1-up.

---

## 6. Non-negotiables (the prohibitions)
1. **Tokens, not hex** — every colour and radius comes from a variable; never a literal value in a component, never a one-off theme.
2. **The one accent, on light surfaces only** — reserved for a single job (the deadline); never on the deep cover.
3. **Status never colour-alone** — colour + icon + word.
4. **No AI imagery** — no robot, sparkle, or "AI" glyphs; an institutional tool, not an AI product. AI features are framed as **advisory** ("Advisory only — the decision stays with the people"), never "Powered by <model>".
5. **No raw enums on screen** — map keys (e.g. `pending_classification`) to a human label + a styled status, through one normaliser.
6. **Feature visibility is capability-driven, never role lists** — gate UI on a capability check, not on `role === …`.
7. **Radius by element type** — don't invent radii; pick the token from §3.
8. **The register does not float** — rings + surfaces define hierarchy, not shadows.
9. **Keep real/sensitive data out of shareable mockups** — show roles/placeholders, not real people.
10. **Contrast = WCAG AA** — every text/background pairing must pass.

---

## 7. Rule of thumb
When unsure, open the **tokens file** (the `:root` variables + the theme mapping are the single source of truth for colour and radius), find the token whose role matches your element, and use that class. **If no token fits, you're probably introducing something the system doesn't want — add a token with a clear role instead of a literal value.**
