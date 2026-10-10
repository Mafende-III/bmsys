import { useId } from "react";
import { cn } from "@/lib/cn";
import { CaptionLabel } from "./CaptionLabel";

type MoneyFieldProps = {
  label?: string;
  /** Unit shown inside the field's right edge. */
  suffix?: string;
  className?: string;
  inputClassName?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">;

/**
 * Money input: right-aligned, mono, tabular-nums, RWF suffix inside
 * the field. Integer RWF only — pair with inputMode="numeric".
 */
export function MoneyField({
  label,
  suffix = "RWF",
  className,
  inputClassName,
  id,
  ...rest
}: MoneyFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={className}>
      {label ? (
        <CaptionLabel className="mb-1.5">
          <label htmlFor={inputId}>{label}</label>
        </CaptionLabel>
      ) : null}
      <div className="relative">
        <input
          id={inputId}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          className={cn(
            "num block h-11 w-full rounded-panel border border-rule bg-surface pl-3 pr-12 text-right text-base font-semibold text-ink",
            "focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active",
            inputClassName,
          )}
          {...rest}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-bold text-ink-2">
          {suffix}
        </span>
      </div>
    </div>
  );
}
