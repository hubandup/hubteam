import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-sm",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md",
        outline: "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        
        // Status variants with enhanced colors
        success: "border-transparent bg-success text-white hover:brightness-110 hover:shadow-md dark:bg-success dark:text-white",
        warning: "border-transparent bg-warning text-white hover:brightness-110 hover:shadow-md dark:bg-warning dark:text-white",
        info: "border-transparent bg-info text-white hover:brightness-110 hover:shadow-md dark:bg-info dark:text-white",
        error: "border-transparent bg-destructive text-destructive-foreground hover:brightness-110 hover:shadow-md",
        
        // Role variants
        admin: "border-transparent bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md dark:bg-purple-500 dark:hover:bg-purple-600",
        team: "border-transparent bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md dark:bg-blue-500 dark:hover:bg-blue-600",
        client: "border-transparent bg-green-600 text-white hover:bg-green-700 hover:shadow-md dark:bg-green-500 dark:hover:bg-green-600",
        agency: "border-transparent bg-orange-600 text-white hover:bg-orange-700 hover:shadow-md dark:bg-orange-500 dark:hover:bg-orange-600",
        
        // Soft variants with subtle backgrounds
        "success-soft": "border-transparent bg-success/10 text-success hover:bg-success/20 dark:bg-success/20 dark:text-success dark:hover:bg-success/30",
        "warning-soft": "border-transparent bg-warning/10 text-warning hover:bg-warning/20 dark:bg-warning/20 dark:text-warning dark:hover:bg-warning/30",
        "info-soft": "border-transparent bg-info/10 text-info hover:bg-info/20 dark:bg-info/20 dark:text-info dark:hover:bg-info/30",
        "error-soft": "border-transparent bg-destructive/10 text-destructive hover:bg-destructive/20 dark:bg-destructive/20 dark:text-destructive dark:hover:bg-destructive/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
