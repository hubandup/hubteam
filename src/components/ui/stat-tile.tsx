import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StatTile — dashboard KPI tile.
 * Variant "navy" = dark card with lime figure · "light" = white card.
 *
 * @example
 * <StatTile label="Chiffre d'affaires" value="128 400 €" delta="+12%" variant="navy" />
 */
export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "navy" | "light";
}

export const StatTile = React.forwardRef<HTMLDivElement, StatTileProps>(
  ({ className, label, value, delta, icon, variant = "light", ...props }, ref) => {
    const isNavy = variant === "navy";
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-2 p-5 border transition-colors",
          isNavy ? "bg-navy border-navy text-navy-foreground" : "bg-card border-border text-foreground",
          className,
        )}
        style={{ borderRadius: 18 }}
        {...props}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-[12px] font-medium uppercase tracking-wider",
              isNavy ? "text-navy-foreground/70" : "text-label",
            )}
          >
            {label}
          </span>
          {icon && (
            <span className={cn("shrink-0", isNavy ? "text-lime" : "text-muted-foreground")}>
              {icon}
            </span>
          )}
        </div>
        <div
          className={cn(
            "display font-bold leading-none",
            isNavy ? "text-lime" : "text-ink",
          )}
          style={{ fontSize: 28, letterSpacing: "-0.02em" }}
        >
          {value}
        </div>
        {delta && (
          <div
            className={cn(
              "text-[12px] font-semibold",
              isNavy ? "text-navy-foreground/80" : "text-muted-foreground",
            )}
          >
            {delta}
          </div>
        )}
      </div>
    );
  },
);
StatTile.displayName = "StatTile";
