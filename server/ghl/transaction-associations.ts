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

type ContactSearchResult = {
  email: string;
  id: string;
  name: string;
  phone: string;
  company?: string;
};

type AssociationsBody = {
  action?: string;
  active_location_id?: string;
  locationId?: string;
  transactionId?: string;
  teamAction?: "addContactAssociation" | "fetchAssociations" | "removeAssociation" | "searchContacts";
  query?: string;
  roleKey?: string;
  contactId?: string;
  relationId?: string;
  companyName?: string;
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
  relationId?: string;
};

type TransactionContactRow = {
  company_name?: string | null;
  created_at?: string | null;
  ghl_contact_id: string;
  is_primary?: boolean | null;
  location_id: string;
  role: string;
  transaction_id: string | number;
  updated_at?: string | null;
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

function collectAssociationDefinitions(payload: unknown) {
  const definitions: AssociationDefinition[] = [];
  const seen = new Set<unknown>();

  function visit(value: unknown) {
    if (!value || typeof value !== "object" || seen.has(value)) return;

    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const record = value as LooseRecord;
    const key = normalizeAssociationKey(record.key || "");
    const id = String(record.id || "");

    if (id && key && ROLE_LABEL_BY_ASSOCIATION_KEY[key]) {
      definitions.push(record as AssociationDefinition);
    }

    Object.values(record).forEach(visit);
  }

  visit(payload);
  return definitions;
}

function getBodyKeys(body: unknown) {
  return body && typeof body === "object" && !Array.isArray(body)
    ? Object.keys(body as LooseRecord)
    : [];
}

function getTokenDiagnostics(token = "") {
  const raw = String(token);
  const trimmed = raw.trim();
  const withoutBearer = trimmed.replace(/^Bearer\s+/i, "");
  const withoutQuotes = withoutBearer.replace(/^["']|["']$/g, "");

  return {
    hasBearerPrefix: /^Bearer\s+/i.test(trimmed),
    hasQuoteWrapper: /^["'].*["']$/.test(withoutBearer),
    rawLength: raw.length,
    sentLength: withoutQuotes.length,
  };
}

async function ghlRequest(input: {
  accessToken: string;
  body?: unknown;
  endpoint: string;
  method: "DELETE" | "GET" | "POST";
  locationId?: string;
}) {
  const url = new URL(input.endpoint, API_BASE);
  const normalizedToken = input.accessToken
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "");
  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${normalizedToken}`,
    "Content-Type": "application/json",
    Version: API_VERSION,
  };

  console.log("DoorScale GHL request diagnostics:", {
    baseUrl: API_BASE,
    bodyKeys: getBodyKeys(input.body),
    contentTypeHeader: headers["Content-Type"],
    endpoint: input.endpoint,
    headerNames: Object.keys(headers),
    locationId: input.locationId || null,
    method: input.method,
    token: getTokenDiagnostics(input.accessToken),
    url: url.toString().replace(API_BASE, "{GHL_API_BASE}"),
    versionHeader: headers.Version,
  });

  const response = await fetch(url, {
    method: input.method,
    headers,
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
    locationId: input.locationId,
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
    locationId: input.locationId,
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

async function fetchTransactionAssociationDefinitions(input: {
  accessToken: string;
  locationId: string;
}) {
  const result = await ghlRequest({
    accessToken: input.accessToken,
    endpoint: `/objects/${encodeURIComponent(TRANSACTION_OBJECT_KEY)}?locationId=${encodeURIComponent(input.locationId)}&fetchProperties=true`,
    locationId: input.locationId,
    method: "GET",
  });

  if (!result.response.ok) {
    console.warn("DoorScale transaction association schema unavailable:", {
      locationId: input.locationId,
      status: result.response.status,
    });
    return [];
  }

  const definitions = collectAssociationDefinitions(result.json);
  definitions.forEach((definition) => cacheResolvedAssociationId(input.locationId, definition));

  console.log("DoorScale transaction association roles discovered:", {
    endpoint: "/objects/custom_objects.transactions?locationId={locationId}&fetchProperties=true",
    locationId: input.locationId,
    roleKeys: Object.keys(roleAssociationIdCache.get(input.locationId) || {}),
  });

  return definitions;
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
      locationId: input.locationId,
      method: "GET",
    });
    return result.response.ok ? getEntityFromPayload(result.json, ["contact"]) : {};
  }

  if (input.objectKey === "business") {
    const result = await ghlRequest({
      accessToken: input.accessToken,
      endpoint: `/businesses/${encodeURIComponent(input.recordId)}?locationId=${encodeURIComponent(input.locationId)}`,
      locationId: input.locationId,
      method: "GET",
    });
    return result.response.ok ? getEntityFromPayload(result.json, ["business", "record"]) : {};
  }

  if (input.objectKey.startsWith("custom_objects.")) {
    const result = await ghlRequest({
      accessToken: input.accessToken,
      endpoint: `/objects/${encodeURIComponent(input.objectKey)}/records/${encodeURIComponent(input.recordId)}`,
      locationId: input.locationId,
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
    relationId: String(input.relation.id || input.relation.relationId || ""),
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

function getContactsFromPayload(payload: unknown) {
  return extractArray(payload, ["contacts", "items", "data"]);
}

function normalizeContactSearchResult(contact: LooseRecord): ContactSearchResult {
  const id = getId(contact);
  const properties = getProperties(contact);

  return {
    company: contact.company || contact.companyName || properties.company || "",
    email: contact.email || "",
    id,
    name: getName(contact),
    phone: contact.phone || "",
  };
}

async function searchContacts(input: {
  accessToken: string;
  locationId: string;
  query: string;
}) {
  const result = await ghlRequest({
    accessToken: input.accessToken,
    body: {
      locationId: input.locationId,
      page: 1,
      pageLimit: 10,
      query: input.query,
    },
    endpoint: "/contacts/search",
    locationId: input.locationId,
    method: "POST",
  });
  const contacts = getContactsFromPayload(result.json).map(normalizeContactSearchResult);

  console.log("DoorScale transaction team contact search:", {
    count: contacts.length,
    queryLength: input.query.length,
    status: result.response.status,
  });

  return contacts;
}

function buildRelationId(contactId: string, role: string) {
  return `${contactId}::${normalizeAssociationKey(role)}`;
}

function getRoleLabelFromKey(role = "") {
  const roleKey = normalizeAssociationKey(role);
  return ROLE_LABEL_BY_ASSOCIATION_KEY[roleKey] || displayLabel(roleKey.replace(/_/g, " "));
}

function normalizeTransactionContact(input: {
  contact: LooseRecord;
  locationId: string;
  row: TransactionContactRow;
}): NormalizedAssociation {
  const properties = getProperties(input.contact);
  const contactId = input.row.ghl_contact_id;
  const roleKey = normalizeAssociationKey(input.row.role);
  const roleLabel = getRoleLabelFromKey(roleKey);
  const crmCompany =
    input.contact.company ||
    input.contact.companyName ||
    input.contact.businessName ||
    properties.company ||
    properties.companyName ||
    properties.businessName ||
    "";

  return {
    associationId: "",
    associationKey: roleKey,
    associationLabel: roleLabel,
    company: crmCompany || input.row.company_name || "",
    email: input.contact.email || properties.email || "",
    id: contactId,
    name: getName(input.contact),
    openUrl: contactId
      ? `https://app.gohighlevel.com/v2/location/${input.locationId}/contacts/detail/${contactId}`
      : "",
    phone: input.contact.phone || properties.phone || "",
    relationId: buildRelationId(contactId, roleKey),
    role: roleLabel,
    type: "contact",
  };
}

async function fetchLiveContact(input: {
  accessToken: string;
  contactId: string;
  locationId: string;
}) {
  return hydrateRelatedRecord({
    accessToken: input.accessToken,
    locationId: input.locationId,
    objectKey: "contact",
    recordId: input.contactId,
  });
}

async function fetchTransactionTeam(input: {
  accessToken: string;
  db: any;
  locationId: string;
  transactionId: string;
}) {
  const { data, error } = await input.db
    .from("transaction_contacts")
    .select("transaction_id, location_id, ghl_contact_id, role, is_primary, company_name, created_at, updated_at")
    .eq("transaction_id", input.transactionId)
    .eq("location_id", input.locationId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("DoorScale transaction team relationship lookup failed:", {
      error,
      locationId: input.locationId,
      transactionId: input.transactionId,
    });
    throw new Error("Unable to load transaction team.");
  }

  const rows = (data || []) as TransactionContactRow[];
  const associations = await Promise.all(
    rows.map(async (row) => {
      const contact = await fetchLiveContact({
        accessToken: input.accessToken,
        contactId: row.ghl_contact_id,
        locationId: input.locationId,
      });

      return normalizeTransactionContact({
        contact,
        locationId: input.locationId,
        row,
      });
    }),
  );

  console.log("DoorScale transaction team loaded from relationship table:", {
    contactCount: associations.length,
    locationId: input.locationId,
    transactionId: input.transactionId,
  });

  return associations;
}

function groupTransactionTeam(associations: NormalizedAssociation[]) {
  return associations.reduce<Record<string, NormalizedAssociation[]>>((groups, association) => {
    const label = association.associationLabel || "Other Transaction Contact";
    groups[label] = [...(groups[label] || []), association];
    return groups;
  }, {});
}

function parseRelationId(relationId = "") {
  const [contactId, ...roleParts] = relationId.split("::");
  return {
    contactId,
    roleKey: normalizeAssociationKey(roleParts.join("::")),
  };
}

async function insertTransactionContact(input: {
  companyName?: string;
  contactId: string;
  db: any;
  locationId: string;
  roleKey: string;
  transactionId: string;
}) {
  const now = new Date().toISOString();
  const payload = {
    company_name: input.companyName || null,
    created_at: now,
    ghl_contact_id: input.contactId,
    is_primary: false,
    location_id: input.locationId,
    role: input.roleKey,
    transaction_id: input.transactionId,
    updated_at: now,
  };

  const { data, error } = await input.db
    .from("transaction_contacts")
    .insert(payload)
    .select("transaction_id, location_id, ghl_contact_id, role, is_primary, company_name, created_at, updated_at")
    .single();

  if (error) {
    console.error("DoorScale transaction team relationship insert failed:", {
      contactId: input.contactId,
      error,
      locationId: input.locationId,
      roleKey: input.roleKey,
      transactionId: input.transactionId,
    });
    throw new Error("Unable to add contact.");
  }

  return data as TransactionContactRow;
}

async function deleteTransactionContact(input: {
  contactId: string;
  db: any;
  locationId: string;
  roleKey: string;
  transactionId: string;
}) {
  const { error } = await input.db
    .from("transaction_contacts")
    .delete()
    .eq("transaction_id", input.transactionId)
    .eq("location_id", input.locationId)
    .eq("ghl_contact_id", input.contactId)
    .eq("role", input.roleKey);

  if (error) {
    console.error("DoorScale transaction team relationship delete failed:", {
      contactId: input.contactId,
      error,
      locationId: input.locationId,
      roleKey: input.roleKey,
      transactionId: input.transactionId,
    });
    throw new Error("Unable to remove contact.");
  }
}

function findDuplicateContactRole(input: {
  contactId: string;
  roleKey: string;
  associations: NormalizedAssociation[];
}) {
  return input.associations.find(
    (association) =>
      association.type === "contact" &&
      association.id === input.contactId &&
      association.associationKey === input.roleKey,
  );
}

function getCachedAssociationId(locationId: string, roleKey: string) {
  return roleAssociationIdCache.get(locationId)?.[roleKey] || "";
}

function getGhlErrorMessage(payload: unknown, fallback = "Unable to add contact to transaction team.") {
  const body = payload as LooseRecord;
  const message = body?.message || body?.error || body?.msg || body?.raw;

  if (Array.isArray(message)) return message.join("; ");
  if (message) return String(message);

  return fallback;
}

async function createContactAssociation(input: {
  accessToken: string;
  associationId: string;
  contactId: string;
  locationId: string;
  roleKey: string;
  transactionRecordId: string;
}) {
  const payload = {
    associationId: input.associationId,
    firstRecordId: input.contactId,
    locationId: input.locationId,
    secondRecordId: input.transactionRecordId,
  };
  const result = await ghlRequest({
    accessToken: input.accessToken,
    body: payload,
    endpoint: "/associations/relations",
    locationId: input.locationId,
    method: "POST",
  });

  console.log("DoorScale transaction team association create request:", {
    associationId: input.associationId,
    contactId: input.contactId,
    payloadKeys: Object.keys(payload),
    roleKey: input.roleKey,
    transactionRecordId: input.transactionRecordId,
  });

  console.log("DoorScale transaction team association create response:", {
    body: result.json,
    status: result.response.status,
  });

  if (!result.response.ok) {
    throw new Error(getGhlErrorMessage(result.json));
  }

  return result.json as LooseRecord;
}

async function removeContactAssociation(input: {
  accessToken: string;
  locationId: string;
  relationId: string;
}) {
  const result = await ghlRequest({
    accessToken: input.accessToken,
    endpoint: `/associations/relations/${encodeURIComponent(input.relationId)}?locationId=${encodeURIComponent(input.locationId)}`,
    locationId: input.locationId,
    method: "DELETE",
  });

  console.log("DoorScale transaction team association remove:", {
    relationId: input.relationId,
    status: result.response.status,
  });

  if (!result.response.ok) {
    throw new Error("Unable to remove contact from transaction team.");
  }

  return result.json as LooseRecord;
}
async function fetchAssociations(input: {
  accessToken: string;
  locationId: string;
  recordId: string;
}) {
  const result = await ghlRequest({
    accessToken: input.accessToken,
    endpoint: `/associations/relations/${encodeURIComponent(input.recordId)}?locationId=${encodeURIComponent(input.locationId)}&skip=0&limit=20`,
    locationId: input.locationId,
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
  const teamAction = body.teamAction || "fetchAssociations";

  if (!activeLocationId) {
    response.status(400).json({ ok: false, message: "DoorScale account is missing." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const connectedAccount = await getActiveLocation(request, supabase, "/api/ghl/transaction-associations");

  console.log("DoorScale transaction association connected-location diagnostics:", {
    activeLocationId,
    connectionId: connectedAccount.id,
    connectionLocationId: connectedAccount.location_id,
    connectionStatus: connectedAccount.connection.connection_status,
    hasToken: Boolean(connectedAccount.access_token),
    requestedLocationId: activeLocationId,
    token: getTokenDiagnostics(connectedAccount.access_token),
    userType: connectedAccount.connection.user_type,
  });

  if (teamAction === "searchContacts") {
    const query = (body.query || "").trim();

    if (query.length < 2) {
      response.status(200).json({ contacts: [], ok: true });
      return;
    }

    const contacts = await searchContacts({
      accessToken: connectedAccount.access_token,
      locationId: activeLocationId,
      query,
    });
    response.status(200).json({ contacts, ok: true });
    return;
  }

  if (!transactionId) {
    response.status(400).json({ ok: false, message: "Transaction details are missing." });
    return;
  }

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

  if (teamAction === "removeAssociation") {
    if (!body.relationId) {
      response.status(400).json({ ok: false, message: "Association details are missing." });
      return;
    }

    const parsedRelation = parseRelationId(body.relationId);

    if (!parsedRelation.contactId || !parsedRelation.roleKey) {
      response.status(400).json({ ok: false, message: "Association details are missing." });
      return;
    }

    await deleteTransactionContact({
      contactId: parsedRelation.contactId,
      db: supabase,
      locationId: activeLocationId,
      roleKey: parsedRelation.roleKey,
      transactionId,
    });
    response.status(200).json({ ok: true, relationId: body.relationId });
    return;
  }

  const associations = await fetchTransactionTeam({
    accessToken: connectedAccount.access_token,
    db: supabase,
    locationId: activeLocationId,
    transactionId,
  });

  if (teamAction === "addContactAssociation") {
    const roleKey = normalizeAssociationKey(body.roleKey || "");
    const contactId = body.contactId || "";

    if (!roleKey || !contactId) {
      response.status(400).json({ ok: false, message: "Contact and role are required." });
      return;
    }

    const duplicate = associations.find(
      (association) => association.id === contactId && association.associationKey === roleKey,
    );

    if (duplicate) {
      response.status(409).json({ ok: false, message: "This contact already has that role on this transaction." });
      return;
    }

    const inserted = await insertTransactionContact({
      companyName: body.companyName,
      contactId,
      db: supabase,
      locationId: activeLocationId,
      roleKey,
      transactionId,
    });
    const contact = await fetchLiveContact({
      accessToken: connectedAccount.access_token,
      contactId,
      locationId: activeLocationId,
    });

    const association = normalizeTransactionContact({
      contact,
      locationId: activeLocationId,
      row: inserted,
    });

    response.status(200).json({ association, ok: true });
    return;
  }

  const contactsByLabel = groupTransactionTeam(associations);

  response.status(200).json({
    associations,
    contactsByLabel,
    linkedOrganization: null,
    linkedProperty: null,
    objectKey: "",
    objectRecordId: "",
    ok: true,
  });
}
