"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  BarChart3,
  MoreHorizontal,
  Package,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

// String-keyed icon registry — keeps the server/client boundary clean
// (we can pass strings across it; we can't pass component refs).
const ICONS: Record<string, LucideIcon> = {
  banknote: Banknote,
  wallet: Wallet,
  package: Package,
  warning: AlertTriangle,
  chart: BarChart3,
  back: ArrowLeft,
};

export type QuickActionIconKey = keyof typeof ICONS;

export type QuickAction = {
  href: string;
  label: string;
  icon: QuickActionIconKey;
  hint?: string;
};

function ActionIcon({
  name,
  className,
}: {
  name: QuickActionIconKey;
  className: string;
}) {
  const Icon = ICONS[name] ?? Package;
  return <Icon className={className} strokeWidth={1.5} />;
}

export function QuickActionsMenu({
  ownerActions,
}: {
  ownerActions: QuickAction[];
}) {
  const [open, setOpen] = useState(false);

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
        className="rounded-lg border border-zinc-300 bg-white p-2 hover:bg-zinc-50"
      >
        <MoreHorizontal className="h-5 w-5 text-zinc-700" strokeWidth={2} />
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
                <X className="h-5 w-5" strokeWidth={2} />
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
                    <ActionIcon
                      name={a.icon}
                      className="h-6 w-6 shrink-0 text-zinc-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium">{a.label}</p>
                      {a.hint && (
                        <p className="mt-0.5 text-xs text-zinc-500">{a.hint}</p>
                      )}
                    </div>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-zinc-400"
                      strokeWidth={2}
                    />
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
