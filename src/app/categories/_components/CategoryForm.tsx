"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Category } from "@prisma/client";
import { createCategory, updateCategory } from "@/lib/categories/actions";
import { IconPicker } from "@/app/_components/IconPicker";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; id: string; category: Category };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function CategoryForm({ mode }: { mode: Mode }) {
  const router = useRouter();

  const initial =
    mode.kind === "edit"
      ? {
          name: mode.category.name,
          slug: mode.category.slug,
          iconKey: mode.category.iconKey,
          iconEmoji: mode.category.iconEmoji,
          sortOrder: mode.category.sortOrder,
          active: mode.category.active,
        }
      : {
          name: "",
          slug: "",
          iconKey: "package" as string | null,
          iconEmoji: "📦",
          sortOrder: 0,
          active: true,
        };

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [iconKey, setIconKey] = useState<string | null>(initial.iconKey);
  const [iconEmoji, setIconEmoji] = useState(initial.iconEmoji);
  const [sortOrder, setSortOrder] = useState(String(initial.sortOrder));
  const [active, setActive] = useState(initial.active);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  const slugTouched = useRef(mode.kind === "edit");
  useEffect(() => {
    if (mode.kind === "create" && !slugTouched.current) {
      setSlug(slugify(name));
    }
  }, [name, mode.kind]);

  function handleSubmit() {
    setError(null);

    const data: Record<string, unknown> = {
      name,
      iconKey,
      iconEmoji,
      sortOrder,
    };
    if (mode.kind === "create") {
      data.slug = slug;
    } else {
      data.active = active;
    }

    startTransition(async () => {
      const result =
        mode.kind === "create"
          ? await createCategory(idempotencyKey, data)
          : await updateCategory(idempotencyKey, mode.id, data);

      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }

      if (mode.kind === "create") {
        router.push(`/categories/${result.data.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Soft drinks"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Slug</span>
        {mode.kind === "edit" ? (
          <input
            value={initial.slug}
            disabled
            className="mt-1 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-500"
          />
        ) : (
          <input
            type="text"
            required
            value={slug}
            onChange={(e) => {
              slugTouched.current = true;
              setSlug(e.target.value);
            }}
            placeholder="auto-derived"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
          />
        )}
        <span className="mt-1 block text-xs text-zinc-500">
          Used in /sell URLs. Cannot be changed after creation.
        </span>
      </label>

      <div data-tour="category-icon">
        <span className="text-sm font-medium">Icon</span>
        <div className="mt-1">
          <IconPicker value={iconKey} onChange={setIconKey} />
        </div>
        <details className="mt-2 text-xs text-zinc-600">
          <summary className="cursor-pointer">Emoji fallback (optional)</summary>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={iconEmoji}
              onChange={(e) => setIconEmoji(e.target.value)}
              maxLength={10}
              className="block w-20 rounded-lg border border-zinc-300 px-2 py-1 text-center text-xl"
              aria-label="Emoji fallback"
            />
            <span className="text-zinc-500">
              Shown if a device can&apos;t render the icon above.
            </span>
          </div>
        </details>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Sort order</span>
        <input
          type="number"
          step={1}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="mt-1 block w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-zinc-500">
          Lower numbers appear first in the /sell grid. Same numbers sort by name.
        </span>
      </label>

      {mode.kind === "edit" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Active (visible in /sell)
        </label>
      )}

      <div className="flex gap-2 pt-2">
        <Link
          href="/categories"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending
            ? "Saving..."
            : mode.kind === "create"
              ? "Create category"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
