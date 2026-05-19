"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Channel } from "@prisma/client";
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

export function ChannelForm({ mode }: { mode: Mode }) {
  const router = useRouter();

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
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Wholesale Premium"
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
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
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              slugTouched.current = true;
              setSlug(e.target.value);
            }}
            placeholder="auto-derived from name"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        )}
        <span className="mt-1 block text-xs text-zinc-500">
          {mode.kind === "edit"
            ? "Cannot be changed — referenced in URLs and reports."
            : "Lowercase letters, digits, and dashes only. Cannot be changed after creation."}
        </span>
      </label>

      <div className="flex gap-2 pt-2">
        <Link
          href="/channels"
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
              ? "Create channel"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
