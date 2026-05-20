import { useState } from "react";
import { format } from "date-fns";
import { CalendarClock, CheckSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCRMData } from "@/hooks/use-crm-data";

function formatDate(dateValue: string) {
  const date = new Date(dateValue);

  if (!dateValue || Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return format(date, "MMM d, yyyy");
}

function taskVariant(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "pending") return "warning";
  if (normalizedStatus === "completed" || normalizedStatus === "done") {
    return "success";
  }
  if (normalizedStatus === "blocked") return "danger";

  return "muted";
}

export default function Tasks() {
  const { error, loading, tasks } = useCRMData();
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter === "all") return true;

    return task.status.toLowerCase() === statusFilter;
  });

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Task queue</p>
          <h2>Tasks</h2>
          <p>Review pending and completed task work from Supabase.</p>
          {loading ? <p className="dashboard__status">Loading Supabase data...</p> : null}
          {error ? <p className="dashboard__error">{error}</p> : null}
        </div>
      </header>

      <section className="segmented-control" aria-label="Task status filters">
        {["all", "pending", "completed"].map((status) => (
          <button
            className={statusFilter === status ? "is-active" : ""}
            key={status}
            onClick={() => setStatusFilter(status)}
            type="button"
          >
            {status}
          </button>
        ))}
      </section>

      <section className="entity-grid" aria-label="Tasks">
        {filteredTasks.map((task) => (
          <Card key={task.id}>
            <CardHeader>
              <div>
                <CardTitle>{task.title}</CardTitle>
                <CardDescription>
                  {task.propertyAddress || task.clientName || "No related transaction"}
                </CardDescription>
              </div>
              <Badge variant={taskVariant(task.status)}>{task.status}</Badge>
            </CardHeader>
            <CardContent>
              <dl className="detail-list">
                <div>
                  <dt>Due Date</dt>
                  <dd>
                    <CalendarClock size={15} />
                    {formatDate(task.dueDate)}
                  </dd>
                </div>
                <div>
                  <dt>Assigned To</dt>
                  <dd>{task.assignedTo || "Unassigned"}</dd>
                </div>
                <div>
                  <dt>Related Transaction</dt>
                  <dd>{task.propertyAddress || task.relatedOpportunityId || "None"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </section>

      {!loading && filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="empty-state">
            <CheckSquare size={20} />
            No tasks match this status.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
