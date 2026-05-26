import { Outlet } from "react-router-dom";
import { AccountSelector } from "@/components/AccountSelector";
import { AppSidebar } from "@/components/AppSidebar";

export function Layout() {
  return (
    <div className="app-shell">
      <AppSidebar />
      <main className="app-main">
        <AccountSelector />
        <Outlet />
      </main>
    </div>
  );
}
