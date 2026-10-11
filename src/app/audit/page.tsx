import { getTranslations } from "next-intl/server";
import { AlertTriangle, LogIn, ShieldAlert } from "lucide-react";
import { requireOwner } from "@/lib/auth-guards";
import {
  AUDIT_CATEGORIES,
  AUDIT_TONE,
  type AuditCategory,
} from "@/lib/audit/categories";
import { listSecurityEvents } from "@/lib/audit/queries";
import { formatRWF } from "@/lib/format";
import { Card, StatusPill, type StatusTone } from "@/components/ui";
import { cn } from "@/lib/cn";

type SearchParams = { category?: string };

function isCategory(v: unknown): v is AuditCategory {
  return (
    typeof v === "string" && (AUDIT_CATEGORIES as readonly string[]).includes(v)
  );
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const category: AuditCategory | "all" = isCategory(sp.category)
    ? sp.category
    : "all";

  const events = await listSecurityEvents({ category, sinceDays: 30 });
  const t = await getTranslations("audit");
  const tc = await getTranslations("common");

  const categoryLabel: Record<AuditCategory, string> = {
    LOGIN_SUCCESS: t("categoryLoginSuccess"),
    LOGIN_FAILED: t("categoryLoginFailed"),
    CASH_LARGE_VARIANCE: t("categoryCashLargeVariance"),
  };

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
      </header>

      <form method="get" className="flex gap-2" data-tour="audit-filter">
        <select
          name="category"
          defaultValue={category}
          aria-label={t("filterCategory")}
          className="h-10 min-w-0 flex-1 rounded-panel border border-rule bg-surface px-2.5 text-[13px] text-ink-2"
        >
          <option value="all">{t("filterAll")}</option>
          {AUDIT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryLabel[c]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-10 shrink-0 rounded-full bg-surface px-4 text-[13px] font-bold text-primary ring-1 ring-inset ring-rule"
        >
          {tc("filter")}
        </button>
      </form>

      {events.length === 0 ? (
        <Card data-tour="audit-table" className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <Card data-tour="audit-table" className="px-3.5 py-1">
          {events.map((e, i) => (
            <EventRow
              key={e.id}
              event={e}
              label={categoryLabel[e.category]}
              anonymousLabel={t("anonymousAttempt")}
              divider={i > 0}
            />
          ))}
        </Card>
      )}
    </main>
  );
}

function EventRow({
  event,
  label,
  anonymousLabel,
  divider,
}: {
  event: {
    id: string;
    createdAt: Date;
    category: AuditCategory;
    changes: unknown;
    userName: string | null;
    userId: string | null;
  };
  label: string;
  anonymousLabel: string;
  divider: boolean;
}) {
  const tone = AUDIT_TONE[event.category];
  const pillTone: StatusTone =
    tone === "alert" ? "error" : tone === "warn" ? "warning" : "neutral";
  const icon =
    event.category === "CASH_LARGE_VARIANCE" ? (
      <AlertTriangle className="h-3 w-3" strokeWidth={2.6} />
    ) : tone === "alert" ? (
      <ShieldAlert className="h-3 w-3" strokeWidth={2.6} />
    ) : (
      <LogIn className="h-3 w-3" strokeWidth={2.6} />
    );

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3",
        divider && "border-t border-rule-hair",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="num text-[13px] font-bold text-ink">
          {new Date(event.createdAt).toLocaleString()}
        </p>
        <p className="mt-0.5 truncate text-xs text-ink-2">
          {event.userName ?? anonymousLabel}
          <span className="ml-2">
            <EventDetails category={event.category} changes={event.changes} />
          </span>
        </p>
      </div>
      <StatusPill tone={pillTone} icon={icon} className="shrink-0">
        {label}
      </StatusPill>
    </div>
  );
}

function EventDetails({
  category,
  changes,
}: {
  category: AuditCategory;
  changes: unknown;
}) {
  if (!changes || typeof changes !== "object") return null;
  const c = changes as Record<string, unknown>;

  if (category === "LOGIN_SUCCESS" || category === "LOGIN_FAILED") {
    const phone = typeof c.phone === "string" ? c.phone : "—";
    const reason = typeof c.reason === "string" ? c.reason : null;
    return (
      <span>
        <span className="num">{phone}</span>
        {reason && <span className="ml-2 text-ink-2">· {reason}</span>}
      </span>
    );
  }

  if (category === "CASH_LARGE_VARIANCE") {
    const v = typeof c.variance === "number" ? c.variance : 0;
    return (
      <span className={cn("num font-bold", v < 0 ? "text-error" : "text-warning")}>
        {v >= 0 ? "+" : ""}
        {formatRWF(v)}
      </span>
    );
  }

  return null;
}
