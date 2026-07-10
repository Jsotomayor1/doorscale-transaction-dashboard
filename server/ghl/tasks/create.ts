import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getActiveLocation,
  getRequestedLocationId,
  logRouteDataCounts,
} from "../_active-location.js";

const TASKS_URL_BASE = "https://services.leadconnectorhq.com/locations";
const API_VERSION = "2021-07-28";

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

type DoorScaleTaskResponse = {
  id?: string;
  task?: {
    id?: string;
    _id?: string;
  };
  [key: string]: unknown;
};

function getTaskId(payload: DoorScaleTaskResponse) {
  return payload.id ?? payload.task?.id ?? payload.task?._id;
}

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
  let writeBackFailed = false;
  let syncErrorMessage = "";

  try {
    const connectedAccount = await getActiveLocation(
      request,
      supabase,
      "/api/ghl/tasks/create",
    );

    if (connectedAccount.location_id !== transactionRow.location_id) {
      throw new Error("DoorScale account does not match this transaction.");
    }

    if (!contactId) {
      throw new Error("Task contact is not synced yet.");
    }

    const taskPayload = {
      assignedTo: body.assignedTo || undefined,
      contactId,
      dueDate: dueDateTime || undefined,
      locationId: connectedAccount.location_id,
      opportunityId: transactionRow.ghl_opportunity_id || undefined,
      body: body.description || undefined,
      title: body.title,
    };
    const endpoint = `${TASKS_URL_BASE}/${connectedAccount.location_id}/tasks`;

    console.log("DoorScale task create request:", {
      contactIdExists: Boolean(contactId),
      endpoint,
      locationId: connectedAccount.location_id,
      taskId: body.taskId || null,
      taskTitle: body.title,
      transactionId: body.transactionId,
    });

    const taskResponse = await fetch(
      endpoint,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${connectedAccount.access_token}`,
          "Content-Type": "application/json",
          Version: API_VERSION,
        },
        body: JSON.stringify(taskPayload),
      },
    );
    const rawBody = await taskResponse.text();

    console.log("DoorScale task create response:", {
      endpoint,
      status: taskResponse.status,
      taskId: body.taskId || null,
      taskTitle: body.title,
    });

    if (!taskResponse.ok) {
      console.error("DoorScale task create failed:", {
        body: rawBody,
        status: taskResponse.status,
      });
      throw new Error("DoorScale task create failed.");
    }

    externalTaskId = getTaskId(JSON.parse(rawBody) as DoorScaleTaskResponse);
    console.log("DoorScale task create result:", {
      externalTaskId: externalTaskId || null,
      status: taskResponse.status,
      taskTitle: body.title,
    });
  } catch (error) {
    writeBackFailed = true;
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
    sync_status: writeBackFailed ? "pending_sync" : "synced",
    last_sync_error: writeBackFailed ? syncErrorMessage : null,
    last_synced_at: writeBackFailed ? null : new Date().toISOString(),
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
    ok: !writeBackFailed,
    message: writeBackFailed
      ? "Task saved locally. DoorScale sync will retry later."
      : "Task saved.",
    taskId: savedTask?.id,
  });
  logRouteDataCounts("/api/ghl/tasks/create", activeLocationId, {
    tasks: savedTask ? 1 : 0,
  });
}
