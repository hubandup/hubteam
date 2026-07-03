import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterPillItem {
  key: string;
  label: React.ReactNode;
  count?: number;
}

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterPillItem[];
  activeFilter?: string;
  onFilterChange?: (key: string) => void;
  trailing?: React.ReactNode;
  className?: string;
}

/**
 * Pill search input + filter pills row. Standard for list/grid views.
 */
export function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Rechercher…",
  filters,
  activeFilter,
  onFilterChange,
  trailing,
  className,
}: SearchFilterBarProps) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-button p-2 pl-4 flex items-center gap-3 flex-wrap",
        className,
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 text-sm outline-none bg-transparent font-display text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {filters && filters.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((f) => {
            const active = activeFilter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => onFilterChange?.(f.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1.5 rounded-button",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted text-foreground hover:bg-muted/70",
                )}
              >
                {f.label}
                {typeof f.count === "number" ? (
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 leading-none rounded-badge",
                      active ? "bg-background/20 text-background" : "bg-card text-foreground",
                    )}
                  >
                    {f.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {trailing}
    </div>
  );
}
