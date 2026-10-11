"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Supplier } from "@prisma/client";
import { CaptionLabel } from "@/components/ui";
import { createSupplier, updateSupplier } from "@/lib/suppliers/actions";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; id: string; supplier: Supplier };

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function SupplierForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const t = useTranslations("suppliers.form");
  const tc = useTranslations("common");

  const initial =
    mode.kind === "edit"
      ? {
          name: mode.supplier.name,
          phone: mode.supplier.phone ?? "",
          notes: mode.supplier.notes ?? "",
        }
      : { name: "", phone: "", notes: "" };

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function handleSubmit(formData: FormData) {
    setError(null);

    const data = {
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      notes: String(formData.get("notes") ?? ""),
    };

    startTransition(async () => {
      const result =
        mode.kind === "create"
          ? await createSupplier(idempotencyKey, data)
          : await updateSupplier(idempotencyKey, mode.id, data);

      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }

      if (mode.kind === "create") {
        router.push(`/suppliers/${result.data.id}`);
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
        <CaptionLabel>{t("name")}</CaptionLabel>
        <input
          type="text"
          name="name"
          required
          defaultValue={initial.name}
          placeholder={t("namePlaceholder")}
          className={FIELD}
        />
      </label>

      <label className="block">
        <CaptionLabel>{t("phoneOptional")}</CaptionLabel>
        <input
          type="tel"
          name="phone"
          defaultValue={initial.phone}
          placeholder={t("phonePlaceholder")}
          className={FIELD}
        />
      </label>

      <label className="block">
        <CaptionLabel>{t("notesOptional")}</CaptionLabel>
        <textarea
          name="notes"
          defaultValue={initial.notes}
          rows={4}
          placeholder={t("notesPlaceholder")}
          className="mt-1.5 block w-full rounded-panel border border-rule bg-surface px-3 py-2.5 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active"
        />
      </label>

      <div className="flex gap-2.5 pt-1">
        <Link
          href="/suppliers"
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
            ? t("saving")
            : mode.kind === "create"
              ? t("create")
              : tc("save")}
        </button>
      </div>
    </form>
  );
}
