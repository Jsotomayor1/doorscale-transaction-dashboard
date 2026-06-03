import { Outlet } from "react-router-dom";
import { AppTopNav } from "@/components/AppTopNav";

export function Layout() {
  return (
    <div className="app-shell">
      <AppTopNav />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
