import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PillSegmentedOption<T extends string> {
  value: T;
  icon: LucideIcon;
  label: string;
}

interface PillSegmentedProps<T extends string> {
  options: PillSegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

/**
 * PillSegmented — segmented control pilule pour bascules de vue
 * (liste/colonnes/grille). H 40, segments 40px, séparés par border 1px.
 * Actif = navy, inactif = card.
 * Tokens sémantiques → dark mode OK.
 */
export function PillSegmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: PillSegmentedProps<T>) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex h-10 rounded-full border border-[hsl(var(--field-border))] bg-card overflow-hidden shrink-0",
        className,
      )}
    >
      {options.map(({ value: v, icon: Icon, label }, i) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-label={label}
            aria-pressed={active}
            title={label}
            className={cn(
              "h-full w-10 inline-flex items-center justify-center transition-colors duration-150",
              i > 0 && "border-l border-[hsl(var(--field-border))]",
              active
                ? "bg-navy text-navy-foreground"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon size={16} strokeWidth={1.8} />
          </button>
        );
      })}
    </div>
  );
}
