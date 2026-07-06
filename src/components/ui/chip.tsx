import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Chip — selectable pill for single/multi selection.
 * Active = navy fill / white text · Inactive = outline.
 *
 * @example
 * <Chip active={zone === 'FR'} onClick={() => setZone('FR')}>France</Chip>
 */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: "sm" | "md";
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active, size = "md", children, ...props }, ref) => {
    const py = size === "sm" ? 4 : 6;
    const px = size === "sm" ? 10 : 14;
    const fz = size === "sm" ? 11 : 12.5;
    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={active}
        className={cn(
          "inline-flex items-center gap-1.5 font-medium transition-colors whitespace-nowrap",
          active
            ? "bg-navy text-navy-foreground border-navy"
            : "bg-card text-foreground border-border hover:bg-muted",
          className,
        )}
        style={{
          border: "1px solid",
          padding: `${py}px ${px}px`,
          fontSize: fz,
          borderRadius: 9999,
        }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Chip.displayName = "Chip";
