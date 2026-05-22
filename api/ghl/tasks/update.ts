import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const TASKS_URL_BASE = "https://services.leadconnectorhq.com/locations";
const API_VERSION = "2021-07-28";

type ConnectedAccount = {
  access_token: string;
  location_id: string;
};

type TaskRow = {
  assigned_to: string | null;
  due_date: string | null;
  due_datetime: string | null;
  ghl_task_id: string | null;
  status: string | null;
  title: string | null;
};

type UpdateTaskBody = {
  assignedTo?: string;
  dueDate?: string | null;
  dueDateTime?: string | null;
  status?: string;
  taskId?: string;
  title?: string;
};

async function getConnectedAccount(
  supabase: ReturnType<typeof createClient>,
) {
  const { data, error } = await supabase
    .from("ghl_locations")
    .select("access_token, location_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ConnectedAccount | null;
}

function buildLocalUpdate(body: UpdateTaskBody) {
  return {
    ...(body.assignedTo !== undefined ? { assigned_to: body.assignedTo } : {}),
    ...(body.dueDate !== undefined ? { due_date: body.dueDate } : {}),
    ...(body.dueDateTime !== undefined ? { due_datetime: body.dueDateTime } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.title !== undefined ? { title: body.title } : {}),
  };
}

function getSyncFields(writeBackFailed: boolean) {
  return {
    sync_status: writeBackFailed ? "pending_sync" : "synced",
    last_sync_error: writeBackFailed
      ? "Task saved locally. DoorScale sync will retry later."
      : null,
    last_synced_at: writeBackFailed ? null : new Date().toISOString(),
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

  if (!body.taskId) {
    response.status(400).json({ ok: false, message: "Task details are missing." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: currentTask, error: taskError } = await supabase
    .from("tasks")
    .select("assigned_to, due_date, due_datetime, ghl_task_id, status, title")
    .eq("id", body.taskId)
    .maybeSingle();

  if (taskError || !currentTask) {
    response.status(404).json({ ok: false, message: "Task not found." });
    return;
  }

  const task = currentTask as TaskRow;
  let writeBackFailed = false;

  if (task.ghl_task_id) {
    try {
      const connectedAccount = await getConnectedAccount(supabase);

      if (!connectedAccount?.access_token) {
        throw new Error("DoorScale account is not connected.");
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
        throw new Error("DoorScale task update failed.");
      }
    } catch (error) {
      writeBackFailed = true;
      console.error("DoorScale task update write-back failed:", error);
    }
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      ...buildLocalUpdate(body),
      ...getSyncFields(writeBackFailed),
    })
    .eq("id", body.taskId);

  if (updateError) {
    console.error("Local task update failed:", updateError);
    response.status(500).json({ ok: false, message: "Unable to save task." });
    return;
  }

  response.status(200).json({
    ok: !writeBackFailed,
    message: writeBackFailed
      ? "Task saved locally. DoorScale sync will retry later."
      : "Task saved.",
  });
}
