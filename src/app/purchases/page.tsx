import Link from "next/link";
import { Check, Clock, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { listPurchases, type PurchaseStatus } from "@/lib/purchases/queries";
import { Card, CaptionLabel, StatusPill, type StatusTone } from "@/components/ui";
import { cn } from "@/lib/cn";

type SearchParams = { status?: string };

const validStatus = (s: string | undefined): PurchaseStatus => {
  if (s === "DRAFT" || s === "RECEIVED" || s === "CANCELLED" || s === "all")
    return s;
  return "all";
};

const STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "warning",
  RECEIVED: "success",
  CANCELLED: "neutral",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "RECEIVED")
    return <Check className="h-3 w-3" strokeWidth={3} />;
  if (status === "DRAFT")
    return <Clock className="h-3 w-3" strokeWidth={2.6} />;
  return <X className="h-3 w-3" strokeWidth={3} />;
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();

  const params = await searchParams;
  const status = validStatus(params.status);
  const purchases = await listPurchases({ status });
  const t = await getTranslations("purchases");

  const statusLabel: Record<string, string> = {
    DRAFT: t("statusDraft"),
    RECEIVED: t("statusReceived"),
    CANCELLED: t("statusCancelled"),
  };

  const filters: Array<[PurchaseStatus, string]> = [
    ["all", t("filterAll")],
    ["DRAFT", t("statusDraft")],
    ["RECEIVED", t("statusReceived")],
    ["CANCELLED", t("statusCancelled")],
  ];

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
          <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
        </div>
        <Link
          href="/purchases/new"
          className="flex h-11 shrink-0 items-center rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
        >
          {t("new")}
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <Link
            key={value}
            href={value === "all" ? "/purchases" : `/purchases?status=${value}`}
            className={cn(
              "rounded-full px-4 py-2 text-[13px]",
              status === value
                ? "bg-ink font-bold text-white"
                : "bg-surface font-semibold text-ink-2 ring-1 ring-inset ring-rule",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {purchases.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <div className="space-y-2.5">
          {purchases.map((p) => (
            <Link key={p.id} href={`/purchases/${p.id}`} className="block">
              <Card className="p-3.5 transition-shadow hover:ring-rule">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-ink">
                      {p.supplier.name}
                    </p>
                    <p className="num mt-0.5 text-xs text-ink-2">
                      {new Date(p.date).toLocaleDateString()} ·{" "}
                      {t("lineCount", { count: p._count.lines })}
                    </p>
                  </div>
                  <StatusPill
                    tone={STATUS_TONE[p.status] ?? "neutral"}
                    icon={<StatusIcon status={p.status} />}
                    className="shrink-0"
                  >
                    {statusLabel[p.status] ?? p.status}
                  </StatusPill>
                </div>
                <div className="mt-2.5 flex items-baseline justify-between border-t border-rule-hair pt-2.5">
                  <CaptionLabel>{t("headerTotal")}</CaptionLabel>
                  <span className="num text-base font-bold text-ink">
                    {formatRWF(p.totalCost)}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
