import { signOut } from "@/lib/auth";
import { requireSeller } from "@/lib/auth-guards";
import { listAllowedChannels } from "@/lib/permissions";

export default async function SellPage() {
  const user = await requireSeller();
  const channels = await listAllowedChannels(user.id);

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sell</h1>
          <p className="text-sm text-zinc-600">
            Signed in as <span className="font-medium">{user.name}</span>{" "}
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

      <section className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-700">
        <h2 className="text-lg font-medium text-zinc-800">
          POS coming in the next sprint
        </h2>
        <p className="mt-2">
          The point-of-sale flow (category tiles → product → cart →
          checkout) ships next. For now this page just confirms your
          allowed channels are wired correctly.
        </p>

        <p className="mt-4 text-sm font-medium text-zinc-800">
          You can sell on:
        </p>
        {channels.length === 0 ? (
          <p className="mt-1 text-amber-700">
            ⚠ No channels assigned. Ask the owner to add you to at least
            one channel before sales begin.
          </p>
        ) : (
          <ul className="mt-1 list-disc pl-5">
            {channels.map((c) => (
              <li key={c.id}>
                {c.name}{" "}
                <span className="font-mono text-xs text-zinc-500">
                  ({c.slug})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
