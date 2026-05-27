import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  getDoorScaleLocationHeaders,
  getUrlActiveLocationId,
  setStoredActiveLocationId,
} from "@/lib/active-location";
import PrivateIntegration from "@/pages/PrivateIntegration";

type StatusResponse = {
  connected?: boolean;
  locationRequired?: boolean;
};

export function DoorScaleGate() {
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [hasLocationId, setHasLocationId] = useState(Boolean(getUrlActiveLocationId()));

  useEffect(() => {
    const urlLocationId = getUrlActiveLocationId();

    if (urlLocationId) {
      setStoredActiveLocationId(urlLocationId);
      setHasLocationId(true);
    } else {
      setHasLocationId(false);
      setIsChecking(false);
      return;
    }

    let isMounted = true;

    async function checkConnection() {
      setIsChecking(true);

      try {
        const response = await fetch("/api/ghl", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getDoorScaleLocationHeaders(),
          },
          body: JSON.stringify({
            action: "status",
            active_location_id: urlLocationId,
          }),
        });
        const status = (await response.json().catch(() => ({}))) as StatusResponse;

        if (isMounted) {
          setIsConnected(Boolean(status.connected));
        }
      } catch {
        if (isMounted) {
          setIsConnected(false);
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    }

    void checkConnection();

    return () => {
      isMounted = false;
    };
  }, [location.search]);

  if (!hasLocationId) {
    return (
      <div className="dashboard">
        <header className="dashboard__header">
          <div>
            <p className="dashboard__eyebrow">DoorScale dashboard</p>
            <h2>Open this dashboard from your DoorScale account.</h2>
          </div>
        </header>
      </div>
    );
  }

  if (isChecking) {
    return <p className="dashboard__status">Loading DoorScale data...</p>;
  }

  if (!isConnected) {
    return <PrivateIntegration />;
  }

  return <Outlet />;
}
