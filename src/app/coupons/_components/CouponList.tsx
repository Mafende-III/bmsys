"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, Ticket, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, FilterChips, type FilterChipOption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatRWF } from "@/lib/format";
import { revokeCoupon } from "@/lib/coupons/actions";
import type { CouponRow } from "@/lib/coupons/queries";

const TABS = ["ACTIVE", "REDEEMED", "EXPIRED", "REVOKED"] as const;
type Tab = (typeof TABS)[number];

export function CouponList({ coupons }: { coupons: CouponRow[] }) {
  const t = useTranslations("coupons");
  const [tab, setTab] = useState<Tab>("ACTIVE");
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const tabLabel: Record<Tab, string> = {
    ACTIVE: t("tabActive"),
    REDEEMED: t("tabRedeemed"),
    EXPIRED: t("tabExpired"),
    REVOKED: t("tabRevoked"),
  };

  function describeValue(c: CouponRow): string {
    if (c.type === "PERCENT") return t("valuePercent", { value: c.value });
    return c.perUnit
      ? t("valueFixedEach", { value: formatRWF(c.value) })
      : t("valueFixed", { value: formatRWF(c.value) });
  }

  function describeScope(c: CouponRow): string {
    if (c.productName) return t("scopeProduct", { name: c.productName });
    return t("scopeCart");
  }

  function relativeDays(d: Date): string {
    const ms = new Date(d).getTime() - Date.now();
    const days = Math.round(ms / 86_400_000);
    if (Math.abs(days) < 1) return t("relToday");
    if (days > 0) return t("relInDays", { count: days });
    return t("relAgo", { count: Math.abs(days) });
  }

  const counts = useMemo(() => {
    const c: Record<Tab, number> = {
      ACTIVE: 0,
      REDEEMED: 0,
      EXPIRED: 0,
      REVOKED: 0,
    };
    for (const x of coupons) c[x.status] += 1;
    return c;
  }, [coupons]);

  const rows = coupons.filter((c) => c.status === tab);

  const chipOptions: FilterChipOption<Tab>[] = TABS.map((value) => ({
    value,
    label: tabLabel[value],
    count: counts[value],
  }));

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    } catch {
      // clipboard may be blocked; fall back silently
    }
  }

  function onRevoke(id: string) {
    if (!confirm(t("confirmRevoke"))) return;
    startTransition(async () => {
      await revokeCoupon(id);
    });
  }

  function statusLine(c: CouponRow): string {
    if (c.status === "ACTIVE")
      return t("expires", { when: relativeDays(c.expiresAt) });
    if (c.status === "EXPIRED")
      return t("expired", { when: relativeDays(c.expiresAt) });
    if (c.status === "REDEEMED") {
      const when = c.redeemedAt ? relativeDays(c.redeemedAt) : "";
      return c.redeemedByUserName
        ? t("usedBy", { name: c.redeemedByUserName, when })
        : t("used", { when });
    }
    return c.revokedAt ? t("revoked", { when: relativeDays(c.revokedAt) }) : "";
  }

  return (
    <div className="space-y-3">
      <FilterChips options={chipOptions} value={tab} onChange={setTab} />

      {rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-2">
          <Ticket className="mx-auto h-8 w-8 text-ink-2" strokeWidth={1.5} />
          <p className="mt-2 font-bold text-ink">{t("empty")}</p>
          <p className="mt-0.5 text-xs">{t("emptyHint")}</p>
        </Card>
      ) : (
        <Card className="px-3.5 py-1">
          {rows.map((c, i) => (
            <div
              key={c.id}
              className={cn(
                "flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between",
                i > 0 && "border-t border-rule-hair",
              )}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="shrink-0 rounded-panel bg-surface-sunk px-2.5 py-1.5 ring-1 ring-inset ring-rule">
                  <p className="num text-base font-bold tracking-wider text-ink">
                    {c.code}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {describeValue(c)} · {describeScope(c)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-2">
                    {statusLine(c)}
                    {c.notes ? ` · ${c.notes}` : ""}
                  </p>
                </div>
              </div>
              {c.status === "ACTIVE" && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => copy(c.code)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-primary ring-1 ring-inset ring-rule"
                  >
                    {copied === c.code ? (
                      <>
                        <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {t("copied")}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />
                        {t("copy")}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onRevoke(c.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-error ring-1 ring-inset ring-rule disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                    {t("revoke")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
