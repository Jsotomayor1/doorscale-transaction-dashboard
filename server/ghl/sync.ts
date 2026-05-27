import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getActiveLocation, logRouteDataCounts } from "./_active-location.js";

const OPPORTUNITIES_URL =
  "https://services.leadconnectorhq.com/opportunities/search";
const PIPELINES_URL = "https://services.leadconnectorhq.com/opportunities/pipelines";
const TASKS_URL_BASE = "https://services.leadconnectorhq.com/locations";
const LOCATION_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/locationToken";
const API_VERSION = "2021-07-28";

type StoredConnection = {
  access_token?: string | null;
  company_id?: string | null;
  created_at?: string;
  connection_status?: string | null;
  location_id: string;
  location_access_token?: string | null;
  location_refresh_token?: string | null;
  location_token_expires_at?: string | null;
  parent_connection_id?: number | null;
  selected_location_id?: string | null;
  is_bulk_installation?: boolean | null;
  user_type?: string | null;
};

type LooseQueryResult = {
  data?: unknown;
  error?: unknown;
};

type LooseQueryBuilder = PromiseLike<LooseQueryResult> & {
  eq(column: string, value: unknown): LooseQueryBuilder;
  in(column: string, values: unknown[]): LooseQueryBuilder;
  insert(values: unknown): LooseQueryBuilder;
  maybeSingle(): Promise<LooseQueryResult>;
  select(columns?: string): LooseQueryBuilder;
  single(): Promise<LooseQueryResult>;
  update(values: unknown): LooseQueryBuilder;
};

type LooseSupabase = {
  from(table: string): LooseQueryBuilder;
};

type ParentConnectionRow = {
  access_token?: string | null;
  company_id?: string | null;
  selected_location_id?: string | null;
};

