import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireSeller } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import type { Locale } from "@/i18n/config";
import { isLocale } from "@/i18n/config";
import { ProfileForm } from "./_components/ProfileForm";

export default async function ProfilePage() {
  const session = await requireSeller();
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const locale = (await getLocale()) as Locale;

  const me = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { id: true, name: true, phone: true, role: true, language: true },
  });

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href={session.role === "OWNER" ? "/dashboard" : "/sell"}
          className="text-sm text-zinc-600 hover:underline"
        >
          ← {tc("dashboard")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-zinc-600">{t("subtitle")}</p>
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
