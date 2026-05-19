import Link from "next/link";
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
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/categories"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Categories
        </Link>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold">
          <span>{category.iconEmoji}</span>
          <span>{category.name}</span>
        </h1>
        <p className="font-mono text-xs text-zinc-500">{category.slug}</p>
      </header>
      <CategoryForm mode={{ kind: "edit", id, category }} />
    </main>
  );
}
