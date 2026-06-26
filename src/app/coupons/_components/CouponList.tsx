"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Copy, Ticket, Trash2 } from "lucide-react";
import { formatRWF } from "@/lib/format";
import { revokeCoupon } from "@/lib/coupons/actions";
import type { CouponRow } from "@/lib/coupons/queries";

const TABS = ["ACTIVE", "REDEEMED", "EXPIRED", "REVOKED"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  ACTIVE: "Active",
  REDEEMED: "Redeemed",
  EXPIRED: "Expired",
  REVOKED: "Revoked",
};

function describeValue(c: CouponRow): string {
  if (c.type === "PERCENT") return `${c.value}% off`;
  return c.perUnit
    ? `${formatRWF(c.value)} off each`
    : `${formatRWF(c.value)} off`;
}

function describeScope(c: CouponRow): string {
  if (c.productName) return `Only on ${c.productName}`;
  return "Whole cart";
}

function relativeDays(d: Date): string {
  const ms = new Date(d).getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  if (Math.abs(days) < 1) return "today";
  if (days === 1) return "in 1 day";
  if (days === -1) return "1 day ago";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function CouponList({ coupons }: { coupons: CouponRow[] }) {
  const [tab, setTab] = useState<Tab>("ACTIVE");
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    if (!confirm("Revoke this coupon? The code will stop working.")) return;
    startTransition(async () => {
      await revokeCoupon(id);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            {TAB_LABEL[t]}{" "}
            <span className="ml-0.5 text-xs opacity-70">({counts[t]})</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-600">
          <Ticket
            className="mx-auto h-8 w-8 text-zinc-400"
            strokeWidth={1.5}
          />
          <p className="mt-2 font-medium">No {TAB_LABEL[tab].toLowerCase()} coupons.</p>
          <p className="mt-0.5 text-xs">
            Create a coupon to give a customer a one-time discount.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-zinc-200 bg-white divide-y divide-zinc-100">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="shrink-0 rounded-lg border-2 border-zinc-200 bg-zinc-50 px-2.5 py-1.5">
                  <p className="font-mono text-base font-semibold tracking-wider tabular-nums">
                    {c.code}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-zinc-800">
                    {describeValue(c)} · {describeScope(c)}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {c.status === "ACTIVE" &&
                      `Expires ${relativeDays(c.expiresAt)}`}
                    {c.status === "EXPIRED" &&
                      `Expired ${relativeDays(c.expiresAt)}`}
                    {c.status === "REDEEMED" &&
                      `Used ${
                        c.redeemedByUserName
                          ? `by ${c.redeemedByUserName}`
                          : ""
                      } ${c.redeemedAt ? relativeDays(c.redeemedAt) : ""}`}
                    {c.status === "REVOKED" &&
                      c.revokedAt &&
                      `Revoked ${relativeDays(c.revokedAt)}`}
                    {c.notes ? ` · ${c.notes}` : ""}
                  </p>
                </div>
              </div>
              {c.status === "ACTIVE" && (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => copy(c.code)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    {copied === c.code ? (
                      <>
                        <Check className="h-3.5 w-3.5" strokeWidth={2} />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onRevoke(c.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Revoke
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
