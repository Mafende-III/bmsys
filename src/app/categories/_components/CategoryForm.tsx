"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Category } from "@prisma/client";
import { CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  createCategory,
  removeCategoryIcon,
  updateCategory,
  uploadCategoryIcon,
} from "@/lib/categories/actions";
import { IconPicker } from "@/app/_components/IconPicker";
import { IconImageUpload } from "@/app/_components/IconImageUpload";

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

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function CategoryForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const tForm = useTranslations("categories.form");
  const tc = useTranslations("common");

  const editingId = mode.kind === "edit" ? mode.id : null;
  const initialImageUrl =
    mode.kind === "edit" && mode.category.iconImagePath
      ? `/uploads/${mode.category.iconImagePath}?v=${Date.now()}`
      : null;

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
    <form action={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </div>
      )}

      <label className="block">
        <CaptionLabel>{tForm("name")}</CaptionLabel>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tForm("namePlaceholder")}
          className={FIELD}
        />
      </label>

      <label className="block">
        <CaptionLabel>{tForm("slug")}</CaptionLabel>
        {mode.kind === "edit" ? (
          <input
            value={initial.slug}
            disabled
            className={cn(FIELD, "num bg-ground text-ink-2")}
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
            placeholder={tForm("slugPlaceholder")}
            className={cn(FIELD, "num")}
          />
        )}
        <span className="mt-1 block text-xs text-ink-2">
          {tForm("slugHint")}
        </span>
      </label>

      {editingId && (
        <IconImageUpload
          initialUrl={initialImageUrl}
          upload={(formData) => uploadCategoryIcon(editingId, formData)}
          remove={() => removeCategoryIcon(editingId)}
          label={tForm("imageLabel")}
          hint={tForm("imageHint")}
          uploadCta={tForm("imageUpload")}
          replaceCta={tForm("imageReplace")}
          removeCta={tForm("imageRemove")}
        />
      )}

      <div data-tour="category-icon">
        <CaptionLabel>{tForm("icon")}</CaptionLabel>
        <div className="mt-1.5">
          <IconPicker value={iconKey} onChange={setIconKey} />
        </div>
        <details className="mt-2 text-xs text-ink-2">
          <summary className="cursor-pointer font-semibold">
            {tForm("emojiFallback")}
          </summary>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={iconEmoji}
              onChange={(e) => setIconEmoji(e.target.value)}
              maxLength={10}
              className="block h-11 w-20 rounded-panel border border-rule bg-surface px-2 text-center text-xl focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active"
              aria-label={tForm("emojiFallback")}
            />
            <span className="text-ink-2">{tForm("emojiFallbackHint")}</span>
          </div>
        </details>
      </div>

      <label className="block">
        <CaptionLabel>{tForm("sortOrder")}</CaptionLabel>
        <input
          type="number"
          step={1}
          inputMode="numeric"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className={cn(FIELD, "num w-32 text-right font-semibold")}
        />
        <span className="mt-1 block text-xs text-ink-2">
          {tForm("sortHint")}
        </span>
      </label>

      {mode.kind === "edit" && (
        <label className="flex items-center gap-2.5 rounded-panel bg-ground px-3.5 py-3 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-rule"
          />
          {tForm("activeLabel")}
        </label>
      )}

      <div className="flex gap-2.5 pt-1">
        <Link
          href="/categories"
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-surface px-5 text-sm font-semibold text-ink-2 ring-1 ring-inset ring-rule"
        >
          {tc("cancel")}
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="h-12 flex-1 rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
        >
          {isPending
            ? tForm("saving")
            : mode.kind === "create"
              ? tForm("create")
              : tc("save")}
        </button>
      </div>
    </form>
  );
}
