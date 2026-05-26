import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TRANSACTION_STAGES,
  TRANSACTION_TYPES,
  type NewTransactionInput,
} from "@/hooks/use-crm-data";

const initialForm: NewTransactionInput = {
  clientEmail: "",
  clientFirstName: "",
  clientLastName: "",
  clientPhone: "",
  propertyAddress: "",
  transactionType: "",
  stage: "Pre-listing",
  buyerName: "",
  sellerName: "",
  closingDate: "",
  inspectionDate: "",
  commission: "",
};

type NewTransactionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: NewTransactionInput) => Promise<string | void>;
};

export function NewTransactionModal({
  isOpen,
  onClose,
  onCreate,
}: NewTransactionModalProps) {
  const [form, setForm] = useState<NewTransactionInput>(initialForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  function updateField<K extends keyof NewTransactionInput>(
    field: K,
    value: NewTransactionInput[K],
  ) {
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!form.clientFirstName.trim()) {
      setFormError("Client First Name is required.");
      return;
    }

    if (!form.clientLastName.trim()) {
      setFormError("Client Last Name is required.");
      return;
    }

    if (!form.clientEmail.trim() && !form.clientPhone.trim()) {
      setFormError("Client Email or Phone is required.");
      return;
    }

    if (!form.propertyAddress.trim()) {
      setFormError("Property Address is required.");
      return;
    }

    if (!form.transactionType) {
      setFormError("Transaction Type is required.");
      return;
    }

    if (!form.stage) {
      setFormError("Stage is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      await onCreate({
        ...form,
        clientEmail: form.clientEmail.trim(),
        clientFirstName: form.clientFirstName.trim(),
        clientLastName: form.clientLastName.trim(),
        clientPhone: form.clientPhone.trim(),
        propertyAddress: form.propertyAddress.trim(),
        buyerName: form.buyerName.trim(),
        sellerName: form.sellerName.trim(),
      });
      setForm(initialForm);
      onClose();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to create transaction.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-labelledby="new-transaction-title"
        aria-modal="true"
        className="modal"
        role="dialog"
      >
        <div className="modal__header">
          <div>
            <p className="dashboard__eyebrow">Create transaction</p>
            <h2 id="new-transaction-title">New Transaction</h2>
          </div>
          <button
            aria-label="Close new transaction modal"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <form className="transaction-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Client First Name</span>
            <input
              onChange={(event) =>
                updateField("clientFirstName", event.target.value)
              }
              required
              value={form.clientFirstName}
            />
          </label>

          <label className="form-field">
            <span>Client Last Name</span>
            <input
              onChange={(event) =>
                updateField("clientLastName", event.target.value)
              }
              required
              value={form.clientLastName}
            />
          </label>

          <label className="form-field">
            <span>Client Email</span>
            <input
              onChange={(event) =>
                updateField("clientEmail", event.target.value)
              }
              type="email"
              value={form.clientEmail}
            />
          </label>

          <label className="form-field">
            <span>Client Phone</span>
            <input
              onChange={(event) =>
                updateField("clientPhone", event.target.value)
              }
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
              placeholder="123 Main St, Tampa, FL"
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
            <span>Stage</span>
            <select
              onChange={(event) =>
                updateField("stage", event.target.value as NewTransactionInput["stage"])
              }
              required
              value={form.stage}
            >
              {TRANSACTION_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
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
              placeholder="0"
              step="0.01"
              type="number"
              value={form.commission}
            />
          </label>

          {formError ? <p className="form-error">{formError}</p> : null}

          <div className="modal__actions">
            <Button disabled={isSubmitting} onClick={onClose} variant="ghost">
              Cancel
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating..." : "Create Transaction"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
