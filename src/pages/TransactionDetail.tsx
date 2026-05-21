import { differenceInCalendarDays, format } from "date-fns";
import {
  ArrowLeft,
  CalendarClock,
  CheckSquare,
  FileText,
  Pencil,
  StickyNote,
} from "lucide-react";
import { useState, type FormEvent } from "react";
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
  const [detailMessage, setDetailMessage] = useState("");
  const [detailError, setDetailError] = useState("");
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
  const relatedTasks = data.tasks.filter(
    (task) =>
      String(task.relatedOpportunityId) === transactionId ||
      String(task.transactionId) === transactionId,
  );

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
            <span>{transaction.status || "Status not set"}</span>
          </div>
        </div>
        <Badge variant={stageVariant(transaction.stage)}>
          {transaction.stage as TransactionStage}
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
        <Button disabled variant="ghost">
          Open in DoorScale
        </Button>
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
      </section>

      <section className="workspace-grid">
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
                Coming soon through the DoorScale account connection.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="documents-helper">
              Document uploads will connect to the contact's DoorScale document
              storage once the account connection is enabled.
            </p>
            <div className="placeholder-list">
              {documentRows.map((row) => (
                <div className="placeholder-row" key={row}>
                  <FileText size={16} />
                  <span>{row}</span>
                  <Badge variant="muted">DoorScale Connection Needed</Badge>
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
