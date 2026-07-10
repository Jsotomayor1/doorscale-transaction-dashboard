const TASKS_URL_BASE = "https://services.leadconnectorhq.com/locations";
const API_VERSION = "2021-07-28";

type DoorScaleTaskResponse = {
  id?: string;
  _id?: string;
  task?: {
    id?: string;
    _id?: string;
  };
  [key: string]: unknown;
};

export type TaskSyncStatus = "failed" | "pending_sync" | "synced";

export type TaskSyncResult = {
  externalTaskId?: string;
  lastSyncError: string | null;
  syncStatus: TaskSyncStatus;
};

export type TaskSyncTransaction = {
  contact_id?: string | null;
  ghl_contact_id?: string | null;
  ghl_opportunity_id?: string | null;
  location_id: string;
};

function getTaskId(payload: DoorScaleTaskResponse) {
  return payload.id ?? payload._id ?? payload.task?.id ?? payload.task?._id;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Task saved locally. DoorScale sync will retry later.";
}

export async function syncTaskToDoorScale(input: {
  accessToken: string;
  activeLocationId: string;
  assignedTo?: string | null;
  contactId?: string | null;
  description?: string | null;
  dueDateTime?: string | null;
  taskId?: string | null;
  title: string;
  transactionId: string;
  transactionRow: TaskSyncTransaction;
}): Promise<TaskSyncResult> {
  if (input.activeLocationId !== input.transactionRow.location_id) {
    return {
      lastSyncError: "DoorScale account does not match this task.",
      syncStatus: "failed",
    };
  }

  if (!input.contactId) {
    return {
      lastSyncError: "Waiting for CRM contact sync.",
      syncStatus: "pending_sync",
    };
  }

  const taskPayload = {
    assignedTo: input.assignedTo || undefined,
    contactId: input.contactId,
    dueDate: input.dueDateTime || undefined,
    body: input.description || undefined,
    title: input.title,
  };
  const endpoint = `${TASKS_URL_BASE}/${input.activeLocationId}/tasks`;

  console.log("DoorScale task sync request:", {
    contactIdExists: Boolean(input.contactId),
    endpoint,
    locationId: input.activeLocationId,
    requestKeys: Object.keys(taskPayload).filter(
      (key) => taskPayload[key as keyof typeof taskPayload] !== undefined,
    ),
    taskId: input.taskId || null,
    taskTitle: input.title,
    transactionId: input.transactionId,
  });

  try {
    const taskResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": "application/json",
        Version: API_VERSION,
      },
      body: JSON.stringify(taskPayload),
    });
    const rawBody = await taskResponse.text();

    console.log("DoorScale task sync response:", {
      body: rawBody,
      endpoint,
      status: taskResponse.status,
      taskId: input.taskId || null,
      taskTitle: input.title,
    });

    if (!taskResponse.ok) {
      console.error("DoorScale task sync failed:", {
        body: rawBody,
        status: taskResponse.status,
      });
      return {
        lastSyncError:
          rawBody || `DoorScale task create failed with status ${taskResponse.status}.`,
        syncStatus: "failed",
      };
    }

    const parsedBody = rawBody ? (JSON.parse(rawBody) as DoorScaleTaskResponse) : {};
    const externalTaskId = getTaskId(parsedBody);

    if (!externalTaskId) {
      console.error("DoorScale task sync response missing task id:", {
        body: rawBody,
        status: taskResponse.status,
      });
      return {
        lastSyncError: "DoorScale task was created but no task ID was returned.",
        syncStatus: "failed",
      };
    }

    console.log("DoorScale task sync result:", {
      externalTaskId,
      status: taskResponse.status,
      taskTitle: input.title,
    });

    return {
      externalTaskId,
      lastSyncError: null,
      syncStatus: "synced",
    };
  } catch (error) {
    return {
      lastSyncError: getErrorMessage(error),
      syncStatus: "failed",
    };
  }
}
