import { format, isBefore, startOfTomorrow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  DollarSign,
  Plus,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { NewTransactionModal } from "@/components/NewTransactionModal";
import { OverviewChart } from "@/components/OverviewChart";
import { RecentSales } from "@/components/RecentSales";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCrmData } from "@/hooks/use-crm-data";
import { formatCurrency } from "@/lib/utils";

function taskVariant(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "blocked") return "danger";
  if (normalizedStatus === "pending") return "warning";
  if (normalizedStatus === "completed" || normalizedStatus === "done") {
    return "success";
  }

  return "muted";
}

function isDueSoon(dueDateValue: string) {
  const date = new Date(dueDateValue);

  return dueDateValue ? isBefore(date, startOfTomorrow()) : false;
}

function formatDueDate(dueDateValue: string) {
  const date = new Date(dueDateValue);

  if (!dueDateValue || Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return format(date, "MMM d, h:mm a");
}

export default function Index() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const {
    activeTransactions,
    createTransaction,
    documentCounts,
    error,
    loadDebug,
    loading,
    openTasks,
    stageCounts,
    tasks,
    totalCommission,
    transactions,
  } = useCrmData();

  const urgentTasks = openTasks.filter((task) =>
    isDueSoon(task.dueDateTime || task.dueDate),
  );

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Pipeline command center</p>
          <h2>Transaction Management Dashboard</h2>
          <p>
            Track active contracts, task pressure, deadlines, commissions, and
            workflow stages in one place.
          </p>
          {successMessage ? (
            <p className="dashboard__success">{successMessage}</p>
          ) : null}
          {loading ? <p className="dashboard__status">Loading DoorScale data...</p> : null}
          {error ? <p className="dashboard__error">{error}</p> : null}
          <div className="debug-panel">
            <strong>Load debug</strong>
            <span>route called: {loadDebug.routeCalled}</span>
            <span>response status: {loadDebug.responseStatus}</span>
            <span>response body preview: {loadDebug.responseBodyPreview}</span>
            <span>parsed transactions: {loadDebug.parsedTransactionCount}</span>
            <span>parsed documents: {loadDebug.parsedDocumentCount}</span>
          </div>
        </div>
        <Button
          onClick={() => {
            setSuccessMessage("");
            setIsCreateOpen(true);
          }}
        >
          <Plus size={17} />
          New Transaction
        </Button>
      </header>

      <NewTransactionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={async (input) => {
          const message = await createTransaction(input);
          setSuccessMessage(message || "Transaction created successfully.");
        }}
      />

      <section className="stats-grid" aria-label="Dashboard stats">
        <Card>
          <CardHeader>
            <CardDescription>Active Transactions</CardDescription>
            <Workflow size={20} />
          </CardHeader>
          <CardContent>
            <strong>{activeTransactions.length}</strong>
            <span>{transactions.length} total transactions tracked</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Open Tasks</CardDescription>
            <Clock3 size={20} />
          </CardHeader>
          <CardContent>
            <strong>{openTasks.length}</strong>
            <span>{urgentTasks.length} due today or overdue</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Projected Commission</CardDescription>
            <DollarSign size={20} />
          </CardHeader>
          <CardContent>
            <strong>{formatCurrency(totalCommission)}</strong>
            <span>Projected across active pipeline</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Workflow Health</CardDescription>
            <CheckCircle2 size={20} />
          </CardHeader>
          <CardContent>
            <strong>
              {
                tasks.filter((task) =>
                  ["completed", "done"].includes(task.status.toLowerCase()),
                ).length
              }
            </strong>
            <span>completed task checkpoints</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Document Summary</CardDescription>
            <FileText size={20} />
          </CardHeader>
          <CardContent>
            <strong>{documentCounts.needed}</strong>
            <span>
              {documentCounts.uploaded} uploaded, {documentCounts.missing} missing
            </span>
          </CardContent>
        </Card>
      </section>

      <section className="dashboard-grid">
        <Card className="dashboard-grid__wide">
          <CardHeader>
            <div>
              <CardTitle>Transaction Stages</CardTitle>
              <CardDescription>
                Snapshot of where deals sit in the current workflow.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <OverviewChart stageCounts={stageCounts} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Deadline Alerts</CardTitle>
              <CardDescription>Tasks that need quick visibility.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="task-list">
              {urgentTasks.map((task) => (
                <article className="task-row" key={task.id}>
                  <div>
                    <h3>{task.title}</h3>
                    <p>{task.clientName}</p>
                  </div>
                  <Badge variant={taskVariant(task.status)}>{task.status}</Badge>
                  <span className="task-row__due">
                    <AlertTriangle size={15} />
                    {formatDueDate(task.dueDateTime || task.dueDate)}
                  </span>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-grid__wide">
          <CardHeader>
            <div>
              <CardTitle>Active Transactions</CardTitle>
              <CardDescription>
                Property, commission, close date, and stage visibility.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RecentSales transactions={activeTransactions} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
