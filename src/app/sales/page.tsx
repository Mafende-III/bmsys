import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Ticket } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import { requireOwner } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { listSales } from "@/lib/sales/history";
import { formatRWF } from "@/lib/format";
import { Card, CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

type SearchParams = {
  from?: string;
  to?: string;
  channel?: string;
  payment?: string;
};

function parseDateParam(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

const PAYMENTS: PaymentMethod[] = ["CASH", "MOMO", "BANK"];

const FILTER_FIELD =
  "mt-0.5 block h-10 w-full rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const from = parseDateParam(sp.from);
  const toRaw = parseDateParam(sp.to);
  const to = toRaw ? endOfDay(toRaw) : undefined;
  const channelId = sp.channel || undefined;
  const paymentMethod = PAYMENTS.includes(sp.payment as PaymentMethod)
    ? (sp.payment as PaymentMethod)
    : undefined;

  const [rows, channels] = await Promise.all([
    listSales({ from, to, channelId, paymentMethod }, 100),
    prisma.channel.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const t = await getTranslations("salesHistory");

  const totalRevenue = rows.reduce((a, r) => a + r.total, 0);
  const totalProfit = rows.reduce((a, r) => a + r.profit, 0);

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
      </header>

      {/* Filters */}
      <form
        method="get"
        data-tour="sales-filters"
        className="grid grid-cols-2 gap-2 sm:grid-cols-5"
      >
        <label className="block">
          <CaptionLabel>{t("filterFrom")}</CaptionLabel>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className={FILTER_FIELD}
          />
        </label>
        <label className="block">
          <CaptionLabel>{t("filterTo")}</CaptionLabel>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className={FILTER_FIELD}
          />
        </label>
        <label className="block">
          <CaptionLabel>{t("filterChannel")}</CaptionLabel>
          <select
            name="channel"
            defaultValue={sp.channel ?? ""}
            className={FILTER_FIELD}
          >
            <option value="">{t("filterAll")}</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <CaptionLabel>{t("filterPayment")}</CaptionLabel>
          <select
            name="payment"
            defaultValue={sp.payment ?? ""}
            className={FILTER_FIELD}
          >
            <option value="">{t("filterAll")}</option>
            {PAYMENTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex items-end sm:col-span-1">
          <button
            type="submit"
            className="h-10 w-full rounded-full bg-surface px-4 text-[13px] font-bold text-primary ring-1 ring-inset ring-rule"
          >
            {t("filterApply")}
          </button>
        </div>
      </form>

      {/* Summary strip */}
      <section className="grid grid-cols-3 gap-2.5">
        <Card className="p-3">
          <CaptionLabel>{t("statCount")}</CaptionLabel>
          <p className="num mt-0.5 text-lg font-bold text-ink">
            {rows.length}
          </p>
        </Card>
        <Card className="p-3">
          <CaptionLabel>{t("statRevenue")}</CaptionLabel>
          <p className="num mt-0.5 text-lg font-bold text-ink">
            {formatRWF(totalRevenue)}
          </p>
        </Card>
        <Card className="p-3">
          <CaptionLabel>{t("statProfit")}</CaptionLabel>
          <p
            className={cn(
              "num mt-0.5 text-lg font-bold",
              totalProfit >= 0 ? "text-success" : "text-error",
            )}
          >
            {formatRWF(totalProfit)}
          </p>
        </Card>
      </section>

      {/* Sales list */}
      {rows.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <Card data-tour="sales-list" className="px-3.5 py-1">
          {rows.map((r, i) => (
            <Link
              key={r.id}
              href={`/sales/${r.id}`}
              className={cn(
                "flex items-center gap-3 py-3",
                i > 0 && "border-t border-rule-hair",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-ink">
                  <span className="num">
                    {new Date(r.date).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="ml-2 font-semibold text-ink-2">
                    {r.channelName} · {r.paymentMethod} · {r.sellerName}
                  </span>
                </p>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-ink-2">
                  {t("itemCount", { count: r.itemCount })}
                  {r.couponCode && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning-wash px-2 py-0.5 text-[10px] font-bold text-warning">
                      <Ticket className="h-3 w-3" strokeWidth={2.2} />
                      {r.couponCode}
                    </span>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="num text-sm font-bold text-ink">
                  {formatRWF(r.total)}
                </p>
                <p
                  className={cn(
                    "num text-xs font-semibold",
                    r.profit >= 0 ? "text-success" : "text-error",
                  )}
                >
                  {r.profit >= 0 ? "+" : ""}
                  {formatRWF(r.profit)}
                </p>
              </div>
            </Link>
          ))}
        </Card>
      )}

      <p className="text-center text-xs text-ink-2">{t("scopeNote")}</p>
    </main>
  );
}
