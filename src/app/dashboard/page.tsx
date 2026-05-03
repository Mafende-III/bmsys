import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-zinc-600">
            Signed in as {session.user?.name ?? session.user?.email}
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

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="text-lg font-medium">Phase 1 (coming next)</h2>
        <ul className="mt-3 list-disc pl-5 text-sm text-zinc-700 space-y-1">
          <li>Products, channels, suppliers</li>
          <li>Purchases (draft → receive)</li>
          <li>Carton open with tag</li>
          <li>Sales (retail units, wholesale cartons)</li>
          <li>Cash sessions</li>
          <li>Adjustments</li>
          <li>Expenses</li>
          <li>Daily summary report</li>
        </ul>
      </section>

      <p className="mt-6 text-xs text-zinc-500">
        BMS skeleton ready. Phase 1 features build on top of this.
      </p>
    </main>
  );
}
