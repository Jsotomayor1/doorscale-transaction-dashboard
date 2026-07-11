import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getActiveLocation, getRequestedLocationId } from "./_active-location.js";

const API_VERSION = "2021-07-28";
const API_BASE = "https://services.leadconnectorhq.com";
const TRANSACTION_OBJECT_KEY = "custom_objects.transactions";

const ROLE_LABEL_BY_ASSOCIATION_KEY: Record<string, string> = {
  agent: "Agent",
  appraiser: "Appraiser",
  attorney: "Attorney",
  insurance_agent: "Insurance Agent",
  inspector: "Inspector",
  involved_party_buyersellertenant: "Involved Party",
  lender: "Lender",
  other_transaction_contact: "Other Transaction Contact",
  rent_payment_transaction_property: "Property",
  title_escrow: "Title/Escrow",
  transaction_company: "Linked Organization",
  transaction_coordinator: "Transaction Coordinator",
};

const CONTACT_LABELS = [
  "involved party",
  "agent",
  "lender",
  "title/escrow",
  "inspector",
  "attorney",
  "appraiser",
  "insurance agent",
  "transaction coordinator",
  "other transaction contact",
];

const associationDefinitionCache = new Map<string, AssociationDefinition>();
const roleAssociationIdCache = new Map<string, Record<string, string>>();

type AssociationsBody = {
  action?: string;
  active_location_id?: string;
  locationId?: string;
  transactionId?: string;
};

type TransactionRow = {
  contact_id?: string | null;
  ghl_contact_id?: string | null;
  ghl_opportunity_id?: string | null;
  location_id: string;
  property_address?: string | null;
};

type LooseRecord = Record<string, any>;

type AssociationDefinition = {
  associationType?: string;
  firstObjectKey?: string;
  firstObjectLabel?: string;
  id?: string;
  key?: string;
  secondObjectKey?: string;
  secondObjectLabel?: string;
};

type NormalizedAssociation = {
  associationId: string;
  associationKey: string;
  associationLabel: string;
  company: string;
  email: string;
  id: string;
  name: string;
  openUrl: string;
  phone: string;
  role: string;
  type: "contact" | "company" | "property" | "unknown";
};

function normalizeLabel(label = "") {
  return label.trim().toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ");
}

function normalizeAssociationKey(key = "") {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function displayLabel(label = "") {
  const normalized = normalizeLabel(label);
  if (normalized === "title escrow") return "Title/Escrow";
  if (normalized === "transaction coordinators") return "Transaction Coordinator";
  if (normalized === "buyer seller tenant") return "Involved Party";
  if (normalized === "linked company") return "Linked Organization";
  if (normalized === "transaction property") return "Property";

  const known = CONTACT_LABELS.find((value) => normalizeLabel(value) === normalized);
  if (known) {
    return known
      .split(" ")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
      .replace("Title/escrow", "Title/Escrow");
  }

  return label || "Other Transaction Contact";
}

function isContactAssociation(association: NormalizedAssociation) {
  return association.type === "contact" || CONTACT_LABELS.includes(normalizeLabel(association.associationLabel));
}

function getId(value: LooseRecord) {
  return String(value.id || value._id || value.recordId || value.contactId || value.companyId || value.objectRecordId || "");
}

function getProperties(value: LooseRecord) {
  return (value.properties || value.customFields || {}) as LooseRecord;
}

function getName(value: LooseRecord) {
  const properties = getProperties(value);

  return (
    value.name ||
    value.contactName ||
    value.fullName ||
    [value.firstName || value.first_name, value.lastName || value.last_name]
      .filter(Boolean)
      .join(" ") ||
    value.companyName ||
    properties.name ||
    properties.property_address ||
    properties.propertyAddress ||
    value.propertyName ||
    value.address ||
    value.propertyAddress ||
    "Unnamed"
  );
}

function getEntityFromPayload(payload: unknown, keys: string[]) {
  const body = payload as LooseRecord;

  for (const key of keys) {
    if (body?.[key] && typeof body[key] === "object") return body[key] as LooseRecord;
  }

  return body && typeof body === "object" ? body : {};
}

function getRelationObjectKey(raw: LooseRecord) {
  return String(raw.firstObjectKey || raw.sourceObjectKey || raw.relatedObjectKey || raw.objectType || raw.type || "");
}

function getRelationRecordId(raw: LooseRecord) {
  return String(raw.firstRecordId || raw.sourceRecordId || raw.relatedRecordId || raw.recordId || "");
}

function inferType(objectKey = "", entity: LooseRecord = {}): NormalizedAssociation["type"] {
  const normalized = objectKey.toLowerCase();
  if (normalized.includes("contact")) return "contact";
  if (normalized.includes("business") || normalized.includes("compan") || normalized.includes("organization")) return "company";
  if (normalized.includes("property") || normalized.includes("home")) return "property";
  if (entity.email || entity.phone || entity.contactId) return "contact";
  if (entity.companyName || entity.name) return "company";
  if (entity.address || entity.propertyAddress || getProperties(entity).property_address) return "property";
  return "unknown";
}

function extractArray(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) return payload as LooseRecord[];
  const body = payload as LooseRecord;

  for (const key of keys) {
    if (Array.isArray(body?.[key])) return body[key] as LooseRecord[];
  }

  if (Array.isArray(body?.data?.records)) return body.data.records as LooseRecord[];
  if (Array.isArray(body?.data?.relations)) return body.data.relations as LooseRecord[];
  if (Array.isArray(body?.data?.associations)) return body.data.associations as LooseRecord[];
  if (Array.isArray(body?.records)) return body.records as LooseRecord[];
  if (Array.isArray(body?.relations)) return body.relations as LooseRecord[];
  if (Array.isArray(body?.associations)) return body.associations as LooseRecord[];
  if (Array.isArray(body?.items)) return body.items as LooseRecord[];
  return [];
}

