import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPPORTUNITIES_URL =
  "https://services.leadconnectorhq.com/opportunities/search";
const PIPELINES_URL = "https://services.leadconnectorhq.com/opportunities/pipelines";
const TASKS_URL_BASE = "https://services.leadconnectorhq.com/locations";
const CUSTOM_FIELDS_URL_BASE = "https://services.leadconnectorhq.com";
const LOCATION_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/locationToken";
const API_VERSION = "2021-07-28";
const EXPECTED_FIELD_KEYS = [
  "transaction_type",
  "seller_name",
  "buyer_name",
  "property_address",
] as const;

type StoredConnection = {
  access_token?: string | null;
  company_id?: string | null;
  created_at?: string;
  connection_status?: string | null;
  location_id: string;
  location_access_token?: string | null;
  location_refresh_token?: string | null;
  location_token_expires_at?: string | null;
  parent_connection_id?: string | null;
  selected_location_id?: string | null;
  is_bulk_installation?: boolean | null;
  user_type?: string | null;
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

type DoorScaleCustomField = {
  id?: string;
  fieldKey?: string;
  key?: string;
  name?: string;
  model?: string;
  objectKey?: string;
  [key: string]: unknown;
};

type CustomFieldsResponse = {
  customFields?: DoorScaleCustomField[];
  fields?: DoorScaleCustomField[];
  data?: DoorScaleCustomField[];
  [key: string]: unknown;
};

type FieldMap = Record<(typeof EXPECTED_FIELD_KEYS)[number], string[]>;

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
    customFields?: DoorScaleCustomValue[];
    custom_fields?: DoorScaleCustomValue[];
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
  custom_fields?: DoorScaleCustomValue[];
  tags?: unknown;
  [key: string]: unknown;
};

type DoorScaleCustomValue = {
  id?: string;
  fieldId?: string;
  fieldKey?: string;
  key?: string;
  name?: string;
  value?: unknown;
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
  return (
    connection.is_bulk_installation === true ||
    connection.user_type?.toLowerCase() === "company" ||
    Boolean(connection.company_id)
  );
}

async function getLocationAccessToken(
  supabase: ReturnType<typeof createClient>,
  connection: StoredConnection,
  appId: string,
) {
  const selectedLocationId = isCompanyInstall(connection)
    ? connection.selected_location_id
    : connection.selected_location_id ?? connection.location_id;

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

  if (!connection.company_id || !selectedLocationId || !appId) {
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
    const parentConnectionId =
      connection.parent_connection_id ?? `company:${connection.company_id}`;
    console.log("DoorScale sync loading parent company row:", {
      parentConnectionId,
      selected_location_id: selectedLocationId,
    });

    const { data: parentConnection, error: parentError } = await supabase
      .from("ghl_locations")
      .select("access_token, location_id")
      .eq("location_id", parentConnectionId)
      .maybeSingle();

    if (parentError || !parentConnection?.access_token) {
      console.error("DoorScale sync parent company row lookup failed:", {
        error: parentError,
        parentConnectionId,
        selected_location_id: selectedLocationId,
      });
      throw new Error("location_token_unavailable");
    }

    companyAccessToken = parentConnection.access_token as string;
  }

  const locationTokenBody = {
    appId,
    companyId: connection.company_id,
    locationId: selectedLocationId,
  };
  const loggedLocationTokenHeaders = {
    Accept: "application/json",
    Authorization: connection.access_token ? "Bearer [redacted]" : "missing",
    "Content-Type": "application/x-www-form-urlencoded",
    Version: API_VERSION,
  };
  const locationTokenBodyParams = new URLSearchParams({
    appId,
    companyId: connection.company_id,
    locationId: selectedLocationId,
  });

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
      "Content-Type": "application/x-www-form-urlencoded",
      Version: API_VERSION,
    },
    body: locationTokenBodyParams,
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
  const { error } = await supabase
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

