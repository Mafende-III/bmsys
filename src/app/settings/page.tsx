import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { getSettings } from "@/lib/settings/queries";
import { getWorkingCapital } from "@/lib/treasury/queries";
import { SettingsForm } from "./_components/SettingsForm";
import { TreasuryCheckpointForm } from "./_components/TreasuryCheckpointForm";

export default async function SettingsPage() {
  await requireOwner();
  const [settings, capital] = await Promise.all([
    getSettings(),
    getWorkingCapital(),
  ]);
  const t = await getTranslations("settings");
  const tc = await getTranslations("common");

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 sm:p-6">
      <header>
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
          defaultMinMarginBps: settings.defaultMinMarginBps,
        }}
      />

      <TreasuryCheckpointForm
        momo={{
          balance: capital.momo.balance,
          initialised: capital.momo.initialised,
          checkpointAt: capital.momo.checkpointAt?.toISOString() ?? null,
        }}
        bank={{
          balance: capital.bank.balance,
          initialised: capital.bank.initialised,
          checkpointAt: capital.bank.checkpointAt?.toISOString() ?? null,
        }}
      />
    </main>
  );
}
