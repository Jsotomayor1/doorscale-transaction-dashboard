import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const TASKS_URL_BASE = "https://services.leadconnectorhq.com/locations";
const API_VERSION = "2021-07-28";

type ConnectedAccount = {
  access_token: string;
  location_id: string;
};

type TransactionRow = {
  contact_id: string | null;
  ghl_opportunity_id: string | null;
  location_id: string;
};

type CreateTaskBody = {
  assignedTo?: string;
  dueDate?: string;
  dueDateTime?: string;
  status?: string;
  title?: string;
  taskId?: string;
  transactionId?: string;
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

  if (!body.title || !body.transactionId) {
    response.status(400).json({ ok: false, message: "Task details are missing." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("location_id, contact_id, ghl_opportunity_id")
    .eq("id", body.transactionId)
    .maybeSingle();

  if (transactionError || !transaction) {
    response.status(404).json({ ok: false, message: "Transaction not found." });
    return;
  }

  const transactionRow = transaction as TransactionRow;
  const dueDateTime = getDueDateTime(body);
  const localTask = {
    assigned_to: body.assignedTo || null,
    contact_id: transactionRow.contact_id,
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

  try {
    const connectedAccount = await getConnectedAccount(supabase);

    if (!connectedAccount?.access_token) {
      throw new Error("DoorScale account is not connected.");
    }

    const taskPayload = {
      assignedTo: body.assignedTo || undefined,
      contactId: transactionRow.contact_id || undefined,
      dueDate: dueDateTime || undefined,
      opportunityId: transactionRow.ghl_opportunity_id || undefined,
      title: body.title,
    };

    const taskResponse = await fetch(
      `${TASKS_URL_BASE}/${connectedAccount.location_id}/tasks`,
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

    if (!taskResponse.ok) {
      console.error("DoorScale task create failed:", {
        body: rawBody,
        status: taskResponse.status,
      });
      throw new Error("DoorScale task create failed.");
    }

    externalTaskId = getTaskId(JSON.parse(rawBody) as DoorScaleTaskResponse);
  } catch (error) {
    writeBackFailed = true;
    console.error("DoorScale task create write-back failed:", error);
  }

  const taskRow = {
    ...localTask,
    ghl_task_id: externalTaskId ?? null,
    sync_status: writeBackFailed ? "pending_sync" : "synced",
    last_sync_error: writeBackFailed
      ? "Task saved locally. DoorScale sync will retry later."
      : null,
    last_synced_at: writeBackFailed ? null : new Date().toISOString(),
  };
  const saveQuery = body.taskId
    ? supabase.from("tasks").update(taskRow).eq("id", body.taskId).select("id").single()
    : supabase.from("tasks").insert(taskRow).select("id").single();
  const { data: savedTask, error: saveError } = await saveQuery;

  if (saveError) {
    console.error("Local task create failed:", saveError);
    response.status(500).json({ ok: false, message: "Unable to save task." });
    return;
  }

  response.status(200).json({
    ok: !writeBackFailed,
    message: writeBackFailed
      ? "Task saved locally. DoorScale sync will retry later."
      : "Task saved.",
    taskId: savedTask?.id,
  });
}
