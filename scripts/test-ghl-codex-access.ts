import dotenv from "dotenv";
import { resolve } from "node:path";

const OBJECT_KEY = "custom_objects.transactions";
const OBJECT_ID = "6a11cdf37ce99c3a4644cd93";
const envPath = resolve(process.cwd(), ".env.local");
dotenv.config({ path: envPath, override: true, quiet: true });

const requiredEnvNames = ["GHL_CODEX_PIT", "GHL_LOCATION_ID", "GHL_API_BASE"] as const;
type RequiredEnvName = (typeof requiredEnvNames)[number];
type LooseRecord = Record<string, any>;

type AssociationDefinition = {
  firstObjectKey?: string;
  firstObjectLabel?: string;
  id?: string;
  key?: string;
  secondObjectKey?: string;
  secondObjectLabel?: string;
};
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

function normalizeAssociationKey(key = "") {
  return key.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getRoleLabel(definition?: AssociationDefinition) {
  const roleKey = normalizeAssociationKey(definition?.key || "");
  return ROLE_LABEL_BY_ASSOCIATION_KEY[roleKey] || definition?.secondObjectLabel || definition?.firstObjectLabel || definition?.key || null;
}

function readRequiredEnv(name: RequiredEnvName) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing ${name}. Create .env.local in the project root and add this value.`);
  }

  return value;
}

function getRecordId(record: LooseRecord) {
  return String(record.id || record._id || record.recordId || record.objectRecordId || "");
}

function extractArray(payload: unknown, keys: string[] = []) {
  if (Array.isArray(payload)) return payload as LooseRecord[];

  const body = payload as LooseRecord;
  for (const key of keys) {
    if (Array.isArray(body?.[key])) return body[key] as LooseRecord[];
  }

  const candidates = [
    body?.records,
    body?.items,
    body?.data,
    body?.data?.records,
    body?.data?.items,
    body?.relations,
    body?.data?.relations,
    body?.associations,
    body?.data?.associations,
  ];

  return (candidates.find(Array.isArray) || []) as LooseRecord[];
}

function getEntity(payload: unknown, keys: string[]) {
  const body = payload as LooseRecord;
  for (const key of keys) {
    if (body?.[key] && typeof body[key] === "object") return body[key] as LooseRecord;
  }
  return body && typeof body === "object" ? body : {};
}

function getProperties(record: LooseRecord) {
  return (record.properties || {}) as LooseRecord;
}

function getName(record: LooseRecord) {
  const properties = getProperties(record);
  return record.name || record.fullName || [record.firstName, record.lastName].filter(Boolean).join(" ") || properties.name || properties.property_address || "Unnamed";
}

function summarizePayload(payload: unknown) {
  const body = payload as LooseRecord;
  const rows = extractArray(payload);

  return {
    keys: body && typeof body === "object" ? Object.keys(body).slice(0, 16) : [],
    rowCount: rows.length,
    firstRowKeys: rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0]).slice(0, 16) : [],
  };
}

function relationObjectKey(relation: LooseRecord) {
  return String(relation.firstObjectKey || relation.sourceObjectKey || relation.relatedObjectKey || relation.objectType || relation.type || "");
}

function relationRecordId(relation: LooseRecord) {
  return String(relation.firstRecordId || relation.sourceRecordId || relation.relatedRecordId || relation.recordId || "");
}

async function ghlRequest(input: {
  apiBase: string;
  body?: unknown;
  endpoint: string;
  method: "GET" | "POST";
  token: string;
}) {
  const url = new URL(input.endpoint, input.apiBase);
  const response = await fetch(url, {
    method: input.method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.token.replace(/^Bearer\s+/i, "")}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
    body: input.body ? JSON.stringify(input.body) : undefined,
  });
  const text = await response.text();
  let payload: unknown = { raw: text.slice(0, 600) };

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text.slice(0, 600) };
  }

  return {
    ok: response.ok,
    payload,
    status: response.status,
    url: url.toString().replace(input.apiBase, "{GHL_API_BASE}"),
  };
}

function findManualTestRecord(records: LooseRecord[]) {
  const testRecord = records.find((record) => /manual|test/i.test(JSON.stringify(record)));
  return testRecord || records[0] || null;
}

async function fetchDefinition(input: { apiBase: string; associationId: string; locationId: string; token: string }) {
  const result = await ghlRequest({
    apiBase: input.apiBase,
    endpoint: `/associations/${encodeURIComponent(input.associationId)}?locationId=${encodeURIComponent(input.locationId)}`,
    method: "GET",
    token: input.token,
  });
  return result.ok ? result.payload as AssociationDefinition : null;
}

async function hydrateRecord(input: { apiBase: string; locationId: string; objectKey: string; recordId: string; token: string }) {
  if (input.objectKey === "contact") {
    const result = await ghlRequest({ apiBase: input.apiBase, endpoint: `/contacts/${encodeURIComponent(input.recordId)}`, method: "GET", token: input.token });
    return result.ok ? getEntity(result.payload, ["contact"]) : {};
  }
  if (input.objectKey === "business") {
    const result = await ghlRequest({ apiBase: input.apiBase, endpoint: `/businesses/${encodeURIComponent(input.recordId)}?locationId=${encodeURIComponent(input.locationId)}`, method: "GET", token: input.token });
    return result.ok ? getEntity(result.payload, ["business", "record"]) : {};
  }
  if (input.objectKey.startsWith("custom_objects.")) {
    const result = await ghlRequest({ apiBase: input.apiBase, endpoint: `/objects/${encodeURIComponent(input.objectKey)}/records/${encodeURIComponent(input.recordId)}`, method: "GET", token: input.token });
    return result.ok ? getEntity(result.payload, ["record"]) : {};
  }
  return {};
}

async function main() {
  const token = readRequiredEnv("GHL_CODEX_PIT");
  const locationId = readRequiredEnv("GHL_LOCATION_ID");
  const apiBase = readRequiredEnv("GHL_API_BASE").replace(/\/$/, "");

  console.log("DoorScale local GHL Transaction inspection");
  console.log(".env.local loaded:", true);
  console.log("Location ID:", locationId);
  console.log("Object key:", OBJECT_KEY);
  console.log("Object ID:", OBJECT_ID);
  console.log("Token present:", Boolean(token));
  console.log("No write requests will be made.\n");

  const schema = await ghlRequest({
    apiBase,
    endpoint: `/objects/${encodeURIComponent(OBJECT_KEY)}?locationId=${encodeURIComponent(locationId)}&fetchProperties=true`,
    method: "GET",
    token,
  });
  console.log("Schema endpoint:", schema.url);
  console.log("Schema status:", schema.status);
  console.log("Schema summary:", summarizePayload(schema.payload));

  const searchBody = { locationId, page: 1, pageLimit: 20, query: "", searchAfter: [] };
  const search = await ghlRequest({ apiBase, body: searchBody, endpoint: `/objects/${encodeURIComponent(OBJECT_KEY)}/records/search`, method: "POST", token });
  const records = extractArray(search.payload, ["records", "items", "data"]);
  const selectedRecord = findManualTestRecord(records);
  const recordId = selectedRecord ? getRecordId(selectedRecord) : "";

  console.log("Search endpoint:", search.url);
  console.log("Search status:", search.status);
  console.log("Transaction records:", records.map((record) => ({ id: getRecordId(record), keys: Object.keys(record).slice(0, 12) })));
  console.log("Selected manual test record ID:", recordId || "none found");

  if (!recordId) return;

  const relations = await ghlRequest({ apiBase, endpoint: `/associations/relations/${encodeURIComponent(recordId)}?locationId=${encodeURIComponent(locationId)}&skip=0&limit=20`, method: "GET", token });
  const relationRows = extractArray(relations.payload, ["relations", "associations", "items", "data"]);
  const ids = [...new Set(relationRows.map((relation) => String(relation.associationId || "")).filter(Boolean))];
  const definitionEntries = await Promise.all(ids.map(async (associationId) => [associationId, await fetchDefinition({ apiBase, associationId, locationId, token })] as const));
  const definitions = Object.fromEntries(definitionEntries.filter((entry): entry is [string, AssociationDefinition] => Boolean(entry[1])));
  const hydrated = await Promise.all(relationRows.map(async (relation) => {
    const objectKey = relationObjectKey(relation);
    const relatedRecordId = relationRecordId(relation);
    const definition = definitions[String(relation.associationId || "")];
    const entity = await hydrateRecord({ apiBase, locationId, objectKey, recordId: relatedRecordId, token });
    const properties = getProperties(entity);

    return {
      associationId: relation.associationId || null,
      roleLabel: getRoleLabel(definition),
      relatedObjectType: objectKey,
      relatedRecordId,
      name: getName(entity),
      email: entity.email || properties.email || null,
      phone: entity.phone || properties.phone || null,
      company: entity.companyName || entity.company || properties.name || null,
    };
  }));

  console.log("Associations endpoint:", relations.url);
  console.log("Associations status:", relations.status);
  console.log("Association definition endpoint: /associations/{associationId}?locationId={locationId}");
  console.log("Final role labels found:", [...new Set(hydrated.map((row) => row.roleLabel).filter(Boolean))]);
  console.log("Hydrated associations:", hydrated);
  console.log("Authentication succeeded:", [schema.status, search.status, relations.status].some((status) => status !== 401 && status !== 403));
  console.log("Transaction object read succeeded:", search.ok && Boolean(recordId));
}

main().catch((error) => {
  console.error("DoorScale local GHL Transaction inspection failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

