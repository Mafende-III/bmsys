import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { listUsersWithChannels } from "@/lib/users/queries";

export default async function UsersPage() {
  await requireOwner();

  const users = await listUsersWithChannels();

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
          <h1 className="mt-1 text-2xl font-semibold">Users</h1>
          <p className="text-sm text-zinc-600">
            {users.length} {users.length === 1 ? "user" : "users"}
          </p>
        </div>
        <Link
          href="/users/new"
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 sm:self-auto"
        >
          + New user
        </Link>
      </header>

      <div className="mt-4 hidden overflow-hidden rounded-2xl border border-zinc-200 bg-white sm:block">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs font-medium uppercase text-zinc-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Channels</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-t border-zinc-200 hover:bg-zinc-50"
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/users/${u.id}`}
                    className="font-medium text-zinc-900 hover:underline"
                  >
                    {u.name}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-600">
                  {u.phone}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs uppercase text-zinc-700">
                    {u.role}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">
                  {u.role === "OWNER"
                    ? "All channels"
                    : u.channels.length === 0
                      ? "—"
                      : u.channels.map((c) => c.channel.name).join(", ")}
                </td>
                <td className="px-3 py-2 text-right">
                  {u.active ? (
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
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-zinc-500">
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2 sm:hidden">
        {users.map((u) => (
          <Link
            key={u.id}
            href={`/users/${u.id}`}
            className="block rounded-2xl border border-zinc-200 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.name}</p>
                <p className="font-mono text-xs text-zinc-500">{u.phone}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase text-zinc-700">
                  {u.role}
                </span>
                {u.active ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-800">
                    Active
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700">
                    Inactive
                  </span>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              {u.role === "OWNER"
                ? "All channels"
                : u.channels.length === 0
                  ? "No channels assigned"
                  : u.channels.map((c) => c.channel.name).join(", ")}
            </p>
          </Link>
        ))}
        {users.length === 0 && (
          <p className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
            No users yet.
          </p>
        )}
      </div>
    </main>
  );
}
