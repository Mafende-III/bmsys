import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth-guards";
import { ChannelForm } from "../_components/ChannelForm";
import { getChannel, getChannelUsage } from "@/lib/channels/queries";
import { reactivateChannel } from "@/lib/channels/actions";

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

  const reactivateKey = crypto.randomUUID();

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href="/channels"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Channels
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold">
            {channel.name}
          </h1>
          <p className="font-mono text-xs text-zinc-500">{channel.slug}</p>
        </div>
        {channel.active ? (
          <Link
            href={`/channels/${id}/deactivate`}
            className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          >
            Deactivate
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
              className="shrink-0 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-sm text-green-700 hover:bg-green-50"
            >
              Reactivate
            </button>
          </form>
        )}
      </header>

      <ChannelForm mode={{ kind: "edit", id, channel }} />

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-800">Usage</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-zinc-600">Customers with this as primary</dt>
          <dd className="text-right font-mono tabular-nums">
            {usage.customerCount}
          </dd>
          <dt className="text-zinc-600">Sales in the last 30 days</dt>
          <dd className="text-right font-mono tabular-nums">
            {usage.recentSales}
          </dd>
        </dl>
        {channel.active && usage.recentSales > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            Cannot deactivate while there are recent sales.
          </p>
        )}
      </section>
    </main>
  );
}