async function ghlRequest(input: {
  accessToken: string;
  body?: unknown;
  endpoint: string;
  method: "GET" | "POST";
}) {
  const response = await fetch(`${API_BASE}${input.endpoint}`, {
    method: input.method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken.replace(/^Bearer\s+/i, "")}`,
      "Content-Type": "application/json",
      Version: API_VERSION,
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const text = await response.text();
  let json: unknown = {};

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 600) };
  }

  return { json, response, text };
}

function recordMatchesTransaction(record: LooseRecord, transaction: TransactionRow) {
  const values = JSON.stringify(record).toLowerCase();
  const opportunityId = transaction.ghl_opportunity_id?.toLowerCase();
  const contactId = (transaction.ghl_contact_id || transaction.contact_id || "").toLowerCase();
  const propertyAddress = transaction.property_address?.trim().toLowerCase();

  return Boolean(
    (opportunityId && values.includes(opportunityId)) ||
    (contactId && values.includes(contactId)) ||
    (propertyAddress && values.includes(propertyAddress)),
  );
}

async function findTransactionObjectRecord(input: {
  accessToken: string;
  locationId: string;
  transaction: TransactionRow;
}) {
  const searchBody = {
    locationId: input.locationId,
    page: 1,
    pageLimit: 20,
    query: "",
    searchAfter: [],
  };
  const search = await ghlRequest({
    accessToken: input.accessToken,
    body: searchBody,
    endpoint: `/objects/${encodeURIComponent(TRANSACTION_OBJECT_KEY)}/records/search`,
    method: "POST",
  });
  const records = extractArray(search.json, ["records", "items", "data"]);
  const matchedRecord = records.find((record) => recordMatchesTransaction(record, input.transaction)) || records[0] || null;

  console.log("DoorScale transaction object record lookup:", {
    objectKey: TRANSACTION_OBJECT_KEY,
    recordsReturned: records.length,
    searchStatus: search.response.status,
    selectedRecordId: matchedRecord ? getId(matchedRecord) : null,
  });

  return {
    objectKey: TRANSACTION_OBJECT_KEY,
    record: matchedRecord,
    recordId: matchedRecord ? getId(matchedRecord) : "",
  };
}

async function fetchAssociationDefinition(input: {
  accessToken: string;
  associationId: string;
  locationId: string;
}) {
  const cacheKey = `${input.locationId}:${input.associationId}`;
  const cached = associationDefinitionCache.get(cacheKey);
  if (cached) return cached;

  const result = await ghlRequest({
    accessToken: input.accessToken,
    endpoint: `/associations/${encodeURIComponent(input.associationId)}?locationId=${encodeURIComponent(input.locationId)}`,
    method: "GET",
  });

  if (!result.response.ok) {
    console.warn("DoorScale association definition unavailable:", {
      associationId: input.associationId,
      status: result.response.status,
    });
    return null;
  }

  const definition = result.json as AssociationDefinition;
  associationDefinitionCache.set(cacheKey, definition);
  return definition;
}

function cacheResolvedAssociationId(locationId: string, definition: AssociationDefinition) {
  const roleKey = normalizeAssociationKey(definition.key || "");
  if (!roleKey || !definition.id) return;

  const current = roleAssociationIdCache.get(locationId) || {};
  roleAssociationIdCache.set(locationId, {
    ...current,
    [roleKey]: definition.id,
  });
}

async function buildAssociationDefinitions(input: {
  accessToken: string;
  locationId: string;
  rows: LooseRecord[];
}) {
  const ids = [...new Set(input.rows.map((row) => String(row.associationId || "")).filter(Boolean))];
  const entries = await Promise.all(
    ids.map(async (associationId) => [associationId, await fetchAssociationDefinition({
      accessToken: input.accessToken,
      associationId,
      locationId: input.locationId,
    })] as const),
  );
  const definitions = entries.reduce<Record<string, AssociationDefinition>>((map, [associationId, definition]) => {
    if (definition) {
      map[associationId] = definition;
      cacheResolvedAssociationId(input.locationId, definition);
    }
    return map;
  }, {});

  console.log("DoorScale association definitions loaded:", {
    definitionEndpoint: "/associations/{associationId}?locationId={locationId}",
    locationId: input.locationId,
    resolvedRoleKeys: Object.keys(roleAssociationIdCache.get(input.locationId) || {}),
    roleLabels: Object.values(definitions).map(getRoleLabelFromDefinition),
  });

  return definitions;
}

async function hydrateRelatedRecord(input: {
  accessToken: string;
  locationId: string;
  objectKey: string;
  recordId: string;
}) {
  if (!input.recordId) return {};

  if (input.objectKey === "contact") {
    const result = await ghlRequest({
      accessToken: input.accessToken,
      endpoint: `/contacts/${encodeURIComponent(input.recordId)}`,
      method: "GET",
    });
    return result.response.ok ? getEntityFromPayload(result.json, ["contact"]) : {};
  }

  if (input.objectKey === "business") {
    const result = await ghlRequest({
      accessToken: input.accessToken,
      endpoint: `/businesses/${encodeURIComponent(input.recordId)}?locationId=${encodeURIComponent(input.locationId)}`,
      method: "GET",
    });
    return result.response.ok ? getEntityFromPayload(result.json, ["business", "record"]) : {};
  }

  if (input.objectKey.startsWith("custom_objects.")) {
    const result = await ghlRequest({
      accessToken: input.accessToken,
      endpoint: `/objects/${encodeURIComponent(input.objectKey)}/records/${encodeURIComponent(input.recordId)}`,
      method: "GET",
    });
    return result.response.ok ? getEntityFromPayload(result.json, ["record"]) : {};
  }

  return {};
}

function getRoleLabelFromDefinition(definition: AssociationDefinition | undefined) {
  const roleKey = normalizeAssociationKey(definition?.key || "");
  if (roleKey && ROLE_LABEL_BY_ASSOCIATION_KEY[roleKey]) {
    return ROLE_LABEL_BY_ASSOCIATION_KEY[roleKey];
  }

  return displayLabel(
    definition?.secondObjectKey === TRANSACTION_OBJECT_KEY
      ? definition.secondObjectLabel || definition.firstObjectLabel || definition.key || definition.id
      : definition?.firstObjectLabel || definition?.secondObjectLabel || definition?.key || definition?.id || "Other Transaction Contact",
  );
}

function getRoleLabel(definition: AssociationDefinition | undefined, relation: LooseRecord) {
  return getRoleLabelFromDefinition(definition) || displayLabel(relation.associationId || "Other Transaction Contact");
}

function normalizeHydratedAssociation(input: {
  definition?: AssociationDefinition;
  entity: LooseRecord;
  locationId: string;
  relation: LooseRecord;
}): NormalizedAssociation {
  const objectKey = getRelationObjectKey(input.relation);
  const id = getId(input.entity) || getRelationRecordId(input.relation);
  const type = inferType(objectKey, input.entity);
  const properties = getProperties(input.entity);
  const label = getRoleLabel(input.definition, input.relation);

  return {
    associationId: String(input.relation.associationId || ""),
    associationKey: normalizeAssociationKey(input.definition?.key || ""),
    associationLabel: label,
    company: type === "company" ? "" : input.entity.company || input.entity.companyName || properties.company || "",
    email: input.entity.email || properties.email || "",
    id,
    name: getName(input.entity),
    openUrl: type === "contact" && id
      ? `https://app.gohighlevel.com/v2/location/${input.locationId}/contacts/detail/${id}`
      : "",
    phone: input.entity.phone || properties.phone || "",
    role: label,
    type,
  };
}

