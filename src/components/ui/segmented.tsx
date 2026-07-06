import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * SegmentedControl — pill-shaped segmented switch.
 * Container = muted background, active segment = white card with ink border.
 *
 * @example
 * <SegmentedControl
 *   value={filter}
 *   onValueChange={setFilter}
 *   options={[
 *     { value: "all", label: "Tous" },
 *     { value: "public", label: "Publics" },
 *   ]}
 * />
 */
export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
}

export interface SegmentedControlProps<T extends string = string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

export function SegmentedControl<T extends string = string>({
  value,
  onValueChange,
  options,
  size = "md",
  className,
  ...props
}: SegmentedControlProps<T>) {
  const paddingY = size === "sm" ? 5 : 6;
  const paddingX = size === "sm" ? 10 : 14;
  const fontSize = size === "sm" ? 11 : 12;
  return (
    <div
      role="group"
      aria-label={props["aria-label"]}
      className={cn("inline-flex items-center gap-1 p-1 bg-muted", className)}
      style={{ borderRadius: 9999 }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onValueChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "leading-none font-semibold transition-all",
              active ? "text-ink" : "text-muted-foreground hover:text-foreground",
            )}
            style={{
              background: active ? "hsl(var(--card))" : "transparent",
              border: active ? "1px solid hsl(var(--ink))" : "1px solid transparent",
              padding: `${paddingY}px ${paddingX}px`,
              fontSize,
              borderRadius: 9999,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
