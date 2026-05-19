import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getUserWithChannels } from "@/lib/users/queries";
import { UserForm } from "../_components/UserForm";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const [user, channels] = await Promise.all([
    getUserWithChannels(id),
    prisma.channel.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  if (!user) notFound();

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4">
        <Link href="/users" className="text-sm text-zinc-600 hover:underline">
          ← Users
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{user.name}</h1>
        <p className="font-mono text-xs text-zinc-500">{user.phone}</p>
      </header>
      <UserForm
        mode={{
          kind: "edit",
          user: {
            id: user.id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            active: user.active,
            allowedChannelIds: user.channels.map((c) => c.channel.id),
          },
        }}
        channels={channels}
      />
    </main>
  );
}