type LocationTokenResponse = {
  access_token?: string;
  expires_in?: number;
  locationId?: string;
  refresh_token?: string;
  token_type?: string;
  userType?: string;
  [key: string]: unknown;
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
  contact_id?: string;
  locationId?: string;
  location_id?: string;
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
  relations?: Array<{
    contactName?: string;
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
  id?: string;
  ghl_opportunity_id: string;
  buyer_name: string | null;
  closing_date: string | null;
  contact_id: string | null;
  ghl_contact_id: string | null;
  ghl_location_id: string | null;
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
  client_email?: string | null;
  client_first_name?: string | null;
  client_last_name?: string | null;
  client_phone?: string | null;
};

type TransactionUpsertPayload = {
  location_id: string;
  ghl_opportunity_id: string;
  contact_id: string | null;
  ghl_contact_id: string | null;
  ghl_location_id: string | null;
  assigned_to: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  client_email: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_phone: string | null;
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
  stage?: string | null;
  transaction_type?: string | null;
};

type ExistingTask = {
  ghl_task_id: string;
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

function redactTokenValue(value: unknown) {
  if (typeof value !== "string") return value;
  if (value.length <= 12) return "[redacted]";

  return `${value.slice(0, 6)}...[redacted]...${value.slice(-4)}`;
}

function redactTokens<T extends Record<string, unknown>>(data: T) {
  return {
    ...data,
    access_token: redactTokenValue(data.access_token),
    refresh_token: redactTokenValue(data.refresh_token),
  };
}

function parseJson<T>(rawBody: string) {
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return null;
  }
}

function hasUsableLocationToken(connection: StoredConnection) {
  if (!connection.location_access_token || !connection.location_token_expires_at) {
    return false;
  }

  const expiresAt = new Date(connection.location_token_expires_at).getTime();

  return Number.isFinite(expiresAt) && expiresAt - Date.now() > 5 * 60 * 1000;
}

function isCompanyInstall(connection: StoredConnection) {
  if (connection.user_type === "PrivateIntegration") return false;

  return (
    connection.is_bulk_installation === true ||
    connection.user_type?.toLowerCase() === "company" ||
    Boolean(connection.company_id)
  );
}

async function getLocationAccessToken(
  supabase: LooseSupabase,
  connection: StoredConnection,
) {
  const selectedLocationId = isCompanyInstall(connection)
    ? connection.selected_location_id
    : connection.selected_location_id ?? connection.location_id;

  if (connection.user_type === "PrivateIntegration") {
    if (!connection.access_token || !selectedLocationId) {
      throw new Error("location_token_unavailable");
    }

    console.log("DoorScale sync using private integration connection:", {
      selected_location_id: selectedLocationId,
    });

    return {
      accessToken: connection.access_token,
      locationId: selectedLocationId,
    };
  }

  console.log("DoorScale sync selected_location_id:", selectedLocationId);
  console.log("DoorScale sync selected account token state:", {
    hasCompanyAccessToken: Boolean(connection.access_token),
    hasLocationAccessToken: Boolean(connection.location_access_token),
    parentConnectionId: connection.parent_connection_id ?? null,
    selected_location_id: selectedLocationId,
    tokenType: connection.location_access_token ? "location" : "missing",
  });

  if (selectedLocationId && hasUsableLocationToken(connection)) {
    console.log("DoorScale sync location token reused:", {
      selected_location_id: selectedLocationId,
    });

    return {
      accessToken: connection.location_access_token as string,
      locationId: selectedLocationId,
    };
  }

  if (!isCompanyInstall(connection) && selectedLocationId) {
    if (!connection.access_token) {
      throw new Error("location_token_unavailable");
    }

    console.log("DoorScale sync using direct location connection:", {
      selected_location_id: selectedLocationId,
    });

    return {
      accessToken: connection.access_token,
      locationId: selectedLocationId,
    };
  }

  if (!connection.company_id || !selectedLocationId) {
    console.error("DoorScale sync location token missing company/location:", {
      hasCompanyId: Boolean(connection.company_id),
      isBulkInstallation: Boolean(connection.is_bulk_installation),
      selected_location_id: selectedLocationId,
      userType: connection.user_type,
    });
    throw new Error("location_token_unavailable");
  }

  let companyAccessToken = connection.access_token;

  if (!companyAccessToken) {
    const parentConnectionId = connection.parent_connection_id;

    if (!parentConnectionId) {
      console.error("DoorScale sync parent company row id is missing:", {
        selected_location_id: selectedLocationId,
      });
      throw new Error("location_token_unavailable");
    }

    console.log("DoorScale sync loading parent company row:", {
      parentConnectionId,
      selected_location_id: selectedLocationId,
    });

    const { data: parentConnection, error: parentError } = await supabase
      .from("ghl_locations")
      .select("access_token, location_id")
      .eq("id", parentConnectionId)
      .maybeSingle();

    if (parentError || !parentConnection) {
      console.error("DoorScale sync parent company row lookup failed:", {
        error: parentError,
        parentConnectionId,
        selected_location_id: selectedLocationId,
      });
      throw new Error("location_token_unavailable");
    }

    const parent = parentConnection as ParentConnectionRow;

    if (!parent.access_token) {
      console.error("DoorScale sync parent company token missing:", {
        parentConnectionId,
        selected_location_id: selectedLocationId,
      });
      throw new Error("location_token_unavailable");
    }

    companyAccessToken = parent.access_token as string;
  }

  const locationTokenBody = {
    companyId: connection.company_id,
    locationId: selectedLocationId,
  };
  const loggedLocationTokenHeaders = {
    Accept: "application/json",
    Authorization: companyAccessToken ? "Bearer [redacted]" : "missing",
    "Content-Type": "application/json",
    Version: API_VERSION,
  };

  console.log("DoorScale sync location token request:", {
    body: locationTokenBody,
    company_id: connection.company_id,
    endpoint: LOCATION_TOKEN_URL,
    hasAccessToken: Boolean(companyAccessToken),
    headers: loggedLocationTokenHeaders,
    method: "POST",
    selected_location_id: selectedLocationId,
  });

  const tokenResponse = await fetch(LOCATION_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${companyAccessToken}`,
      "Content-Type": "application/json",
      Version: API_VERSION,
    },
    body: JSON.stringify(locationTokenBody),
  });
  const rawBody = await tokenResponse.text();
  const tokenData = parseJson<LocationTokenResponse>(rawBody);

  console.log("DoorScale sync location token response:", {
    body: tokenData ? redactTokens(tokenData) : rawBody,
    selected_location_id: selectedLocationId,
    status: tokenResponse.status,
  });

  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw new Error("location_token_unavailable");
  }

  const expiresAt = new Date(
    Date.now() + Number(tokenData.expires_in || 86400) * 1000,
  ).toISOString();
  const db = supabase as LooseSupabase;
  const { error } = await db
    .from("ghl_locations")
    .update({
      location_access_token: tokenData.access_token,
      location_refresh_token: tokenData.refresh_token ?? null,
      location_token_expires_at: expiresAt,
      selected_location_id: selectedLocationId,
      updated_at: new Date().toISOString(),
    })
    .eq("location_id", connection.location_id);

  if (error) {
    console.error("DoorScale sync location token storage failed:", error);
  }

  console.log("DoorScale sync location token created:", {
    selected_location_id: selectedLocationId,
  });

  return {
    accessToken: tokenData.access_token,
    locationId: selectedLocationId,
  };
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

function getContactNameParts(opportunity: DoorScaleOpportunity) {
  const firstName = opportunity.contact?.first_name ?? opportunity.contact?.firstName ?? "";
  const lastName = opportunity.contact?.last_name ?? opportunity.contact?.lastName ?? "";

  if (firstName || lastName) {
    return {
      firstName,
      lastName,
    };
  }

  const nameParts = (opportunity.contact?.name ?? "").trim().split(/\s+/);

  return {
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" "),
  };
}

function getFallbackPartyName(opportunity: DoorScaleOpportunity, transactionType?: string | null) {
  const normalizedType = transactionType?.toLowerCase() ?? "";

  if (normalizedType.includes("buyer") || normalizedType.includes("seller")) {
    return getContactName(opportunity);
  }

  return null;
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
  const transactionType = getContactTransactionType(opportunity);
  const fallbackPartyName = getFallbackPartyName(opportunity, transactionType);
  const contactId =
    opportunity.contactId ??
    opportunity.contact_id ??
    existing?.ghl_contact_id ??
    existing?.contact_id ??
    null;
  const opportunityLocationId =
    opportunity.locationId ??
    opportunity.location_id ??
    existing?.ghl_location_id ??
    fallbackLocationId;
  const locationId = fallbackLocationId;
  const contactNameParts = getContactNameParts(opportunity);
  const propertyAddress = opportunity.name || null;

  return {
    location_id: locationId,
    ghl_opportunity_id: opportunity.id,
    contact_id: contactId,
    ghl_contact_id: contactId ?? existing?.ghl_contact_id ?? null,
    ghl_location_id: opportunityLocationId,
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
    client_email: keepExistingWhenEmpty(
      opportunity.contact?.email ?? null,
      existing?.client_email,
      "",
    ) || null,
    client_first_name: keepExistingWhenEmpty(
      contactNameParts.firstName,
      existing?.client_first_name,
      "",
    ) || null,
    client_last_name: keepExistingWhenEmpty(
      contactNameParts.lastName,
      existing?.client_last_name,
      "",
    ) || null,
    client_phone: keepExistingWhenEmpty(
      opportunity.contact?.phone ?? null,
      existing?.client_phone,
      "",
    ) || null,
    property_address: keepExistingWhenEmpty(
      propertyAddress,
      existing?.property_address,
      "",
    ),
    transaction_type: keepExistingWhenEmpty(
      transactionType,
      existing?.transaction_type,
      "Seller",
    ),
    stage: stageId
      ? stageMap[stageId] || "Unmapped Stage"
      : "Unmapped Stage",
    buyer_name: keepExistingWhenEmpty(
      transactionType?.toLowerCase().includes("buyer")
        ? fallbackPartyName
        : null,
      existing?.buyer_name,
      "",
    ) || null,
    seller_name: keepExistingWhenEmpty(
      transactionType?.toLowerCase().includes("seller")
        ? fallbackPartyName
        : null,
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

type DocumentTemplate = {
  delivery_type?: string | null;
  document_type: string | null;
  location_id?: string | null;
  workflow_name?: string | null;
  workflow_trigger_tag?: string | null;
};

type ExistingDocument = {
  document_type: string | null;
};

async function generateDocumentChecklist(
  supabase: LooseSupabase,
  transaction: SyncedTransaction,
  locationId: string,
) {
  const db = supabase as LooseSupabase;

  if (!transaction.transaction_type || !transaction.stage) {
    return;
  }

  const { data: templates, error: templateError } = await db
    .from("document_templates")
    .select(
      "document_type, delivery_type, workflow_trigger_tag, workflow_name, location_id",
    )
    .in("location_id", [locationId, "demo-location", "global"])
    .eq("transaction_type", transaction.transaction_type)
    .eq("stage", transaction.stage);

  if (templateError) {
    console.error("DoorScale document template lookup failed:", templateError);
    return;
  }

  const templateRows = (templates ?? []) as DocumentTemplate[];
  const locationSpecificTemplates = templateRows.filter(
    (template) => template.location_id === locationId,
  );
  const documentTemplates =
    locationSpecificTemplates.length > 0
      ? locationSpecificTemplates
      : templateRows.filter((template) =>
          ["demo-location", "global"].includes(template.location_id ?? ""),
        );

  if (!documentTemplates.length) {
    return;
  }

  const { data: existingDocuments, error: existingDocumentsError } = await db
    .from("transaction_documents")
    .select("document_type")
    .eq("location_id", locationId)
    .eq("transaction_id", transaction.id);

  if (existingDocumentsError) {
    console.error("DoorScale document checklist lookup failed:", existingDocumentsError);
    return;
  }

  const existingTypes = new Set(
    ((existingDocuments ?? []) as ExistingDocument[])
      .map((document) => document.document_type?.trim().toLowerCase())
      .filter(Boolean),
  );
  const rows = documentTemplates
    .filter((template) => {
      const documentType = template.document_type?.trim().toLowerCase();
      return documentType ? !existingTypes.has(documentType) : false;
    })
    .map((template) => ({
      location_id: locationId,
      transaction_id: transaction.id,
      document_type: template.document_type,
      document_name: template.document_type,
      delivery_type: template.delivery_type || "manual_upload",
      workflow_trigger_tag: template.workflow_trigger_tag || null,
      workflow_name: template.workflow_name || null,
      status: "needed",
    }));

  if (!rows.length) {
    return;
  }

  const { error: insertError } = await db
    .from("transaction_documents")
    .insert(rows);

  if (insertError) {
    console.error("DoorScale document checklist insert failed:", insertError);
  }
}

async function saveSyncedTransactions(
  supabase: LooseSupabase,
  payload: TransactionUpsertPayload[],
  locationId: string,
) {
  const db = supabase as LooseSupabase;
  const syncedRows: SyncedTransaction[] = [];

  for (const transaction of payload) {
    const { data: updatedRow, error: updateError } = await db
      .from("transactions")
      .update(transaction)
      .eq("location_id", locationId)
      .eq("ghl_opportunity_id", transaction.ghl_opportunity_id)
      .select("id, ghl_opportunity_id, contact_id, transaction_type, stage")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (updatedRow) {
      syncedRows.push(updatedRow as SyncedTransaction);
      continue;
    }

    const { data: insertedRow, error: insertError } = await db
      .from("transactions")
      .insert(transaction)
      .select("id, ghl_opportunity_id, contact_id, transaction_type, stage")
      .single();

    if (insertError) {
      throw insertError;
    }

    syncedRows.push(insertedRow as SyncedTransaction);
  }

  return syncedRows;
}

async function saveSyncedTasks(
  supabase: LooseSupabase,
  payload: TaskUpsertPayload[],
  locationId: string,
) {
  const db = supabase as LooseSupabase;
  const taskIds = payload.map((task) => task.ghl_task_id);
  const { data: existingTasks, error: existingTasksError } = await db
    .from("tasks")
    .select("id, ghl_task_id")
    .eq("location_id", locationId)
    .in("ghl_task_id", taskIds);

  if (existingTasksError) {
    throw existingTasksError;
  }

  const existingByTaskId = new Map(
    ((existingTasks ?? []) as ExistingTask[]).map((task) => [
      task.ghl_task_id,
      task.id,
    ]),
  );
  let syncedTasks = 0;

  for (const task of payload) {
    const existingTaskId = existingByTaskId.get(task.ghl_task_id);

    if (existingTaskId) {
      const { error: updateError } = await db
        .from("tasks")
        .update(task)
        .eq("id", existingTaskId)
        .eq("location_id", locationId);

      if (updateError) {
        throw updateError;
      }

      syncedTasks += 1;
      continue;
    }

    const { error: insertError } = await db.from("tasks").insert(task);

    if (insertError) {
      throw insertError;
    }

    syncedTasks += 1;
  }

  return syncedTasks;
}

export default async function handler(
  request: VercelRequest,
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

  let activeLocation;

  try {
    activeLocation = await getActiveLocation(request, supabase, "/api/ghl/sync");
  } catch (error) {
    console.error("DoorScale sync active account failed:", error);
    response.status(409).json({
      ok: false,
      message: "Choose a DoorScale account before syncing.",
    });
    return;
  }

  console.log("DoorScale sync active account:", {
    activeLocationId: activeLocation.location_id,
    connectionId: activeLocation.id,
  });

  const connection: StoredConnection = {
    access_token: activeLocation.access_token,
    location_id: activeLocation.location_id,
    selected_location_id: activeLocation.location_id,
    user_type: "PrivateIntegration",
  };

  let syncToken: string;
  let selectedLocationId: string;
  try {
    const locationToken = await getLocationAccessToken(
      supabase as unknown as LooseSupabase,
      connection,
    );
    syncToken = locationToken.accessToken;
    selectedLocationId = locationToken.locationId;
  } catch (error) {
    console.error("DoorScale sync location token setup failed:", error);
    response.status(409).json({
      ok: false,
      message:
        "Unable to access this DoorScale account. Please reconnect DoorScale.",
    });
    return;
  }

  const pipelines = await fetchPipelines(
    syncToken,
    selectedLocationId,
  );
  const pipelineUsed = findTransactionManagementSystemPipeline(pipelines);

  if (!pipelineUsed) {
    response.status(200).json({
      ok: false,
      message: "Transaction Management System pipeline was not found.",
    });
    logRouteDataCounts("/api/ghl/sync", selectedLocationId, {
      documents: 0,
      tasks: 0,
      transactions: 0,
    });
    return;
  }

  const pipelineIdUsed = getPipelineId(pipelineUsed);
  const pipelineNameUsed = getPipelineName(pipelineUsed);

  if (!pipelineIdUsed) {
    response.status(200).json({
      ok: false,
      message: "Transaction Management System pipeline was not found.",
    });
    return;
  }

  const opportunitiesUrl = new URL(OPPORTUNITIES_URL);
  opportunitiesUrl.searchParams.set("location_id", selectedLocationId);
  opportunitiesUrl.searchParams.set("pipeline_id", pipelineIdUsed);

  console.log("DoorScale sync endpoint called:", opportunitiesUrl.toString());

  const opportunitiesResponse = await fetch(opportunitiesUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${syncToken}`,
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
  const stageMap = buildStageMap(pipelineUsed);
  const syncableOpportunities = opportunities.filter(
    (opportunity) => getOpportunityPipelineId(opportunity) === pipelineIdUsed,
  );
  const skippedOpportunities = opportunities.length - syncableOpportunities.length;
  const opportunityCount = syncableOpportunities.length;
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
      opportunityCount,
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
        "id, ghl_opportunity_id, buyer_name, seller_name, transaction_type, closing_date, inspection_date, contact_id, ghl_contact_id, ghl_location_id, property_address, assigned_to, contact_name, contact_email, contact_phone, client_first_name, client_last_name, client_email, client_phone, commission, status",
      )
      .eq("location_id", selectedLocationId)
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
        selectedLocationId,
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
    let syncedTransactionRows: SyncedTransaction[];

    try {
      syncedTransactionRows = await saveSyncedTransactions(
        supabase as unknown as LooseSupabase,
        payload,
        selectedLocationId,
      );
    } catch (syncError) {
      console.error("DoorScale transaction sync upsert failed:", syncError);
      response.status(500).json({
        ok: false,
        message: "Unable to sync DoorScale data.",
      });
      return;
    }

    await Promise.all(
      syncedTransactionRows.map((transaction) =>
        generateDocumentChecklist(
          supabase as unknown as LooseSupabase,
          transaction,
          selectedLocationId,
        ),
      ),
    );
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
    const tasks = await fetchTasks(syncToken, selectedLocationId);
    const taskPayload = dedupeTasksByExternalId(
      tasks
        .map((task) =>
          mapTaskToPayload(
            task,
            selectedLocationId,
            transactionByOpportunityId,
            transactionByContactId,
          ),
        )
        .filter((task): task is TaskUpsertPayload => Boolean(task)),
    );
    const skippedTasks = tasks.length - taskPayload.length;
    let syncedTasks = 0;

    if (taskPayload.length) {
      try {
        syncedTasks = await saveSyncedTasks(
          supabase as unknown as LooseSupabase,
          taskPayload,
          selectedLocationId,
        );
      } catch (taskSyncError) {
        console.error("DoorScale task sync upsert failed:", taskSyncError);
        response.status(500).json({
          ok: false,
          message: "Unable to sync DoorScale data.",
        });
        return;
      }
    }

    response.status(200).json({
      ok: true,
      message: "DoorScale data synced successfully.",
      syncedTransactions: syncedTransactionRows.length,
      syncedTasks,
      skippedTasks,
      opportunityCount,
      pipelineNameUsed,
      pipelineIdUsed,
      skippedOpportunities,
    });
    logRouteDataCounts("/api/ghl/sync", selectedLocationId, {
      documents: syncedTransactionRows.length,
      tasks: syncedTasks,
      transactions: syncedTransactionRows.length,
    });
    return;
  }

  response.status(200).json({
    ok: true,
    message: "DoorScale data synced successfully.",
    syncedTransactions: 0,
    syncedTasks: 0,
    skippedTasks: 0,
    opportunityCount,
    pipelineNameUsed,
    pipelineIdUsed,
    skippedOpportunities,
  });
  logRouteDataCounts("/api/ghl/sync", selectedLocationId, {
    documents: 0,
    tasks: 0,
    transactions: 0,
  });
}
