import Link from "next/link";
import { signOut } from "@/lib/auth";
import { requireSeller } from "@/lib/auth-guards";
import { getOpenSession } from "@/lib/cash-sessions/queries";
import { listAllowedChannels } from "@/lib/permissions";
import { getActiveChannelId } from "@/lib/sales/actions";
import { CartProvider } from "./_components/CartProvider";
import { CartHeader } from "./_components/CartHeader";
import { ChannelPicker } from "./_components/ChannelPicker";

export default async function SellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSeller();
  const allowedChannels = await listAllowedChannels(user.id);

  if (allowedChannels.length === 0) {
    return (
      <main className="mx-auto max-w-md p-4 sm:p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Sell</h1>
            <p className="text-sm text-zinc-600">
              {user.name}{" "}
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs uppercase text-zinc-700">
                {user.role}
              </span>
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
            >
              Sign out
            </button>
          </form>
        </header>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You have no allowed channels. Ask the owner to assign at least one
          channel to your account.
        </div>
      </main>
    );
  }

  // Determine current channel: cookie value if it's still allowed, else
  // first allowed channel. We don't write the cookie from this server
  // component (Next.js forbids that) — the cookie is set only when the
  // user explicitly picks a channel via ChannelPicker.
  const cookieChannelId = await getActiveChannelId();
  const allowedIds = new Set(allowedChannels.map((c) => c.id));
  const activeChannelId =
    cookieChannelId && allowedIds.has(cookieChannelId)
      ? cookieChannelId
      : (allowedChannels[0]?.id ?? "");

  const activeChannel = allowedChannels.find((c) => c.id === activeChannelId);
  const openSession = await getOpenSession();

  return (
    <CartProvider currentChannelId={activeChannelId}>
      <main className="mx-auto max-w-md p-4 sm:max-w-2xl sm:p-6">
        <header className="mb-3 flex items-end justify-between gap-2">
          <ChannelPicker
            channels={allowedChannels.map((c) => ({ id: c.id, name: c.name }))}
            currentChannelId={activeChannelId}
          />
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100"
            >
              Sign out
            </button>
          </form>
        </header>

        <CartHeader channelName={activeChannel?.name ?? "—"} />

        {!openSession && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠ Till is closed. Cash sales will be refused until someone opens
            it.
            {user.role === "OWNER" && (
              <>
                {" "}
                <Link
                  href="/cash-sessions"
                  className="font-medium underline"
                >
                  Open the till
                </Link>
                .
              </>
            )}
          </div>
        )}

        {children}
      </main>
    </CartProvider>
  );
}
