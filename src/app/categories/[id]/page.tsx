import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth-guards";
import { getCategory } from "@/lib/categories/queries";
import { CategoryForm } from "../_components/CategoryForm";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireOwner();

  const { id } = await params;
  const category = await getCategory(id);
  if (!category) notFound();

  return (
    <main className="mx-auto max-w-2xl space-y-3 p-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
          <span>{category.iconEmoji}</span>
          <span>{category.name}</span>
        </h1>
        <p className="num text-[13px] text-ink-2">{category.slug}</p>
      </header>
      <CategoryForm mode={{ kind: "edit", id, category }} />
    </main>
  );
}
