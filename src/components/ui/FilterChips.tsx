"use client";

import { cn } from "@/lib/cn";
import type { StatusTone } from "./StatusPill";

const CHIP_TONES: Partial<Record<StatusTone, string>> = {
  warning: "text-warning",
  error: "text-error",
  success: "text-success",
};

export type FilterChipOption<T extends string> = {
  value: T;
  label: string;
  /** Small count shown after the label, e.g. "Low · 1". */
  count?: number;
  /** Tints the inactive chip's text (warning for Low, error for Out). */
  tone?: StatusTone;
};

/** Pill filter row: active chip is solid ink, the rest are ringed. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: FilterChipOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full px-4 py-2 text-[13px]",
              active
                ? "bg-ink font-bold text-white"
                : cn(
                    "bg-surface font-semibold text-ink-2 ring-1 ring-inset ring-rule",
                    opt.tone ? CHIP_TONES[opt.tone] : null,
                  ),
            )}
          >
            {opt.label}
            {opt.count != null ? (
              <span className="num"> · {opt.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
