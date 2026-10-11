"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Channel } from "@prisma/client";
import { CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createChannel, updateChannel } from "@/lib/channels/actions";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; id: string; channel: Channel };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function ChannelForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const tf = useTranslations("channels.form");
  const tc = useTranslations("common");

  const initial =
    mode.kind === "edit"
      ? { name: mode.channel.name, slug: mode.channel.slug }
      : { name: "", slug: "" };

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  // Auto-fill slug from name when creating, but only if user hasn't
  // manually edited the slug field.
  const slugTouched = useRef(mode.kind === "edit");
  useEffect(() => {
    if (mode.kind === "create" && !slugTouched.current) {
      setSlug(slugify(name));
    }
  }, [name, mode.kind]);

  function handleSubmit(formData: FormData) {
    setError(null);

    const data: Record<string, unknown> = {
      name: String(formData.get("name") ?? ""),
    };
    if (mode.kind === "create") {
      data.slug = String(formData.get("slug") ?? "");
    }

    startTransition(async () => {
      const result =
        mode.kind === "create"
          ? await createChannel(idempotencyKey, data)
          : await updateChannel(idempotencyKey, mode.id, data);

      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }

      if (mode.kind === "create") {
        router.push(`/channels/${result.data.id}`);
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
        <CaptionLabel>{tf("name")}</CaptionLabel>
        <input
          type="text"
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={tf("namePlaceholder")}
          className={FIELD}
        />
      </label>

      <label className="block">
        <CaptionLabel>{tf("slug")}</CaptionLabel>
        {mode.kind === "edit" ? (
          <input
            value={initial.slug}
            disabled
            className={cn(FIELD, "num bg-ground text-ink-2")}
          />
        ) : (
          <input
            type="text"
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              slugTouched.current = true;
              setSlug(e.target.value);
            }}
            placeholder={tf("slugPlaceholder")}
            className={cn(FIELD, "num")}
          />
        )}
        <span className="mt-1 block text-xs text-ink-2">
          {mode.kind === "edit" ? tf("slugHintEdit") : tf("slugHintCreate")}
        </span>
      </label>

      <div className="flex gap-2.5 pt-1">
        <Link
          href="/channels"
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
            ? tf("saving")
            : mode.kind === "create"
              ? tf("create")
              : tc("save")}
        </button>
      </div>
    </form>
  );
}
