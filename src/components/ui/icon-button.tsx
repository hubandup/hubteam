import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * IconButton — square 38px button for topbar/toolbar actions.
 * Always requires `aria-label` for accessibility.
 *
 * @example
 * <IconButton aria-label="Notifications"><Bell size={16} /></IconButton>
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "ghost" | "outline" | "solid";
  size?: "sm" | "md";
  "aria-label": string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = "ghost", size = "md", children, ...props }, ref) => {
    const dim = size === "sm" ? 32 : 38;
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none",
          variant === "ghost" && "text-foreground hover:bg-muted",
          variant === "outline" && "text-foreground border border-border hover:bg-muted",
          variant === "solid" && "bg-navy text-navy-foreground hover:bg-navy-hover",
          className,
        )}
        style={{ width: dim, height: dim, borderRadius: 10 }}
        {...props}
      >
        {children}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
