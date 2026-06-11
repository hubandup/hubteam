import * as React from "react";
import { cn } from "@/lib/utils";

interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * Toolbar wrapper enforcing consistent action button alignment.
 *
 * - All direct children (buttons, ViewToggle, badges, selects) are forced to
 *   the same height (h-9) and vertically centered.
 * - Gap and wrap behavior are unified so toolbars look identical on every page.
 *
 * Use to wrap Export / Import / Archives / ViewToggle / CTA groups.
 */
export function Toolbar({ className, children, ...rest }: ToolbarProps) {
  return (
    <div
      {...rest}
      className={cn(
        // height-normalized row — every leaf control should be h-9
        "flex items-center gap-2 flex-wrap [&>*]:h-9 [&_button]:h-9 [&_[role=group]]:h-9",
        className,
      )}
    >
      {children}
    </div>
  );
}
