import { differenceInCalendarDays, format } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  CheckSquare,
  ExternalLink,
  FileText,
  Pencil,
  StickyNote,
  Upload,
} from "lucide-react";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { EditTransactionModal } from "@/components/EditTransactionModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskItem } from "@/components/TaskItem";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TRANSACTION_STAGES,
  type DocumentStatus,
  type TransactionStage,
  useCRMData,
} from "@/hooks/use-crm-data";
import { formatCurrency } from "@/lib/utils";

const documentRows = [
  "Executed Contract",
  "Flood Disclosure",
  "Inspection Report",
  "Closing Disclosure",
  "Commission Documents",
];

const initialTaskForm = {
  assignedTo: "",
  dueDate: "",
  dueTime: "",
  title: "",
};

function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  if (!dateValue || Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return format(date, "MMM d, yyyy");
}

function getDaysUntilClosing(closingDate: string) {
  const date = new Date(closingDate);

  if (!closingDate || Number.isNaN(date.getTime())) {
    return "Not set";
  }

  const days = differenceInCalendarDays(date, new Date());

  if (days === 0) return "Closing today";
  if (days < 0) return `${Math.abs(days)} days past closing`;

  return `${days} days`;
}

function stageVariant(stage: string) {
  if (stage === "Clear to Close") return "success";
  if (stage === "Inspections" || stage === "Appraisal") return "warning";
  if (stage === "Closed") return "muted";
  if (stage === "Dead") return "danger";
  return "default";
}

function getSyncLabel(syncStatus = "synced") {
  if (syncStatus === "pending_sync") return "Pending Sync";
  if (syncStatus === "sync_error") return "Sync Error";
  return "Synced";
}

function getSyncVariant(syncStatus = "synced") {
  if (syncStatus === "pending_sync") return "warning";
  if (syncStatus === "sync_error") return "danger";
  return "success";
}

function documentStatusVariant(status: string) {
  const normalizedStatus = normalizeDocumentStatus(status);

  if (normalizedStatus === "uploaded" || normalizedStatus === "approved") {
    return "success";
  }
  if (normalizedStatus === "rejected" || normalizedStatus === "missing") {
    return "danger";
  }
  if (normalizedStatus === "pending review") return "default";
  return "warning";
}

function normalizeDocumentStatus(status = "Needed") {
  const normalizedStatus = status.trim().toLowerCase().replace(/_/g, " ");

  if (normalizedStatus === "uploaded") return "uploaded";
  if (normalizedStatus === "pending review") return "pending review";
  if (normalizedStatus === "approved") return "approved";
  if (normalizedStatus === "rejected") return "rejected";
  if (normalizedStatus === "missing") return "missing";
  return "needed";
}

function formatDocumentStatus(status = "Needed") {
  const normalizedStatus = normalizeDocumentStatus(status);

  if (normalizedStatus === "uploaded") return "Uploaded";
  if (normalizedStatus === "pending review") return "Pending Review";
  if (normalizedStatus === "approved") return "Approved";
  if (normalizedStatus === "rejected") return "Rejected";
  if (normalizedStatus === "missing") return "Missing";
  return "Needed";
}

function buildContactLink(locationId?: string, contactId?: string) {
  if (!locationId || !contactId) return "";

  return `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;
}

function buildOpportunityLink(locationId?: string, opportunityId?: string) {
  if (!locationId || !opportunityId) return "";

  return `https://app.gohighlevel.com/v2/location/${locationId}/opportunities/detail/${opportunityId}`;
}

