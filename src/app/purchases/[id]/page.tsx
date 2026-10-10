import { notFound } from "next/navigation";
import { Check, Clock, X } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { formatRWF } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getPurchaseWithLines } from "@/lib/purchases/queries";
import { StatusPill, type StatusTone } from "@/components/ui";
import { PurchaseForm } from "../_components/PurchaseForm";

const STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "warning",
  RECEIVED: "success",
  CANCELLED: "neutral",
};

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const purchase = await getPurchaseWithLines(id);
  if (!purchase) notFound();

  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        unitsPerCarton: true,
        costPerCarton: true,
      },
    }),
  ]);

  const t = await getTranslations("purchases");
  const statusLabel: Record<string, string> = {
    DRAFT: t("statusDraft"),
    RECEIVED: t("statusReceived"),
    CANCELLED: t("statusCancelled"),
  };

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink">
            {purchase.supplier.name}
          </h1>
          <p className="num text-[13px] text-ink-2">
            {new Date(purchase.date).toLocaleDateString()} ·{" "}
            {purchase.user.name} · {formatRWF(purchase.totalCost)}
          </p>
        </div>
        <StatusPill
          tone={STATUS_TONE[purchase.status] ?? "neutral"}
          icon={
            purchase.status === "RECEIVED" ? (
              <Check className="h-3 w-3" strokeWidth={3} />
            ) : purchase.status === "DRAFT" ? (
              <Clock className="h-3 w-3" strokeWidth={2.6} />
            ) : (
              <X className="h-3 w-3" strokeWidth={3} />
            )
          }
          className="shrink-0"
        >
          {statusLabel[purchase.status] ?? purchase.status}
        </StatusPill>
      </header>

      <PurchaseForm
        mode={{
          kind: "edit",
          id: purchase.id,
          status: purchase.status,
          supplierId: purchase.supplierId,
          date: purchase.date,
          note: purchase.note ?? "",
          lines: purchase.lines.map((l) => ({
            productId: l.productId,
            qtyCartons: l.qtyCartons,
            unitCost: l.unitCost,
          })),
        }}
        suppliers={suppliers}
        products={products}
      />
    </main>
  );
}
