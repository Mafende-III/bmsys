"use client";

import { cn } from "@/lib/cn";

type StepperSize = "md" | "lg";

const BUTTON: Record<StepperSize, string> = {
  md: "h-11 w-11 rounded-panel text-xl",
  lg: "h-14 w-14 rounded-sheet text-3xl",
};

const VALUE: Record<StepperSize, string> = {
  md: "h-11 min-w-[3rem] rounded-panel text-lg",
  lg: "h-14 min-w-[4rem] flex-1 rounded-sheet text-3xl",
};

/**
 * − / + quantity stepper with keycap buttons and a mono value.
 * `lg` is the POS size (full-width value, thumb-sized buttons).
 */
export function Stepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  size = "md",
  decrementLabel = "Fewer",
  incrementLabel = "More",
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: StepperSize;
  decrementLabel?: string;
  incrementLabel?: string;
  className?: string;
}) {
  const clamp = (n: number) => {
    const low = Math.max(min, n);
    return max == null ? low : Math.min(max, low);
  };

  const keycap =
    "shrink-0 bg-keycap font-bold text-ink shadow-keycap active:bg-none active:bg-well active:shadow-well disabled:opacity-40";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        aria-label={decrementLabel}
        disabled={value <= min}
        onClick={() => onChange(clamp(value - step))}
        className={cn(keycap, BUTTON[size])}
      >
        −
      </button>
      <span
        className={cn(
          "num inline-flex items-center justify-center border border-rule bg-surface px-3 font-semibold text-ink",
          VALUE[size],
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={incrementLabel}
        disabled={max != null && value >= max}
        onClick={() => onChange(clamp(value + step))}
        className={cn(keycap, BUTTON[size])}
      >
        +
      </button>
    </div>
  );
}
