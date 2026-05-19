import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { listChannelsWithUsage } from "@/lib/channels/queries";

type SearchParams = {
  search?: string;
  active?: string;
};

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireOwner();

  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  const activeFilter: boolean | "all" =
    params.active === "all"
      ? "all"
      : params.active === "false"
        ? false
        : true;

  const channels = await listChannelsWithUsage({ search, active: activeFilter });

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 hover:underline"
          >
            ← Dashboard
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Channels</h1>
          <p className="text-sm text-zinc-600">
            {channels.length} {channels.length === 1 ? "channel" : "channels"}
          </p>
        </div>
        <Link
          href="/channels/new"
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:self-auto"
        >
          + New channel
        </Link>
      </header>

      <form
        method="get"
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="block flex-1">
          <span className="text-xs font-medium text-zinc-700">Search</span>
          <input
            type="search"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Name or slug"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block sm:w-32">
          <span className="text-xs font-medium text-zinc-700">Status</span>
          <select
            name="active"
            defaultValue={params.active ?? "true"}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
            <option value="all">All</option>
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Filter
        </button>
      </form>

      {/* Desktop table */}
      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2 text-right">Customers</th>
              <th className="px-3 py-2 text-right">Sales (30d)</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr
                key={c.id}
                className="border-t border-zinc-200 hover:bg-zinc-50"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/channels/${c.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                  {c.slug}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.customerCount}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {c.recentSales}
                </td>
                <td className="px-3 py-2 text-right">
                  {c.active ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                      Inactive
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {channels.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-zinc-500"
                >
                  No channels match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mt-4 space-y-2 sm:hidden">
        {channels.map((c) => (
          <Link
            key={c.id}
            href={`/channels/${c.id}`}
            className="block rounded-2xl border border-zinc-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="font-mono text-xs text-zinc-500">{c.slug}</p>
              </div>
              {c.active ? (
                <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                  Active
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                  Inactive
                </span>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-zinc-700">
              <dt>Customers</dt>
              <dd className="text-right tabular-nums">{c.customerCount}</dd>
              <dt>Sales (30d)</dt>
              <dd className="text-right tabular-nums">{c.recentSales}</dd>
            </dl>
          </Link>
        ))}
        {channels.length === 0 && (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            No channels match these filters.
          </p>
        )}
      </div>
    </main>
  );
}
