import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getActiveLocation, getRequestedLocationId } from "./_active-location.js";

const API_VERSION = "2021-07-28";
const API_BASE = "https://services.leadconnectorhq.com";

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

type NormalizedAssociation = {
  id: string;
  associationLabel: string;
  company: string;
  email: string;
  name: string;
  openUrl: string;
  phone: string;
  role: string;
  type: "contact" | "company" | "property" | "unknown";
};

function normalizeLabel(label = "") {
  return label.trim().toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ");
}

function displayLabel(label = "") {
  const normalized = normalizeLabel(label);
  if (normalized === "title escrow") return "Title/Escrow";

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

function getName(value: LooseRecord) {
  return (
    value.name ||
    value.contactName ||
    value.fullName ||
    [value.firstName || value.first_name, value.lastName || value.last_name]
      .filter(Boolean)
      .join(" ") ||
    value.companyName ||
    value.propertyName ||
    value.address ||
    "Unnamed"
  );
}

function getAssociatedEntity(raw: LooseRecord) {
  return raw.entity || raw.record || raw.contact || raw.company || raw.property || raw.associatedRecord || raw;
}

function inferType(raw: LooseRecord, entity: LooseRecord): NormalizedAssociation["type"] {
  const rawType = String(raw.type || raw.objectType || raw.associationType || entity.type || entity.objectType || "").toLowerCase();
  if (rawType.includes("contact")) return "contact";
  if (rawType.includes("compan")) return "company";
  if (rawType.includes("property") || rawType.includes("home")) return "property";
  if (entity.email || entity.phone || entity.contactId) return "contact";
  if (entity.companyName) return "company";
  if (entity.address || entity.propertyAddress) return "property";
  return "unknown";
}

function normalizeAssociation(raw: LooseRecord, locationId: string): NormalizedAssociation {
  const entity = getAssociatedEntity(raw);
  const type = inferType(raw, entity);
  const id = getId(entity) || getId(raw);
  const label = raw.associationLabel || raw.label || raw.relationship || raw.associationKey || raw.name || "Other Transaction Contact";

  return {
    associationLabel: displayLabel(label),
    company: entity.company || entity.companyName || raw.company || raw.companyName || "",
    email: entity.email || raw.email || "",
    id,
    name: getName(entity),
    openUrl: type === "contact" && id
      ? `https://app.gohighlevel.com/v2/location/${locationId}/contacts/detail/${id}`
      : "",
    phone: entity.phone || raw.phone || "",
    role: displayLabel(label),
    type,
  };
}

function extractArray(payload: unknown, keys: string[]) {
  if (Array.isArray(payload)) return payload as LooseRecord[];
  const body = payload as LooseRecord;

  for (const key of keys) {
    if (Array.isArray(body?.[key])) return body[key] as LooseRecord[];
  }

  if (Array.isArray(body?.data?.records)) return body.data.records as LooseRecord[];
  if (Array.isArray(body?.data?.associations)) return body.data.associations as LooseRecord[];
  if (Array.isArray(body?.records)) return body.records as LooseRecord[];
  if (Array.isArray(body?.associations)) return body.associations as LooseRecord[];
  return [];
}

async function ghlFetch(accessToken: string, endpoint: string) {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      Version: API_VERSION,
    },
  });
  const text = await response.text();
  let json: unknown = {};

  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { json, response, text };
}

async function firstSuccessfulRead(accessToken: string, endpoints: string[]) {
  const attempts = [];

  for (const endpoint of endpoints) {
    const result = await ghlFetch(accessToken, endpoint);
    attempts.push({ endpoint, status: result.response.status });

    if (result.response.ok) {
      return { ...result, attempts, endpoint };
    }
  }

  return { attempts, endpoint: "", json: {}, response: null, text: "" };
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
  const objectKeys = [
    process.env.GHL_TRANSACTION_OBJECT_KEY || "",
    "transactions",
    "transaction",
  ].filter(Boolean);

  for (const objectKey of objectKeys) {
    const encodedObjectKey = encodeURIComponent(objectKey);
    const endpoints = [
      `${API_BASE}/objects/${encodedObjectKey}/records?locationId=${encodeURIComponent(input.locationId)}`,
      `${API_BASE}/custom-objects/${encodedObjectKey}/records?locationId=${encodeURIComponent(input.locationId)}`,
      `${API_BASE}/objects/${encodedObjectKey}/records/search?locationId=${encodeURIComponent(input.locationId)}`,
    ];
    const result = await firstSuccessfulRead(input.accessToken, endpoints);
    const records = extractArray(result.json, ["records", "items", "data"]);
    const matchedRecord = records.find((record) => recordMatchesTransaction(record, input.transaction));

    console.log("DoorScale transaction object record lookup:", {
      associationObjectKey: objectKey,
      attempts: result.attempts,
      matchedRecordId: matchedRecord ? getId(matchedRecord) : null,
      recordsReturned: records.length,
    });

    if (matchedRecord) {
      return {
        objectKey,
        record: matchedRecord,
        recordId: getId(matchedRecord),
      };
    }
  }

  return { objectKey: "", record: null as LooseRecord | null, recordId: "" };
}

async function fetchAssociations(input: {
  accessToken: string;
  locationId: string;
  objectKey: string;
  recordId: string;
}) {
  const encodedObjectKey = encodeURIComponent(input.objectKey);
  const encodedRecordId = encodeURIComponent(input.recordId);
  const endpoints = [
    `${API_BASE}/objects/${encodedObjectKey}/records/${encodedRecordId}/associations?locationId=${encodeURIComponent(input.locationId)}`,
    `${API_BASE}/custom-objects/${encodedObjectKey}/records/${encodedRecordId}/associations?locationId=${encodeURIComponent(input.locationId)}`,
    `${API_BASE}/objects/${encodedObjectKey}/records/${encodedRecordId}/relations?locationId=${encodeURIComponent(input.locationId)}`,
  ];
  const result = await firstSuccessfulRead(input.accessToken, endpoints);
  const rows = extractArray(result.json, ["associations", "relations", "items", "data"]);
  const normalized = rows.map((row) => normalizeAssociation(row, input.locationId));

  console.log("DoorScale transaction object associations fetched:", {
    associationLabels: normalized.map((association) => association.associationLabel),
    attempts: result.attempts,
    companyCount: normalized.filter((association) => association.type === "company").length,
    contactCount: normalized.filter(isContactAssociation).length,
    propertyCount: normalized.filter((association) => association.type === "property").length,
    recordId: input.recordId,
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
      objectKey: objectRecord.objectKey,
      objectRecordId: "",
      ok: true,
    });
    return;
  }

  const associations = await fetchAssociations({
    accessToken: connectedAccount.access_token,
    locationId: activeLocationId,
    objectKey: objectRecord.objectKey,
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
