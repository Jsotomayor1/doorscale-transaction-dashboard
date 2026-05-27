import {
  BarChart3,
  CheckSquare,
  CircleDollarSign,
  KeyRound,
  Home,
  RefreshCw,
  Workflow,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "@/components/NavLink";
import {
  getDoorScaleLocationHeaders,
  getStoredActiveLocationId,
  setStoredActiveLocationId,
  withActiveLocationPath,
} from "@/lib/active-location";

export function AppSidebar() {
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncDebug, setSyncDebug] = useState("No sync response yet.");

  useEffect(() => {
    let isMounted = true;

    async function checkStatus() {
      try {
        const response = await fetch("/api/ghl", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getDoorScaleLocationHeaders(),
          },
          body: JSON.stringify({
            action: "status",
            active_location_id: getStoredActiveLocationId(),
          }),
        });
        const status = (await response.json()) as {
          connected?: boolean;
        };

        if (isMounted) {
          setIsConnected(Boolean(status.connected));
        }
      } catch {
        if (isMounted) {
          setIsConnected(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingStatus(false);
        }
      }
    }

    void checkStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleConnectionClick() {
    setSyncMessage("");
    setSyncDebug("Sync not started.");

    if (!isConnected) {
      window.location.href = withActiveLocationPath("/private-integration");
      return;
    }

    setIsSyncing(true);

    try {
      const response = await fetch("/api/ghl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getDoorScaleLocationHeaders(),
        },
        body: JSON.stringify({
          action: "sync",
          active_location_id: getStoredActiveLocationId(),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        data?: {
          documents?: unknown[];
          tasks?: unknown[];
          transactions?: unknown[];
        };
        documents?: unknown[];
        message?: string;
        ok?: boolean;
        syncedDocuments?: number;
        syncedTasks?: number;
        syncedTransactions?: number;
        tasks?: unknown[];
        transactions?: unknown[];
      };
      const transactions =
        result.transactions ?? result.data?.transactions ?? [];
      const tasks = result.tasks ?? result.data?.tasks ?? [];
      const documents = result.documents ?? result.data?.documents ?? [];

      setSyncDebug(
        JSON.stringify({
          routeCalled: "/api/ghl action sync",
          responseStatus: response.status,
          responseBodyPreview: JSON.stringify(result).slice(0, 300),
          parsedTransactionCount: Array.isArray(transactions)
            ? transactions.length
            : result.syncedTransactions ?? 0,
          parsedTaskCount: Array.isArray(tasks)
            ? tasks.length
            : result.syncedTasks ?? 0,
          parsedDocumentCount: Array.isArray(documents)
            ? documents.length
            : result.syncedDocuments ?? 0,
        }),
      );

      if (!response.ok || result.ok === false) {
        throw new Error(
          result.message || "Unable to sync DoorScale data.",
        );
      }

      setSyncMessage(result.message || "DoorScale data synced successfully.");
      setStoredActiveLocationId(getStoredActiveLocationId());
    } catch (error) {
      setSyncMessage(
        error instanceof Error
          ? error.message
          : "Unable to sync DoorScale data.",
      );
    } finally {
      setIsSyncing(false);
    }
  }

  const connectionLabel = isSyncing
    ? "Syncing..."
    : isConnected
      ? "Sync DoorScale Data"
      : "Connect DoorScale";

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
          <span>DoorScale connection ready for transaction operations.</span>
        </div>
        <button
          className="sidebar__connect"
          disabled={isCheckingStatus || isSyncing}
          onClick={() => void handleConnectionClick()}
          type="button"
        >
          {isConnected ? <RefreshCw size={16} /> : <KeyRound size={16} />}
          {connectionLabel}
        </button>
        {syncMessage ? (
          <p className="sidebar__sync-message">{syncMessage}</p>
        ) : null}
        <p className="sidebar__sync-message">{syncDebug}</p>
      </div>
    </aside>
  );
}
