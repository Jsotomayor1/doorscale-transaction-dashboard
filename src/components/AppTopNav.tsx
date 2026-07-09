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
  notifyDoorScaleDataChanged,
  setStoredActiveLocationId,
} from "@/lib/active-location";
import logoUrl from "@/assets/doorscale-tms-logo.png";

type SyncResponse = {
  message?: string;
  ok?: boolean;
  opportunityCount?: number;
  skippedOpportunities?: number;
  syncedTasks?: number;
  syncedTransactions?: number;
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Sync timed out. Please try again.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function getSyncMessage(result: SyncResponse) {
  const opportunityCount = Number(result.opportunityCount ?? 0);
  const syncedTransactions = Number(result.syncedTransactions ?? 0);
  const syncedTasks = Number(result.syncedTasks ?? 0);

  if (opportunityCount === 0) {
    return "No CRM opportunities found.";
  }

  if (syncedTransactions > 0 || syncedTasks > 0) {
    if (syncedTasks > 0) {
      const transactionText = `${syncedTransactions} transaction${
        syncedTransactions === 1 ? "" : "s"
      } updated`;
      const taskText = `${syncedTasks} task${syncedTasks === 1 ? "" : "s"} updated`;

      return `Sync complete. ${transactionText}. ${taskText}.`;
    }

    return `Sync complete. ${syncedTransactions} transaction${
      syncedTransactions === 1 ? "" : "s"
    } updated.`;
  }

  return result.message || "Sync complete.";
}

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

      if (!locationId) {
        throw new Error("Open this dashboard from your DoorScale account.");
      }

      console.log("DoorScale global sync request:", {
        endpoint: "/api/ghl",
        locationId,
      });

      const response = await fetchWithTimeout("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(locationId),
        },
        body: JSON.stringify({
          action: "sync",
          active_location_id: locationId,
        }),
      }, 30000);
      const result = (await response.json().catch(() => ({}))) as SyncResponse;

      console.log("DoorScale global sync response:", {
        ok: result.ok,
        opportunityCount: result.opportunityCount ?? 0,
        skippedOpportunities: result.skippedOpportunities ?? 0,
        status: response.status,
        syncedTasks: result.syncedTasks ?? 0,
        syncedTransactions: result.syncedTransactions ?? 0,
      });

      if (!response.ok || result.ok === false) {
        throw new Error(result.message || "Unable to sync DoorScale data.");
      }

      setSyncMessage(getSyncMessage(result));
      setStoredActiveLocationId(locationId);
      notifyDoorScaleDataChanged();
    } catch (error) {
      setSyncMessage(
        error instanceof Error
          ? `Sync failed: ${error.message}`
          : "Sync failed: Unable to sync DoorScale data.",
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
              {isSyncing ? "Importing..." : "Import from CRM"}
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
