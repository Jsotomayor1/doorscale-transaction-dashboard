import { useMemo, useState, type FormEvent } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { TaskItem } from "@/components/TaskItem";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCRMData } from "@/hooks/use-crm-data";

const initialTaskForm = {
  assignedTo: "",
  description: "",
  dueDate: "",
  status: "pending",
  title: "",
  transactionId: "",
};

export default function Tasks() {
  const {
    createTask,
    error,
    loading,
    markTaskCompleted,
    retryTaskSync,
    tasks,
    transactions,
    updateTaskDueDateTime,
  } = useCRMData();
  const [statusFilter, setStatusFilter] = useState("all");
  const [taskForm, setTaskForm] = useState(initialTaskForm);
  const [taskMessage, setTaskMessage] = useState("");
  const [taskError, setTaskError] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const agentOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...transactions.map((transaction) => transaction.assignedTo),
            ...tasks.map((task) => task.assignedTo),
          ]
            .map((agent) => agent?.trim())
            .filter((agent): agent is string => Boolean(agent)),
        ),
      ).sort(),
    [tasks, transactions],
  );

  const filteredTasks = tasks.filter((task) => {
    const normalizedStatus = task.status.toLowerCase();

    if (statusFilter === "all") return true;
    if (statusFilter === "completed") {
      return ["completed", "done"].includes(normalizedStatus);
    }

    return normalizedStatus === "pending";
  });

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskError("");
    setTaskMessage("");

    if (!taskForm.title.trim()) {
      setTaskError("Task title is required.");
      return;
    }

    if (!taskForm.transactionId) {
      setTaskError("Choose a transaction for this task.");
      return;
    }

    setIsCreatingTask(true);

    try {
      await createTask({
        assignedTo: taskForm.assignedTo.trim(),
        description: taskForm.description.trim(),
        dueDate: taskForm.dueDate,
        dueTime: "",
        status: taskForm.status,
        title: taskForm.title.trim(),
        transactionId: taskForm.transactionId,
      });
      setTaskForm(initialTaskForm);
      setTaskMessage("Task created.");
    } catch (createError) {
      setTaskError(
        createError instanceof Error ? createError.message : "Unable to create task.",
      );
    } finally {
      setIsCreatingTask(false);
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="dashboard__eyebrow">Task queue</p>
          <h2>Tasks</h2>
          <p>Review pending and completed DoorScale task work.</p>
          {loading ? <p className="dashboard__status">Loading DoorScale data...</p> : null}
          {error ? <p className="dashboard__error">{error}</p> : null}
          {taskMessage ? <p className="dashboard__success">{taskMessage}</p> : null}
          {taskError ? <p className="dashboard__error">{taskError}</p> : null}
        </div>
      </header>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Create Task</CardTitle>
            <CardDescription>Add one-off work to any transaction.</CardDescription>
          </div>
          <Plus size={20} />
        </CardHeader>
        <CardContent>
          <form className="task-create-form task-create-form--page" onSubmit={handleCreateTask}>
            <label>
              <span>Title</span>
              <input
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, title: event.target.value }))
                }
                required
                value={taskForm.title}
              />
            </label>

            <label>
              <span>Transaction</span>
              <select
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    transactionId: event.target.value,
                  }))
                }
                required
                value={taskForm.transactionId}
              >
                <option value="">Choose transaction</option>
                {transactions.map((transaction) => (
                  <option key={transaction.id} value={transaction.id}>
                    {transaction.clientName} - {transaction.propertyAddress}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Due Date</span>
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
              <span>Assigned Agent</span>
              <input
                list="task-agent-options"
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    assignedTo: event.target.value,
                  }))
                }
                value={taskForm.assignedTo}
              />
              <datalist id="task-agent-options">
                {agentOptions.map((agent) => (
                  <option key={agent} value={agent} />
                ))}
              </datalist>
            </label>

            <label>
              <span>Status</span>
              <select
                onChange={(event) =>
                  setTaskForm((current) => ({ ...current, status: event.target.value }))
                }
                value={taskForm.status}
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </label>

            <label className="task-create-form__wide">
              <span>Description</span>
              <textarea
                onChange={(event) =>
                  setTaskForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                value={taskForm.description}
              />
            </label>

            <div className="task-create-form__actions">
              <Button disabled={isCreatingTask || loading} type="submit">
                {isCreatingTask ? "Saving..." : "Create Task"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

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
