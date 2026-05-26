import { KeyRound, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const initialForm = {
  accountName: "",
  locationId: "",
  privateIntegrationToken: "",
};

export default function PrivateIntegration() {
  const [form, setForm] = useState(initialForm);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateField(field: keyof typeof initialForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (
      !form.accountName.trim() ||
      !form.locationId.trim() ||
      !form.privateIntegrationToken.trim()
    ) {
      setError("Complete all DoorScale connection fields.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/ghl/private-connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      const result = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message || "Unable to save DoorScale connection.");
      }

      setForm(initialForm);
      setMessage(result.message || "DoorScale connected successfully.");
      window.setTimeout(() => {
        window.location.href = "/";
      }, 900);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save DoorScale connection.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">DoorScale connection</p>
          <h2>Connect DoorScale Private Integration</h2>
          <span>Connect a DoorScale account for transaction operations.</span>
        </div>
      </header>

      {message ? <p className="dashboard__success">{message}</p> : null}
      {error ? <p className="dashboard__error">{error}</p> : null}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Private Integration</CardTitle>
            <CardDescription>
              Save a DoorScale account connection for this dashboard.
            </CardDescription>
          </div>
          <KeyRound size={22} />
        </CardHeader>
        <CardContent>
          <form className="private-integration-form" onSubmit={handleSubmit}>
            <label>
              <span>Account Name</span>
              <input
                onChange={(event) =>
                  updateField("accountName", event.target.value)
                }
                value={form.accountName}
              />
            </label>
            <label>
              <span>Location ID</span>
              <input
                onChange={(event) =>
                  updateField("locationId", event.target.value)
                }
                value={form.locationId}
              />
            </label>
            <label>
              <span>Private Integration Token</span>
              <input
                autoComplete="off"
                onChange={(event) =>
                  updateField("privateIntegrationToken", event.target.value)
                }
                type="password"
                value={form.privateIntegrationToken}
              />
            </label>
            <div className="modal__actions">
              <Button disabled={isSaving} type="submit">
                <Save size={17} />
                {isSaving ? "Connecting..." : "Connect DoorScale"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
