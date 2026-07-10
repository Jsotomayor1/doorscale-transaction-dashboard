import { format, isBefore, startOfTomorrow } from "date-fns";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  CircleDollarSign,
  ExternalLink,
  Eye,
  FileText,
  Home,
  ListChecks,
  Pencil,
  Plus,
  RefreshCw,
  Upload,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewTransactionModal } from "@/components/NewTransactionModal";
import {
  TRANSACTION_STAGES,
  type DashboardTask,
  type DocumentStatus,
  type Opportunity,
  type TransactionDocument,
  type TransactionStage,
  useCRMData,
} from "@/hooks/use-crm-data";
import {
  getUrlActiveLocationId,
  setStoredActiveLocationId,
} from "@/lib/active-location";
import { formatCurrency } from "@/lib/utils";
import logoUrl from "@/assets/doorscale-tms-logo.png";

type MobileTab = "overview" | "transactions" | "tasks" | "documents" | "commissions";

function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  if (!dateValue || Number.isNaN(date.getTime())) return "Not set";

  return format(date, "MMM d");
}

function isOpenTask(task: DashboardTask) {
  return !["completed", "done"].includes(task.status.toLowerCase());
}

function isUpcoming(dateValue: string) {
  const date = new Date(dateValue);

  return dateValue && !Number.isNaN(date.getTime()) && !isBefore(date, new Date());
}

function documentSummary(documents: TransactionDocument[]) {
  const needed = documents.filter((document) => document.status === "needed").length;
  const missing = documents.filter((document) => document.status === "missing").length;
  const uploaded = documents.filter((document) =>
    ["uploaded", "approved", "completed"].includes(document.status),
  ).length;

  return `${uploaded} uploaded · ${needed} needed · ${missing} missing`;
}

function transactionTitle(transaction: Opportunity) {
  return (
    transaction.customFields.contactName ||
    transaction.customFields.propertyAddress ||
    transaction.name ||
    "Transaction"
  );
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function buildDocumentViewLink(
  documentId: string,
  transactionId: string,
  locationId: string,
) {
  const params = new URLSearchParams({
    action: "view",
    document_id: documentId,
    transaction_id: transactionId,
    location_id: locationId,
  });

  return `/api/documents?${params.toString()}`;
}

function buildContactLink(locationId?: string, contactId?: string) {
  if (!locationId || !contactId) return "";

  return `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${contactId}`;
}

function buildOpportunityLink(locationId?: string, opportunityId?: string) {
  if (!locationId || !opportunityId) return "";

  return `https://app.gohighlevel.com/v2/location/${locationId}/opportunities/detail/${opportunityId}`;
}

function needsSync(transaction: Opportunity) {
  return (
    (transaction.syncStatus || "synced").toLowerCase() !== "synced" ||
    !transaction.ghlContactId ||
    !transaction.ghlOpportunityId ||
    Boolean(transaction.lastSyncError)
  );
}

const emptyTaskForm = {
  assignedTo: "",
  dueDate: "",
  dueTime: "",
  title: "",
};

const mobileTabs: Array<{
  icon: typeof Home;
  id: MobileTab;
  label: string;
}> = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "transactions", label: "Transactions", icon: Workflow },
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "commissions", label: "Commissions", icon: CircleDollarSign },
];

