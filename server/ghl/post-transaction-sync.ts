import type { SupabaseClient } from "@supabase/supabase-js";
import { retryPendingDocumentMirrors } from "../documents/mirror.js";
import { syncTaskToDoorScale } from "./tasks/sync.js";

type TransactionRow = {
  contact_id?: string | null;
  ghl_contact_id?: string | null;
  ghl_opportunity_id?: string | null;
  id: string;
  location_id: string;
  property_address?: string | null;
};

type TaskRow = {
  assigned_to?: string | null;
  due_date?: string | null;
  due_datetime?: string | null;
  ghl_task_id?: string | null;
  id: string;
  last_sync_error?: string | null;
  status?: string | null;
  sync_status?: string | null;
  title?: string | null;
  transaction_id: string;
};

function shouldRetryTask(task: TaskRow) {
  return !(
    (task.sync_status || "").toLowerCase() === "synced" &&
    Boolean(task.ghl_task_id)
  );
}

export async function PostTransactionSync(input: {
  accessToken: string;
  activeLocationId: string;
  supabase: SupabaseClient;
  transactionId: string;
}) {
  const { accessToken, activeLocationId, supabase, transactionId } = input;
  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id, location_id, contact_id, ghl_contact_id, ghl_opportunity_id, property_address")
    .eq("id", transactionId)
    .eq("location_id", activeLocationId)
    .maybeSingle();

  if (transactionError || !transaction) {
    console.error("DoorScale post transaction sync transaction lookup failed:", {
      activeLocationId,
      error: transactionError,
      transactionId,
    });
    return {
      documents: { pending: 0, retried: 0, synced: 0 },
      tasks: { failed: 0, pending: 0, retried: 0, synced: 0 },
    };
  }

  const transactionRow = transaction as TransactionRow;
  const contactId = transactionRow.ghl_contact_id || transactionRow.contact_id || null;

  console.log("DoorScale post transaction sync started:", {
    activeLocationId,
    contactIdExists: Boolean(contactId),
    transactionId,
  });

  const documents = await retryPendingDocumentMirrors({
    accessToken,
    activeLocationId,
    contactId,
    propertyAddress: transactionRow.property_address,
    supabase,
    transactionId,
  });

  const { data: taskRows, error: taskError } = await supabase
    .from("tasks")
    .select("id, transaction_id, title, due_date, due_datetime, status, assigned_to, sync_status, last_sync_error, ghl_task_id")
    .eq("location_id", activeLocationId)
    .eq("transaction_id", transactionId);

  if (taskError) {
    console.error("DoorScale post transaction sync task lookup failed:", {
      activeLocationId,
      error: taskError,
      transactionId,
    });
    return {
      documents,
      tasks: { failed: 0, pending: 0, retried: 0, synced: 0 },
    };
  }

  const retryTasks = ((taskRows ?? []) as TaskRow[]).filter(shouldRetryTask);
  const taskResults = {
    failed: 0,
    pending: 0,
    retried: retryTasks.length,
    synced: 0,
  };

  for (const task of retryTasks) {
    const result = await syncTaskToDoorScale({
      accessToken,
      activeLocationId,
      assignedTo: task.assigned_to,
      contactId,
      dueDateTime: task.due_datetime || task.due_date || null,
      taskId: task.id,
      title: task.title || "Untitled task",
      transactionId,
      transactionRow,
    });

    if (result.syncStatus === "synced") taskResults.synced += 1;
    if (result.syncStatus === "pending_sync") taskResults.pending += 1;
    if (result.syncStatus === "failed") taskResults.failed += 1;

    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        ...(result.externalTaskId ? { ghl_task_id: result.externalTaskId } : {}),
        contact_id: contactId,
        ghl_opportunity_id: transactionRow.ghl_opportunity_id ?? null,
        last_sync_error: result.lastSyncError,
        last_synced_at: result.syncStatus === "synced" ? new Date().toISOString() : null,
        sync_status: result.syncStatus,
      })
      .eq("id", task.id)
      .eq("location_id", activeLocationId);

    if (updateError) {
      console.error("DoorScale post transaction sync task status update failed:", {
        activeLocationId,
        error: updateError,
        taskId: task.id,
        transactionId,
      });
    }
  }

  console.log("DoorScale post transaction sync finished:", {
    activeLocationId,
    documents,
    tasks: taskResults,
    transactionId,
  });

  return {
    documents,
    tasks: taskResults,
  };
}
