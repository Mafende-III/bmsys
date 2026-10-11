import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth-guards";
import { describeVariance } from "@/lib/copy";
import { formatRWF } from "@/lib/format";
import { getSession } from "@/lib/cash-sessions/queries";
import { Card, CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CloseSessionForm } from "../_components/CloseSessionForm";

export default async function CashSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSeller();

  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  const t = await getTranslations("cash");

  const isOpen = session.closedAt === null;
  const variance = session.variance ?? 0;
  const varianceTone = describeVariance(variance).tone;

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">
          {isOpen ? t("detailOpen") : t("detailClosed")}
        </h1>
        <p className="text-[13px] text-ink-2">
          {t("openedByLine", {
            when: new Date(session.openedAt).toLocaleString(),
            name: session.openedBy.name,
          })}
        </p>
      </header>

      <Card className="p-4">
        <dl className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt>
              <CaptionLabel>{t("openingFloat")}</CaptionLabel>
            </dt>
            <dd className="num text-[15px] font-semibold text-ink">
              {formatRWF(session.openingFloat)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt>
              <CaptionLabel>
                {t("cashSales", { count: session.cashSalesCount })}
              </CaptionLabel>
            </dt>
            <dd className="num text-[15px] font-semibold text-ink">
              {formatRWF(session.cashSalesTotal)}
            </dd>
          </div>
          {session.expectedCash !== null && (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <dt>
                  <CaptionLabel>{t("form.expected")}</CaptionLabel>
                </dt>
                <dd className="num text-[15px] font-semibold text-ink">
                  {formatRWF(session.expectedCash)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt>
                  <CaptionLabel>{t("headerCounted")}</CaptionLabel>
                </dt>
                <dd className="num text-[15px] font-semibold text-ink">
                  {formatRWF(session.closingCount ?? 0)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-rule-hair pt-2">
                <dt>
                  <CaptionLabel>{t("result")}</CaptionLabel>
                </dt>
                <dd
                  className={cn(
                    "text-[15px] font-bold",
                    varianceTone === "balanced"
                      ? "text-success"
                      : varianceTone === "over"
                        ? "text-warning"
                        : "text-error",
                  )}
                >
                  {describeVariance(variance).label}
                  {variance !== 0 && (
                    <>
                      {" — "}
                      <span className="num">
                        {formatRWF(Math.abs(variance))}
                      </span>
                    </>
                  )}
                </dd>
              </div>
            </>
          )}
        </dl>
        {session.note && (
          <p className="mt-3 rounded-panel bg-ground px-3.5 py-2.5 text-xs text-ink-2">
            {session.note}
          </p>
        )}
        {session.closedAt && (
          <p className="mt-3 text-xs text-ink-2">
            {t("closedByLine", {
              when: new Date(session.closedAt).toLocaleString(),
              name: session.closedBy?.name ?? "—",
            })}
          </p>
        )}
      </Card>

      {isOpen && (
        <CloseSessionForm
          sessionId={session.id}
          openingFloat={session.openingFloat}
          cashSalesTotal={session.cashSalesTotal}
        />
      )}
    </main>
  );
}
