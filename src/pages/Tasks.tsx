import { useState } from "react";
import { CheckSquare } from "lucide-react";
import { TaskItem } from "@/components/TaskItem";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { useCRMData } from "@/hooks/use-crm-data";

export default function Tasks() {
  const {
    error,
    loadDebug,
    loading,
    markTaskCompleted,
    retryTaskSync,
    tasks,
    updateTaskDueDateTime,
  } = useCRMData();
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
          <p>Review pending and completed DoorScale task work.</p>
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
          <TaskItem
            key={task.id}
            onComplete={markTaskCompleted}
            onRetrySync={retryTaskSync}
            onUpdateDueDateTime={updateTaskDueDateTime}
            showContext
            task={task}
          />
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
