import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * PillButton — grammaire unique de CTA (barres d'action pages listes/fiches).
 * H 40px, radius pill, gap 8px, texte 13/600, icônes 16px stroke 1.8.
 * Utilise les tokens sémantiques → compatible dark mode.
 *
 * Variantes :
 *  - primary  : navy plein (un seul par écran)
 *  - outline  : fond card, bordure field-border
 *  - ghost    : transparent, hover muted
 *  - toggle-on: variante navy quand un toggle est actif (Archives sélectionnée…)
 */
const pillButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-[13px] font-semibold font-['Instrument_Sans'] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:opacity-60 disabled:pointer-events-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary:
          "bg-navy text-navy-foreground border border-navy hover:bg-navy-hover",
        outline:
          "bg-card text-foreground border border-[hsl(var(--field-border))] hover:bg-muted hover:border-[hsl(var(--border))]",
        ghost:
          "bg-transparent text-foreground border border-transparent hover:bg-muted",
        "toggle-on":
          "bg-navy text-navy-foreground border border-navy hover:bg-navy-hover",
      },
      iconOnly: {
        true: "w-10 px-0",
        false: "",
      },
    },
    defaultVariants: { variant: "outline", iconOnly: false },
  },
);

export interface PillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof pillButtonVariants> {
  asChild?: boolean;
}

export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ className, variant, iconOnly, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(pillButtonVariants({ variant, iconOnly }), className)}
        {...props}
      />
    );
  },
);
PillButton.displayName = "PillButton";

/**
 * PillCounter — badge compteur discret à coller dans un PillButton
 * (compatible variantes outline / toggle-on).
 */
export function PillCounter({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center h-[18px] min-w-[18px] px-1.5 rounded-full text-[11px] font-semibold",
        active
          ? "bg-white/15 text-navy-foreground"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/**
 * ToolbarSeparator — fine barre verticale entre groupes d'actions.
 */
export function ToolbarSeparator() {
  return (
    <div
      aria-hidden="true"
      className="w-px h-6 mx-1 bg-border shrink-0"
    />
  );
}
