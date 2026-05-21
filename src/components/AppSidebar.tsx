import {
  BarChart3,
  CheckSquare,
  CircleDollarSign,
  Link as LinkIcon,
  Home,
  Workflow,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";

export function AppSidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-mark">TM</div>
        <div>
          <p className="sidebar__eyebrow">Realtor Ops</p>
          <h1>Transaction Hub</h1>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Dashboard navigation">
        <NavLink to="/" icon={<Home size={18} />}>
          Overview
        </NavLink>
        <NavLink to="/transactions" icon={<Workflow size={18} />}>
          Transactions
        </NavLink>
        <NavLink to="/tasks" icon={<CheckSquare size={18} />}>
          Tasks
        </NavLink>
        <NavLink to="/commissions" icon={<CircleDollarSign size={18} />}>
          Commissions
        </NavLink>
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__footer-copy">
          <BarChart3 size={18} />
          <span>Live Supabase data ready for transaction operations.</span>
        </div>
        <a className="sidebar__connect" href="/api/oauth/connect">
          <LinkIcon size={16} />
          Connect DoorScale
        </a>
      </div>
    </aside>
  );
}
