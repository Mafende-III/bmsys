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
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{user.name}</h1>
        <p className="num text-[13px] text-ink-2">{user.phone}</p>
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
