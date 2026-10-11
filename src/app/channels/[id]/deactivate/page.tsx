import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { deactivateChannel } from "@/lib/channels/actions";
import { getChannel, getChannelUsage } from "@/lib/channels/queries";
import { Card } from "@/components/ui";

export default async function DeactivateChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) notFound();
  if (!channel.active) redirect(`/channels/${id}`);

  const usage = await getChannelUsage(id);
  const canDeactivate = usage.recentSales === 0;
  const idempotencyKey = crypto.randomUUID();
  const t = await getTranslations("channels");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("deactivateTitle")}</h1>
        <p className="text-[13px] text-ink-2">
          <span className="num">{channel.slug}</span> — {channel.name}
        </p>
      </header>

      {canDeactivate ? (
        <form
          action={async () => {
            "use server";
            const result = await deactivateChannel(idempotencyKey, id);
            if (!result.ok) throw new Error(result.error);
            redirect("/channels");
          }}
          className="space-y-3"
        >
          <Card className="p-4 text-sm text-ink">{t("deactivateBody")}</Card>
          {usage.customerCount > 0 && (
            <div className="rounded-panel bg-warning-wash px-3.5 py-2.5 text-xs font-semibold text-warning">
              {t("deactivateCustomersWarn", { count: usage.customerCount })}
            </div>
          )}
          <div className="flex gap-2.5">
            <Link
              href={`/channels/${id}`}
              className="flex h-12 flex-1 items-center justify-center rounded-full bg-surface px-5 text-sm font-semibold text-ink-2 ring-1 ring-inset ring-rule"
            >
              {tc("cancel")}
            </Link>
            <button
              type="submit"
              className="h-12 flex-1 rounded-full bg-error px-4 text-sm font-bold text-white"
            >
              {t("deactivate")}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-panel bg-warning-wash p-4">
          <p className="text-sm font-bold text-warning">
            {t("cannotDeactivateTitle")}
          </p>
          <p className="mt-2 text-sm font-semibold text-warning">
            {t("cannotDeactivateReason", { count: usage.recentSales })}
          </p>
          <Link
            href={`/channels/${id}`}
            className="mt-3 inline-block text-sm font-bold text-warning underline"
          >
            ← {t("backToChannel")}
          </Link>
        </div>
      )}
    </main>
  );
}
