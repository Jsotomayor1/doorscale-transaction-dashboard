import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getActiveLocation,
  getRequestedLocationId,
  logRouteDataCounts,
} from "../_active-location.js";
import {
  syncTaskToDoorScale,
  type TaskSyncStatus,
} from "./sync.js";

type TransactionRow = {
  contact_id: string | null;
  ghl_contact_id?: string | null;
  ghl_opportunity_id: string | null;
  location_id: string;
};

type CreateTaskBody = {
  assignedTo?: string;
  description?: string;
  dueDate?: string;
  dueDateTime?: string;
  locationId?: string;
  status?: string;
  title?: string;
  taskId?: string;
  transactionId?: string;
};

type TaskRowPayload = {
  assigned_to: string | null;
  contact_id: string | null;
  description?: string | null;
  due_date: string | null;
  due_datetime: string | null;
  ghl_opportunity_id: string | null;
  ghl_task_id?: string | null;
  last_sync_error?: string | null;
  last_synced_at?: string | null;
  location_id: string;
  status: string;
  sync_status?: string;
  title: string;
  transaction_id: string;
};

function getDueDateTime(body: CreateTaskBody) {
  return body.dueDateTime || body.dueDate || null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Task saved locally. DoorScale sync will retry later.";
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
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

  const body = request.body as CreateTaskBody;

  const activeLocationId = getRequestedLocationId(request);

  if (!body.title || !body.transactionId || !activeLocationId) {
    response.status(400).json({ ok: false, message: "Task details are missing." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("location_id, contact_id, ghl_contact_id, ghl_opportunity_id")
    .eq("id", body.transactionId)
    .eq("location_id", activeLocationId)
    .maybeSingle();

  if (transactionError || !transaction) {
    response.status(404).json({ ok: false, message: "Transaction not found." });
    return;
  }

  const transactionRow = transaction as TransactionRow;
  const contactId = transactionRow.ghl_contact_id ?? transactionRow.contact_id;
  console.log("DoorScale task contact resolution:", {
    resolvedGhlContactId: contactId || null,
    taskTitle: body.title,
    transactionId: body.transactionId,
  });
  const dueDateTime = getDueDateTime(body);
  const localTask = {
    assigned_to: body.assignedTo || null,
    contact_id: contactId,
    description: body.description || null,
    due_date: body.dueDate || (dueDateTime ? dueDateTime.slice(0, 10) : null),
    due_datetime: dueDateTime,
    ghl_opportunity_id: transactionRow.ghl_opportunity_id,
    location_id: transactionRow.location_id,
    status: body.status || "pending",
    title: body.title,
    transaction_id: body.transactionId,
  };

  let externalTaskId: string | undefined;
  let syncStatus: TaskSyncStatus = "pending_sync";
  let syncErrorMessage: string | null = "Waiting for CRM contact sync.";

  try {
    const connectedAccount = await getActiveLocation(
      request,
      supabase,
      "/api/ghl/tasks/create",
    );

    const result = await syncTaskToDoorScale({
      accessToken: connectedAccount.access_token,
      activeLocationId,
      assignedTo: body.assignedTo || undefined,
      contactId,
      description: body.description || undefined,
      dueDateTime,
      taskId: body.taskId,
      title: body.title,
      transactionId: body.transactionId,
      transactionRow,
    });

    externalTaskId = result.externalTaskId;
    syncStatus = result.syncStatus;
    syncErrorMessage = result.lastSyncError;
  } catch (error) {
    syncStatus = "failed";
    syncErrorMessage = getErrorMessage(error);
    console.error("DoorScale task create write-back failed:", {
      error: syncErrorMessage,
      resolvedGhlContactId: contactId || null,
      taskId: body.taskId || null,
      taskTitle: body.title,
      transactionId: body.transactionId,
    });
  }

  const taskRow = {
    ...localTask,
    ghl_task_id: externalTaskId ?? null,
    sync_status: syncStatus,
    last_sync_error: syncErrorMessage,
    last_synced_at: syncStatus === "synced" ? new Date().toISOString() : null,
  };
  async function saveTask(payload: TaskRowPayload) {
    return body.taskId
      ? supabase
          .from("tasks")
          .update(payload)
          .eq("id", body.taskId)
          .eq("location_id", activeLocationId)
          .select("id")
          .single()
      : supabase.from("tasks").insert(payload).select("id").single();
  }

  let { data: savedTask, error: saveError } = await saveTask(taskRow);

  if (saveError && "description" in taskRow) {
    console.error("Local task create failed with description; retrying without it:", {
      code: saveError.code,
      details: saveError.details,
      message: saveError.message,
    });
    const { description: _description, ...fallbackTaskRow } = taskRow;
    const fallbackResult = await saveTask(fallbackTaskRow);
    savedTask = fallbackResult.data;
    saveError = fallbackResult.error;
  }

  if (saveError) {
    console.error("Local task create failed with sync metadata; retrying with base task fields:", {
      code: saveError.code,
      details: saveError.details,
      hint: saveError.hint,
      message: saveError.message,
    });
    const baseTaskRow = {
      assigned_to: body.assignedTo || null,
      due_date: body.dueDate || (dueDateTime ? dueDateTime.slice(0, 10) : null),
      location_id: transactionRow.location_id,
      status: body.status || "pending",
      title: body.title,
      transaction_id: body.transactionId,
    };
    const fallbackResult = await saveTask(baseTaskRow);
    savedTask = fallbackResult.data;
    saveError = fallbackResult.error;
  }

  if (saveError) {
    console.error("Local task create failed:", {
      code: saveError.code,
      details: saveError.details,
      hint: saveError.hint,
      message: saveError.message,
    });
    response.status(500).json({
      ok: false,
      message: `Unable to save task: ${saveError.message}`,
    });
    return;
  }

  response.status(200).json({
    ok: syncStatus === "synced",
    message: syncStatus === "synced"
      ? "Task saved."
      : syncErrorMessage === "Waiting for CRM contact sync."
        ? "Task saved locally. Waiting for CRM contact sync."
        : "Task saved locally. DoorScale sync will retry later.",
    syncStatus,
    taskId: savedTask?.id,
  });
  logRouteDataCounts("/api/ghl/tasks/create", activeLocationId, {
    tasks: savedTask ? 1 : 0,
  });
}
