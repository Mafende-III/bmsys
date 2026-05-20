import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import {
  AUDIT_CATEGORIES,
  AUDIT_TONE,
  type AuditCategory,
} from "@/lib/audit/categories";
import { listSecurityEvents } from "@/lib/audit/queries";
import { formatRWF } from "@/lib/format";

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
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← {tc("dashboard")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-zinc-600">{t("subtitle")}</p>
      </header>

      <form method="get" className="mt-2 flex gap-2" data-tour="audit-filter">
        <label className="block">
          <span className="text-xs font-medium text-zinc-700">
            {t("filterCategory")}
          </span>
          <select
            name="category"
            defaultValue={category}
            className="mt-1 block rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="all">{t("filterAll")}</option>
            {AUDIT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          {tc("filter")}
        </button>
      </form>

      <div
        data-tour="audit-table"
        className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200 bg-white"
      >
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">{t("headerWhen")}</th>
              <th className="px-3 py-2">{t("headerEvent")}</th>
              <th className="px-3 py-2">{t("headerWho")}</th>
              <th className="px-3 py-2">{t("headerDetails")}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                label={categoryLabel[e.category]}
                anonymousLabel={t("anonymousAttempt")}
              />
            ))}
            {events.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-zinc-500"
                >
                  {t("empty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function EventRow({
  event,
  label,
  anonymousLabel,
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
}) {
  const tone = AUDIT_TONE[event.category];
  const toneClass =
    tone === "alert"
      ? "bg-red-100 text-red-800"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800"
        : "bg-zinc-100 text-zinc-700";

  return (
    <tr className="border-t border-zinc-200">
      <td className="px-3 py-2 text-xs text-zinc-600 whitespace-nowrap">
        {new Date(event.createdAt).toLocaleString()}
      </td>
      <td className="px-3 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${toneClass}`}
        >
          {label}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-zinc-700">
        {event.userName ?? anonymousLabel}
      </td>
      <td className="px-3 py-2 text-xs text-zinc-600">
        <EventDetails category={event.category} changes={event.changes} />
      </td>
    </tr>
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
        <span className="font-mono">{phone}</span>
        {reason && <span className="ml-2 text-zinc-500">· {reason}</span>}
      </span>
    );
  }

  if (category === "CASH_LARGE_VARIANCE") {
    const v = typeof c.variance === "number" ? c.variance : 0;
    return (
      <span className={v < 0 ? "text-red-700" : "text-amber-700"}>
        {v >= 0 ? "+" : ""}
        {formatRWF(v)}
      </span>
    );
  }

  return null;
}
