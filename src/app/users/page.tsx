import Link from "next/link";
import { Check, Pause } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { listUsersWithChannels } from "@/lib/users/queries";
import { Card, StatusPill } from "@/components/ui";
import { cn } from "@/lib/cn";

export default async function UsersPage() {
  await requireOwner();

  const users = await listUsersWithChannels();
  const t = await getTranslations("users");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
          <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
        </div>
        <Link
          href="/users/new"
          className="flex h-11 shrink-0 items-center rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
        >
          {t("new")}
        </Link>
      </header>

      {users.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-2">
          {t("empty")}
        </Card>
      ) : (
        <Card className="px-3.5 py-1">
          {users.map((u, i) => (
            <Link
              key={u.id}
              href={`/users/${u.id}`}
              className={cn(
                "flex items-center gap-3 py-3",
                i > 0 && "border-t border-rule-hair",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-ink">
                  {u.name}
                  <span className="ml-2 rounded-full bg-surface-sunk px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-primary">
                    {u.role === "OWNER" ? t("roleOwner") : t("roleSeller")}
                  </span>
                </p>
                <p className="num mt-0.5 truncate text-xs text-ink-2">
                  {u.phone}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-2">
                  {u.role === "OWNER"
                    ? t("allChannels")
                    : u.channels.length === 0
                      ? t("form.noChannels")
                      : u.channels.map((c) => c.channel.name).join(", ")}
                </p>
              </div>
              {u.active ? (
                <StatusPill
                  tone="success"
                  icon={<Check className="h-3 w-3" strokeWidth={3} />}
                  className="shrink-0"
                >
                  {tc("active")}
                </StatusPill>
              ) : (
                <StatusPill
                  tone="neutral"
                  icon={<Pause className="h-3 w-3" strokeWidth={2.6} />}
                  className="shrink-0"
                >
                  {t("inactive")}
                </StatusPill>
              )}
            </Link>
          ))}
        </Card>
      )}
    </main>
  );
}
