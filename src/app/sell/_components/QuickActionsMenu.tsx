"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Action = { href: string; label: string; icon: string; hint?: string };

export function QuickActionsMenu({
  ownerActions,
}: {
  ownerActions: Action[];
}) {
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base hover:bg-zinc-50"
      >
        ⋯
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-4 shadow-xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">More actions</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
              >
                ✕
              </button>
            </div>

            <ul className="space-y-2">
              {ownerActions.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:bg-zinc-50"
                  >
                    <span className="text-2xl" aria-hidden>
                      {a.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium">{a.label}</p>
                      {a.hint && (
                        <p className="mt-0.5 text-xs text-zinc-500">{a.hint}</p>
                      )}
                    </div>
                    <span className="text-zinc-400" aria-hidden>→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
