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
  {
    id: "sell-checkout",
    match: /^\/sell\/checkout\/?$/,
    steps: [
      {
        element: '[data-tour="checkout-lines"]',
        title: "Review the cart",
        body: "Double-check what the customer is paying for. Tap × on a line to drop it. The total updates live.",
        side: "bottom",
      },
      {
        element: '[data-tour="checkout-coupon"]',
        title: "Coupon code",
        body: "If the owner gave the customer a discount code, type it here and tap Apply. The shop validates it server-side — expired, used, or floor-breaking codes are rejected with a clear message.",
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
        element: '[data-tour="dash-capital"]',
        title: "Money available",
        body: "Cash in the drawer plus your MoMo and bank balances — the total you can spend on restock. Use \"Move cash\" when you deposit drawer cash to MoMo so the till stays honest.",
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
  // Analytics
  // ------------------------------------------------------------------
  {
    id: "analytics-home",
    match: /^\/analytics\/?$/,
    steps: [
      {
        element: '[data-tour="analytics-kpis"]',
        title: "Headline numbers",
        body: "Revenue, cost of stock sold, expenses, and net — for the period you picked. The small arrow shows how this period compares to the last one.",
        side: "bottom",
      },
      {
        element: '[data-tour="analytics-period"]',
        title: "Switch the period",
        body: "This month is the default. Switch to last month, the last 7 days, or the last 30 days. All numbers update.",
        side: "bottom",
      },
      {
        element: '[data-tour="analytics-daily"]',
        title: "Sales by day",
        body: "Dark curve is money in, green curve is profit — the gap between them is what the stock cost you. Hover any day for exact numbers.",
        side: "top",
      },
      {
        element: '[data-tour="analytics-profit"]',
        title: "Profit by product",
        body: "What each product actually earns after cost. Red margins mean you're selling almost at cost — raise the price or drop the line.",
        side: "top",
      },
      {
        element: '[data-tour="analytics-stock"]',
        title: "What needs attention",
        body: "Products running low against their threshold and anything fully out of stock — so you can reorder before you lose a sale.",
        side: "top",
      },
    ],
  },

  // ------------------------------------------------------------------
  // Restock plan
  // ------------------------------------------------------------------
  {
    id: "restock-home",
    match: /^\/restock\/?$/,
    steps: [
      {
        element: '[data-tour="restock-summary"]',
        title: "Order at a glance",
        body: "How many products are urgent, how many need an order, and what the whole order would cost — compare that against the cash you have.",
        side: "bottom",
      },
      {
        element: '[data-tour="restock-table"]',
        title: "The plan",
        body: "Sorted by urgency. Sales rate is your real speed over the last two weeks; the suggested order tops you back up to a month of cover, in whole cartons.",
        side: "top",
      },
      {
        element: '[data-tour="restock-draft"]',
        title: "Send it to purchases",
        body: "Happy with the sheet? Pick the supplier and create a draft purchase — you'll receive it on the purchase page when the stock arrives.",
        side: "top",
      },
    ],
  },

  // ------------------------------------------------------------------
  // Sales history
  // ------------------------------------------------------------------
  {
    id: "sales-history",
    match: /^\/sales\/?$/,
    steps: [
      {
        element: '[data-tour="sales-filters"]',
        title: "Filter the sales",
        body: "Narrow by date range, channel, or payment method. The summary strip below updates to match.",
        side: "bottom",
      },
      {
        element: '[data-tour="sales-list"]',
        title: "Every sale, with its profit",
        body: "Each row shows what the customer paid and what you actually earned. Tap a sale for the line-by-line breakdown including coupons and costs.",
        side: "top",
      },
    ],
  },

  // ------------------------------------------------------------------
  // Audit (Activity log)
  // ------------------------------------------------------------------
  {
    id: "audit-home",
    match: /^\/audit\/?$/,
    steps: [
      {
        element: '[data-tour="audit-filter"]',
        title: "Filter what you see",
        body: "All events shown by default. Pick a category to focus — failed sign-ins, big cash variances, or successful logins.",
        side: "bottom",
      },
      {
        element: '[data-tour="audit-table"]',
        title: "What happened",
        body: "Red badges flag failed sign-ins, amber flags big cash differences. Last 30 days of activity worth a glance.",
        side: "top",
      },
    ],
  },

  // ------------------------------------------------------------------
  // My day (per-seller performance view)
  // ------------------------------------------------------------------
  {
    id: "my-day-home",
    match: /^\/my-day\/?$/,
    steps: [
      {
        element: '[data-tour="my-day-today"]',
        title: "Your numbers today",
        body: "Sales you've rung up, money you've taken in, and your hottest item — all just for you. Other sellers' numbers are private.",
        side: "bottom",
      },
      {
        element: '[data-tour="my-day-trend"]',
        title: "Last 7 days",
        body: "A simple bar per day so you can spot which day of the week is busiest for you. Today is the black bar on the right.",
        side: "top",
      },
      {
        element: '[data-tour="my-day-stock"]',
        title: "Stock to watch",
        body: "What's out and what's running low across the whole shop — so you know what to tell customers before they ask. Red is out, amber is low.",
        side: "top",
      },
    ],
  },

  // ------------------------------------------------------------------
  // Stock-take
  // ------------------------------------------------------------------
  {
    id: "stock-take-home",
    match: /^\/stock-take\/?$/,
    steps: [
      {
        element: '[data-tour="stock-take-summary"]',
        title: "Stock-take at a glance",
        body: "Total products to count, how many are still uncounted, and how many are short or over. The summary updates as you type.",
        side: "bottom",
      },
      {
        element: '[data-tour="stock-take-lines"]',
        title: "Count cartons + loose",
        body: "Type sealed cartons in the first input and loose pieces in the second. The system column shows the same split for the books — green when you match, amber/red when you don't.",
        side: "top",
      },
      {
        element: '[data-tour="stock-take-note"]',
        title: "Note is required",
        body: "Add a short reason — \"monthly count\", \"Sunday close\", \"broke 3 bottles\" — so future you understands why the variance was written.",
        side: "top",
      },
      {
        element: '[data-tour="stock-take-history"]',
        title: "Past stock-takes",
        body: "Every saved count lives here with its per-product breakdown. Tap a row to expand and review what was counted, what the books said, and what got adjusted.",
        side: "top",
      },
    ],
  },

  // ------------------------------------------------------------------
  // Profile
  // ------------------------------------------------------------------
  {
    id: "profile-home",
    match: /^\/profile\/?$/,
    steps: [
      {
        element: '[data-tour="profile-identity"]',
        title: "Your details",
        body: "Change your display name here. Phone and role are set by the owner — locked on this screen.",
        side: "bottom",
      },
      {
        element: '[data-tour="profile-language"]',
        title: "Language",
        body: "Pick English or Kinyarwanda. Saved to your account so it follows you across devices.",
        side: "top",
      },
      {
        element: '[data-tour="profile-pin"]',
        title: "Change your PIN",
        body: "Enter your current PIN to set a new one. Leave the fields blank to keep your current PIN.",
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
