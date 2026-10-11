import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { ChannelForm } from "../_components/ChannelForm";
import { getChannel, getChannelUsage } from "@/lib/channels/queries";
import { reactivateChannel } from "@/lib/channels/actions";
import { Card, CaptionLabel } from "@/components/ui";

export default async function EditChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const [channel, usage] = await Promise.all([
    getChannel(id),
    getChannelUsage(id),
  ]);

  if (!channel) notFound();
  const t = await getTranslations("channels");

  const reactivateKey = crypto.randomUUID();

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-ink">
            {channel.name}
          </h1>
          <p className="num text-[13px] text-ink-2">{channel.slug}</p>
        </div>
        {channel.active ? (
          <Link
            href={`/channels/${id}/deactivate`}
            className="flex h-11 shrink-0 items-center rounded-full bg-surface px-4 text-sm font-bold text-error ring-1 ring-inset ring-rule"
          >
            {t("deactivate")}
          </Link>
        ) : (
          <form
            action={async () => {
              "use server";
              const result = await reactivateChannel(reactivateKey, id);
              if (!result.ok) throw new Error(result.error);
            }}
          >
            <button
              type="submit"
              className="flex h-11 shrink-0 items-center rounded-full bg-surface px-4 text-sm font-bold text-success ring-1 ring-inset ring-rule"
            >
              {t("reactivate")}
            </button>
          </form>
        )}
      </header>

      <ChannelForm mode={{ kind: "edit", id, channel }} />

      <Card className="p-4">
        <CaptionLabel>{t("usageTitle")}</CaptionLabel>
        <dl className="mt-3 space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[13px] text-ink-2">{t("usageCustomers")}</dt>
            <dd className="num text-[15px] font-bold text-ink">
              {usage.customerCount}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[13px] text-ink-2">{t("usageSales")}</dt>
            <dd className="num text-[15px] font-bold text-ink">
              {usage.recentSales}
            </dd>
          </div>
        </dl>
        {channel.active && usage.recentSales > 0 && (
          <p className="mt-3 rounded-panel bg-warning-wash px-3.5 py-2.5 text-xs font-semibold text-warning">
            {t("cannotDeactivateNote")}
          </p>
        )}
      </Card>
    </main>
  );
}
