import { cn } from "@/lib/cn";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

const TONES: Record<StatusTone, string> = {
  success: "bg-success-wash text-success",
  warning: "bg-warning-wash text-warning",
  error: "bg-error-wash text-error",
  info: "bg-surface-sunk text-primary",
  neutral: "bg-ground text-ink-2",
};

/**
 * Status is never color alone: pill = wash + icon + short word.
 * Pass a lucide icon (or any small SVG) as `icon`.
 */
export function StatusPill({
  tone,
  icon,
  className,
  children,
}: {
  tone: StatusTone;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
