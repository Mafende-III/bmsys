import { cn } from "@/lib/cn";

/**
 * Surface card: white, hairline inset ring, generous radius.
 * No drop shadows — depth is reserved for pressable things.
 */
export function Card({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card bg-surface ring-1 ring-inset ring-rule-hair",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
