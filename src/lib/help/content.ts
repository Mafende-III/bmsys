/**
 * Per-route help content. End-user-literacy first: short sentences,
 * everyday words, no jargon. A future i18n pass will translate these
 * strings to Kinyarwanda.
 *
 * Matching: the first entry whose `match` regexp matches the current
 * pathname wins, so more specific entries (e.g. /products/new) must
 * come before broader ones (e.g. /products).
 */

export type HelpEntry = {
  /** Pathname pattern. Tested against location.pathname. */
  match: RegExp;
  /** Heading shown at the top of the panel. */
  title: string;
  /** One to two sentences. What this screen is for. */
  what: string;
  /** Key actions a user can take here. */
  actions?: { label: string; what: string }[];
  /** Optional cautions or shortcuts. */
  tips?: string[];
};

export const HELP_ENTRIES: HelpEntry[] = [
  // ------------------------------------------------------------------
  // POS (sellers see these)
  // ------------------------------------------------------------------
  {
    match: /^\/sell\/product\/[^/]+$/,
    title: "Product details",
    what: "Pick how many to sell and add to the bill.",
    actions: [
      { label: "Add to bill", what: "Puts the chosen amount in the cart at the bottom" },
      { label: "← Back", what: "Returns to the list of products in this group" },
    ],
    tips: [
      "If you only need 1, tap once and add. The cart at the bottom shows the running total.",
    ],
  },
  {
    match: /^\/sell\/category\/[^/]+$/,
    title: "Products in this group",
    what: "Pick the exact item the customer is buying.",
    actions: [
      { label: "Tap a product", what: "Opens the details so you can add it to the bill" },
      { label: "← Back", what: "Goes back to all product groups" },
    ],
  },
  {
    match: /^\/sell(\/|$)/,
    title: "Sell",
    what: "Ring up a sale at the counter. Pick a group, pick the product, choose how many, then take payment.",
    actions: [
      { label: "Channel picker (top)", what: "Switch between Retail, Wholesale, etc. — prices and what's available change with it" },
      { label: "Cart (bottom)", what: "Shows the running total. Tap it to take payment" },
      { label: "Three-dot menu (owner only)", what: "Opens the till, logs a loss, sees today's summary" },
    ],
    tips: [
      "The till must be open before you can take cash. The yellow warning at the top tells you when it's closed.",
    ],
  },

  // ------------------------------------------------------------------
  // Dashboard
  // ------------------------------------------------------------------
  {
    match: /^\/dashboard\/?$/,
    title: "Home",
    what: "Your control panel. Every part of the shop opens from here.",
    actions: [
      { label: "Sell", what: "Goes into POS mode for ringing up sales" },
      { label: "Cash", what: "Open the till in the morning, close it at night" },
      { label: "Receive stock", what: "Log new stock you bought from a supplier" },
      { label: "System config", what: "Change the shop name, theme colour, or upload your logo" },
    ],
  },

  // ------------------------------------------------------------------
  // Catalog
  // ------------------------------------------------------------------
  {
    match: /^\/products\/new\/?$/,
    title: "Add a product",
    what: "Set up a new item you sell. Required: name, SKU, units per carton, prices.",
    actions: [
      { label: "Category", what: "Group it with similar items (e.g. Soft drinks). Create one first if missing" },
      { label: "Icon override", what: "Pick a Lucide icon, or leave empty to use the category's icon" },
      { label: "Sellable as", what: "Tick Unit if you sell single bottles, Carton if you sell whole cartons" },
    ],
    tips: [
      "SKU cannot be changed later. Keep it short and unique (e.g. WATER-500ML).",
    ],
  },
  {
    match: /^\/products\/[^/]+\/prices\/?$/,
    title: "Channel prices",
    what: "Set a different price for this product on a specific channel (e.g. wholesale cheaper than retail).",
    tips: [
      "Leave a row empty to use the default price. Only fill in channels where the price differs.",
    ],
  },
  {
    match: /^\/products\/[^/]+\/archive\/?$/,
    title: "Archive product",
    what: "Hide this product from the POS without deleting its sales history.",
    tips: [
      "Archived products stay in old reports and receipts. You can un-archive later.",
    ],
  },
  {
    match: /^\/products\/[^/]+\/?$/,
    title: "Product details",
    what: "Edit the product and review its recent stock movements.",
    actions: [
      { label: "Channel prices", what: "Set per-channel price overrides" },
      { label: "Archive", what: "Hide from the POS (history is preserved)" },
    ],
  },
  {
    match: /^\/products\/?$/,
    title: "Products",
    what: "Everything you sell. Each row shows the price and how many units are in stock.",
    actions: [
      { label: "New product", what: "Adds a new item to the catalog" },
      { label: "Tap a row", what: "Edit details, set channel prices, or archive" },
    ],
  },

  {
    match: /^\/categories\/new\/?$/,
    title: "New category",
    what: "A grouping that shows up as a tile on the POS sell screen.",
    actions: [
      { label: "Icon", what: "Pick from the curated Lucide set. Falls back to an emoji if needed" },
      { label: "Slug", what: "Auto-built from the name. Used in URLs and cannot be changed later" },
    ],
  },
  {
    match: /^\/categories\/[^/]+\/?$/,
    title: "Edit category",
    what: "Rename, change icon, change sort order, or hide it from the POS.",
    tips: [
      "The slug (URL piece) cannot be changed — sellers' bookmarks would break.",
    ],
  },
  {
    match: /^\/categories\/?$/,
    title: "Categories",
    what: "Groups that organise products on the POS sell screen.",
    actions: [
      { label: "New category", what: "Adds a new tile to /sell" },
      { label: "Sort order", what: "Lower numbers appear first in the grid" },
    ],
  },

  {
    match: /^\/channels\/?$/,
    title: "Channels",
    what: "Where you sell: Retail counter, Wholesale, Delivery, etc. Each can have its own prices.",
    tips: [
      "Sellers see only the channels you give them access to (set on the user's profile).",
    ],
  },

  {
    match: /^\/suppliers\/?$/,
    title: "Suppliers",
    what: "Who you buy from. Linked from each purchase so you can review totals later.",
  },

  // ------------------------------------------------------------------
  // Stock in (purchases)
  // ------------------------------------------------------------------
  {
    match: /^\/purchases\/new\/?$/,
    title: "Log a purchase",
    what: "Record stock you're bringing in. Save as draft first, then mark received when it arrives.",
    tips: [
      "Once marked received, the purchase cannot be edited — only cancelled. This keeps stock accounting clean.",
    ],
  },
  {
    match: /^\/purchases\/[^/]+\/?$/,
    title: "Purchase details",
    what: "Review or finish a draft purchase. Receiving it adds stock and locks the record.",
  },
  {
    match: /^\/purchases\/?$/,
    title: "Purchases",
    what: "Stock you bought from suppliers. Draft = not yet received, Received = in stock.",
  },

  // ------------------------------------------------------------------
  // Cash & losses
  // ------------------------------------------------------------------
  {
    match: /^\/cash-sessions\/?$/,
    title: "Cash sessions",
    what: "Track money in the till. Open with your starting float, close with the actual count — the system shows the difference.",
    actions: [
      { label: "Open till", what: "Records your starting cash float" },
      { label: "Close till", what: "Compares system total to what you actually count. Variance is logged" },
    ],
    tips: [
      "Cash sales are refused if the till is closed.",
    ],
  },

  {
    match: /^\/adjustments\/new\/?$/,
    title: "Record a loss",
    what: "Remove stock that you cannot sell: broken, expired, stolen, or given as a sample.",
    tips: [
      "Pick the right reason — it shows up in your daily summary so you can spot patterns.",
    ],
  },
  {
    match: /^\/adjustments\/?$/,
    title: "Losses",
    what: "Stock taken out of inventory for reasons other than a sale.",
  },

  // ------------------------------------------------------------------
  // Expenses
  // ------------------------------------------------------------------
  {
    match: /^\/expenses\/categories\/?$/,
    title: "Expense categories",
    what: "Buckets for grouping expenses (Rent, Transport, Utilities…). Edit them to match how you think about your costs.",
  },
  {
    match: /^\/expenses\/new\/?$/,
    title: "Log an expense",
    what: "Record money going out of the shop. Pick a category and a payment method.",
  },
  {
    match: /^\/expenses\/?$/,
    title: "Expenses",
    what: "Every expense you've logged. Used in the daily summary.",
  },

  // ------------------------------------------------------------------
  // Reports & users & config
  // ------------------------------------------------------------------
  {
    match: /^\/reports\/?$/,
    title: "Daily summary",
    what: "Today's numbers at a glance: sales by channel, expenses, cash variance, top products.",
    tips: [
      "Cash variance = what the system says you should have minus what you actually counted. Big numbers mean something's off.",
    ],
  },
  {
    match: /^\/users\/new\/?$/,
    title: "Add user",
    what: "Owners see everything. Sellers can only sell on the channels you give them access to.",
  },
  {
    match: /^\/users\/[^/]+\/?$/,
    title: "Edit user",
    what: "Rename, change PIN, change role, or pick which channels they can sell on.",
  },
  {
    match: /^\/users\/?$/,
    title: "Users",
    what: "Who can sign in. Owners run the shop; sellers ring up sales.",
  },
  {
    match: /^\/settings\/?$/,
    title: "System config",
    what: "Branding and look — shop name, theme colour, and logo.",
    tips: [
      "Changes take effect immediately. Other open tabs may need a refresh.",
    ],
  },
];

export function findHelpEntry(pathname: string): HelpEntry | null {
  for (const e of HELP_ENTRIES) {
    if (e.match.test(pathname)) return e;
  }
  return null;
}
