import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { ChannelForm } from "../_components/ChannelForm";

export default async function NewChannelPage() {
  await requireOwner();
  const t = await getTranslations("channels");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("newTitle")}</h1>
        <p className="text-[13px] text-ink-2">{t("newSubtitle")}</p>
      </header>
      <ChannelForm mode={{ kind: "create" }} />
    </main>
  );
}
