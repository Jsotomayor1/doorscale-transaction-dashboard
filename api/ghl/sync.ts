import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPPORTUNITIES_URL =
  "https://services.leadconnectorhq.com/opportunities/search";
const PIPELINES_URL = "https://services.leadconnectorhq.com/opportunities/pipelines";
const TASKS_URL_BASE = "https://services.leadconnectorhq.com/locations";
const API_VERSION = "2021-07-28";

type StoredConnection = {
  access_token: string;
  created_at?: string;
  location_id: string;
};

type OpportunitiesResponse = {
  opportunities?: DoorScaleOpportunity[];
  data?: DoorScaleOpportunity[];
  [key: string]: unknown;
};

type TasksResponse = {
  tasks?: DoorScaleTask[];
  data?: DoorScaleTask[];
  [key: string]: unknown;
};

type PipelineStage = {
  id?: string;
  _id?: string;
  stageId?: string;
  name?: string;
  title?: string;
  label?: string;
  stageName?: string;
  [key: string]: unknown;
};

type Pipeline = {
  id?: string;
  _id?: string;
  pipelineId?: string;
  name?: string;
  title?: string;
  stages?: PipelineStage[];
  pipelineStages?: PipelineStage[];
  [key: string]: unknown;
};

type PipelinesResponse = {
  pipelines?: Pipeline[];
  data?: Pipeline[];
  [key: string]: unknown;
};

type DoorScaleOpportunity = {
  id?: string;
  name?: string;
  monetaryValue?: number | string | null;
  monetary_value?: number | string | null;
  pipelineId?: string;
  pipeline_id?: string;
  pipelineStageId?: string;
  pipeline_stage_id?: string;
  assignedTo?: string;
  assigned_to?: string;
  status?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  contactId?: string;
  locationId?: string;
  contact?: {
    name?: string;
    first_name?: string;
    firstName?: string;
    last_name?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    transaction_type?: string;
    transactionType?: string;
  };
  custom_objects?: {
    transactions?: {
      buyer_name?: string;
      property_address?: string;
      seller_name?: string;
    };
  };
  customObjects?: {
    transactions?: {
      buyerName?: string;
      propertyAddress?: string;
      sellerName?: string;
    };
  };
  relations?: Array<{
    contactName?: string;
  }>;
  customFields?: Array<{
    id?: string;
    key?: string;
    fieldKey?: string;
    name?: string;
    value?: unknown;
  }>;
  tags?: unknown;
  [key: string]: unknown;
};

type DoorScaleTask = {
  id?: string;
  _id?: string;
  taskId?: string;
  title?: string;
  body?: string;
  name?: string;
  dueDate?: string;
  due_date?: string;
  dueDatetime?: string;
  due_datetime?: string;
  dateAdded?: string;
  assignedTo?: string;
  assigned_to?: string;
  status?: string;
  completed?: boolean;
  contactId?: string;
  contact_id?: string;
  opportunityId?: string;
  opportunity_id?: string;
  ghlOpportunityId?: string;
  [key: string]: unknown;
};

