import Link from "next/link";
import { AlertTriangle, Check, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth-guards";
import { describeVariance } from "@/lib/copy";
import { formatRWF } from "@/lib/format";
import { getOpenSession, listSessions } from "@/lib/cash-sessions/queries";
import { Card, CaptionLabel, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";
import { OpenSessionForm } from "./_components/OpenSessionForm";

function VariancePill({ variance }: { variance: number }) {
  const v = describeVariance(variance);
  const tone =
    v.tone === "balanced" ? "success" : v.tone === "over" ? "warning" : "error";
  return (
    <StatusPill
      tone={tone}
      icon={
        v.tone === "balanced" ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : (
          <AlertTriangle className="h-3 w-3" strokeWidth={2.6} />
        )
      }
      className="shrink-0"
    >
      {v.label}
      {variance !== 0 && (
        <span className="num">{formatRWF(Math.abs(variance))}</span>
      )}
    </StatusPill>
  );
}

export default async function CashSessionsPage() {
  await requireSeller();

  const [open, history] = await Promise.all([
    getOpenSession(),
    listSessions(50),
  ]);
  const t = await getTranslations("cash");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
      </header>

      {open ? (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-bold text-ink">
              {t("openSince", {
                when: new Date(open.openedAt).toLocaleString(),
              })}
            </p>
            <StatusPill
              tone="success"
              icon={<Clock className="h-3 w-3" strokeWidth={2.6} />}
              className="shrink-0"
            >
              {tc("open")}
            </StatusPill>
          </div>
          <dl className="mt-3 space-y-2 border-t border-rule-hair pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt>
                <CaptionLabel>{t("openingFloat")}</CaptionLabel>
              </dt>
              <dd className="num text-[15px] font-bold text-ink">
                {formatRWF(open.openingFloat)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt>
                <CaptionLabel>
                  {t("cashSalesSoFar", { count: open.cashSalesCount })}
                </CaptionLabel>
              </dt>
              <dd className="num text-[15px] font-bold text-ink">
                {formatRWF(open.cashSalesTotal)}
              </dd>
            </div>
          </dl>
          <Link
            href={`/cash-sessions/${open.id}`}
            className="mt-3.5 flex h-12 items-center justify-center rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
          >
            {t("viewOrClose")}
          </Link>
        </Card>
      ) : (
        <OpenSessionForm />
      )}

      <section className="space-y-2">
        <CaptionLabel className="px-0.5">{t("history")}</CaptionLabel>
        {history.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink-2">
            {t("empty")}
          </Card>
        ) : (
          <Card className="px-3.5 py-1">
            {history.map((s, i) => (
              <Link
                key={s.id}
                href={`/cash-sessions/${s.id}`}
                className={cn(
                  "flex items-center gap-3 py-3",
                  i > 0 && "border-t border-rule-hair",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="num truncate text-[13px] font-bold text-ink">
                    {new Date(s.openedAt).toLocaleString()}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-2">
                    {t("byName", { name: s.openedBy.name })}
                    {s.closedAt
                      ? ` · ${t("headerClosed")} ${new Date(s.closedAt).toLocaleTimeString()}`
                      : ""}
                  </p>
                  <p className="num mt-0.5 text-[11px] text-ink-2">
                    {t("headerFloat")} {formatRWF(s.openingFloat)}
                    {s.closingCount !== null
                      ? ` → ${t("headerCounted")} ${formatRWF(s.closingCount)}`
                      : ""}
                  </p>
                </div>
                {s.variance == null ? (
                  <StatusPill
                    tone="success"
                    icon={<Clock className="h-3 w-3" strokeWidth={2.6} />}
                    className="shrink-0"
                  >
                    {tc("open")}
                  </StatusPill>
                ) : (
                  <VariancePill variance={s.variance} />
                )}
              </Link>
            ))}
          </Card>
        )}
      </section>
    </main>
  );
}
