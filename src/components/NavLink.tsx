import { type ReactNode } from "react";
import { NavLink as RouterNavLink } from "react-router-dom";
import { withActiveLocationPath } from "@/lib/active-location";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  to: string;
  icon: ReactNode;
  children: ReactNode;
};

export function NavLink({ to, icon, children }: NavLinkProps) {
  return (
    <RouterNavLink
      className={({ isActive }) =>
        cn("top-nav__link", isActive && "top-nav__link--active")
      }
      end={to === "/"}
      to={withActiveLocationPath(to)}
    >
      <span className="top-nav__link-icon">{icon}</span>
      <span>{children}</span>
    </RouterNavLink>
  );
}
