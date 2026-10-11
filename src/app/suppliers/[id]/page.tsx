import { notFound } from "next/navigation";
import { Check, Clock, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { getRecentPurchases, getSupplier } from "@/lib/suppliers/queries";
import { Card, CaptionLabel, StatusPill, type StatusTone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SupplierForm } from "../_components/SupplierForm";

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

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const [supplier, purchases] = await Promise.all([
    getSupplier(id),
    getRecentPurchases(id, 20),
  ]);

  if (!supplier) notFound();
  const t = await getTranslations("suppliers");
  const tp = await getTranslations("purchases");

  const statusLabel: Record<string, string> = {
    DRAFT: tp("statusDraft"),
    RECEIVED: tp("statusReceived"),
    CANCELLED: tp("statusCancelled"),
  };

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{supplier.name}</h1>
        {supplier.phone && (
          <p className="num text-[13px] text-ink-2">{supplier.phone}</p>
        )}
      </header>

      <SupplierForm mode={{ kind: "edit", id, supplier }} />

      <section className="space-y-2 pt-2">
        <div className="px-0.5">
          <CaptionLabel>{t("recentPurchases")}</CaptionLabel>
          <p className="mt-0.5 text-xs text-ink-2">{t("lastTwenty")}</p>
        </div>
        {purchases.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink-2">
            {t("noPurchases")}
          </Card>
        ) : (
          <Card className="px-3.5 py-1">
            {purchases.map((p, i) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 py-3",
                  i > 0 && "border-t border-rule-hair",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="num text-[13px] font-bold text-ink">
                    {new Date(p.date).toLocaleDateString()}
                  </p>
                  {p.note && (
                    <p className="mt-0.5 truncate text-xs text-ink-2">
                      {p.note}
                    </p>
                  )}
                </div>
                <StatusPill
                  tone={STATUS_TONE[p.status] ?? "neutral"}
                  icon={<StatusIcon status={p.status} />}
                  className="shrink-0"
                >
                  {statusLabel[p.status] ?? p.status}
                </StatusPill>
                <span className="num w-24 shrink-0 text-right text-sm font-bold text-ink">
                  {formatRWF(p.totalCost)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </main>
  );
}
