import {
  CheckSquare,
  CircleDollarSign,
  FileText,
  Home,
  Plus,
  RefreshCw,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NewTransactionModal } from "@/components/NewTransactionModal";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { useCRMData } from "@/hooks/use-crm-data";
import {
  getDoorScaleLocationHeaders,
  getStoredActiveLocationId,
  setStoredActiveLocationId,
} from "@/lib/active-location";
import logoUrl from "@/assets/doorscale-tms-logo.png";

export function AppTopNav() {
  const { createTransaction } = useCRMData();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    if (!syncMessage) return;

    const timeout = window.setTimeout(() => setSyncMessage(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [syncMessage]);

  async function handleSync() {
    setSyncMessage("");
    setIsSyncing(true);

    try {
      const locationId = getStoredActiveLocationId();
      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          action: "sync",
          active_location_id: locationId,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
        ok?: boolean;
      };

      if (!response.ok || result.ok === false) {
        throw new Error(result.message || "Unable to sync DoorScale data.");
      }

      setSyncMessage(result.message || "DoorScale data synced successfully.");
      setStoredActiveLocationId(locationId);
    } catch (error) {
      setSyncMessage(
        error instanceof Error ? error.message : "Unable to sync DoorScale data.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

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
            <button
              className="top-nav__sync"
              disabled={isSyncing}
              onClick={() => void handleSync()}
              type="button"
            >
              <RefreshCw size={16} />
              {isSyncing ? "Syncing..." : "Sync"}
            </button>
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
