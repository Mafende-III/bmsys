import { cn } from "@/lib/cn";

/**
 * The register's signature label: 11px, uppercase, tracked wide.
 * Use it above values, on card headers, and as field labels.
 */
export function CaptionLabel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "block text-[11px] font-semibold uppercase tracking-wide text-ink-2",
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
