import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { getSettings } from "@/lib/settings/queries";
import { SettingsForm } from "./_components/SettingsForm";

export default async function SettingsPage() {
  await requireOwner();
  const settings = await getSettings();

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">System config</h1>
        <p className="text-sm text-zinc-600">
          Branding and look. Changes apply to everyone using the shop.
        </p>
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
