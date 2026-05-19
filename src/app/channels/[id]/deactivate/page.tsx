import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { deactivateChannel } from "@/lib/channels/actions";
import { getChannel, getChannelUsage } from "@/lib/channels/queries";

export default async function DeactivateChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const channel = await getChannel(id);
  if (!channel) notFound();
  if (!channel.active) redirect(`/channels/${id}`);

  const usage = await getChannelUsage(id);
  const canDeactivate = usage.recentSales === 0;
  const idempotencyKey = crypto.randomUUID();

  return (
    <main className="mx-auto max-w-md p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href={`/channels/${id}`}
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Back to channel
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Deactivate channel</h1>
        <p className="text-sm text-zinc-600">
          <span className="font-mono">{channel.slug}</span> — {channel.name}
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
          className="space-y-4"
        >
          <p className="text-sm text-zinc-700">
            This sets the channel to <strong>inactive</strong>. It is hidden
            from active filters and excluded from new sales, but all history
            (audit log, prior sales) is preserved. You can reactivate it
            later from the edit page.
          </p>
          {usage.customerCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {usage.customerCount} customer
              {usage.customerCount === 1 ? "" : "s"} still have this as their
              primary channel. They are not deleted; you can reassign them
              later.
            </div>
          )}
          <div className="flex gap-2">
            <Link
              href={`/channels/${id}`}
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Deactivate
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Cannot deactivate yet
          </p>
          <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
            <li>
              {usage.recentSales} sale
              {usage.recentSales === 1 ? "" : "s"} on this channel in the
              last 30 days. Wait until activity dies down, or pick a
              different channel for new sales first.
            </li>
          </ul>
          <Link
            href={`/channels/${id}`}
            className="mt-3 inline-block text-sm text-amber-900 underline"
          >
            ← Back to channel
          </Link>
        </div>
      )}
    </main>
  );
}