export default function TransactionDetail() {
  const { id } = useParams();
  const data = useCRMData();
  const [stageMessage, setStageMessage] = useState("");
  const [stageError, setStageError] = useState("");
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [isTaskSubmitting, setIsTaskSubmitting] = useState(false);
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [taskError, setTaskError] = useState("");
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const [detailMessage, setDetailMessage] = useState("");
  const [detailError, setDetailError] = useState("");
  const [uploadingDocumentId, setUploadingDocumentId] = useState("");
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const transaction = data.opportunities.find(
    (opp) => String(opp.id) === String(id),
  );

  if (data.loading) {
    return (
      <div className="dashboard">
        <p className="dashboard__status">Loading DoorScale data...</p>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="dashboard">
        <p className="dashboard__error">{data.error}</p>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="dashboard">
        <Link className="back-link" to="/transactions">
          <ArrowLeft size={16} />
          Transactions
        </Link>
        <Card>
          <CardContent>
            <div className="empty-state">Transaction not found.</div>
            <div className="debug-panel">
              <strong>Debug</strong>
              <span>URL id: {id ?? "missing"}</span>
              <span>
                Available opportunity ids:{" "}
                {data.opportunities.length
                  ? data.opportunities.map((opp) => String(opp.id)).join(", ")
                  : "none"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fields = transaction.customFields;
  const transactionId = String(transaction.id);
  const transactionType = fields.transactionType;
  const currentStage = transaction.stage;
  const contactLink = buildContactLink(
    transaction.ghlLocationId,
    transaction.ghlContactId || transaction.contactId,
  );
  const opportunityLink = buildOpportunityLink(
    transaction.ghlLocationId,
    transaction.ghlOpportunityId,
  );
  const relatedTasks = data.tasks.filter(
    (task) =>
      String(task.relatedOpportunityId) === transactionId ||
      String(task.transactionId) === transactionId,
  );
  const documentsByType = new Map(
    data.documents
      .filter((document) => document.transactionId === transactionId)
      .map((document) => [document.documentType, document]),
  );
  const documentTrackingRows = documentRows.map((documentType) => ({
    documentType,
    document: documentsByType.get(documentType),
  }));

  async function handleStageChange(stage: TransactionStage) {
    setStageMessage("");
    setStageError("");

    if (stage === currentStage) return;

    setIsUpdatingStage(true);

    try {
      const message = await data.updateTransactionStage({
        transactionId,
        transactionType,
        stage,
      });
      setStageMessage(message || "Stage updated and checklist tasks generated.");
    } catch (error) {
      setStageError(
        error instanceof Error ? error.message : "Unable to update stage.",
      );
    } finally {
      setIsUpdatingStage(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskError("");
    setDetailMessage("");

    if (!taskForm.title.trim()) {
      setTaskError("Task title is required.");
      return;
    }

    setIsTaskSubmitting(true);

    try {
      await data.createTask({
        assignedTo: taskForm.assignedTo.trim(),
        dueDate: taskForm.dueDate,
        dueTime: taskForm.dueTime,
        title: taskForm.title.trim(),
        transactionId,
      });
      setTaskForm(initialTaskForm);
      setIsTaskFormOpen(false);
      setDetailMessage("Task saved.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save task.";
      if (message.includes("DoorScale sync will retry later")) {
        setDetailMessage(message);
        setTaskForm(initialTaskForm);
        setIsTaskFormOpen(false);
      } else {
        setTaskError(message);
      }
    } finally {
      setIsTaskSubmitting(false);
    }
  }

  async function handleRetryTransactionSync() {
    setDetailMessage("");
    setDetailError("");
    setIsRetryingSync(true);

    try {
      const message = await data.retryTransactionSync(transactionId);
      setDetailMessage(message || "Transaction synced.");
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Unable to retry sync.",
      );
    } finally {
      setIsRetryingSync(false);
    }
  }

  async function handleDocumentStatusChange(documentId: string, status: string) {
    setDetailMessage("");
    setDetailError("");

    try {
      await data.updateDocumentStatus({
        documentId,
        status: status as DocumentStatus,
      });
      setDetailMessage("Document status updated.");
    } catch (error) {
      setDetailError(
        error instanceof Error
          ? error.message
          : "Unable to update document status.",
      );
    }
  }

  async function handleDocumentUpload(
    documentId: string,
    documentType: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setDetailMessage("");
    setDetailError("");
    setUploadingDocumentId(documentId);

    try {
      await data.uploadTransactionDocument({
        documentId,
        documentType,
        file,
        transactionId,
      });
      setDetailMessage("Document uploaded.");
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Unable to upload document.",
      );
    } finally {
      setUploadingDocumentId("");
    }
  }

  const transactionNeedsSync = ["pending_sync", "sync_error"].includes(
    (transaction.syncStatus || "synced").toLowerCase(),
  );

  return (
    <div className="dashboard transaction-workspace">
      <header className="workspace-header">
        <div>
          <Link className="back-link" to="/transactions">
            <ArrowLeft size={16} />
            Back to Transactions
          </Link>
          <p className="dashboard__eyebrow">Transaction workspace</p>
          <h2>{fields.propertyAddress || transaction.name}</h2>
          <div className="workspace-header__meta">
            <span>{fields.transactionType || "Transaction type not set"}</span>
            <span>{fields.assignedAgent || "Agent not assigned"}</span>
            <span>{transaction.status || "Status not set"}</span>
          </div>
        </div>
        <Badge variant={stageVariant(transaction.stage)}>
          {transaction.stage as TransactionStage}
        </Badge>
        <Badge variant={getSyncVariant(transaction.syncStatus)}>
          {getSyncLabel(transaction.syncStatus)}
        </Badge>
      </header>

      <section className="workspace-actions" aria-label="Transaction actions">
        <Button
          onClick={() => {
            setDetailMessage("");
            setDetailError("");
            setIsEditOpen(true);
          }}
        >
          <Pencil size={17} />
          Edit Transaction
        </Button>
        <Button
          onClick={() => {
            setTaskError("");
            setIsTaskFormOpen((current) => !current);
          }}
        >
          <CheckSquare size={17} />
          Add Task
        </Button>
        {contactLink ? (
          <a
            className="button button--secondary"
            href={contactLink}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={17} />
            Open Contact
          </a>
        ) : (
          <Button disabled variant="secondary">
            <ExternalLink size={17} />
            Open Contact
          </Button>
        )}
        {opportunityLink ? (
          <a
            className="button button--secondary"
            href={opportunityLink}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={17} />
            Open Opportunity
          </a>
        ) : (
          <Button disabled variant="secondary">
            <ExternalLink size={17} />
            Open Opportunity
          </Button>
        )}
        {transactionNeedsSync ? (
          <Button
            disabled={isRetryingSync}
            onClick={() => void handleRetryTransactionSync()}
            variant="secondary"
          >
            Retry Sync
          </Button>
        ) : null}
      </section>

      {detailMessage ? (
        <p className="dashboard__success">{detailMessage}</p>
      ) : null}
      {detailError ? <p className="dashboard__error">{detailError}</p> : null}

      {isTaskFormOpen ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Add Task</CardTitle>
              <CardDescription>Create a task for this transaction.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form className="task-create-form" onSubmit={handleCreateTask}>
              <label>
                <span>Task title</span>
                <input
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  value={taskForm.title}
                />
              </label>
              <label>
                <span>Due date</span>
                <input
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      dueDate: event.target.value,
                    }))
                  }
                  type="date"
                  value={taskForm.dueDate}
                />
              </label>
              <label>
                <span>Due time</span>
                <input
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      dueTime: event.target.value,
                    }))
                  }
                  type="time"
                  value={taskForm.dueTime}
                />
              </label>
              <label>
                <span>Assigned to</span>
                <input
                  onChange={(event) =>
                    setTaskForm((current) => ({
                      ...current,
                      assignedTo: event.target.value,
                    }))
                  }
                  value={taskForm.assignedTo}
                />
              </label>
              <div className="modal__actions">
                <Button disabled={isTaskSubmitting} type="submit">
                  Save Task
                </Button>
                <Button
                  disabled={isTaskSubmitting}
                  onClick={() => setIsTaskFormOpen(false)}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
              {taskError ? <p className="form-error">{taskError}</p> : null}
            </form>
          </CardContent>
        </Card>
      ) : null}

      <EditTransactionModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSave={async (input) => {
          setDetailMessage("");
          setDetailError("");
          try {
            const message = await data.updateTransactionDetails(input);
            setDetailMessage(message || "Transaction details updated.");
          } catch (error) {
            setDetailError(
              error instanceof Error
                ? error.message
                : "Unable to update transaction.",
            );
            throw error;
          }
        }}
        transaction={transaction}
      />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Update Stage</CardTitle>
            <CardDescription>
              Moving stages generates any missing checklist tasks for this
              transaction type.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <label className="stage-update-control">
            <span>Current Stage</span>
            <select
              disabled={isUpdatingStage}
              onChange={(event) =>
                void handleStageChange(event.target.value as TransactionStage)
              }
              value={currentStage}
            >
              {TRANSACTION_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
          {stageMessage ? (
            <p className="dashboard__success">{stageMessage}</p>
          ) : null}
          {stageError ? <p className="dashboard__error">{stageError}</p> : null}
        </CardContent>
      </Card>

      <section className="summary-grid" aria-label="Transaction summary">
        <Card>
          <CardHeader>
            <CardDescription>Transaction Type</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{fields.transactionType || "Not set"}</strong>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Assigned Agent</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{fields.assignedAgent || "Not assigned"}</strong>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Buyer Name</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{fields.buyerName || "Not set"}</strong>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Seller Name</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{fields.sellerName || "Not set"}</strong>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Closing Date</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{formatDate(fields.closingDate)}</strong>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Inspection Date</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{formatDate(fields.inspectionDeadline)}</strong>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Commission</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{formatCurrency(transaction.value)}</strong>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Current Stage</CardDescription>
          </CardHeader>
          <CardContent>
            <strong>{transaction.stage || "Not set"}</strong>
          </CardContent>
        </Card>
      </section>

      <section className="workspace-grid">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Contact Info</CardTitle>
              <CardDescription>Primary contact for this transaction.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="detail-list">
              <div>
                <dt>Name</dt>
                <dd>{fields.contactName || "Not set"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{fields.contactEmail || "Not set"}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{fields.contactPhone || "Not set"}</dd>
              </div>
              <div>
                <dt>Property Address</dt>
                <dd>{fields.propertyAddress || transaction.name || "Not set"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Important Dates</CardTitle>
              <CardDescription>Inspection and closing timeline.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="detail-list">
              <div>
                <dt>Inspection Date</dt>
                <dd>{formatDate(fields.inspectionDeadline)}</dd>
              </div>
              <div>
                <dt>Closing Date</dt>
                <dd>
                  <CalendarClock size={15} />
                  {formatDate(fields.closingDate)}
                </dd>
              </div>
              <div>
                <dt>Days Until Closing</dt>
                <dd>{getDaysUntilClosing(fields.closingDate)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Tasks / Checklist</CardTitle>
              <CardDescription>Tasks connected to this transaction.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {relatedTasks.length ? (
              <div className="task-list">
                {relatedTasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    onComplete={data.markTaskCompleted}
                    onRetrySync={data.retryTaskSync}
                    onUpdateDueDateTime={data.updateTaskDueDateTime}
                    task={task}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No tasks connected to this transaction yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                Track uploaded documents for this transaction.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="documents-helper">
              Uploaded files stay connected to this DoorScale transaction and
              contact.
            </p>
            <div className="placeholder-list">
              {documentTrackingRows.map(({ document, documentType }) => (
                <div className="placeholder-row" key={documentType}>
                  <FileText size={16} />
                  <div>
                    <span>{document?.documentName || documentType}</span>
                    <small>
                      {document?.fileName ||
                        (document?.uploadedAt
                          ? `Uploaded ${formatDate(document.uploadedAt)}`
                          : "No upload date")}
                    </small>
                  </div>
                  <Badge
                    variant={documentStatusVariant(
                      document?.status || "Needed",
                    )}
                  >
                    {formatDocumentStatus(document?.status)}
                  </Badge>
                  <select
                    aria-label={`Update ${documentType} status`}
                    disabled={!document}
                    onChange={(event) =>
                      document
                        ? void handleDocumentStatusChange(
                            document.id,
                            event.target.value,
                          )
                        : undefined
                    }
                    value={normalizeDocumentStatus(document?.status)}
                  >
                    <option value="needed">Needed</option>
                    <option value="uploaded">Uploaded</option>
                    <option value="pending review">Pending Review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <div className="document-actions">
                    {document?.fileUrl ? (
                      <a
                        className="button button--ghost"
                        href={document.fileUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View File
                      </a>
                    ) : null}
                    <input
                      aria-label={`Upload ${documentType}`}
                      className="visually-hidden"
                      disabled={!document || uploadingDocumentId === document?.id}
                      onChange={(event) =>
                        document
                          ? void handleDocumentUpload(
                              document.id,
                              document.documentType || documentType,
                              event,
                            )
                          : undefined
                      }
                      ref={(element) => {
                        if (document) fileInputRefs.current[document.id] = element;
                      }}
                      type="file"
                    />
                    <Button
                      disabled={!document || uploadingDocumentId === document?.id}
                      onClick={() =>
                        document
                          ? fileInputRefs.current[document.id]?.click()
                          : undefined
                      }
                      type="button"
                      variant="secondary"
                    >
                      <Upload size={15} />
                      {document?.fileName ? "Replace File" : "Upload"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Notes</CardTitle>
              <CardDescription>Transaction notes will appear here.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="notes-placeholder">
              <StickyNote size={20} />
              Transaction notes will appear here.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
