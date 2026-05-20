import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Banknote,
  type LucideIcon,
  Package,
  ShoppingBag,
  Store,
  Tag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { signOut } from "@/lib/auth";
import { requireOwner } from "@/lib/auth-guards";
import { getOpenSession } from "@/lib/cash-sessions/queries";

export default async function DashboardPage() {
  const session = await requireOwner();
  const openTill = await getOpenSession();

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Hello, {session.name?.split(" ")[0] ?? "owner"}.
          </h1>
          <p className="text-sm text-zinc-600">
            {openTill ? (
              <>
                Till is open · {openTill.cashSalesCount}{" "}
                {openTill.cashSalesCount === 1 ? "sale" : "sales"} so far
              </>
            ) : (
              "Till is closed."
            )}
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

      {/* Primary: Sell */}
      <Link
        href="/sell"
        className="mt-6 block rounded-3xl border-2 border-zinc-900 bg-zinc-900 p-6 text-white shadow-lg transition hover:shadow-xl"
      >
        <div className="flex items-center gap-4">
          <Store className="h-12 w-12 shrink-0" strokeWidth={1.5} />
          <div className="flex-1">
            <h2 className="text-2xl font-semibold">Sell</h2>
            <p className="mt-1 text-sm text-zinc-300">
              Open the till and ring up sales
            </p>
          </div>
          <ArrowRight className="h-6 w-6 shrink-0" strokeWidth={2} />
        </div>
      </Link>

      {/* Run the shop */}
      <section className="mt-8">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Run the shop
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DashCard
            href="/cash-sessions"
            Icon={Banknote}
            title={openTill ? "Cash (till is open)" : "Cash (till is closed)"}
            subtitle={
              openTill
                ? "View today's sales · Close till"
                : "Open the till to start"
            }
            tone={openTill ? "active" : "neutral"}
          />
          <DashCard
            href="/purchases"
            Icon={Package}
            title="Receive stock"
            subtitle="Log a purchase from a supplier"
          />
          <DashCard
            href="/expenses"
            Icon={Wallet}
            title="Expenses"
            subtitle="Rent, salaries, transport, utilities"
          />
          <DashCard
            href="/adjustments"
            Icon={AlertTriangle}
            title="Losses"
            subtitle="Broken, expired, stolen, samples"
          />
        </div>
      </section>

      {/* Stock & catalog */}
      <section className="mt-8">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Stock & catalog
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DashCard
            href="/products"
            Icon={ShoppingBag}
            title="Products"
            subtitle="Drinks, snacks, prices"
          />
          <DashCard
            href="/categories"
            Icon={Tag}
            title="Categories"
            subtitle="Group products with an icon"
          />
          <DashCard
            href="/suppliers"
            Icon={Truck}
            title="Suppliers"
            subtitle="Who you buy from"
          />
        </div>
      </section>

      {/* Reports & people */}
      <section className="mt-8">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Reports & people
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DashCard
            href="/reports"
            Icon={BarChart3}
            title="Daily summary"
            subtitle="Sales, expenses, top sellers"
          />
          <DashCard
            href="/users"
            Icon={Users}
            title="People"
            subtitle="Owners and sellers"
          />
          <DashCard
            href="/channels"
            Icon={Tag}
            title="Channels"
            subtitle="Retail, wholesale, delivery…"
          />
        </div>
      </section>
    </main>
  );
}

function DashCard({
  href,
  Icon,
  title,
  subtitle,
  tone,
}: {
  href: string;
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  tone?: "neutral" | "active";
}) {
  const tint =
    tone === "active"
      ? "border-green-200 bg-green-50 hover:border-green-300"
      : "border-zinc-200 bg-white hover:border-zinc-300";
  const iconTint =
    tone === "active" ? "text-green-700" : "text-zinc-700";
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-2xl border p-4 transition hover:shadow-sm ${tint}`}
    >
      <Icon className={`h-7 w-7 shrink-0 ${iconTint}`} strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <h4 className="text-base font-medium">{title}</h4>
        <p className="mt-0.5 text-xs text-zinc-600">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={2} />
    </Link>
  );
}
