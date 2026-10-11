import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ClipboardList,
  Clock,
  Package,
  PackagePlus,
  Search,
  X,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import {
  getCategoriesForPicker,
  getProductsWithStock,
} from "@/lib/products/queries";
import { getRestockPlan } from "@/lib/restock/queries";
import { Card, KeycapTile, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";

type SearchParams = {
  search?: string;
  categoryId?: string;
  active?: string;
  stock?: string;
};

type StockState =
  | { kind: "archived" }
  | { kind: "out" }
  | { kind: "low"; days: number | null }
  | { kind: "ok" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();

  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  const categoryId = params.categoryId?.trim() || undefined;
  const activeFilter: boolean | "all" =
    params.active === "all"
      ? "all"
      : params.active === "false"
        ? false
        : true;
  const stockFilter =
    params.stock === "low" || params.stock === "out" ? params.stock : "all";

  const [products, categories, restock] = await Promise.all([
    getProductsWithStock({ search, categoryId, active: activeFilter }),
    getCategoriesForPicker(),
    getRestockPlan(),
  ]);
  const t = await getTranslations("products");
  const ts = await getTranslations("shell");
  const td = await getTranslations("dashboard");

  // Urgency per product from the same burn-rate math as /restock.
  const urgency = new Map(
    restock.rows.map((r) => [r.productId, r] as const),
  );

  function stateOf(p: (typeof products)[number]): StockState {
    if (!p.active) return { kind: "archived" };
    const u = urgency.get(p.id);
    if (p.totalUnits <= 0 || u?.urgency === "OUT") return { kind: "out" };
    if (u?.urgency === "CRITICAL" || u?.urgency === "LOW")
      return { kind: "low", days: u.daysToOut };
    return { kind: "ok" };
  }

  const states = new Map(products.map((p) => [p.id, stateOf(p)] as const));
  const lowCount = [...states.values()].filter((s) => s.kind === "low").length;
  const outCount = [...states.values()].filter((s) => s.kind === "out").length;

  const visible = products.filter((p) => {
    const s = states.get(p.id);
    if (stockFilter === "low") return s?.kind === "low";
    if (stockFilter === "out") return s?.kind === "out";
    return true;
  });

  // Chip links keep the other filters in the query string.
  const chipHref = (stock: "all" | "low" | "out") => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (categoryId) q.set("categoryId", categoryId);
    if (params.active) q.set("active", params.active);
    if (stock !== "all") q.set("stock", stock);
    const s = q.toString();
    return s ? `/products?${s}` : "/products";
  };

  const chips: Array<["all" | "low" | "out", string, number | null]> = [
    ["all", t("filterAll"), null],
    ["low", t("filterLow"), lowCount],
    ["out", t("filterOut"), outCount],
  ];

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{ts("stock")}</h1>
          <p className="text-[13px] text-ink-2">
            {t("count", { count: products.length })}
          </p>
        </div>
        <Link
          href="/products/new"
          data-tour="products-new"
          className="flex h-11 shrink-0 items-center rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
        >
          {t("new")}
        </Link>
      </header>

      {/* Every stock job, one tap from the Stock tab */}
      <section
        data-tour="stock-actions"
        className="grid grid-cols-4 gap-2.5"
      >
        <KeycapTile href="/purchases/new" label={td("receiveStock")}>
          <Package className="h-6 w-6" strokeWidth={2} />
        </KeycapTile>
        <KeycapTile href="/restock" label={td("restock")}>
          <PackagePlus className="h-6 w-6" strokeWidth={2} />
        </KeycapTile>
        <KeycapTile href="/stock-take" label={td("stockTake")}>
          <ClipboardList className="h-6 w-6" strokeWidth={2} />
        </KeycapTile>
        <KeycapTile href="/adjustments" label={td("losses")}>
          <AlertTriangle className="h-6 w-6" strokeWidth={2} />
        </KeycapTile>
      </section>

      <form method="get" className="space-y-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-3.5 h-[18px] w-[18px] text-ink-2"
            strokeWidth={2.2}
          />
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder={t("searchPlaceholder")}
            className="block h-12 w-full rounded-[14px] border border-rule bg-surface pl-11 pr-4 text-[15px] text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active"
          />
        </div>
        <div className="flex gap-2">
          <select
            name="categoryId"
            defaultValue={categoryId ?? ""}
            className="h-10 flex-1 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
          >
            <option value="">{t("allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.iconEmoji} {c.name}
              </option>
            ))}
          </select>
          <select
            name="active"
            defaultValue={params.active ?? "true"}
            className="h-10 w-32 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
          >
            <option value="true">{t("filterActive")}</option>
            <option value="false">{t("filterArchived")}</option>
            <option value="all">{t("filterAll")}</option>
          </select>
          <button
            type="submit"
            className="h-10 rounded-full bg-surface px-4 text-[13px] font-bold text-primary ring-1 ring-inset ring-rule"
          >
            {t("apply")}
          </button>
        </div>
      </form>

      <div className="flex gap-2">
        {chips.map(([value, label, count]) => (
          <Link
            key={value}
            href={chipHref(value)}
            className={cn(
              "rounded-full px-4 py-2 text-[13px]",
              stockFilter === value
                ? "bg-ink font-bold text-white"
                : cn(
                    "bg-surface font-semibold ring-1 ring-inset ring-rule",
                    value === "low"
                      ? "text-warning"
                      : value === "out"
                        ? "text-error"
                        : "text-ink-2",
                  ),
            )}
          >
            {label}
            {count != null && count > 0 ? (
              <span className="num"> · {count}</span>
            ) : null}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("emptyFiltered")}
        </Card>
      ) : (
        <Card className="px-3.5 py-1">
          {visible.map((p, i) => {
            const s = states.get(p.id) ?? { kind: "ok" as const };
            return (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className={cn(
                  "flex items-center gap-3 py-3",
                  i > 0 && "border-t border-rule-hair",
                )}
              >
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-sheet text-xl",
                    s.kind === "out" ? "bg-error-wash" : "bg-surface-sunk",
                  )}
                >
                  {p.iconEmoji ?? p.categoryIconEmoji ?? "📦"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">
                    {p.name}
                  </span>
                  <span className="num block text-xs text-ink-2">
                    {formatRWF(p.unitPrice)} ·{" "}
                    {t("stockLine", {
                      sealed: p.sealedCartons,
                      loose: p.openedUnits,
                    })}
                  </span>
                </span>
                {s.kind === "archived" ? (
                  <StatusPill tone="neutral" className="shrink-0">
                    {t("archived")}
                  </StatusPill>
                ) : s.kind === "out" ? (
                  <StatusPill
                    tone="error"
                    className="shrink-0"
                    icon={<X className="h-3 w-3" strokeWidth={3} />}
                  >
                    {t("out")}
                  </StatusPill>
                ) : s.kind === "low" ? (
                  <StatusPill
                    tone="warning"
                    className="shrink-0"
                    icon={<Clock className="h-3 w-3" strokeWidth={2.6} />}
                  >
                    {s.days != null
                      ? t("daysLeft", { days: s.days })
                      : t("lowNoRate")}
                  </StatusPill>
                ) : (
                  <StatusPill
                    tone="success"
                    className="shrink-0"
                    icon={<Check className="h-3 w-3" strokeWidth={3} />}
                  >
                    {t("inStock")}
                  </StatusPill>
                )}
              </Link>
            );
          })}
        </Card>
      )}
    </main>
  );
}
