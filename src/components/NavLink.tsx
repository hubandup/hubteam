import { NavLink as RouterNavLink, NavLinkProps, useLocation } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
  matchParent?: boolean; // New prop to match parent routes
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, matchParent = false, ...props }, ref) => {
    const location = useLocation();
    const toPath = typeof to === 'string' ? to : to.pathname;
    
    // Check if current path starts with the target path (for parent matching)
    const isParentActive = matchParent && toPath && toPath !== '/' && location.pathname.startsWith(toPath);
    
    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(
            className, 
            (isActive || isParentActive) && activeClassName, 
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
