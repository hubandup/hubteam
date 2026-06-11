import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewToggleOption<T extends string> {
  value: T;
  icon: LucideIcon;
  label: string;
}

interface ViewToggleProps<T extends string> {
  options: ViewToggleOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}


/**
 * Pill segmented control for switching between views (list/kanban/grid…).
 * Visually consistent with CRM toolbar. Uses semantic radius tokens.
 */
export function ViewToggle<T extends string>({
  options,
  value,
  onChange,
  className,
}: ViewToggleProps<T>) {
  return (
    <div
      className={cn(
        "flex border border-border bg-card rounded-button overflow-hidden",
        className,
      )}
      role="group"
    >
      {options.map(({ value: v, icon: Icon, label }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-label={label}
            aria-pressed={active}
            className={cn(
              "h-9 w-9 inline-flex items-center justify-center transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
