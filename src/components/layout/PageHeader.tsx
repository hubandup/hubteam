import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header — title (display, bold, 30px), optional subtitle (muted),
 * actions slot on the right. Use on every page for visual consistency.
 *
 * Reference: CRM page.
 */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 mb-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display font-bold leading-tight text-foreground text-[26px] sm:text-[30px] tracking-tight">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm text-muted-foreground font-display mt-1">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>
      ) : null}
    </header>
  );
}
