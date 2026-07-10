import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { FileCheck2, FileText, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type DocumentStatus,
  type TransactionDocument,
  useCRMData,
} from "@/hooks/use-crm-data";
import { withActiveLocationPath } from "@/lib/active-location";

const DOCUMENT_STATUSES: Array<{ label: string; value: DocumentStatus }> = [
  { label: "Required", value: "needed" },
  { label: "Uploaded", value: "uploaded" },
  { label: "Missing", value: "missing" },
];

function statusVariant(status: string) {
  if (status === "uploaded") return "success";
  if (status === "missing") return "danger";
  return "warning";
}

function statusLabel(status: string) {
  if (status === "needed") return "Required";
  if (status === "uploaded") return "Uploaded";
  if (status === "missing") return "Missing";
  return status.replace(/_/g, " ");
}

function formatUploadDate(dateValue: string) {
  const date = new Date(dateValue);

  if (!dateValue || Number.isNaN(date.getTime())) {
    return "No upload yet";
  }

  return `Uploaded ${date.toLocaleDateString()}`;
}

export default function Documents() {
  const data = useCRMData();
  const {
    documents,
    ensureTransactionDocuments,
    error,
    loading,
    renameTransactionDocument,
    transactions,
    updateDocumentStatus,
    uploadTransactionDocument,
  } = data;
  const [documentMessage, setDocumentMessage] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [preparingTransactionIds, setPreparingTransactionIds] = useState<
    string[]
  >([]);
  const [uploadingDocumentId, setUploadingDocumentId] = useState("");
  const [manualDocumentNames, setManualDocumentNames] = useState<
    Record<string, string>
  >({});
  const [globalDocumentName, setGlobalDocumentName] = useState("");
  const [globalTransactionId, setGlobalTransactionId] = useState("");
  const [renamingDocumentIds, setRenamingDocumentIds] = useState<string[]>([]);
  const [renameValues, setRenameValues] = useState<Record<string, string>>({});
  const checklistKeys = useMemo(
    () =>
      transactions
        .map(
          (transaction) =>
            `${transaction.id}:${transaction.type}:${transaction.stage}`,
        )
        .join("|"),
    [transactions],
  );

  useEffect(() => {
    let isMounted = true;

    async function prepareMissingChecklists() {
      if (!transactions.length) {
        return;
      }

      setPreparingTransactionIds(
        transactions.map((transaction) => transaction.id),
      );

      await Promise.all(
        transactions.map((transaction) =>
          ensureTransactionDocuments({
            stage: transaction.stage,
            transactionId: transaction.id,
            transactionType: transaction.type,
          }),
        ),
      );

      if (isMounted) {
        setPreparingTransactionIds([]);
      }
    }

    void prepareMissingChecklists();

    return () => {
      isMounted = false;
    };
  }, [checklistKeys, ensureTransactionDocuments, transactions]);

  async function handleStatusChange(
    document: TransactionDocument,
    status: DocumentStatus,
  ) {
    setDocumentError("");
    setDocumentMessage("");

    try {
      await updateDocumentStatus({
        documentId: document.id,
        status,
        transactionId: document.transactionId,
      });
      setDocumentMessage("Document status updated.");
    } catch (statusError) {
      setDocumentError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to update document status.",
      );
    }
  }

  async function handleUpload(
    event: ChangeEvent<HTMLInputElement>,
    document: TransactionDocument,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setDocumentError("");
    setDocumentMessage("");
    setUploadingDocumentId(document.id);

    try {
      await uploadTransactionDocument({
        documentId: document.id,
        documentType: document.documentType,
        file,
        transactionId: document.transactionId,
      });
      setDocumentMessage("Document uploaded.");
    } catch (uploadError) {
      setDocumentError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload document.",
      );
    } finally {
      setUploadingDocumentId("");
    }
  }

  async function handleManualUpload(
    event: ChangeEvent<HTMLInputElement>,
    transaction: { id: string; stage: string; type: string },
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const uploadKey = `manual-${transaction.id}`;
    const documentType =
      manualDocumentNames[transaction.id]?.trim() ||
      file.name ||
      "Uploaded Document";

    setDocumentError("");
    setDocumentMessage("");
    setUploadingDocumentId(uploadKey);

    try {
      await uploadTransactionDocument({
        documentType,
        file,
        transactionId: transaction.id,
      });
      setDocumentMessage("Document uploaded.");
      setManualDocumentNames((currentNames) => ({
        ...currentNames,
        [transaction.id]: "",
      }));
    } catch (uploadError) {
      setDocumentError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload document.",
      );
    } finally {
      setUploadingDocumentId("");
    }
  }

  async function handleGlobalManualUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!globalTransactionId) {
      setDocumentError("Choose a transaction before uploading.");
      return;
    }

    const documentType =
      globalDocumentName.trim() || file.name || "Uploaded Document";

    setDocumentError("");
    setDocumentMessage("");
    setUploadingDocumentId("global-manual");

    try {
      await uploadTransactionDocument({
        documentType,
        file,
        transactionId: globalTransactionId,
      });
      setDocumentMessage("Document uploaded.");
      setGlobalDocumentName("");
    } catch (uploadError) {
      setDocumentError(
        uploadError instanceof Error
          ? uploadError.message
          : "Unable to upload document.",
      );
    } finally {
      setUploadingDocumentId("");
    }
  }

  async function handleRenameDocument(document: TransactionDocument) {
    const documentName = (renameValues[document.id] ?? document.documentName).trim();

    setDocumentError("");
    setDocumentMessage("");

    try {
      await renameTransactionDocument({
        documentId: document.id,
        documentName,
        transactionId: document.transactionId,
      });
      setDocumentMessage("Document renamed.");
      setRenamingDocumentIds((currentIds) =>
        currentIds.filter((id) => id !== document.id),
      );
    } catch (renameError) {
      setDocumentError(
        renameError instanceof Error
          ? renameError.message
          : "Unable to rename document.",
      );
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Document readiness</p>
          <h2>Documents</h2>
          <p>Review required, uploaded, and missing transaction documents.</p>
          {loading ? <p className="dashboard__status">Loading DoorScale data...</p> : null}
          {error ? <p className="dashboard__error">{error}</p> : null}
          {documentMessage ? (
            <p className="dashboard__success">{documentMessage}</p>
          ) : null}
          {documentError ? (
            <p className="dashboard__error">{documentError}</p>
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>Add a document to any transaction.</CardDescription>
          </div>
          <Upload size={20} />
        </CardHeader>
        <CardContent>
          <div className="manual-document-upload manual-document-upload--wide">
            <select
              aria-label="Choose transaction"
              onChange={(event) => setGlobalTransactionId(event.target.value)}
              value={globalTransactionId}
            >
              <option value="">Choose transaction</option>
              {transactions.map((transaction) => (
                <option key={transaction.id} value={transaction.id}>
                  {transaction.clientName} - {transaction.propertyAddress}
                </option>
              ))}
            </select>
            <input
              aria-label="Document name"
              onChange={(event) => setGlobalDocumentName(event.target.value)}
              placeholder="Document name or type"
              value={globalDocumentName}
            />
            <label className="button button--secondary document-upload-label">
              <Upload size={16} />
              {uploadingDocumentId === "global-manual"
                ? "Uploading..."
                : "Upload Document"}
              <input
                disabled={uploadingDocumentId === "global-manual"}
                onChange={(event) => void handleGlobalManualUpload(event)}
                type="file"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <section className="entity-grid documents-entity-grid" aria-label="Transaction documents">
        {transactions.map((transaction) => {
          const transactionDocuments = documents.filter(
            (document) => String(document.transactionId) === String(transaction.id),
          );
          const isPreparing = preparingTransactionIds.includes(transaction.id);

          return (
            <Card key={transaction.id}>
              <CardHeader>
                <div>
                  <CardTitle>{transaction.clientName}</CardTitle>
                  <CardDescription>
                    {transaction.propertyAddress} · {transaction.type} · {transaction.stage}
                  </CardDescription>
                </div>
                <FileText size={20} />
              </CardHeader>
              <CardContent>
                <div className="document-page-list">
                  {transactionDocuments.map((document) => (
                    <div className="document-page-row" key={document.id}>
                      <div className="document-page-row__main">
                        {renamingDocumentIds.includes(document.id) ? (
                          <input
                            aria-label="Rename document"
                            onChange={(event) =>
                              setRenameValues((currentValues) => ({
                                ...currentValues,
                                [document.id]: event.target.value,
                              }))
                            }
                            value={
                              renameValues[document.id] ??
                              (document.documentName || document.documentType)
                            }
                          />
                        ) : (
                          <span>{document.documentName || document.documentType}</span>
                        )}
                        <small>
                          {document.fileName || "No file uploaded"} ·{" "}
                          {formatUploadDate(document.uploadedAt)}
                        </small>
                      </div>
                      <Badge variant={statusVariant(document.status)}>
                        {statusLabel(document.status)}
                      </Badge>
                      <select
                        aria-label={`Status for ${document.documentName || document.documentType}`}
                        onChange={(event) =>
                          void handleStatusChange(
                            document,
                            event.target.value as DocumentStatus,
                          )
                        }
                        value={document.status as DocumentStatus}
                      >
                        {DOCUMENT_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      <label className="button button--secondary document-upload-label">
                        <Upload size={16} />
                        {uploadingDocumentId === document.id ? "Uploading..." : "Upload"}
                        <input
                          disabled={uploadingDocumentId === document.id}
                          onChange={(event) => void handleUpload(event, document)}
                          type="file"
                        />
                      </label>
                      {renamingDocumentIds.includes(document.id) ? (
                        <>
                          <button
                            className="button button--ghost"
                            onClick={() => void handleRenameDocument(document)}
                            type="button"
                          >
                            Save Name
                          </button>
                          <button
                            className="button button--ghost"
                            onClick={() =>
                              setRenamingDocumentIds((currentIds) =>
                                currentIds.filter((id) => id !== document.id),
                              )
                            }
                            type="button"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="button button--ghost"
                          onClick={() => {
                            setRenameValues((currentValues) => ({
                              ...currentValues,
                              [document.id]:
                                document.documentName || document.documentType,
                            }));
                            setRenamingDocumentIds((currentIds) => [
                              ...currentIds,
                              document.id,
                            ]);
                          }}
                          type="button"
                        >
                          Rename
                        </button>
                      )}
                    </div>
                  ))}
                  {!transactionDocuments.length ? (
                    <div className="empty-state">
                      <p>
                        {isPreparing
                          ? "Preparing document checklist..."
                          : "No document checklist templates found for this transaction yet."}
                      </p>
                      {!isPreparing ? (
                        <div className="manual-document-upload">
                          <input
                            aria-label="Document name"
                            onChange={(event) =>
                              setManualDocumentNames((currentNames) => ({
                                ...currentNames,
                                [transaction.id]: event.target.value,
                              }))
                            }
                            placeholder="Document name or type"
                            value={manualDocumentNames[transaction.id] ?? ""}
                          />
                          <label className="button button--secondary document-upload-label">
                            <Upload size={16} />
                            {uploadingDocumentId === `manual-${transaction.id}`
                              ? "Uploading..."
                              : "Upload Document"}
                            <input
                              disabled={uploadingDocumentId === `manual-${transaction.id}`}
                              onChange={(event) =>
                                void handleManualUpload(event, transaction)
                              }
                              type="file"
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <Link
                  className="button button--secondary"
                  to={withActiveLocationPath(`/transactions/${transaction.id}`)}
                >
                  <FileCheck2 size={16} />
                  Open Checklist
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
