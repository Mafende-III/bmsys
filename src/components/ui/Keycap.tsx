import Link from "next/link";
import { cn } from "@/lib/cn";

type KeycapSize = "sm" | "md" | "lg";

const CAP_SIZES: Record<KeycapSize, string> = {
  sm: "h-10 w-11",
  md: "h-[42px] w-12",
  lg: "h-[46px] w-[52px]",
};

const POP_SIZES: Record<KeycapSize, string> = {
  sm: "h-7 w-9",
  md: "h-[30px] w-9",
  lg: "h-8 w-10",
};

type KeycapProps = {
  /** Selected state: the cap sinks into a well and the icon sits on a rounded "pop". */
  pressed?: boolean;
  size?: KeycapSize;
  /** Short word under the cap (tab bars, rails). */
  label?: string;
  /** Render as a link instead of a button. */
  href?: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/**
 * 3D pressable icon button. Raised: gradient face + solid bottom
 * edge. Held down (or `pressed`): inset well with a primary "pop"
 * tile carrying the icon. Touch target stays ≥44px with the label.
 */
export function Keycap({
  pressed = false,
  size = "md",
  label,
  href,
  className,
  children,
  ...rest
}: KeycapProps) {
  const cap = (
    <span
      className={cn(
        "flex items-center justify-center rounded-keycap transition-shadow",
        CAP_SIZES[size],
        pressed
          ? "bg-well shadow-well"
          : "bg-keycap shadow-keycap group-active:bg-none group-active:bg-well group-active:shadow-well",
      )}
    >
      {pressed ? (
        <span
          className={cn(
            "flex items-center justify-center rounded-[9px] bg-primary text-white shadow-pop",
            POP_SIZES[size],
          )}
        >
          {children}
        </span>
      ) : (
        children
      )}
    </span>
  );

  const outer = cn(
    "group inline-flex flex-col items-center gap-1",
    pressed ? "text-primary" : "text-ink-2",
    className,
  );

  const caption = label ? (
    <span
      className={cn("text-[11px]", pressed ? "font-bold" : "font-medium")}
    >
      {label}
    </span>
  ) : null;

  if (href) {
    return (
      <Link href={href} className={outer} aria-label={rest["aria-label"]}>
        {cap}
        {caption}
      </Link>
    );
  }
  return (
    <button type="button" className={outer} {...rest}>
      {cap}
      {caption}
    </button>
  );
}

type KeycapTileProps = {
  label: string;
  href?: string;
  className?: string;
  /** The icon, rendered in primary. */
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/**
 * Matrix tile: a bigger keycap with the label inside, for action
 * grids (Receive / Restock / Count / …). Whole tile is the target.
 */
export function KeycapTile({
  label,
  href,
  className,
  children,
  ...rest
}: KeycapTileProps) {
  const inner = (
    <>
      <span className="text-primary">{children}</span>
      <span className="text-center text-xs font-semibold leading-tight text-ink">
        {label}
      </span>
    </>
  );
  const classes = cn(
    "flex flex-col items-center justify-center gap-2 rounded-[14px] bg-keycap-tile px-2 py-4 shadow-keycap-lg transition-shadow active:translate-y-[2px] active:shadow-keycap",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {inner}
    </button>
  );
}
