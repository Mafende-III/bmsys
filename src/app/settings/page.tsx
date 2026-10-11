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

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("title")}</h1>
        <p className="text-[13px] text-ink-2">{t("subtitle")}</p>
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