function getCustomFields(payload: CustomFieldsResponse) {
  if (Array.isArray(payload.customFields)) {
    return payload.customFields;
  }

  if (Array.isArray(payload.fields)) {
    return payload.fields;
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

function emptyFieldMap(): FieldMap {
  return {
    transaction_type: [],
    seller_name: [],
    buyer_name: [],
    property_address: [],
  };
}

function normalizeFieldIdentifier(value?: string) {
  return value
    ?.toLowerCase()
    .replace(/^custom_field\./, "")
    .replace(/^contact\./, "")
    .replace(/^custom_object\.[^.]+\./, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getFieldIdentifiers(field: DoorScaleCustomField) {
  return [field.id, field.fieldKey, field.key, field.name]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => {
      const normalized = normalizeFieldIdentifier(value);
      return normalized ? [value, normalized] : [value];
    });
}

function addFieldsToMap(fields: DoorScaleCustomField[], fieldMap: FieldMap) {
  for (const field of fields) {
    const identifiers = getFieldIdentifiers(field);

    for (const expectedKey of EXPECTED_FIELD_KEYS) {
      if (
        identifiers.some(
          (identifier) => normalizeFieldIdentifier(identifier) === expectedKey,
        )
      ) {
        fieldMap[expectedKey] = Array.from(
          new Set([...fieldMap[expectedKey], ...identifiers]),
        );
      }
    }
  }
}

async function fetchCustomFields(
  accessToken: string,
  path: string,
  label: string,
) {
  try {
    const fieldsResponse = await fetch(`${CUSTOM_FIELDS_URL_BASE}${path}`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        Version: API_VERSION,
      },
    });
    const rawBody = await fieldsResponse.text();

    if (!fieldsResponse.ok) {
      console.log(`DoorScale ${label} field lookup unavailable:`, rawBody);
      return [];
    }

    return getCustomFields(JSON.parse(rawBody) as CustomFieldsResponse);
  } catch (error) {
    console.error(`DoorScale ${label} field lookup failed:`, error);
    return [];
  }
}

async function buildFieldMap(accessToken: string, locationId: string) {
  const fieldMap = emptyFieldMap();
  const contactFields = await fetchCustomFields(
    accessToken,
    `/locations/${locationId}/customFields`,
    "contact",
  );
  const objectFieldGroups = await Promise.all(
    [
      "custom_object.transactions",
      "custom_object.transaction",
      "custom_object.homes",
      "custom_object.home",
      "transactions",
      "transaction",
      "homes",
      "home",
    ].map((objectKey) =>
      fetchCustomFields(
        accessToken,
        `/custom-fields/object-key/${encodeURIComponent(objectKey)}`,
        objectKey,
      ),
    ),
  );

  addFieldsToMap(contactFields, fieldMap);
  for (const fields of objectFieldGroups) {
    addFieldsToMap(fields, fieldMap);
  }

  for (const expectedKey of EXPECTED_FIELD_KEYS) {
    if (!fieldMap[expectedKey].length) {
      console.log(`DoorScale field mapping missing: ${expectedKey}`);
    }
  }

  return fieldMap;
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

function stringifyCustomValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.join(" ");
  return "";
}

function getValueFromCustomValues(
  values: DoorScaleCustomValue[] | undefined,
  identifiers: string[],
) {
  if (!values?.length || !identifiers.length) {
    return null;
  }

  const normalizedIdentifiers = new Set(
    identifiers
      .map((identifier) => normalizeFieldIdentifier(identifier))
      .filter(Boolean),
  );
  const field = values.find((value) =>
    [value.id, value.fieldId, value.fieldKey, value.key, value.name].some(
      (identifier) =>
        identifier &&
        normalizedIdentifiers.has(normalizeFieldIdentifier(identifier)),
    ),
  );

  return field ? stringifyCustomValue(field.value) || null : null;
}

function getNestedCustomObjectValue(
  opportunity: DoorScaleOpportunity,
  fieldKey: "seller_name" | "buyer_name" | "property_address",
) {
  const transaction = getObjectTransaction(opportunity);

  switch (fieldKey) {
    case "seller_name":
      return "seller_name" in transaction
        ? transaction.seller_name ?? null
        : transaction.sellerName ?? null;
    case "buyer_name":
      return "buyer_name" in transaction
        ? transaction.buyer_name ?? null
        : transaction.buyerName ?? null;
    case "property_address":
      return "property_address" in transaction
        ? transaction.property_address ?? null
        : transaction.propertyAddress ?? null;
  }
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

function getContactTransactionType(opportunity: DoorScaleOpportunity, fieldMap: FieldMap) {
  return (
    opportunity.contact?.transaction_type ??
    opportunity.contact?.transactionType ??
    getValueFromCustomValues(
      opportunity.contact?.customFields ?? opportunity.contact?.custom_fields,
      fieldMap.transaction_type,
    ) ??
    getValueFromCustomValues(
      opportunity.customFields ?? opportunity.custom_fields,
      fieldMap.transaction_type,
    )
  );
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

function getObjectSellerName(opportunity: DoorScaleOpportunity, fieldMap: FieldMap) {
  return (
    getNestedCustomObjectValue(opportunity, "seller_name") ??
    getValueFromCustomValues(
      opportunity.customFields ?? opportunity.custom_fields,
      fieldMap.seller_name,
    )
  );
}

function getObjectBuyerName(opportunity: DoorScaleOpportunity, fieldMap: FieldMap) {
  return (
    getNestedCustomObjectValue(opportunity, "buyer_name") ??
    getValueFromCustomValues(
      opportunity.customFields ?? opportunity.custom_fields,
      fieldMap.buyer_name,
    )
  );
}

function getObjectPropertyAddress(opportunity: DoorScaleOpportunity, fieldMap: FieldMap) {
  return (
    getNestedCustomObjectValue(opportunity, "property_address") ??
    getValueFromCustomValues(
      opportunity.customFields ?? opportunity.custom_fields,
      fieldMap.property_address,
    )
  );
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
  fieldMap: FieldMap,
  existing?: ExistingTransaction,
): TransactionUpsertPayload | null {
  if (!opportunity.id) {
    return null;
  }

  const stageId = getOpportunityStageId(opportunity);
  const transactionType = getContactTransactionType(opportunity, fieldMap);
  const fallbackPartyName = getFallbackPartyName(opportunity, transactionType);
  const contactId =
    opportunity.contactId ??
    opportunity.contact_id ??
    existing?.ghl_contact_id ??
    existing?.contact_id ??
    null;
  const locationId =
    opportunity.locationId ??
    opportunity.location_id ??
    existing?.ghl_location_id ??
    fallbackLocationId;

  return {
    location_id: locationId,
    ghl_opportunity_id: opportunity.id,
    contact_id: contactId,
    ghl_contact_id: contactId ?? existing?.ghl_contact_id ?? null,
    ghl_location_id: locationId,
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
      getObjectPropertyAddress(opportunity, fieldMap) ?? opportunity.name,
      existing?.property_address,
      "Untitled Transaction",
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
      getObjectBuyerName(opportunity, fieldMap) ??
        (transactionType?.toLowerCase().includes("buyer")
          ? fallbackPartyName
          : null),
      existing?.buyer_name,
      "",
    ) || null,
    seller_name: keepExistingWhenEmpty(
      getObjectSellerName(opportunity, fieldMap) ??
        (transactionType?.toLowerCase().includes("seller")
          ? fallbackPartyName
          : null),
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
  document_name: string | null;
  document_type: string | null;
};

type ExistingDocument = {
  document_type: string | null;
};

async function generateDocumentChecklist(
  supabase: ReturnType<typeof createClient>,
  transaction: SyncedTransaction,
  locationId: string,
) {
  if (!transaction.transaction_type || !transaction.stage) {
    return;
  }

  const { data: templates, error: templateError } = await supabase
    .from("document_templates")
    .select("document_type, document_name")
    .eq("location_id", locationId)
    .eq("transaction_type", transaction.transaction_type)
    .eq("stage", transaction.stage);

  if (templateError) {
    console.error("DoorScale document template lookup failed:", templateError);
    return;
  }

  const documentTemplates = (templates ?? []) as DocumentTemplate[];

  if (!documentTemplates.length) {
    return;
  }

  const { data: existingDocuments, error: existingDocumentsError } = await supabase
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
      document_name: template.document_name || template.document_type,
      status: "Needed",
    }));

  if (!rows.length) {
    return;
  }

  const { error: insertError } = await supabase
    .from("transaction_documents")
    .insert(rows);

  if (insertError) {
    console.error("DoorScale document checklist insert failed:", insertError);
  }
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
    .select(
      "access_token, company_id, created_at, connection_status, is_bulk_installation, location_access_token, location_refresh_token, location_token_expires_at, location_id, parent_connection_id, selected_at, selected_location_id, user_type",
    )
    .or("connection_status.eq.connected,connection_status.is.null")
    .not("location_id", "like", "company:%")
    .order("selected_at", { ascending: false, nullsFirst: false })
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

  if (!connection) {
    response.status(404).json({
      ok: false,
      message: "DoorScale account is not connected.",
    });
    return;
  }

  let syncToken: string;
  let selectedLocationId: string;
  const appId = process.env.GHL_APP_ID || process.env.GHL_APP_VERSION_ID || "";

  try {
    const locationToken = await getLocationAccessToken(supabase, connection, appId);
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
  const fieldMap = await buildFieldMap(
    syncToken,
    selectedLocationId,
  );
  const opportunitiesUrl = new URL(OPPORTUNITIES_URL);
  opportunitiesUrl.searchParams.set("location_id", selectedLocationId);

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
        "ghl_opportunity_id, buyer_name, seller_name, transaction_type, closing_date, inspection_date, contact_id, ghl_contact_id, ghl_location_id, property_address, assigned_to, contact_name, contact_email, contact_phone, commission, status",
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
        selectedLocationId,
        stageMap,
        fieldMap,
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
      .select("id, ghl_opportunity_id, contact_id, transaction_type, stage");

    if (syncError) {
      console.error("DoorScale transaction sync upsert failed:", syncError);
      response.status(500).json({
        ok: false,
        message: "Unable to sync DoorScale data.",
      });
      return;
    }

    const syncedTransactionRows = (syncedTransactions ?? []) as SyncedTransaction[];
    await Promise.all(
      syncedTransactionRows.map((transaction) =>
        generateDocumentChecklist(supabase, transaction, selectedLocationId),
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
