import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * StatusPill — unified pill for statuses across the app.
 * Tone controls the color pair (success/warning/danger/info/neutral/accent).
 * Use `dot` to prepend a small colored bullet.
 *
 * @example
 * <StatusPill tone="success" dot>Renseignée</StatusPill>
 * <StatusPill tone="warning">À définir</StatusPill>
 */
const pillVariants = cva(
  "inline-flex items-center gap-1.5 font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        success: "bg-pill-success-bg text-pill-success",
        warning: "bg-pill-warning-bg text-pill-warning",
        danger: "bg-pill-danger-bg text-pill-danger",
        info: "bg-pill-info-bg text-pill-info",
        neutral: "bg-muted text-foreground",
        accent: "bg-lime text-lime-foreground",
        dark: "bg-navy text-navy-foreground",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-1 text-[11px]",
        lg: "px-3 py-1.5 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

const dotToneClass: Record<NonNullable<VariantProps<typeof pillVariants>["tone"]>, string> = {
  success: "bg-pill-success",
  warning: "bg-pill-warning",
  danger: "bg-pill-danger",
  info: "bg-pill-info",
  neutral: "bg-muted-foreground",
  accent: "bg-navy",
  dark: "bg-lime",
};

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  dot?: boolean;
}

export const StatusPill = React.forwardRef<HTMLSpanElement, StatusPillProps>(
  ({ className, tone, size, dot, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(pillVariants({ tone, size }), className)}
      style={{ borderRadius: 9999, ...props.style }}
      {...props}
    >
      {dot && (
        <span
          className={cn("inline-block rounded-full", dotToneClass[tone ?? "neutral"])}
          style={{ width: 6, height: 6 }}
        />
      )}
      {children}
    </span>
  ),
);
StatusPill.displayName = "StatusPill";