type ExistingTransaction = {
  ghl_opportunity_id: string;
  buyer_name: string | null;
  closing_date: string | null;
  contact_id: string | null;
  commission: number | null;
  inspection_date: string | null;
  property_address: string | null;
  seller_name: string | null;
  transaction_type: string | null;
  status: string | null;
  assigned_to: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type TransactionUpsertPayload = {
  location_id: string;
  ghl_opportunity_id: string;
  contact_id: string | null;
  assigned_to: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  property_address: string;
  transaction_type: string;
  stage: string;
  buyer_name: string | null;
  seller_name: string | null;
  closing_date: string | null;
  inspection_date: string | null;
  commission: number;
  status: string;
  sync_status: string;
  last_sync_error: string | null;
  last_synced_at: string;
  created_at: string | null;
  updated_at: string | null;
};

type SyncedTransaction = {
  contact_id: string | null;
  ghl_opportunity_id: string | null;
  id: string;
};

type TaskUpsertPayload = {
  assigned_to: string | null;
  contact_id: string | null;
  due_date: string | null;
  due_datetime: string | null;
  ghl_opportunity_id: string | null;
  ghl_task_id: string;
  location_id: string;
  status: string;
  sync_status: string;
  last_sync_error: string | null;
  last_synced_at: string;
  title: string;
  transaction_id: string;
};

function getOpportunities(payload: OpportunitiesResponse) {
  if (Array.isArray(payload.opportunities)) {
    return payload.opportunities;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function getTasks(payload: TasksResponse) {
  if (Array.isArray(payload.tasks)) {
    return payload.tasks;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function getPipelines(payload: PipelinesResponse) {
  if (Array.isArray(payload.pipelines)) {
    return payload.pipelines;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  return [];
}

function getStageId(stage: PipelineStage) {
  return stage.id ?? stage._id ?? stage.stageId;
}

function getStageName(stage: PipelineStage) {
  return stage.name ?? stage.title ?? stage.label ?? stage.stageName;
}

function getPipelineId(pipeline: Pipeline) {
  return pipeline.id ?? pipeline._id ?? pipeline.pipelineId;
}

function getPipelineName(pipeline: Pipeline) {
  return pipeline.name ?? pipeline.title;
}

function buildStageMap(pipeline?: Pipeline) {
  const stageMap: Record<string, string> = {};

  if (!pipeline) {
    return stageMap;
  }

  const stages = pipeline.stages ?? pipeline.pipelineStages ?? [];

  for (const stage of stages) {
    const stageId = getStageId(stage);
    const stageName = getStageName(stage);

    if (stageId && stageName) {
      stageMap[stageId] = stageName;
    }
  }

  return stageMap;
}

async function fetchPipelines(accessToken: string, locationId: string) {
  const pipelinesUrl = new URL(PIPELINES_URL);
  pipelinesUrl.searchParams.set("locationId", locationId);

  try {
    const pipelinesResponse = await fetch(pipelinesUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        Version: API_VERSION,
      },
    });

    const rawBody = await pipelinesResponse.text();
    console.log("DoorScale pipeline stages sync response:", rawBody);

    if (!pipelinesResponse.ok) {
      return [];
    }

    return getPipelines(JSON.parse(rawBody) as PipelinesResponse);
  } catch (error) {
    console.error("DoorScale stage mapping lookup failed:", error);
    return [];
  }
}

async function fetchTasks(accessToken: string, locationId: string) {
  const tasksUrl = `${TASKS_URL_BASE}/${locationId}/tasks/search`;

  try {
    const tasksResponse = await fetch(tasksUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Version: API_VERSION,
      },
      body: JSON.stringify({}),
    });

    const rawBody = await tasksResponse.text();
    console.log("DoorScale tasks sync response:", rawBody);

    if (!tasksResponse.ok) {
      return [];
    }

    return getTasks(JSON.parse(rawBody) as TasksResponse);
  } catch (error) {
    console.error("DoorScale task sync lookup failed:", error);
    return [];
  }
}

function findTransactionManagementSystemPipeline(pipelines: Pipeline[]) {
  return pipelines.find(
    (pipeline) =>
      getPipelineName(pipeline)?.trim() === "Transaction Management System",
  );
}

function keepExistingWhenEmpty<T>(incoming: T | null | undefined, existing: T | null | undefined, fallback: T) {
  if (typeof incoming === "string") {
    return incoming.trim() ? incoming : existing ?? fallback;
  }

  return incoming ?? existing ?? fallback;
}

function getOpportunityPipelineId(opportunity: DoorScaleOpportunity) {
  return opportunity.pipeline_id ?? opportunity.pipelineId;
}

function getOpportunityStageId(opportunity: DoorScaleOpportunity) {
  return opportunity.pipeline_stage_id ?? opportunity.pipelineStageId;
}

function getOpportunityAssignedTo(opportunity: DoorScaleOpportunity) {
  return opportunity.assigned_to ?? opportunity.assignedTo ?? null;
}

function getOpportunityCommission(opportunity: DoorScaleOpportunity) {
  return opportunity.monetary_value ?? opportunity.monetaryValue;
}

function getContactTransactionType(opportunity: DoorScaleOpportunity) {
  return opportunity.contact?.transaction_type ?? opportunity.contact?.transactionType ?? null;
}

function getContactName(opportunity: DoorScaleOpportunity) {
  const firstName = opportunity.contact?.first_name ?? opportunity.contact?.firstName ?? "";
  const lastName = opportunity.contact?.last_name ?? opportunity.contact?.lastName ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  return fullName || opportunity.contact?.name || null;
}

function getObjectTransaction(opportunity: DoorScaleOpportunity) {
  return (
    opportunity.custom_objects?.transactions ??
    opportunity.customObjects?.transactions ??
    {}
  );
}

function getObjectSellerName(opportunity: DoorScaleOpportunity) {
  const transaction = getObjectTransaction(opportunity);
  return "seller_name" in transaction
    ? transaction.seller_name ?? null
    : transaction.sellerName ?? null;
}

function getObjectBuyerName(opportunity: DoorScaleOpportunity) {
  const transaction = getObjectTransaction(opportunity);
  return "buyer_name" in transaction
    ? transaction.buyer_name ?? null
    : transaction.buyerName ?? null;
}

function getObjectPropertyAddress(opportunity: DoorScaleOpportunity) {
  const transaction = getObjectTransaction(opportunity);
  return "property_address" in transaction
    ? transaction.property_address ?? null
    : transaction.propertyAddress ?? null;
}

function toCommission(value: number | string | null | undefined) {
  const commission = Number(value ?? 0);
  return Number.isFinite(commission) ? commission : 0;
}

function getTaskId(task: DoorScaleTask) {
  return task.id ?? task._id ?? task.taskId;
}

function getTaskTitle(task: DoorScaleTask) {
  return task.title ?? task.body ?? task.name ?? "Untitled Task";
}

function getTaskContactId(task: DoorScaleTask) {
  return task.contactId ?? task.contact_id;
}

function getTaskOpportunityId(task: DoorScaleTask) {
  return task.opportunityId ?? task.opportunity_id ?? task.ghlOpportunityId;
}

function getTaskDueDateTime(task: DoorScaleTask) {
  return task.dueDatetime ?? task.due_datetime ?? task.dueDate ?? task.due_date ?? null;
}

function getTaskDueDate(task: DoorScaleTask) {
  const dueDateTime = getTaskDueDateTime(task);

  if (!dueDateTime) {
    return null;
  }

  return dueDateTime.slice(0, 10);
}

function getTaskStatus(task: DoorScaleTask) {
  if (task.completed) {
    return "completed";
  }

  if (task.status?.toLowerCase() === "completed") {
    return "completed";
  }

  return "pending";
}

function getTaskAssignee(task: DoorScaleTask) {
  return task.assignedTo ?? task.assigned_to ?? null;
}

function mapOpportunityToTransaction(
  opportunity: DoorScaleOpportunity,
  fallbackLocationId: string,
  stageMap: Record<string, string>,
  existing?: ExistingTransaction,
): TransactionUpsertPayload | null {
  if (!opportunity.id) {
    return null;
  }

  const stageId = getOpportunityStageId(opportunity);

  return {
    location_id: opportunity.locationId || fallbackLocationId,
    ghl_opportunity_id: opportunity.id,
    contact_id: opportunity.contactId || existing?.contact_id || null,
    assigned_to: keepExistingWhenEmpty(
      getOpportunityAssignedTo(opportunity),
      existing?.assigned_to,
      "",
    ),
    contact_name: keepExistingWhenEmpty(
      getContactName(opportunity),
      existing?.contact_name,
      "",
    ),
    contact_email: keepExistingWhenEmpty(
      opportunity.contact?.email ?? null,
      existing?.contact_email,
      "",
    ),
    contact_phone: keepExistingWhenEmpty(
      opportunity.contact?.phone ?? null,
      existing?.contact_phone,
      "",
    ),
    property_address: keepExistingWhenEmpty(
      getObjectPropertyAddress(opportunity),
      existing?.property_address,
      "Untitled Transaction",
    ),
    transaction_type: keepExistingWhenEmpty(
      getContactTransactionType(opportunity),
      existing?.transaction_type,
      "Seller",
    ),
    stage: stageId
      ? stageMap[stageId] || "Unmapped Stage"
      : "Unmapped Stage",
    buyer_name: keepExistingWhenEmpty(
      getObjectBuyerName(opportunity),
      existing?.buyer_name,
      "",
    ) || null,
    seller_name: keepExistingWhenEmpty(
      getObjectSellerName(opportunity),
      existing?.seller_name,
      "",
    ) || null,
    closing_date: existing?.closing_date ?? null,
    inspection_date: existing?.inspection_date ?? null,
    commission:
      getOpportunityCommission(opportunity) === undefined ||
      getOpportunityCommission(opportunity) === null
        ? Number(existing?.commission ?? 0)
        : toCommission(getOpportunityCommission(opportunity)),
    status: keepExistingWhenEmpty(opportunity.status, existing?.status, "active"),
    sync_status: "synced",
    last_sync_error: null,
    last_synced_at: new Date().toISOString(),
    created_at: opportunity.createdAt || null,
    updated_at: opportunity.updatedAt || null,
  };
}

function mapTaskToPayload(
  task: DoorScaleTask,
  fallbackLocationId: string,
  transactionByOpportunityId: Map<string, SyncedTransaction>,
  transactionByContactId: Map<string, SyncedTransaction>,
): TaskUpsertPayload | null {
  const taskId = getTaskId(task);

  if (!taskId) {
    return null;
  }

  const opportunityId = getTaskOpportunityId(task);
  const contactId = getTaskContactId(task);
  const matchedTransaction =
    (opportunityId ? transactionByOpportunityId.get(opportunityId) : undefined) ??
    (contactId ? transactionByContactId.get(contactId) : undefined);

  if (!matchedTransaction) {
    return null;
  }

  const dueDateTime = getTaskDueDateTime(task);

  return {
    assigned_to: getTaskAssignee(task),
    contact_id: contactId ?? matchedTransaction.contact_id,
    due_date: getTaskDueDate(task),
    due_datetime: dueDateTime,
    ghl_opportunity_id: opportunityId ?? matchedTransaction.ghl_opportunity_id,
    ghl_task_id: taskId,
    location_id: fallbackLocationId,
    status: getTaskStatus(task),
    sync_status: "synced",
    last_sync_error: null,
    last_synced_at: new Date().toISOString(),
    title: getTaskTitle(task),
    transaction_id: matchedTransaction.id,
  };
}

function dedupeTasksByExternalId(tasks: TaskUpsertPayload[]) {
  return Array.from(
    new Map(tasks.map((task) => [task.ghl_task_id, task])).values(),
  );
}

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({
      ok: false,
      message: "Unable to sync DoorScale data.",
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: connections, error: connectionError } = await supabase
    .from("ghl_locations")
    .select("access_token, created_at, location_id")
    .order("created_at", { ascending: false })
    .limit(1);

  if (connectionError) {
    console.error("DoorScale sync connection lookup failed:", connectionError);
    response.status(500).json({
      ok: false,
      message: "Unable to sync DoorScale data.",
    });
    return;
  }

  const connection = connections?.[0] as StoredConnection | undefined;

  if (!connection?.access_token) {
    response.status(404).json({
      ok: false,
      message: "DoorScale account is not connected.",
    });
    return;
  }

  const pipelines = await fetchPipelines(
    connection.access_token,
    connection.location_id,
  );
  const opportunitiesUrl = new URL(OPPORTUNITIES_URL);
  opportunitiesUrl.searchParams.set("location_id", connection.location_id);

  const opportunitiesResponse = await fetch(opportunitiesUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${connection.access_token}`,
      Version: API_VERSION,
    },
  });

  const rawBody = await opportunitiesResponse.text();
  console.log("DoorScale opportunities sync response:", rawBody);

  let opportunitiesPayload: OpportunitiesResponse = {};

  try {
    opportunitiesPayload = JSON.parse(rawBody) as OpportunitiesResponse;
  } catch {
    opportunitiesPayload = {};
  }

  if (!opportunitiesResponse.ok) {
    response.status(opportunitiesResponse.status).json({
      ok: false,
      message: "Unable to sync DoorScale data.",
    });
    return;
  }

  const opportunities = getOpportunities(opportunitiesPayload).filter(
    (opportunity) => Boolean(opportunity.id),
  );
  const pipelineUsed = findTransactionManagementSystemPipeline(pipelines);

  if (!pipelineUsed) {
    response.status(200).json({
      ok: false,
      message: "Transaction Management System pipeline was not found.",
    });
    return;
  }

  const pipelineIdUsed = pipelineUsed ? getPipelineId(pipelineUsed) : undefined;
  const pipelineNameUsed = pipelineUsed ? getPipelineName(pipelineUsed) : undefined;
  const stageMap = buildStageMap(pipelineUsed);
  const syncableOpportunities = pipelineIdUsed
    ? opportunities.filter(
        (opportunity) => getOpportunityPipelineId(opportunity) === pipelineIdUsed,
      )
    : [];
  const skippedOpportunities = opportunities.length - syncableOpportunities.length;
  const opportunityIds = syncableOpportunities
    .map((opportunity) => opportunity.id)
    .filter((id): id is string => Boolean(id));

  if (!opportunityIds.length || !syncableOpportunities.length) {
    response.status(200).json({
      ok: true,
      message: "DoorScale data synced successfully.",
      syncedTransactions: 0,
      syncedTasks: 0,
      skippedTasks: 0,
      pipelineNameUsed,
      pipelineIdUsed,
      skippedOpportunities,
    });
    return;
  }

  const { data: existingTransactions, error: existingTransactionsError } =
    await supabase
      .from("transactions")
      .select(
        "ghl_opportunity_id, buyer_name, seller_name, transaction_type, closing_date, inspection_date, contact_id, property_address, assigned_to, contact_name, contact_email, contact_phone, commission, status",
      )
      .in("ghl_opportunity_id", opportunityIds);

  if (existingTransactionsError) {
    console.error(
      "DoorScale sync existing transaction lookup failed:",
      existingTransactionsError,
    );
    response.status(500).json({
      ok: false,
      message: "Unable to sync DoorScale data.",
    });
    return;
  }

  const existingByOpportunityId = new Map(
    ((existingTransactions ?? []) as ExistingTransaction[]).map(
      (transaction) => [transaction.ghl_opportunity_id, transaction],
    ),
  );

  // Requires transactions.ghl_opportunity_id with a unique index so synced
  // DoorScale opportunities can upsert into stable transaction rows.
  const payload = syncableOpportunities
    .map((opportunity) =>
      mapOpportunityToTransaction(
        opportunity,
        connection.location_id,
        stageMap,
        opportunity.id
          ? existingByOpportunityId.get(opportunity.id)
          : undefined,
      ),
    )
    .filter((transaction): transaction is TransactionUpsertPayload =>
      Boolean(transaction),
    );

  if (payload.length) {
    const { data: syncedTransactions, error: syncError } = await supabase
      .from("transactions")
      .upsert(payload, { onConflict: "ghl_opportunity_id" })
      .select("id, ghl_opportunity_id, contact_id");

    if (syncError) {
      console.error("DoorScale transaction sync upsert failed:", syncError);
      response.status(500).json({
        ok: false,
        message: "Unable to sync DoorScale data.",
      });
      return;
    }

    const syncedTransactionRows = (syncedTransactions ?? []) as SyncedTransaction[];
    const transactionByOpportunityId = new Map(
      syncedTransactionRows
        .filter((transaction) => Boolean(transaction.ghl_opportunity_id))
        .map((transaction) => [
          transaction.ghl_opportunity_id as string,
          transaction,
        ]),
    );
    const transactionByContactId = new Map(
      syncedTransactionRows
        .filter((transaction) => Boolean(transaction.contact_id))
        .map((transaction) => [transaction.contact_id as string, transaction]),
    );
    const tasks = await fetchTasks(
      connection.access_token,
      connection.location_id,
    );
    const taskPayload = dedupeTasksByExternalId(
      tasks
        .map((task) =>
          mapTaskToPayload(
            task,
            connection.location_id,
            transactionByOpportunityId,
            transactionByContactId,
          ),
        )
        .filter((task): task is TaskUpsertPayload => Boolean(task)),
    );
    const skippedTasks = tasks.length - taskPayload.length;
    let syncedTasks = 0;

    if (taskPayload.length) {
      const { data: syncedTaskRows, error: taskSyncError } = await supabase
        .from("tasks")
        .upsert(taskPayload, { onConflict: "ghl_task_id" })
        .select("id");

      if (taskSyncError) {
        console.error("DoorScale task sync upsert failed:", taskSyncError);
        response.status(500).json({
          ok: false,
          message: "Unable to sync DoorScale data.",
        });
        return;
      }

      syncedTasks = syncedTaskRows?.length ?? 0;
    }

    response.status(200).json({
      ok: true,
      message: "DoorScale data synced successfully.",
      syncedTransactions: syncedTransactions?.length ?? 0,
      syncedTasks,
      skippedTasks,
      pipelineNameUsed,
      pipelineIdUsed,
      skippedOpportunities,
    });
    return;
  }

  response.status(200).json({
    ok: true,
    message: "DoorScale data synced successfully.",
    syncedTransactions: 0,
    syncedTasks: 0,
    skippedTasks: 0,
    pipelineNameUsed,
    pipelineIdUsed,
    skippedOpportunities,
  });
}
