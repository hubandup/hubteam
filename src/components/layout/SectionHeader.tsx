import * as React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: React.ReactNode;
  count?: number;
  /** Accent bar color — hex or hsl(var(...)) */
  color?: string;
  className?: string;
  trailing?: React.ReactNode;
}

/**
 * Standard section header: colored vertical bar + uppercase title + pill counter.
 * Used to group lists (e.g. "EN RETARD", "Cette semaine"…).
 */
export function SectionHeader({
  title,
  count,
  color = "hsl(var(--muted-foreground))",
  className,
  trailing,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className="block w-1 h-5 rounded-full"
        style={{ background: color }}
        aria-hidden
      />
      <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-foreground font-display">
        {title}
      </h2>
      {typeof count === "number" ? (
        <span className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-badge bg-foreground text-background text-[11px] font-semibold leading-none">
          {count}
        </span>
      ) : null}
      {trailing ? <div className="ml-auto">{trailing}</div> : null}
    </div>
  );
}
