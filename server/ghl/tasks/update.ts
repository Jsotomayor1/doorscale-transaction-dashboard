import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getActiveLocation,
  getRequestedLocationId,
  logRouteDataCounts,
} from "../_active-location.js";

const TASKS_URL_BASE = "https://services.leadconnectorhq.com/locations";
const API_VERSION = "2021-07-28";

type TaskRow = {
  assigned_to: string | null;
  due_date: string | null;
  due_datetime: string | null;
  ghl_task_id: string | null;
  location_id: string;
  status: string | null;
  title: string | null;
};

type UpdateTaskBody = {
  assignedTo?: string;
  dueDate?: string | null;
  dueDateTime?: string | null;
  locationId?: string;
  status?: string;
  taskId?: string;
  title?: string;
};

function buildLocalUpdate(body: UpdateTaskBody) {
  return {
    ...(body.assignedTo !== undefined ? { assigned_to: body.assignedTo } : {}),
    ...(body.dueDate !== undefined ? { due_date: body.dueDate } : {}),
    ...(body.dueDateTime !== undefined ? { due_datetime: body.dueDateTime } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.title !== undefined ? { title: body.title } : {}),
  };
}

function getSyncFields(syncStatus: "failed" | "pending_sync" | "synced", syncError: string | null) {
  return {
    sync_status: syncStatus,
    last_sync_error: syncError,
    last_synced_at: syncStatus === "synced" ? new Date().toISOString() : null,
  };
}

function buildDoorScaleUpdate(body: UpdateTaskBody, task: TaskRow) {
  return {
    assignedTo: body.assignedTo ?? task.assigned_to ?? undefined,
    completed:
      body.status?.toLowerCase() === "completed"
        ? true
        : task.status?.toLowerCase() === "completed" || undefined,
    dueDate: body.dueDateTime ?? body.dueDate ?? task.due_datetime ?? task.due_date ?? undefined,
    title: body.title ?? task.title ?? undefined,
  };
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST" && request.method !== "PATCH") {
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({
      ok: false,
      message: "Task saved locally. DoorScale sync will retry later.",
    });
    return;
  }

  const body = request.body as UpdateTaskBody;

  const activeLocationId = getRequestedLocationId(request);

  if (!body.taskId || !activeLocationId) {
    response.status(400).json({ ok: false, message: "Task details are missing." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: currentTask, error: taskError } = await supabase
    .from("tasks")
    .select("assigned_to, due_date, due_datetime, ghl_task_id, location_id, status, title")
    .eq("id", body.taskId)
    .eq("location_id", activeLocationId)
    .maybeSingle();

  if (taskError || !currentTask) {
    response.status(404).json({ ok: false, message: "Task not found." });
    return;
  }

  const task = currentTask as TaskRow;
  let syncStatus: "failed" | "pending_sync" | "synced" = task.ghl_task_id
    ? "synced"
    : "pending_sync";
  let syncError: string | null = task.ghl_task_id
    ? null
    : "Waiting for CRM task sync.";

  if (task.ghl_task_id) {
    try {
      const connectedAccount = await getActiveLocation(
        request,
        supabase,
        "/api/ghl/tasks/update",
      );

      if (connectedAccount.location_id !== task.location_id) {
        throw new Error("DoorScale account does not match this task.");
      }

      const updateResponse = await fetch(
        `${TASKS_URL_BASE}/${connectedAccount.location_id}/tasks/${task.ghl_task_id}`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${connectedAccount.access_token}`,
            "Content-Type": "application/json",
            Version: API_VERSION,
          },
          body: JSON.stringify(buildDoorScaleUpdate(body, task)),
        },
      );
      const rawBody = await updateResponse.text();

      if (!updateResponse.ok) {
        console.error("DoorScale task update failed:", {
          body: rawBody,
          status: updateResponse.status,
        });
        throw new Error(rawBody || `DoorScale task update failed with status ${updateResponse.status}.`);
      }
      syncStatus = "synced";
      syncError = null;
    } catch (error) {
      syncStatus = "failed";
      syncError = error instanceof Error ? error.message : "Task saved locally. DoorScale sync will retry later.";
      console.error("DoorScale task update write-back failed:", {
        error: syncError,
        taskId: body.taskId,
      });
    }
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      ...buildLocalUpdate(body),
      ...getSyncFields(syncStatus, syncError),
    })
    .eq("id", body.taskId)
    .eq("location_id", activeLocationId);

  if (updateError) {
    console.error("Local task update failed:", updateError);
    response.status(500).json({ ok: false, message: "Unable to save task." });
    return;
  }

  response.status(200).json({
    ok: syncStatus === "synced",
    message: syncStatus === "synced"
      ? "Task saved."
      : syncError === "Waiting for CRM task sync."
        ? "Task saved locally. Waiting for CRM task sync."
        : "Task saved locally. DoorScale sync will retry later.",
    syncStatus,
  });
  logRouteDataCounts("/api/ghl/tasks/update", activeLocationId, {
    tasks: 1,
  });
}
