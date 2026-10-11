import { getTranslations } from "next-intl/server";
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
  const t = await getTranslations("users");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("newTitle")}</h1>
        <p className="text-[13px] text-ink-2">{t("newSubtitle")}</p>
      </header>
      <UserForm mode={{ kind: "create" }} channels={channels} />
    </main>
  );
}
