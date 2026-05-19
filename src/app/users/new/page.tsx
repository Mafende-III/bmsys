import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { UserForm } from "../_components/UserForm";

export default async function NewUserPage() {
  await requireOwner();

  const channels = await prisma.channel.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4">
        <Link href="/users" className="text-sm text-zinc-600 hover:underline">
          ← Users
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New user</h1>
        <p className="text-sm text-zinc-600">
          Add a seller (limited to picked channels) or another owner.
        </p>
      </header>
      <UserForm mode={{ kind: "create" }} channels={channels} />
    </main>
  );
}
