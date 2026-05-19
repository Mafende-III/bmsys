import Link from "next/link";
import { signOut } from "@/lib/auth";
import { requireOwner } from "@/lib/auth-guards";

export default async function DashboardPage() {
  const session = await requireOwner();

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-600">
            Signed in as {session.name ?? session.phone}
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

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/products"
          className="block rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-sm"
        >
          <h2 className="text-lg font-medium">Products</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Catalog — SKUs, prices, stock at a glance.
          </p>
        </Link>
        <Link
          href="/channels"
          className="block rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-sm"
        >
          <h2 className="text-lg font-medium">Channels</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Sales channels — retail, wholesale, delivery, online.
          </p>
        </Link>
        <Link
          href="/users"
          className="block rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-sm"
        >
          <h2 className="text-lg font-medium">Users</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Owners + sellers, with per-channel permissions.
          </p>
        </Link>
        <Link
          href="/suppliers"
          className="block rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 hover:shadow-sm"
        >
          <h2 className="text-lg font-medium">Suppliers</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Vendors you buy stock from.
          </p>
        </Link>
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-5 text-zinc-500 sm:col-span-2">
          <h2 className="text-lg font-medium">Coming next</h2>
          <ul className="mt-1 list-disc pl-5 text-sm">
            <li>Suppliers</li>
            <li>Purchases (draft → receive)</li>
            <li>Carton open, sales</li>
            <li>Cash sessions, adjustments, expenses</li>
            <li>Daily summary report</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
