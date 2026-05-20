import {
  BarChart3,
  CheckSquare,
  CircleDollarSign,
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
        <BarChart3 size={18} />
        <span>Mock CRM data ready for Supabase and GoHighLevel.</span>
      </div>
    </aside>
  );
}
