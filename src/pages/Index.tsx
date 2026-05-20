import { format, isBefore, startOfTomorrow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DollarSign,
  Plus,
  Workflow,
} from "lucide-react";
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
  if (status === "Blocked") return "danger";
  if (status === "In Progress") return "warning";
  if (status === "Done") return "success";
  return "muted";
}

export default function Index() {
  const {
    activeTransactions,
    openTasks,
    stageCounts,
    tasks,
    totalCommission,
    transactions,
  } = useCrmData();

  const urgentTasks = openTasks.filter((task) =>
    isBefore(new Date(task.dueDate), startOfTomorrow()),
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
        </div>
        <Button>
          <Plus size={17} />
          New Transaction
        </Button>
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
            <strong>{tasks.filter((task) => task.status === "Done").length}</strong>
            <span>completed task checkpoints</span>
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
                    {format(new Date(task.dueDate), "MMM d")}
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
