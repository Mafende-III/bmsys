"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Mobile-first modal: slides up as a rounded sheet on phones,
 * centers as a card on sm+. Scrim click and Escape close it.
 * Used by the stepped quick-create flows (e.g. new product while
 * receiving stock).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  headerExtra,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Right-aligned header slot (step dots, etc.) next to the close button. */
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(13,27,42,0.45)] sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "w-full max-w-md rounded-t-card bg-surface p-4 pb-6 sm:rounded-card",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <div className="flex items-center gap-3">
            {headerExtra}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-sheet bg-ground text-ink-2"
            >
              <X className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
