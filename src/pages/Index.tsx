import { format, isBefore, startOfTomorrow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  DollarSign,
  Workflow,
} from "lucide-react";
import { OverviewChart } from "@/components/OverviewChart";
import { RecentSales } from "@/components/RecentSales";
import { Badge } from "@/components/ui/badge";
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
  const {
    activeTransactions,
    documentCounts,
    error,
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
  const upcomingClosings = activeTransactions
    .filter((transaction) => transaction.closeDate)
    .sort(
      (first, second) =>
        new Date(first.closeDate).getTime() - new Date(second.closeDate).getTime(),
    )
    .slice(0, 5);

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
          {loading ? <p className="dashboard__status">Loading DoorScale data...</p> : null}
          {error ? <p className="dashboard__error">{error}</p> : null}
        </div>
      </header>

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
              <CardTitle>Urgent Tasks</CardTitle>
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

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Upcoming Closings</CardTitle>
              <CardDescription>Closest active transaction closing dates.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="closing-list">
              {upcomingClosings.map((transaction) => (
                <div className="closing-row" key={transaction.id}>
                  <div>
                    <strong>{transaction.clientName}</strong>
                    <span>{transaction.propertyAddress}</span>
                  </div>
                  <Badge variant="default">{formatDueDate(transaction.closeDate)}</Badge>
                </div>
              ))}
              {!upcomingClosings.length ? (
                <p className="empty-state">No upcoming closings yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-grid__wide">
          <CardHeader>
            <div>
              <CardTitle>Recent Transactions</CardTitle>
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
