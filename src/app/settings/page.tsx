import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { getSettings } from "@/lib/settings/queries";
import { SettingsForm } from "./_components/SettingsForm";

export default async function SettingsPage() {
  await requireOwner();
  const settings = await getSettings();
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← {tc("dashboard")}
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-zinc-600">{t("subtitle")}</p>
      </header>

      <SettingsForm
        initial={{
          companyName: settings.companyName,
          theme: settings.theme,
          logoUrl: settings.logoUrl,
        }}
      />
    </main>
  );
}
