"use client";

import { useState } from "react";
import { Check, Package } from "lucide-react";
import { ICON_KEYS, PRODUCT_ICONS, type ProductIconKey } from "@/lib/icons";

/**
 * Inline icon picker. Shows the current selection as a single tile.
 * Tap → opens a grid of all available icons. Tap an icon → sets and
 * collapses. "Use category default" option clears the value.
 */
export function IconPicker({
  value,
  onChange,
  allowClear = false,
  clearLabel = "Use default",
}: {
  value: string | null;
  onChange: (key: string | null) => void;
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const SelectedIcon =
    value && value in PRODUCT_ICONS ? PRODUCT_ICONS[value]!.Icon : Package;
  const selectedLabel =
    value && value in PRODUCT_ICONS ? PRODUCT_ICONS[value]!.label : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center gap-3 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50"
      >
        <SelectedIcon
          className="h-6 w-6 shrink-0 text-zinc-700"
          strokeWidth={1.5}
        />
        <span className="flex-1 text-zinc-700">
          {selectedLabel ?? <em className="text-zinc-500">No icon picked</em>}
        </span>
        <span className="text-xs text-zinc-500">
          {open ? "Done" : "Change"}
        </span>
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-2">
          <div className="grid grid-cols-6 gap-1 sm:grid-cols-8">
            {allowClear && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                title={clearLabel}
                aria-label={clearLabel}
                className={`flex h-12 flex-col items-center justify-center rounded-lg border text-xs transition ${
                  value === null
                    ? "border-zinc-900 bg-zinc-100 text-zinc-900"
                    : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                <span className="text-base leading-none">−</span>
              </button>
            )}
            {ICON_KEYS.map((key) => {
              const { Icon, label } = PRODUCT_ICONS[key]!;
              const selected = value === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  title={label}
                  aria-label={label}
                  className={`flex h-12 items-center justify-center rounded-lg border transition ${
                    selected
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                  {selected && (
                    <Check
                      className="absolute h-3 w-3 translate-x-3 -translate-y-3 text-white"
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
