import { useState, type FormEvent } from "react";
import { format, isBefore, startOfToday } from "date-fns";
import { CalendarClock, Check, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DashboardTask } from "@/hooks/use-crm-data";

type TaskItemProps = {
  task: DashboardTask;
  onComplete: (taskId: string) => Promise<void>;
  onUpdateDueDateTime: (
    taskId: string,
    dueDate: string,
    dueTime: string,
  ) => Promise<void>;
  showContext?: boolean;
};

function getTaskDate(task: DashboardTask) {
  const dateValue = task.dueDateTime || task.dueDate;
  const date = new Date(dateValue);

  return dateValue && !Number.isNaN(date.getTime()) ? date : null;
}

function formatTaskDate(task: DashboardTask) {
  const date = getTaskDate(task);

  if (!date) return "No due date";

  return format(date, "MMM d, yyyy h:mm a");
}

function getDateInputValue(task: DashboardTask) {
  const date = getTaskDate(task);

  return date ? format(date, "yyyy-MM-dd") : "";
}

function getTimeInputValue(task: DashboardTask) {
  const date = getTaskDate(task);

  return date ? format(date, "HH:mm") : "";
}

function taskVariant(task: DashboardTask) {
  const status = task.status.toLowerCase();

  if (status === "completed" || status === "done") return "success";
  if (status === "blocked") return "danger";
  if (isOverdue(task)) return "danger";
  if (status === "pending") return "warning";

  return "muted";
}

function isCompleted(task: DashboardTask) {
  return ["completed", "done"].includes(task.status.toLowerCase());
}

function isOverdue(task: DashboardTask) {
  const date = getTaskDate(task);

  return Boolean(
    date && !isCompleted(task) && isBefore(date, startOfToday()),
  );
}

export function TaskItem({
  onComplete,
  onUpdateDueDateTime,
  showContext = false,
  task,
}: TaskItemProps) {
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [dueDate, setDueDate] = useState(() => getDateInputValue(task));
  const [dueTime, setDueTime] = useState(() => getTimeInputValue(task));
  const [isSaving, setIsSaving] = useState(false);
  const [taskError, setTaskError] = useState("");
  const completed = isCompleted(task);
  const overdue = isOverdue(task);

  async function handleComplete() {
    setTaskError("");
    setIsSaving(true);

    try {
      await onComplete(task.id);
    } catch (error) {
      setTaskError(
        error instanceof Error ? error.message : "Unable to complete task.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDueDateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskError("");
    setIsSaving(true);

    try {
      await onUpdateDueDateTime(task.id, dueDate, dueTime);
      setIsEditingDueDate(false);
    } catch (error) {
      setTaskError(
        error instanceof Error ? error.message : "Unable to update due date.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article
      className={[
        "task-row",
        completed ? "task-row--completed" : "",
        overdue ? "task-row--overdue" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div>
        <h3>{task.title}</h3>
        <p>{showContext ? task.propertyAddress || "No related transaction" : task.assignedTo || "Unassigned"}</p>
      </div>
      <div className="task-row__badges">
        {overdue ? <Badge variant="danger">Overdue</Badge> : null}
        <Badge variant={taskVariant(task)}>{completed ? "completed" : task.status}</Badge>
      </div>
      <span className="task-row__due">
        <CalendarClock size={15} />
        {formatTaskDate(task)}
      </span>

      {showContext ? (
        <span className="task-row__assigned">
          Assigned to {task.assignedTo || "Unassigned"}
        </span>
      ) : null}

      <div className="task-row__actions">
        <Button
          disabled={completed || isSaving}
          onClick={() => void handleComplete()}
          variant="secondary"
        >
          <Check size={15} />
          {completed ? "Completed" : "Mark Complete"}
        </Button>
        <Button
          disabled={isSaving}
          onClick={() => setIsEditingDueDate((current) => !current)}
          variant="ghost"
        >
          <Pencil size={15} />
          Edit Due Date/Time
        </Button>
      </div>

      {isEditingDueDate ? (
        <form className="task-date-editor" onSubmit={handleDueDateSubmit}>
          <label>
            <span>Due date</span>
            <input
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </label>
          <label>
            <span>Due time</span>
            <input
              onChange={(event) => setDueTime(event.target.value)}
              type="time"
              value={dueTime}
            />
          </label>
          <Button disabled={isSaving} type="submit">
            Save
          </Button>
        </form>
      ) : null}

      {taskError ? <p className="form-error">{taskError}</p> : null}
    </article>
  );
}
