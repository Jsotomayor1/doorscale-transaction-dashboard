import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TRANSACTION_TYPES,
  type Opportunity,
  type UpdateTransactionDetailsInput,
} from "@/hooks/use-crm-data";

const STATUS_OPTIONS = ["active", "closed", "dead"] as const;

type EditTransactionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: UpdateTransactionDetailsInput) => Promise<string | void>;
  transaction: Opportunity;
};

function toDateInput(value: string) {
  if (!value) return "";

  return value.slice(0, 10);
}

export function EditTransactionModal({
  isOpen,
  onClose,
  onSave,
  transaction,
}: EditTransactionModalProps) {
  const fields = transaction.customFields;
  const [form, setForm] = useState<UpdateTransactionDetailsInput>(() => ({
    transactionId: String(transaction.id),
    assignedTo: fields.assignedAgent || transaction.assignedTo || "",
    clientEmail: fields.contactEmail || "",
    clientFirstName: transaction.customFields.contactName?.split(/\s+/)[0] || "",
    clientLastName: transaction.customFields.contactName?.split(/\s+/).slice(1).join(" ") || "",
    clientPhone: fields.contactPhone || "",
    propertyAddress: fields.propertyAddress || transaction.name,
    transactionType: fields.transactionType,
    buyerName: fields.buyerName,
    sellerName: fields.sellerName,
    closingDate: toDateInput(fields.closingDate),
    inspectionDate: toDateInput(fields.inspectionDeadline),
    commission: String(transaction.value || ""),
    status: transaction.status || "active",
  }));
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  function updateField<K extends keyof UpdateTransactionDetailsInput>(
    field: K,
    value: UpdateTransactionDetailsInput[K],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!form.propertyAddress.trim()) {
      setFormError("Property Address is required.");
      return;
    }

    if (!form.clientEmail.trim() && !form.clientPhone.trim()) {
      setFormError("Client Email or Phone is required.");
      return;
    }

    if (!form.transactionType) {
      setFormError("Transaction Type is required.");
      return;
    }

    setIsSaving(true);

    try {
      await onSave({
        ...form,
        assignedTo: form.assignedTo.trim(),
        clientEmail: form.clientEmail.trim(),
        clientFirstName: form.clientFirstName.trim(),
        clientLastName: form.clientLastName.trim(),
        clientPhone: form.clientPhone.trim(),
        propertyAddress: form.propertyAddress.trim(),
        buyerName: form.buyerName.trim(),
        sellerName: form.sellerName.trim(),
      });
      onClose();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to update transaction.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="edit-transaction-title"
        aria-modal="true"
        className="modal"
        role="dialog"
      >
        <div className="modal__header">
          <div>
            <p className="dashboard__eyebrow">Edit transaction</p>
            <h2 id="edit-transaction-title">Transaction Details</h2>
          </div>
          <button
            aria-label="Close edit transaction modal"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <form className="transaction-form" onSubmit={handleSubmit}>
          <div className="form-field form-field--full">
            <span>Client / Contact</span>
          </div>

          <label className="form-field">
            <span>Client First Name</span>
            <input
              onChange={(event) =>
                updateField("clientFirstName", event.target.value)
              }
              value={form.clientFirstName}
            />
          </label>

          <label className="form-field">
            <span>Client Last Name</span>
            <input
              onChange={(event) =>
                updateField("clientLastName", event.target.value)
              }
              value={form.clientLastName}
            />
          </label>

          <label className="form-field">
            <span>Client Email</span>
            <input
              onChange={(event) => updateField("clientEmail", event.target.value)}
              type="email"
              value={form.clientEmail}
            />
          </label>

          <label className="form-field">
            <span>Client Phone</span>
            <input
              onChange={(event) => updateField("clientPhone", event.target.value)}
              type="tel"
              value={form.clientPhone}
            />
          </label>

          <label className="form-field form-field--full">
            <span>Property Address</span>
            <input
              onChange={(event) =>
                updateField("propertyAddress", event.target.value)
              }
              required
              value={form.propertyAddress}
            />
          </label>

          <label className="form-field">
            <span>Transaction Type</span>
            <select
              onChange={(event) =>
                updateField("transactionType", event.target.value)
              }
              required
              value={form.transactionType}
            >
              <option value="">Select type</option>
              {TRANSACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Status</span>
            <select
              onChange={(event) => updateField("status", event.target.value)}
              value={form.status}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Assigned Agent</span>
            <input
              onChange={(event) => updateField("assignedTo", event.target.value)}
              value={form.assignedTo}
            />
          </label>

          <label className="form-field">
            <span>Buyer Name</span>
            <input
              onChange={(event) => updateField("buyerName", event.target.value)}
              value={form.buyerName}
            />
          </label>

          <label className="form-field">
            <span>Seller Name</span>
            <input
              onChange={(event) => updateField("sellerName", event.target.value)}
              value={form.sellerName}
            />
          </label>

          <label className="form-field">
            <span>Closing Date</span>
            <input
              onChange={(event) => updateField("closingDate", event.target.value)}
              type="date"
              value={form.closingDate}
            />
          </label>

          <label className="form-field">
            <span>Inspection Date</span>
            <input
              onChange={(event) =>
                updateField("inspectionDate", event.target.value)
              }
              type="date"
              value={form.inspectionDate}
            />
          </label>

          <label className="form-field form-field--full">
            <span>Commission</span>
            <input
              min="0"
              onChange={(event) => updateField("commission", event.target.value)}
              step="0.01"
              type="number"
              value={form.commission}
            />
          </label>

          {formError ? <p className="form-error">{formError}</p> : null}

          <div className="modal__actions">
            <Button disabled={isSaving} onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <Button disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
