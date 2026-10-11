import { getLocale, getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n/config";
import { isLocale } from "@/i18n/config";
import { ProfileForm } from "./_components/ProfileForm";

export default async function ProfilePage() {
  const session = await requireSeller();
  const t = await getTranslations("profile");
  const locale = (await getLocale()) as Locale;

  const me = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { id: true, name: true, phone: true, role: true, language: true },
  });

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
      </header>

      <ProfileForm
        initial={{
          name: me.name,
          phone: me.phone,
          role: me.role,
          language: (isLocale(me.language) ? me.language : locale) as Locale,
        }}
      />
    </main>
  );
}
