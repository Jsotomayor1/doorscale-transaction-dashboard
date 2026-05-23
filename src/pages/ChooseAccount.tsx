import { Building2, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type DoorScaleLocation = {
  id: string;
  name: string;
};

type LocationsResponse = {
  connected?: boolean;
  locations?: DoorScaleLocation[];
  needsLocationSelection?: boolean;
};

export default function ChooseAccount() {
  const [locations, setLocations] = useState<DoorScaleLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      setError("");

      try {
        const response = await fetch("/api/ghl/locations");
        const result = (await response.json()) as LocationsResponse;

        if (!isMounted) return;

        setLocations(result.locations ?? []);

        if (result.connected && !result.needsLocationSelection) {
          setMessage("DoorScale account connected.");
        } else if (!result.locations?.length) {
          setError("No DoorScale accounts were found for this connection.");
        }
      } catch {
        if (isMounted) {
          setError("Unable to load DoorScale accounts.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLocations();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleChooseLocation(locationId: string) {
    setError("");
    setMessage("");
    setIsSaving(locationId);

    try {
      const response = await fetch("/api/ghl/select-location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ locationId }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || "Unable to save DoorScale account.");
      }

      setMessage(result.message || "DoorScale account connected.");
      window.setTimeout(() => {
        window.location.href = "/";
      }, 900);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save DoorScale account.",
      );
    } finally {
      setIsSaving("");
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">DoorScale connection</p>
          <h2>Choose DoorScale Account</h2>
          <span>Select the account that should power this dashboard.</span>
        </div>
      </header>

      {isLoading ? (
        <p className="dashboard__status">Loading DoorScale accounts...</p>
      ) : null}
      {message ? <p className="dashboard__success">{message}</p> : null}
      {error ? <p className="dashboard__error">{error}</p> : null}

      <section className="account-selection-list">
        {locations.map((location) => (
          <Card key={location.id}>
            <CardHeader>
              <div>
                <CardTitle>{location.name}</CardTitle>
                <CardDescription>
                  Use this DoorScale account for transactions and tasks.
                </CardDescription>
              </div>
              <Building2 size={22} />
            </CardHeader>
            <CardContent>
              <Button
                disabled={Boolean(isSaving)}
                onClick={() => void handleChooseLocation(location.id)}
              >
                {isSaving === location.id ? (
                  "Connecting..."
                ) : (
                  <>
                    <CheckCircle2 size={17} />
                    Choose Account
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
