import { NavLink as RouterNavLink, NavLinkProps, useLocation } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  matchParent?: boolean;
  activePatterns?: string[]; // extra paths that should mark this link active
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, matchParent = false, activePatterns = [], ...props }, ref) => {
    const location = useLocation();
    const toPath = typeof to === 'string' ? to : to.pathname;
    
    const isParentActive = matchParent && toPath && toPath !== '/' && location.pathname.startsWith(toPath);
    const isPatternActive = activePatterns.some((p) => location.pathname.startsWith(p));
    
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(
            className,
            (isActive || isParentActive || isPatternActive) && activeClassName,
            isPending && pendingClassName
          )
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
