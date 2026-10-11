import { getTranslations } from "next-intl/server";
import { requireOwner } from "@/lib/auth-guards";
import { CategoryForm } from "../_components/CategoryForm";

export default async function NewCategoryPage() {
  await requireOwner();
  const t = await getTranslations("categories");

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="text-xl font-bold text-ink">{t("newTitle")}</h1>
        <p className="text-[13px] text-ink-2">{t("newSubtitle")}</p>
      </header>
      <CategoryForm mode={{ kind: "create" }} />
    </main>
  );
}
