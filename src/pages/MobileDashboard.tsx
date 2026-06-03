import { format, isBefore, startOfTomorrow } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ListChecks,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const emptyTaskForm = {
  assignedTo: "",
  dueDate: "",
  dueTime: "",
  title: "",
};

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
  const [message, setMessage] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [editingTaskId, setEditingTaskId] = useState("");
  const [editingDueDate, setEditingDueDate] = useState("");
  const [editingDueTime, setEditingDueTime] = useState("");

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

  useEffect(() => {
    if (!selectedTransaction) return;

    void data.ensureTransactionDocuments({
      stage: selectedTransaction.stage,
      transactionId: String(selectedTransaction.id),
      transactionType: selectedTransaction.customFields.transactionType,
    });
  }, [data, selectedTransaction]);

  async function handleStageChange(stage: TransactionStage) {
    if (!selectedTransaction) return;

    setMessage("");
    await data.updateTransactionStage({
      stage,
      transactionId: String(selectedTransaction.id),
      transactionType: selectedTransaction.customFields.transactionType,
    });
    setMessage("Stage updated.");
  }

  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedTransaction || !taskForm.title.trim()) return;

    await data.createTask({
      assignedTo: taskForm.assignedTo,
      dueDate: taskForm.dueDate,
      dueTime: taskForm.dueTime,
      title: taskForm.title,
      transactionId: String(selectedTransaction.id),
    });
    setTaskForm(emptyTaskForm);
    setMessage("Task added.");
  }

  async function handleDocumentUpload(
    document: TransactionDocument,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!selectedTransaction || !file) return;

    await data.uploadTransactionDocument({
      documentId: document.id,
      documentType: document.documentType,
      file,
      transactionId: String(selectedTransaction.id),
    });
    setMessage("Document uploaded.");
  }

  async function handleDocumentStatus(documentId: string, status: string) {
    if (!selectedTransaction) return;

    await data.updateDocumentStatus({
      documentId,
      status: status as DocumentStatus,
      transactionId: String(selectedTransaction.id),
    });
    setMessage("Document status updated.");
  }

  async function handleTaskDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTaskId) return;

    await data.updateTaskDueDateTime({
      dueDate: editingDueDate,
      dueTime: editingDueTime,
      taskId: editingTaskId,
    });
    setEditingTaskId("");
    setMessage("Task updated.");
  }

  if (selectedTransaction) {
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
          <div>
            <p>DoorScale TMS</p>
            <h1>{transactionTitle(selectedTransaction)}</h1>
          </div>
        </header>

        {message ? <p className="mobile-success">{message}</p> : null}

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
          </dl>
          <label className="mobile-field">
            <span>Stage</span>
            <select
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
            <Button type="submit">Add Task</Button>
          </form>
          <div className="mobile-list">
            {selectedTasks.map((task) => (
              <article className="mobile-row" key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  <p>{formatDate(task.dueDateTime || task.dueDate)} · {task.assignedTo || "Unassigned"}</p>
                </div>
                <div className="mobile-row__actions">
                  <Button
                    disabled={!isOpenTask(task)}
                    onClick={() => void data.markTaskCompleted(task.id)}
                    variant="secondary"
                  >
                    <CheckCircle2 size={16} />
                    Done
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
          <div className="mobile-list">
            {selectedDocuments.length ? (
              selectedDocuments.map((document) => (
                <article className="mobile-document" key={document.id}>
                  <div>
                    <h3>{document.documentName || document.documentType}</h3>
                    <p>
                      {statusLabel(document.status)}
                      {document.uploadedAt ? ` · Uploaded ${formatDate(document.uploadedAt)}` : ""}
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
                  <label className="mobile-upload-button">
                    <Upload size={16} />
                    Upload
                    <input
                      onChange={(event) => void handleDocumentUpload(document, event)}
                      type="file"
                    />
                  </label>
                </article>
              ))
            ) : (
              <p className="mobile-muted">Document checklist is still preparing.</p>
            )}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mobile-shell">
      <header className="mobile-home-header">
        <p>DoorScale TMS</p>
        <h1>Transaction Management</h1>
        {data.loading ? <span>Loading DoorScale data...</span> : null}
        {data.error ? <span className="mobile-error">{data.error}</span> : null}
      </header>

      <section className="mobile-card">
        <div className="mobile-card__header">
          <h2>Today&apos;s Tasks</h2>
          <ListChecks size={18} />
        </div>
        <div className="mobile-list">
          {todayTasks.slice(0, 5).map((task) => (
            <article className="mobile-row" key={task.id}>
              <div>
                <h3>{task.title}</h3>
                <p>{task.propertyAddress || task.clientName || "Transaction"}</p>
              </div>
              <Button onClick={() => void data.markTaskCompleted(task.id)} variant="secondary">
                Done
              </Button>
            </article>
          ))}
          {!todayTasks.length ? <p className="mobile-muted">No urgent tasks today.</p> : null}
        </div>
      </section>

      <section className="mobile-card">
        <h2>Active Transactions</h2>
        <div className="mobile-list">
          {activeTransactions.map((transaction) => {
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
              </article>
            );
          })}
        </div>
      </section>

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
    </main>
  );
}
