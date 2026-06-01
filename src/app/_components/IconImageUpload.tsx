"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2 } from "lucide-react";

type ActionResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

/**
 * Reusable image-upload control for category and product icons.
 *
 * Parents pass the current `initialUrl` (rendered as `/uploads/...`
 * cache-busted by updatedAt) plus two server actions: `upload(formData)`
 * and `remove()`. The component handles file-pick, optimistic preview,
 * pending state, and router refresh.
 *
 * Only renders in "edit" mode — image upload needs a saved record id
 * to file the upload against. The parent should hide it during create.
 */
export function IconImageUpload({
  initialUrl,
  upload,
  remove,
  label,
  hint,
  uploadCta,
  replaceCta,
  removeCta,
}: {
  initialUrl: string | null;
  upload: (formData: FormData) => Promise<ActionResult>;
  remove: () => Promise<ActionResult>;
  label: string;
  hint: string;
  uploadCta: string;
  replaceCta: string;
  removeCta: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onPick(file: File) {
    setError(null);
    const formData = new FormData();
    formData.append("image", file);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    startTransition(async () => {
      const result = await upload(formData);
      if (!result.ok) {
        setError(result.error);
        setPreviewUrl(initialUrl);
        return;
      }
      router.refresh();
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await remove();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4">
      <h2 className="text-base font-medium">{label}</h2>
      <p className="mt-0.5 text-xs text-zinc-600">{hint}</p>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className="max-h-16 max-w-16 object-contain"
            />
          ) : (
            <ImagePlus className="h-7 w-7 text-zinc-400" strokeWidth={1.5} />
          )}
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50">
            <ImagePlus className="h-4 w-4" strokeWidth={1.5} />
            <span>{previewUrl ? replaceCta : uploadCta}</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              disabled={isPending}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPick(f);
              }}
            />
          </label>
          {previewUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              {removeCta}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
