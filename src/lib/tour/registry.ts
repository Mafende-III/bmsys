import type { TourDefinition } from "./types";

/**
 * Per-screen guided tours. End-user-literacy first: short sentences,
 * everyday words, no jargon. Each step points at a real DOM element
 * via a data-tour="…" anchor.
 *
 * Order matters — more specific regexes must come before broader
 * ones (e.g. /products/new before /products).
 */
export const TOURS: TourDefinition[] = [
  // ------------------------------------------------------------------
  // POS
  // ------------------------------------------------------------------
  {
    id: "sell-home",
    match: /^\/sell\/?$/,
    steps: [
      {
        element: '[data-tour="sell-channel"]',
        title: "Channel",
        body: "Pick where you are selling right now — retail counter, wholesale, delivery. Prices and what is available change with this choice.",
        side: "bottom",
      },
      {
        element: '[data-tour="sell-category-grid"]',
        title: "Pick a group",
        body: "Tap a group to see the products inside. Once you add a product, a black running-bill bar appears at the bottom — tap it to take payment.",
        side: "top",
      },
      {
        element: '[data-tour="sell-quick-actions"]',
        title: "Quick actions",
        body: "Owner only. From here you can open or close the till, log an expense, record a loss, or jump back to the admin side.",
        side: "left",
      },
    ],
  },
  {
    id: "sell-category",
    match: /^\/sell\/category\/[^/]+$/,
    steps: [
      {
        element: '[data-tour="sell-product-grid"]',
        title: "Products",
        body: "Tap the product the customer is buying. The next screen lets you choose how many.",
        side: "top",
      },
    ],
  },
  {
    id: "sell-product",
    match: /^\/sell\/product\/[^/]+$/,
    steps: [
      {
        element: '[data-tour="add-to-cart-form"]',
        title: "Add to bill",
        body: "Set the amount and tap Add. The bill at the bottom updates straight away. You can mix unit and carton on the same sale.",
        side: "top",
      },
    ],
  },

  // ------------------------------------------------------------------
  // Dashboard
  // ------------------------------------------------------------------
  {
    id: "dashboard-home",
    match: /^\/dashboard\/?$/,
    steps: [
      {
        element: '[data-tour="dash-sell"]',
        title: "Sell",
        body: "The big button takes you into POS mode for ringing up customers. Tap here whenever a customer walks in.",
        side: "bottom",
      },
      {
        element: '[data-tour="dash-run-shop"]',
        title: "Run the shop",
        body: "Open and close the till here, log expenses, record losses, and receive new stock from suppliers.",
        side: "top",
      },
      {
        element: '[data-tour="dash-catalog"]',
        title: "What you sell",
        body: "Products, categories, and suppliers live here. Set them up once, then forget until you change prices or add new items.",
        side: "top",
      },
      {
        element: '[data-tour="dash-reports"]',
        title: "Reports & system",
        body: "Daily totals, manage users, and System config — where you set the shop name, theme colour, and logo.",
        side: "top",
      },
    ],
  },

  // ------------------------------------------------------------------
  // Settings
  // ------------------------------------------------------------------
  {
    id: "settings-home",
    match: /^\/settings\/?$/,
    steps: [
      {
        element: '[data-tour="settings-name"]',
        title: "Shop name",
        body: "Change the name shown on the sign-in screen and in the browser tab. Defaults to HydroMart Shop.",
        side: "bottom",
      },
      {
        element: '[data-tour="settings-theme"]',
        title: "Theme",
        body: "Pick one of three palettes. The background of every page changes immediately — content stays high-contrast either way.",
        side: "top",
      },
      {
        element: '[data-tour="settings-logo"]',
        title: "Logo",
        body: "Upload a single image (PNG or SVG works best). It shows on the sign-in screen, in the top bar, and as the browser tab icon. Max 2 MB.",
        side: "top",
      },
    ],
  },

  // ------------------------------------------------------------------
  // Catalog
  // ------------------------------------------------------------------
  {
    id: "products-list",
    match: /^\/products\/?$/,
    steps: [
      {
        element: '[data-tour="products-new"]',
        title: "Add a product",
        body: "Each product you sell needs an entry here. You can edit prices and stock movements after creation.",
        side: "left",
      },
    ],
  },
  {
    id: "products-new",
    match: /^\/products\/new\/?$/,
    steps: [
      {
        element: '[data-tour="product-sku"]',
        title: "SKU",
        body: "A short unique code (e.g. WATER-500ML). It cannot be changed later, so keep it stable.",
        side: "bottom",
      },
      {
        element: '[data-tour="product-icon"]',
        title: "Icon",
        body: "Pick from the curated icon set, or leave empty to use the category's icon. Sellers see this on the POS tile.",
        side: "top",
      },
      {
        element: '[data-tour="product-sellable"]',
        title: "Sellable as",
        body: "Tick Unit if you sell single bottles or items, Carton if you sell full cartons, both if you sell both. At least one is required.",
        side: "top",
      },
    ],
  },
  {
    id: "categories-list",
    match: /^\/categories\/?$/,
    steps: [
      {
        element: '[data-tour="categories-new"]',
        title: "Add a category",
        body: "Categories group products on the POS sell screen — Soft drinks, Beer, Water, and so on. Each gets its own tile.",
        side: "left",
      },
    ],
  },
  {
    id: "categories-new",
    match: /^\/categories\/new\/?$/,
    steps: [
      {
        element: '[data-tour="category-icon"]',
        title: "Category icon",
        body: "Pick from the Lucide icon set. Products without their own icon will inherit this one.",
        side: "top",
      },
    ],
  },
];

export function findTour(pathname: string): TourDefinition | null {
  for (const t of TOURS) {
    if (t.match.test(pathname)) return t;
  }
  return null;
}
