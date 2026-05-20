/**
 * Curated Lucide icon registry for product/category visuals.
 *
 * Stored on Category.iconKey and Product.iconKey as a short string;
 * UI components resolve it through this registry. If the key is null
 * or unknown, callers fall back to the legacy iconEmoji string, and
 * finally to a Package fallback.
 *
 * To add an icon: pick from https://lucide.dev/icons/, import it,
 * add an entry below. Keep the registry small and shop-relevant —
 * the picker shows them all in a grid.
 */
import {
  Apple,
  Beer,
  Cake,
  Candy,
  Cherry,
  Cigarette,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Egg,
  Fish,
  Flame,
  GlassWater,
  Grape,
  Hamburger,
  IceCream,
  Lollipop,
  Milk,
  Package,
  Pizza,
  Popcorn,
  Salad,
  Sandwich,
  Soup,
  Wheat,
  Wine,
  type LucideIcon,
} from "lucide-react";

export type IconRegistryEntry = {
  Icon: LucideIcon;
  label: string;
};

/**
 * Full curated set. Keys are short, lowercase, kebab-case-free.
 * Order matters — picker renders them in this order.
 */
export const PRODUCT_ICONS: Record<string, IconRegistryEntry> = {
  // Drinks
  water: { Icon: GlassWater, label: "Water" },
  beer: { Icon: Beer, label: "Beer" },
  wine: { Icon: Wine, label: "Wine" },
  soda: { Icon: CupSoda, label: "Soda" },
  juice: { Icon: Citrus, label: "Juice" },
  milk: { Icon: Milk, label: "Milk" },
  coffee: { Icon: Coffee, label: "Coffee / Tea" },
  // Fruit
  apple: { Icon: Apple, label: "Apple / fruit" },
  cherry: { Icon: Cherry, label: "Cherry" },
  grape: { Icon: Grape, label: "Grape" },
  // Snacks / sweets
  cookie: { Icon: Cookie, label: "Biscuit / Cookie" },
  candy: { Icon: Candy, label: "Candy" },
  "ice-cream": { Icon: IceCream, label: "Ice cream" },
  cake: { Icon: Cake, label: "Cake" },
  lollipop: { Icon: Lollipop, label: "Lollipop" },
  popcorn: { Icon: Popcorn, label: "Popcorn" },
  croissant: { Icon: Croissant, label: "Pastry" },
  // Meals / prepared
  pizza: { Icon: Pizza, label: "Pizza" },
  hamburger: { Icon: Hamburger, label: "Burger" },
  sandwich: { Icon: Sandwich, label: "Sandwich" },
  soup: { Icon: Soup, label: "Soup" },
  salad: { Icon: Salad, label: "Salad" },
  // Pantry
  bread: { Icon: Wheat, label: "Bread / grain" },
  egg: { Icon: Egg, label: "Egg" },
  fish: { Icon: Fish, label: "Fish / meat" },
  // Other
  cigarette: { Icon: Cigarette, label: "Cigarette" },
  flame: { Icon: Flame, label: "Gas / charcoal" },
  package: { Icon: Package, label: "Other / generic" },
};

export type ProductIconKey = keyof typeof PRODUCT_ICONS;

export const ICON_KEYS = Object.keys(PRODUCT_ICONS) as ProductIconKey[];

/**
 * Resolve a string key to a Lucide component. Unknown keys fall
 * back to Package.
 */
export function iconForKey(key: string | null | undefined): LucideIcon {
  if (key && key in PRODUCT_ICONS) return PRODUCT_ICONS[key]!.Icon;
  return Package;
}

/**
 * Resolve a label for a key — used in the picker for an aria-label
 * and tooltip.
 */
export function labelForKey(key: string | null | undefined): string {
  if (key && key in PRODUCT_ICONS) return PRODUCT_ICONS[key]!.label;
  return "Other";
}
