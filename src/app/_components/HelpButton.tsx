"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X } from "lucide-react";
import { findHelpEntry } from "@/lib/help/content";

/**
 * Floating "?" button that opens a contextual help panel for the
 * current route. Hidden on /login and other unauthenticated chrome.
 * Visibility on each route is controlled by the help registry — if
 * there is no entry for the path, the button stays hidden.
 */
export function HelpButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const entry = pathname ? findHelpEntry(pathname) : null;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (!entry) return null;
  if (pathname === "/login") return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="What does this screen do?"
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-800 shadow-lg hover:bg-zinc-50 sm:bottom-6 sm:right-6"
      >
        <HelpCircle className="h-6 w-6" strokeWidth={1.5} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/30 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  About this screen
                </p>
                <h2 id="help-title" className="mt-0.5 text-lg font-semibold">
                  {entry.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 rounded-lg p-1 text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm">
              <p className="text-zinc-700">{entry.what}</p>

              {entry.actions && entry.actions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    What you can do
                  </p>
                  <ul className="mt-2 space-y-2">
                    {entry.actions.map((a) => (
                      <li key={a.label} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                        <span>
                          <span className="font-medium text-zinc-800">
                            {a.label}
                          </span>{" "}
                          <span className="text-zinc-600">— {a.what}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {entry.tips && entry.tips.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Good to know
                  </p>
                  <ul className="mt-1 space-y-1 text-amber-900">
                    {entry.tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
