import * as React from "react";
import { useState } from "react";
import { AlertCircle, Mail, Phone, Clock, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLogoFallback } from "@/components/targets/targetUtils";

export interface EntityCardStatus {
  label: string;
  bg: string;
  text: string;
  dot: string;
}

export interface EntityCardAlert {
  label: string;
  color: string; // text color (hex/hsl)
}

export interface EntityCardFooterItem {
  icon?: React.ReactNode;
  label?: React.ReactNode;
  value?: React.ReactNode;
}

interface EntityCardProps {
  title: string;
  subtitle?: React.ReactNode;
  logoUrl?: string | null;
  /** 'md' = 56px (default), 'xl' = 64px for project-like cards */
  logoSize?: "md" | "xl";
  logoTitleAdornment?: React.ReactNode;
  alert?: EntityCardAlert;
  status?: EntityCardStatus;
  /** Custom node rendered top-right of the header (replaces status pill placement when used). */
  headerRight?: React.ReactNode;
  email?: string | null;
  phone?: string | null;
  extraInfo?: React.ReactNode;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
}

/**
 * Unified card design used everywhere (CRM, Agences, Projets…).
 * Layout reference: TargetCard.
 *
 * Anatomy (top → bottom):
 *  1. Optional alert row (en retard / urgent)
 *  2. Header: logo box + title/subtitle + (optional) actions menu
 *  3. Status pill
 *  4. Contact lines (email/phone) + extraInfo slot
 *  5. Footer (separator + left/right slots)
 */
export function EntityCard({
  title,
  subtitle,
  logoUrl,
  logoSize = "md",
  logoTitleAdornment,
  alert,
  status,
  headerRight,
  email,
  phone,
  extraInfo,
  footerLeft,
  footerRight,
  actions,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className,
}: EntityCardProps) {
  const [logoError, setLogoError] = useState(false);
  const fallback = getLogoFallback(title);

  const hasFooter = !!(footerLeft || footerRight);
  const logoBox = LOGO_SIZE[logoSize];

  return (
    <div
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(
        "group relative bg-card border border-border hover:border-foreground/40 transition-colors rounded-card",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {alert && (
        <div
          className="px-4 pt-3 pb-2 flex items-center gap-1.5 text-[11px] font-semibold font-roboto"
          style={{ color: alert.color }}
        >
          <AlertCircle size={12} strokeWidth={2.5} />
          <span>{alert.label}</span>
        </div>
      )}

      <div className={cn("px-4 pb-4", !alert && "pt-3")}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={cn(
                logoBox,
                "shrink-0 border border-border bg-card p-1.5 flex items-center justify-center overflow-hidden rounded-card",
              )}
              style={
                !logoUrl || logoError
                  ? { background: fallback.bg, borderColor: "rgba(0,0,0,0.06)" }
                  : undefined
              }
            >
              {logoUrl && !logoError ? (
                <img
                  src={logoUrl}
                  alt={`${title} logo`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span
                  className="font-display font-bold text-base"
                  style={{ color: fallback.text }}
                >
                  {fallback.initials}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className="font-display font-bold text-sm leading-tight truncate text-foreground"
                  title={title}
                >
                  {title}
                </div>
                {logoTitleAdornment}
              </div>
              {subtitle && (
                <div className="text-xs text-muted-foreground truncate mt-0.5 font-roboto">
                  {subtitle}
                </div>
              )}
            </div>
          </div>

          {headerRight && <div className="shrink-0">{headerRight}</div>}

          {actions && (
            <div onClick={(e) => e.stopPropagation()} className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 hover:bg-muted rounded-button"
                    aria-label="Actions"
                  >
                    <MoreHorizontal size={14} className="text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">{actions}</DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Status pill */}
        {status && (
          <div className="mb-3">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider font-roboto rounded-badge"
              style={{ background: status.bg, color: status.text }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: status.dot }}
              />
              {status.label}
            </span>
          </div>
        )}

        {/* Contact infos */}
        {(email || phone || extraInfo) && (
          <div className="space-y-1 text-xs text-muted-foreground mb-3 font-roboto">
            {email && (
              <div className="flex items-center gap-2">
                <Mail size={11} className="text-muted-foreground shrink-0 opacity-70" />
                <span className="truncate">{email}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2">
                <Phone size={11} className="text-muted-foreground shrink-0 opacity-70" />
                <span className="truncate">{phone}</span>
              </div>
            )}
            {extraInfo}
          </div>
        )}

        {hasFooter && (
          <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] font-roboto gap-2">
            <div className="flex items-center gap-1.5 min-w-0">{footerLeft}</div>
            {footerRight && (
              <div className="flex items-center gap-1 shrink-0">{footerRight}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { Clock as EntityCardClockIcon };
