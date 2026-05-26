import { useEffect, useState } from "react";
import {
  getStoredActiveLocationId,
  setStoredActiveLocationId,
} from "@/lib/active-location";

type DoorScaleLocation = {
  id: string;
  name: string;
};

type StatusResponse = {
  connected?: boolean;
  locations?: DoorScaleLocation[];
};

export function AccountSelector() {
  const [locations, setLocations] = useState<DoorScaleLocation[]>([]);
  const [activeLocationId, setActiveLocationId] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      try {
        const response = await fetch("/api/ghl/status");
        const result = (await response.json()) as StatusResponse;
        const connectedLocations = result.locations ?? [];
        const storedLocationId = getStoredActiveLocationId();
        const nextActiveLocationId =
          connectedLocations.find((location) => location.id === storedLocationId)
            ?.id ??
          connectedLocations[0]?.id ??
          "";

        if (!isMounted) return;

        setLocations(connectedLocations);
        setActiveLocationId(nextActiveLocationId);

        if (nextActiveLocationId && nextActiveLocationId !== storedLocationId) {
          setStoredActiveLocationId(nextActiveLocationId);
        }
      } catch {
        if (isMounted) {
          setLocations([]);
          setActiveLocationId("");
        }
      }
    }

    void loadLocations();

    return () => {
      isMounted = false;
    };
  }, []);

  if (locations.length <= 1) return null;

  return (
    <div className="account-selector">
      <label>
        <span>DoorScale Account</span>
        <select
          onChange={(event) => {
            setActiveLocationId(event.target.value);
            setStoredActiveLocationId(event.target.value);
          }}
          value={activeLocationId}
        >
          {locations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
