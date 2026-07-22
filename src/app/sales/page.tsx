import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ReceiptText, Ticket } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";
import { requireOwner } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { listSales } from "@/lib/sales/history";
import { formatRWF } from "@/lib/format";

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
  const tc = await getTranslations("common");

  const totalRevenue = rows.reduce((a, r) => a + r.total, 0);
  const totalProfit = rows.reduce((a, r) => a + r.profit, 0);

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <header>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← {tc("dashboard")}
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
          <ReceiptText className="h-6 w-6" strokeWidth={2} />
          {t("title")}
        </h1>
        <p className="text-sm text-zinc-600">{t("subtitle")}</p>
      </header>

      {/* Filters */}
      <form
        method="get"
        data-tour="sales-filters"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 sm:grid-cols-5"
      >
        <label className="block text-xs">
          <span className="text-zinc-600">{t("filterFrom")}</span>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="mt-0.5 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-600">{t("filterTo")}</span>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="mt-0.5 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block text-xs">
          <span className="text-zinc-600">{t("filterChannel")}</span>
          <select
            name="channel"
            defaultValue={sp.channel ?? ""}
            className="mt-0.5 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t("filterAll")}</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="text-zinc-600">{t("filterPayment")}</span>
          <select
            name="payment"
            defaultValue={sp.payment ?? ""}
            className="mt-0.5 block w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="">{t("filterAll")}</option>
            {PAYMENTS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t("filterApply")}
          </button>
        </div>
      </form>

      {/* Summary strip */}
      <section className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("statCount")}
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {rows.length}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("statRevenue")}
          </p>
          <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums">
            {formatRWF(totalRevenue)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">
            {t("statProfit")}
          </p>
          <p
            className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
              totalProfit >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {formatRWF(totalProfit)}
          </p>
        </div>
      </section>

      {/* Sales list */}
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-600">
          {t("empty")}
        </p>
      ) : (
        <section
          data-tour="sales-list"
          className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
        >
          <ul className="divide-y divide-zinc-100">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/sales/${r.id}`}
                  className="flex items-center gap-3 p-3 hover:bg-zinc-50 sm:px-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-800">
                      {new Date(r.date).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      <span className="ml-2 font-normal text-zinc-500">
                        {r.channelName} · {r.paymentMethod} · {r.sellerName}
                      </span>
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                      {t("itemCount", { count: r.itemCount })}
                      {r.couponCode && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          <Ticket className="h-3 w-3" strokeWidth={2} />
                          {r.couponCode}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {formatRWF(r.total)}
                    </p>
                    <p
                      className={`font-mono text-xs tabular-nums ${
                        r.profit >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {r.profit >= 0 ? "+" : ""}
                      {formatRWF(r.profit)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-xs text-zinc-500">{t("scopeNote")}</p>
    </main>
  );
}