function MobileBottomNav({
  activeTab,
  onChange,
}: {
  activeTab: MobileTab;
  onChange: (tab: MobileTab) => void;
}) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile dashboard navigation">
      {mobileTabs.map(({ icon: Icon, id, label }) => (
        <button
          className={activeTab === id ? "is-active" : ""}
          key={id}
          onClick={() => onChange(id)}
          type="button"
        >
          <Icon size={19} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export default function MobileDashboard() {
  const urlLocationId = getUrlActiveLocationId();

  if (!urlLocationId) {
    return (
      <main className="mobile-shell">
        <section className="mobile-empty">
          <h1>DoorScale TMS</h1>
          <p>Open this dashboard from your DoorScale account.</p>
        </section>
      </main>
    );
  }

  return <MobileDashboardContent locationId={urlLocationId} />;
}

function MobileDashboardContent({ locationId }: { locationId: string }) {
  const data = useCRMData();
  const [selectedTransactionId, setSelectedTransactionId] = useState("");
  const [mobileTab, setMobileTab] = useState<MobileTab>("overview");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [editingTaskId, setEditingTaskId] = useState("");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [editingDueTime, setEditingDueTime] = useState("");
  const [savingStage, setSavingStage] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState("");
  const [retryingTransactionId, setRetryingTransactionId] = useState("");
  const [uploadingDocumentId, setUploadingDocumentId] = useState("");
  const [manualDocumentName, setManualDocumentName] = useState("");
  const [globalManualDocumentName, setGlobalManualDocumentName] = useState("");
  const [globalUploadTransactionId, setGlobalUploadTransactionId] = useState("");
  const [renamingDocumentId, setRenamingDocumentId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [preparedDocumentKeys, setPreparedDocumentKeys] = useState<string[]>([]);

  useEffect(() => {
    setStoredActiveLocationId(locationId);
  }, [locationId]);

  const activeTransactions = data.opportunities.filter(
    (transaction) => !["Closed", "Dead"].includes(transaction.stage),
  );
  const selectedTransaction = data.opportunities.find(
    (transaction) => String(transaction.id) === String(selectedTransactionId),
  );
  const selectedDocuments = selectedTransaction
    ? data.documents.filter(
        (document) =>
          String(document.transactionId) === String(selectedTransaction.id) &&
          document.locationId === locationId,
      )
    : [];
  const selectedTasks = selectedTransaction
    ? data.tasks.filter(
        (task) => String(task.transactionId) === String(selectedTransaction.id),
      )
    : [];
  const todayTasks = data.openTasks.filter((task) =>
    isBefore(new Date(task.dueDateTime || task.dueDate), startOfTomorrow()),
  );
  const upcomingClosings = useMemo(
    () =>
      data.transactions
        .filter((transaction) => isUpcoming(transaction.closeDate))
        .sort(
          (first, second) =>
            new Date(first.closeDate).getTime() - new Date(second.closeDate).getTime(),
        )
        .slice(0, 5),
    [data.transactions],
  );
  const recentTransactions = data.opportunities.slice(0, 5);
  const documentNeededCount = data.documents.filter(
    (document) => document.status === "needed",
  ).length;
  const documentUploadedCount = data.documents.filter((document) =>
    ["uploaded", "approved", "completed"].includes(document.status),
  ).length;
  const totalCommission = activeTransactions.reduce(
    (total, transaction) => total + transaction.value,
    0,
  );

  function renderTransactionCards(transactions: Opportunity[]) {
    return transactions.map((transaction) => {
      const transactionTasks = data.tasks.filter(
        (task) =>
          String(task.transactionId) === String(transaction.id) && isOpenTask(task),
      );
      const transactionDocuments = data.documents.filter(
        (document) => String(document.transactionId) === String(transaction.id),
      );

      return (
        <article className="mobile-transaction-card" key={transaction.id}>
          <div>
            <h3>{transactionTitle(transaction)}</h3>
            <p>{transaction.customFields.propertyAddress || "No property set"}</p>
          </div>
          <div className="mobile-card__meta">
            <Badge variant="default">{transaction.stage}</Badge>
            <span>{formatDate(transaction.customFields.closingDate)}</span>
          </div>
          <p>{transactionTasks.length} open tasks</p>
          <p>{documentSummary(transactionDocuments)}</p>
          <button
            className="mobile-primary-button"
            onClick={() => setSelectedTransactionId(String(transaction.id))}
            type="button"
          >
            View Transaction
          </button>
          {needsSync(transaction) ? (
            <Button
              disabled={retryingTransactionId === String(transaction.id)}
              onClick={() => void handleRetrySync(String(transaction.id))}
              variant="secondary"
            >
              <RefreshCw size={16} />
              {retryingTransactionId === String(transaction.id)
                ? "Syncing..."
                : "Retry Sync"}
            </Button>
          ) : null}
        </article>
      );
    });
  }

  useEffect(() => {
    if (!selectedTransaction) return;
    if (selectedDocuments.length > 0) return;

    const preparationKey = [
      selectedTransaction.id,
      selectedTransaction.stage,
      selectedTransaction.customFields.transactionType,
    ].join(":");

    if (preparedDocumentKeys.includes(preparationKey)) return;

    setPreparedDocumentKeys((currentKeys) => [...currentKeys, preparationKey]);

    void data.ensureTransactionDocuments({
      stage: selectedTransaction.stage,
      transactionId: String(selectedTransaction.id),
      transactionType: selectedTransaction.customFields.transactionType,
    });
  }, [
    data.ensureTransactionDocuments,
    preparedDocumentKeys,
    selectedDocuments.length,
    selectedTransaction,
  ]);

  async function handleStageChange(stage: TransactionStage) {
    if (!selectedTransaction) return;

    setMessage("");
    setErrorMessage("");
    setSavingStage(true);

    try {
      const updateMessage = await data.updateTransactionStage({
        stage,
        transactionId: String(selectedTransaction.id),
        transactionType: selectedTransaction.customFields.transactionType,
      });
      setPreparedDocumentKeys((currentKeys) =>
        currentKeys.filter((key) => !key.startsWith(`${selectedTransaction.id}:`)),
      );
      setMessage(updateMessage || "Stage updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update stage.");
    } finally {
      setSavingStage(false);
    }
  }

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTransaction || !taskForm.title.trim()) return;

    setMessage("");
    setErrorMessage("");
    setSavingTask(true);

    try {
      const taskMessage = await data.createTask({
        assignedTo: taskForm.assignedTo,
        description: "",
        dueDate: taskForm.dueDate,
        dueTime: taskForm.dueTime,
        status: "pending",
        title: taskForm.title,
        transactionId: String(selectedTransaction.id),
      });
      setTaskForm(emptyTaskForm);
      setMessage(taskMessage || "Task added.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to save task.");
    } finally {
      setSavingTask(false);
    }
  }

  async function handleDocumentUpload(
    document: TransactionDocument,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    const transactionId = String(document.transactionId || selectedTransaction?.id || "");

    if (!transactionId || !file) return;

    setMessage("");
    setErrorMessage("");
    setUploadingDocumentId(document.id);

    try {
      const uploadMessage = await data.uploadTransactionDocument({
        documentId: document.id,
        documentType: document.documentType,
        file,
        transactionId,
      });
      setMessage(uploadMessage.message || "Document uploaded.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to upload document.",
      );
    } finally {
      setUploadingDocumentId("");
    }
  }

  async function handleDocumentStatus(
    documentId: string,
    status: string,
    transactionId = selectedTransaction ? String(selectedTransaction.id) : "",
  ) {
    if (!transactionId) return;

    setMessage("");
    setErrorMessage("");

    try {
      const statusMessage = await data.updateDocumentStatus({
        documentId,
        status: status as DocumentStatus,
        transactionId,
      });
      setMessage(statusMessage.message || "Document status updated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update document.",
      );
    }
  }

  async function handleTaskDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTaskId) return;

    setMessage("");
    setErrorMessage("");

    try {
      await data.updateTaskDueDateTime({
        dueDate: editingDueDate,
        dueTime: editingDueTime,
        taskId: editingTaskId,
      });
      setEditingTaskId("");
      setMessage("Task updated.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update task.");
    }
  }

  async function handleCompleteTask(taskId: string) {
    setMessage("");
    setErrorMessage("");
    setCompletingTaskId(taskId);

    try {
      await data.markTaskCompleted(taskId);
      setMessage("Task completed.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to complete task.",
      );
    } finally {
      setCompletingTaskId("");
    }
  }

  async function handleRetrySync(transactionId: string) {
    setMessage("");
    setErrorMessage("");
    setRetryingTransactionId(transactionId);

    try {
      const retryMessage = await data.retryTransactionSync(transactionId);
      setMessage(retryMessage || "Transaction synced.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to retry sync.");
    } finally {
      setRetryingTransactionId("");
    }
  }

  async function handleManualDocumentUpload(
    event: ChangeEvent<HTMLInputElement>,
    transaction: Opportunity,
    documentName: string,
    resetDocumentName: () => void,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setMessage("");
    setErrorMessage("");
    setUploadingDocumentId(`manual-${transaction.id}`);

    try {
      const uploadMessage = await data.uploadTransactionDocument({
        documentType: documentName.trim() || file.name || "Uploaded Document",
        file,
        transactionId: String(transaction.id),
      });
      resetDocumentName();
      setMessage(uploadMessage.message || "Document uploaded.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to upload document.",
      );
    } finally {
      setUploadingDocumentId("");
    }
  }

  async function handleRenameDocument(document: TransactionDocument) {
    const nextName = renameValue.trim();
    const transactionId = String(document.transactionId || selectedTransaction?.id || "");

    if (!transactionId || !nextName) return;

    setMessage("");
    setErrorMessage("");

    try {
      const renameMessage = await data.renameTransactionDocument({
        documentId: document.id,
        documentName: nextName,
        transactionId,
      });
      setRenamingDocumentId("");
      setRenameValue("");
      setMessage(renameMessage.message || "Document renamed.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to rename document.",
      );
    }
  }

  if (selectedTransaction) {
    const contactLink = buildContactLink(
      selectedTransaction.ghlLocationId || locationId,
      selectedTransaction.ghlContactId,
    );
    const opportunityLink = buildOpportunityLink(
      selectedTransaction.ghlLocationId || locationId,
      selectedTransaction.ghlOpportunityId,
    );

    return (
      <main className="mobile-shell">
        <header className="mobile-header">
          <button
            className="mobile-icon-button"
            onClick={() => setSelectedTransactionId("")}
            type="button"
          >
            <ChevronLeft size={20} />
          </button>
          <img
            alt="DoorScale Transaction Management System"
            className="mobile-header__logo"
            src={logoUrl}
          />
          <div>
            <h1>{transactionTitle(selectedTransaction)}</h1>
          </div>
        </header>

        {message ? <p className="mobile-success">{message}</p> : null}
        {errorMessage ? <p className="mobile-error">{errorMessage}</p> : null}

        <section className="mobile-card">
          <div className="mobile-card__header">
            <h2>Summary</h2>
            <Badge variant="default">{selectedTransaction.stage}</Badge>
          </div>
          <dl className="mobile-detail-list">
            <div>
              <dt>Property</dt>
              <dd>{selectedTransaction.customFields.propertyAddress || "Not set"}</dd>
            </div>
            <div>
              <dt>Closing</dt>
              <dd>{formatDate(selectedTransaction.customFields.closingDate)}</dd>
            </div>
            <div>
              <dt>Commission</dt>
              <dd>{formatCurrency(selectedTransaction.value)}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{selectedTransaction.customFields.contactEmail || "Not set"}</dd>
            </div>
            <div>
              <dt>Sync</dt>
              <dd>{statusLabel(selectedTransaction.syncStatus || "synced")}</dd>
            </div>
          </dl>
          <div className="mobile-action-grid">
            {contactLink ? (
              <a
                className="mobile-secondary-link"
                href={contactLink}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={16} />
                Open Contact
              </a>
            ) : (
              <span className="mobile-disabled-action">Contact not synced</span>
            )}
            {opportunityLink ? (
              <a
                className="mobile-secondary-link"
                href={opportunityLink}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={16} />
                Open Opportunity
              </a>
            ) : (
              <span className="mobile-disabled-action">Opportunity not synced</span>
            )}
          </div>
          {needsSync(selectedTransaction) ? (
            <Button
              disabled={retryingTransactionId === String(selectedTransaction.id)}
              onClick={() => void handleRetrySync(String(selectedTransaction.id))}
              variant="secondary"
            >
              <RefreshCw size={16} />
              {retryingTransactionId === String(selectedTransaction.id)
                ? "Syncing..."
                : "Retry Sync"}
            </Button>
          ) : null}
          <label className="mobile-field">
            <span>Stage</span>
            <select
              disabled={savingStage}
              onChange={(event) =>
                void handleStageChange(event.target.value as TransactionStage)
              }
              value={selectedTransaction.stage}
            >
              {TRANSACTION_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="mobile-card">
          <h2>Tasks</h2>
          <form className="mobile-task-form" onSubmit={handleAddTask}>
            <input
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Add a task"
              value={taskForm.title}
            />
            <input
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, dueDate: event.target.value }))
              }
              type="date"
              value={taskForm.dueDate}
            />
            <input
              onChange={(event) =>
                setTaskForm((current) => ({ ...current, dueTime: event.target.value }))
              }
              type="time"
              value={taskForm.dueTime}
            />
            <Button disabled={savingTask} type="submit">
              {savingTask ? "Saving..." : "Add Task"}
            </Button>
          </form>
          <div className="mobile-list mobile-scroll-list">
            {selectedTasks.map((task) => (
              <article className="mobile-row" key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  <p>{formatDate(task.dueDateTime || task.dueDate)} · {task.assignedTo || "Unassigned"}</p>
                </div>
                <div className="mobile-row__actions">
                  <Button
                    disabled={!isOpenTask(task) || completingTaskId === task.id}
                    onClick={() => void handleCompleteTask(task.id)}
                    variant="secondary"
                  >
                    <CheckCircle2 size={16} />
                    {completingTaskId === task.id ? "Saving..." : "Done"}
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingTaskId(task.id);
                      setEditingDueDate(task.dueDate);
                      setEditingDueTime("");
                    }}
                    variant="ghost"
                  >
                    Edit
                  </Button>
                </div>
                {editingTaskId === task.id ? (
                  <form className="mobile-task-form" onSubmit={handleTaskDateSubmit}>
                    <input
                      onChange={(event) => setEditingDueDate(event.target.value)}
                      type="date"
                      value={editingDueDate}
                    />
                    <input
                      onChange={(event) => setEditingDueTime(event.target.value)}
                      type="time"
                      value={editingDueTime}
                    />
                    <Button type="submit">Save</Button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section className="mobile-card">
          <h2>Documents</h2>
          <div className="mobile-list mobile-scroll-list">
            {selectedDocuments.length ? (
              selectedDocuments.map((document) => (
                <article className="mobile-document" key={document.id}>
                  <div>
                    {renamingDocumentId === document.id ? (
                      <input
                        aria-label="Document name"
                        className="mobile-text-input"
                        onChange={(event) => setRenameValue(event.target.value)}
                        value={renameValue}
                      />
                    ) : (
                      <h3>{document.documentName || document.documentType}</h3>
                    )}
                    <p>
                      {statusLabel(document.status)}
                      {document.uploadedAt ? ` | Uploaded ${formatDate(document.uploadedAt)}` : ""}
                    </p>
                    {document.fileName ? <p>{document.fileName}</p> : null}
                  </div>
                  <select
                    onChange={(event) =>
                      void handleDocumentStatus(document.id, event.target.value)
                    }
                    value={document.status}
                  >
                    {[
                      "needed",
                      "sent",
                      "viewed",
                      "completed",
                      "uploaded",
                      "pending_review",
                      "approved",
                      "rejected",
                      "missing",
                    ].map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                  <div className="mobile-document-actions">
                    {document.doorScaleFileId ? (
                      <a
                        className="mobile-secondary-link"
                        href={buildDocumentViewLink(
                          document.id,
                          String(selectedTransaction.id),
                          locationId,
                        )}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <Eye size={16} />
                        View File
                      </a>
                    ) : null}
                    {renamingDocumentId === document.id ? (
                      <>
                        <Button
                          onClick={() => void handleRenameDocument(document)}
                          variant="secondary"
                        >
                          Save Name
                        </Button>
                        <Button
                          onClick={() => {
                            setRenamingDocumentId("");
                            setRenameValue("");
                          }}
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => {
                          setRenamingDocumentId(document.id);
                          setRenameValue(document.documentName || document.documentType);
                        }}
                        variant="ghost"
                      >
                        <Pencil size={16} />
                        Rename
                      </Button>
                    )}
                  </div>
                  <label className="mobile-upload-button">
                    <Upload size={16} />
                    {uploadingDocumentId === document.id
                      ? "Uploading..."
                      : document.doorScaleFileId
                        ? "Replace File"
                        : "Upload"}
                    <input
                      disabled={uploadingDocumentId === document.id}
                      onChange={(event) => void handleDocumentUpload(document, event)}
                      type="file"
                    />
                  </label>
                </article>
              ))
            ) : (
              <>
                <p className="mobile-muted">
                  No document checklist templates found for this transaction yet.
                </p>
                <div className="mobile-manual-upload">
                  <input
                    className="mobile-text-input"
                    onChange={(event) => setManualDocumentName(event.target.value)}
                    placeholder="Document name or type"
                    value={manualDocumentName}
                  />
                  <label className="mobile-upload-button">
                    <Upload size={16} />
                    {uploadingDocumentId === `manual-${selectedTransaction.id}`
                      ? "Uploading..."
                      : "Upload Document"}
                    <input
                      disabled={uploadingDocumentId === `manual-${selectedTransaction.id}`}
                      onChange={(event) =>
                        void handleManualDocumentUpload(
                          event,
                          selectedTransaction,
                          manualDocumentName,
                          () => setManualDocumentName(""),
                        )
                      }
                      type="file"
                    />
                  </label>
                </div>
              </>
            )}
          </div>
        </section>
        <MobileBottomNav
          activeTab={mobileTab}
          onChange={(tab) => {
            setSelectedTransactionId("");
            setMobileTab(tab);
          }}
        />
      </main>
    );
  }

  return (
    <main className="mobile-shell">
      <header className="mobile-home-header">
        <div className="mobile-home-header__top">
          <img alt="DoorScale Transaction Management System" src={logoUrl} />
          <button className="mobile-icon-button" type="button" aria-label="Notifications">
            <Bell size={19} />
          </button>
        </div>
        <div className="mobile-home-header__title">
          <div>
            <p>Welcome back</p>
            <h1>{mobileTab === "overview" ? "Overview" : mobileTabs.find((tab) => tab.id === mobileTab)?.label}</h1>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus size={17} />
            New Transaction
          </Button>
        </div>
        {data.loading ? <span>Loading DoorScale data...</span> : null}
        {data.error ? <span className="mobile-error">{data.error}</span> : null}
        {message ? <span className="mobile-success">{message}</span> : null}
        {errorMessage ? <span className="mobile-error">{errorMessage}</span> : null}
      </header>

      {mobileTab === "overview" ? (
        <>
          <section className="mobile-kpi-grid" aria-label="Mobile dashboard stats">
            <article>
              <span>Active Transactions</span>
              <strong>{activeTransactions.length}</strong>
            </article>
            <article>
              <span>Open Tasks</span>
              <strong>{data.openTasks.length}</strong>
            </article>
            <article>
              <span>Projected Commission</span>
              <strong>{formatCurrency(totalCommission)}</strong>
            </article>
            <article>
              <span>Documents Needed</span>
              <strong>{documentNeededCount}</strong>
            </article>
          </section>

          <section className="mobile-card">
            <div className="mobile-card__header">
              <h2>Urgent Tasks</h2>
              <ListChecks size={18} />
            </div>
            <div className="mobile-list">
              {todayTasks.slice(0, 5).map((task) => (
                <article className="mobile-row" key={task.id}>
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.propertyAddress || task.clientName || "Transaction"}</p>
                  </div>
                  <Button
                    disabled={completingTaskId === task.id}
                    onClick={() => void handleCompleteTask(task.id)}
                    variant="secondary"
                  >
                    {completingTaskId === task.id ? "Saving..." : "Done"}
                  </Button>
                </article>
              ))}
              {!todayTasks.length ? <p className="mobile-muted">No urgent tasks today.</p> : null}
            </div>
          </section>

          <section className="mobile-card">
            <h2>Transaction Stages</h2>
            <div className="mobile-stage-grid">
              {TRANSACTION_STAGES.map((stage) => (
                <button
                  key={stage}
                  onClick={() => setMobileTab("transactions")}
                  type="button"
                >
                  <strong>{data.stageCounts[stage]}</strong>
                  <span>{stage}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="mobile-card">
            <h2>Recent Transactions</h2>
            <div className="mobile-list">{renderTransactionCards(recentTransactions)}</div>
          </section>
        </>
      ) : null}

      {mobileTab === "transactions" ? (
        <section className="mobile-card">
          <h2>Active Transactions</h2>
          <div className="mobile-list">{renderTransactionCards(activeTransactions)}</div>
        </section>
      ) : null}

      {mobileTab === "tasks" ? (
        <section className="mobile-card">
          <h2>Tasks</h2>
          <div className="mobile-list">
            {data.tasks.map((task) => (
              <article className="mobile-row" key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  <p>{task.propertyAddress || task.clientName || "Transaction"}</p>
                </div>
                <Button
                  disabled={!isOpenTask(task) || completingTaskId === task.id}
                  onClick={() => void handleCompleteTask(task.id)}
                  variant="secondary"
                >
                  {completingTaskId === task.id ? "Saving..." : "Done"}
                </Button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {mobileTab === "documents" ? (
        <section className="mobile-card">
          <div className="mobile-card__header">
            <h2>Documents</h2>
            <span>{documentUploadedCount} uploaded</span>
          </div>
          <div className="mobile-manual-upload">
            <select
              aria-label="Transaction for upload"
              className="mobile-text-input"
              onChange={(event) => setGlobalUploadTransactionId(event.target.value)}
              value={globalUploadTransactionId}
            >
              <option value="">Select transaction</option>
              {data.opportunities.map((transaction) => (
                <option key={transaction.id} value={String(transaction.id)}>
                  {transactionTitle(transaction)}
                </option>
              ))}
            </select>
            <input
              className="mobile-text-input"
              onChange={(event) => setGlobalManualDocumentName(event.target.value)}
              placeholder="Document name or type"
              value={globalManualDocumentName}
            />
            <label className="mobile-upload-button">
              <Upload size={16} />
              {uploadingDocumentId === "global-manual"
                ? "Uploading..."
                : "Upload Document"}
              <input
                disabled={!globalUploadTransactionId || uploadingDocumentId === "global-manual"}
                onChange={(event) => {
                  const transaction = data.opportunities.find(
                    (currentTransaction) =>
                      String(currentTransaction.id) === String(globalUploadTransactionId),
                  );

                  if (!transaction) {
                    event.target.value = "";
                    setErrorMessage("Select a transaction before uploading.");
                    return;
                  }

                  setUploadingDocumentId("global-manual");
                  void handleManualDocumentUpload(
                    event,
                    transaction,
                    globalManualDocumentName,
                    () => setGlobalManualDocumentName(""),
                  );
                }}
                type="file"
              />
            </label>
          </div>
          <div className="mobile-list">
            {data.documents.map((document) => (
              <article className="mobile-document" key={document.id}>
                <div>
                  {renamingDocumentId === document.id ? (
                    <input
                      aria-label="Document name"
                      className="mobile-text-input"
                      onChange={(event) => setRenameValue(event.target.value)}
                      value={renameValue}
                    />
                  ) : (
                    <h3>{document.documentName || document.documentType}</h3>
                  )}
                  <p>
                    {statusLabel(document.status)}
                    {document.uploadedAt ? ` | Uploaded ${formatDate(document.uploadedAt)}` : ""}
                  </p>
                  {document.fileName ? <p>{document.fileName}</p> : null}
                </div>
                <Badge variant="default">{statusLabel(document.status)}</Badge>
                <select
                  onChange={(event) =>
                    void handleDocumentStatus(
                      document.id,
                      event.target.value,
                      String(document.transactionId),
                    )
                  }
                  value={document.status}
                >
                  {[
                    "needed",
                    "sent",
                    "viewed",
                    "completed",
                    "uploaded",
                    "pending_review",
                    "approved",
                    "rejected",
                    "missing",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
                <div className="mobile-document-actions">
                  {document.doorScaleFileId ? (
                    <a
                      className="mobile-secondary-link"
                      href={buildDocumentViewLink(
                        document.id,
                        String(document.transactionId),
                        locationId,
                      )}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Eye size={16} />
                      View File
                    </a>
                  ) : null}
                  {renamingDocumentId === document.id ? (
                    <>
                      <Button
                        onClick={() => void handleRenameDocument(document)}
                        variant="secondary"
                      >
                        Save Name
                      </Button>
                      <Button
                        onClick={() => {
                          setRenamingDocumentId("");
                          setRenameValue("");
                        }}
                        variant="ghost"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => {
                        setRenamingDocumentId(document.id);
                        setRenameValue(document.documentName || document.documentType);
                      }}
                      variant="ghost"
                    >
                      <Pencil size={16} />
                      Rename
                    </Button>
                  )}
                </div>
                <label className="mobile-upload-button">
                  <Upload size={16} />
                  {uploadingDocumentId === document.id
                    ? "Uploading..."
                    : document.doorScaleFileId
                      ? "Replace File"
                      : "Upload"}
                  <input
                    disabled={uploadingDocumentId === document.id}
                    onChange={(event) => void handleDocumentUpload(document, event)}
                    type="file"
                  />
                </label>
              </article>
            ))}
            {!data.documents.length ? (
              <p className="mobile-muted">No documents uploaded yet.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {mobileTab === "commissions" ? (
        <section className="mobile-card">
          <h2>Commissions</h2>
          <div className="mobile-list">
            {activeTransactions.map((transaction) => (
              <article className="mobile-row" key={transaction.id}>
                <div>
                  <h3>{transactionTitle(transaction)}</h3>
                  <p>{transaction.customFields.propertyAddress || "No property set"}</p>
                </div>
                <strong>{formatCurrency(transaction.value)}</strong>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {mobileTab === "overview" ? (
        <section className="mobile-card">
          <div className="mobile-card__header">
            <h2>Upcoming Closings</h2>
            <CalendarClock size={18} />
          </div>
          <div className="mobile-list">
            {upcomingClosings.map((transaction) => (
              <article className="mobile-row" key={transaction.id}>
                <div>
                  <h3>{transaction.clientName}</h3>
                  <p>{transaction.propertyAddress}</p>
                </div>
                <strong>{formatDate(transaction.closeDate)}</strong>
              </article>
            ))}
            {!upcomingClosings.length ? (
              <p className="mobile-muted">No upcoming closings yet.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <NewTransactionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={async (input) => {
          await data.createTransaction(input);
          setMessage("Transaction created successfully.");
        }}
      />
      <MobileBottomNav activeTab={mobileTab} onChange={setMobileTab} />
    </main>
  );
}
