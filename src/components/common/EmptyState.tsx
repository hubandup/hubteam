import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * EmptyState — consistent empty view for lists/tabs.
 * Lime pastel icon tile + title + description + optional CTA.
 *
 * @example
 * <EmptyState
 *   icon={<FileText />}
 *   title="Aucun document"
 *   description="Ajoute ton premier document pour ce client."
 *   action={{ label: "Ajouter", onClick: openModal }}
 * />
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: {
    label: React.ReactNode;
    onClick?: () => void;
    href?: string;
  };
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col items-center justify-center text-center bg-card border border-border",
        "px-6 py-10 gap-3",
        className,
      )}
      style={{ borderRadius: 18 }}
      {...props}
    >
      {icon && (
        <span
          className="inline-flex items-center justify-center text-ink"
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "hsl(var(--lime) / 0.25)",
          }}
        >
          {icon}
        </span>
      )}
      <div className="space-y-1 max-w-md">
        <h3 className="display font-semibold text-ink" style={{ fontSize: 16 }}>
          {title}
        </h3>
        {description && (
          <p className="text-muted-foreground" style={{ fontSize: 13, lineHeight: 1.5 }}>
            {description}
          </p>
        )}
      </div>
      {action &&
        (action.href ? (
          <a
            href={action.href}
            className="mt-1 inline-flex items-center gap-1.5 bg-navy text-navy-foreground font-semibold hover:bg-navy-hover transition-colors"
            style={{ padding: "8px 16px", fontSize: 13, borderRadius: 9999 }}
          >
            {action.label}
          </a>
        ) : (
          <Button
            onClick={action.onClick}
            className="mt-1 bg-navy text-navy-foreground hover:bg-navy-hover"
            style={{ borderRadius: 9999 }}
          >
            {action.label}
          </Button>
        ))}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";