async function fetchAssociations(input: {
  accessToken: string;
  locationId: string;
  recordId: string;
}) {
  const result = await ghlRequest({
    accessToken: input.accessToken,
    endpoint: `/associations/relations/${encodeURIComponent(input.recordId)}?locationId=${encodeURIComponent(input.locationId)}&skip=0&limit=20`,
    method: "GET",
  });
  const rows = extractArray(result.json, ["relations", "associations", "items", "data"]);
  const definitions = await buildAssociationDefinitions({
    accessToken: input.accessToken,
    locationId: input.locationId,
    rows,
  });
  const normalized = await Promise.all(rows.map(async (row) => {
    const objectKey = getRelationObjectKey(row);
    const recordId = getRelationRecordId(row);
    const entity = await hydrateRelatedRecord({
      accessToken: input.accessToken,
      locationId: input.locationId,
      objectKey,
      recordId,
    });

    return normalizeHydratedAssociation({
      definition: definitions[String(row.associationId || "")],
      entity,
      locationId: input.locationId,
      relation: row,
    });
  }));

  console.log("DoorScale transaction object associations fetched:", {
    associationLabels: normalized.map((association) => association.associationLabel),
    associationStatus: result.response.status,
    companyCount: normalized.filter((association) => association.type === "company").length,
    contactCount: normalized.filter(isContactAssociation).length,
    propertyCount: normalized.filter((association) => association.type === "property").length,
    recordId: input.recordId,
    relationCount: rows.length,
    relatedObjectTypes: rows.map((row) => getRelationObjectKey(row)),
  });

  return normalized;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "This action is not available." });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ ok: false, message: "Unable to load transaction team." });
    return;
  }

  const body = (request.body ?? {}) as AssociationsBody;
  const transactionId = body.transactionId || "";
  const activeLocationId = getRequestedLocationId(request);

  if (!transactionId || !activeLocationId) {
    response.status(400).json({ ok: false, message: "Transaction details are missing." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const connectedAccount = await getActiveLocation(request, supabase, "/api/ghl/transaction-associations");
  const { data, error } = await supabase
    .from("transactions")
    .select("location_id, contact_id, ghl_contact_id, ghl_opportunity_id, property_address")
    .eq("id", transactionId)
    .eq("location_id", activeLocationId)
    .maybeSingle();

  if (error || !data) {
    console.error("DoorScale transaction association lookup failed:", {
      error,
      transactionId,
    });
    response.status(404).json({ ok: false, message: "Transaction not found." });
    return;
  }

  const transaction = data as TransactionRow;
  const objectRecord = await findTransactionObjectRecord({
    accessToken: connectedAccount.access_token,
    locationId: activeLocationId,
    transaction,
  });

  if (!objectRecord.recordId || !objectRecord.objectKey) {
    response.status(200).json({
      associations: [],
      contactsByLabel: {},
      linkedOrganization: null,
      linkedProperty: null,
      objectKey: TRANSACTION_OBJECT_KEY,
      objectRecordId: "",
      ok: true,
    });
    return;
  }

  const associations = await fetchAssociations({
    accessToken: connectedAccount.access_token,
    locationId: activeLocationId,
    recordId: objectRecord.recordId,
  });
  const contactsByLabel = associations.filter(isContactAssociation).reduce<Record<string, NormalizedAssociation[]>>(
    (groups, association) => {
      const label = association.associationLabel || "Other Transaction Contact";
      groups[label] = [...(groups[label] || []), association];
      return groups;
    },
    {},
  );

  response.status(200).json({
    associations,
    contactsByLabel,
    linkedOrganization: associations.find((association) => association.type === "company") || null,
    linkedProperty: associations.find((association) => association.type === "property") || null,
    objectKey: objectRecord.objectKey,
    objectRecordId: objectRecord.recordId,
    ok: true,
  });
}
