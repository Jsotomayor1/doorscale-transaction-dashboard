import {
  CheckSquare,
  CircleDollarSign,
  FileText,
  Home,
  Plus,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NewTransactionModal } from "@/components/NewTransactionModal";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useCRMData } from "@/hooks/use-crm-data";
import logoUrl from "@/assets/doorscale-tms-logo.png";

export function AppTopNav() {
  const { createTransaction } = useCRMData();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    if (!syncMessage) return;

    const timeout = window.setTimeout(() => setSyncMessage(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [syncMessage]);

  return (
    <>
      <header className="top-nav">
        <div className="top-nav__inner">
          <div className="top-nav__brand">
            <img alt="DoorScale Transaction Management System" src={logoUrl} />
          </div>

          <nav className="top-nav__tabs" aria-label="Dashboard navigation">
            <NavLink to="/" icon={<Home size={17} />}>
              Overview
            </NavLink>
            <NavLink to="/transactions" icon={<Workflow size={17} />}>
              Transactions
            </NavLink>
            <NavLink to="/tasks" icon={<CheckSquare size={17} />}>
              Tasks
            </NavLink>
            <NavLink to="/documents" icon={<FileText size={17} />}>
              Documents
            </NavLink>
            <NavLink to="/commissions" icon={<CircleDollarSign size={17} />}>
              Commissions
            </NavLink>
          </nav>

          <div className="top-nav__actions">
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus size={17} />
              New Transaction
            </Button>
          </div>
        </div>
        {syncMessage ? <p className="top-nav__message">{syncMessage}</p> : null}
      </header>

      <NewTransactionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={async (input) => {
          await createTransaction(input);
          setSyncMessage("Transaction created successfully.");
        }}
      />
    </>
  );
}
