import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getActiveLocation,
  getRequestedLocationId,
  logRouteDataCounts,
} from "../_active-location.js";
import { PostTransactionSync } from "../post-transaction-sync.js";

const OPPORTUNITIES_URL = "https://services.leadconnectorhq.com/opportunities/";
const CONTACTS_URL = "https://services.leadconnectorhq.com/contacts/";
const CONTACTS_SEARCH_URL = "https://services.leadconnectorhq.com/contacts/search";
const PIPELINES_URL = "https://services.leadconnectorhq.com/opportunities/pipelines";
const API_VERSION = "2021-07-28";
const PIPELINE_NAME = "Transaction Management System";

type PipelineStage = {
  id?: string;
  _id?: string;
  name?: string;
  title?: string;
};

type Pipeline = {
  id?: string;
  _id?: string;
  name?: string;
  title?: string;
  stages?: PipelineStage[];
  pipelineStages?: PipelineStage[];
};

type PipelinesResponse = {
  data?: Pipeline[];
  pipelines?: Pipeline[];
};

type CreateTransactionBody = {
  buyerName?: string;
  clientEmail?: string;
  clientFirstName?: string;
  clientLastName?: string;
  clientPhone?: string;
  closingDate?: string;
  commission?: string;
  inspectionDate?: string;
  locationId?: string;
  propertyAddress?: string;
  sellerName?: string;
  stage?: string;
  status?: string;
  transactionId?: string;
  transactionType?: string;
};

type Contact = {
  id?: string;
  _id?: string;
  email?: string;
  phone?: string;
};

type ContactSearchResponse = {
  contacts?: Contact[];
  data?: Contact[];
};

type ContactCreateResponse = {
  contact?: Contact;
  id?: string;
};

type ContactIdResult = {
  contact?: {
    id?: string;
    _id?: string;
  };
  id?: string;
  _id?: string;
};

type OpportunityResponse = {
  id?: string;
  opportunity?: {
    id?: string;
    _id?: string;
  };
};

type DuplicateOpportunityResponse = {
  message?: string | string[];
  meta?: {
    existingId?: string;
  };
};

type LocalTransactionMatch = {
  id: string;
};

type TransactionLookupClient = {
  from: (table: "transactions") => any;
};

const TRANSACTIONS_TABLE_COLUMNS = new Set([
  "assigned_to",
  "buyer_name",
  "client_email",
  "client_first_name",
  "client_last_name",
  "client_phone",
  "closing_date",
  "commission",
  "contact_email",
  "contact_id",
  "contact_name",
  "contact_phone",
  "ghl_contact_id",
  "ghl_location_id",
  "ghl_opportunity_id",
  "inspection_date",
  "last_sync_error",
  "last_synced_at",
  "location_id",
  "property_address",
  "seller_name",
  "stage",
  "status",
  "sync_status",
  "transaction_type",
]);

function getPipelineId(pipeline: Pipeline) {
  return pipeline.id ?? pipeline._id;
}

function getPipelineName(pipeline: Pipeline) {
  return pipeline.name ?? pipeline.title;
}

function getStageId(stage: PipelineStage) {
  return stage.id ?? stage._id;
}

function getStageName(stage: PipelineStage) {
  return stage.name ?? stage.title;
}

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");

function getPipelines(payload: PipelinesResponse) {
  if (Array.isArray(payload.pipelines)) return payload.pipelines;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function getOpportunityId(payload: OpportunityResponse) {
  return payload.id ?? payload.opportunity?.id ?? payload.opportunity?._id;
}

function parseJsonSafely<T>(rawBody: string): T | null {
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    return null;
  }
}

function getMessageText(message: string | string[] | undefined) {
  return Array.isArray(message) ? message.join(" ") : message || "";
}

function getDuplicateOpportunityId(status: number, rawBody: string) {
  if (status !== 400) return null;

  const payload = parseJsonSafely<DuplicateOpportunityResponse>(rawBody);
  const message = getMessageText(payload?.message);

  if (!message.includes("Can not create duplicate opportunity for the contact")) {
    return null;
  }

  return payload?.meta?.existingId || null;
}

function getSafeBodyPreview(rawBody: string) {
  return rawBody.length > 2000 ? `${rawBody.slice(0, 2000)}...` : rawBody;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "DoorScale sync failed.";
}

function normalizePrivateIntegrationToken(token: string) {
  return token.trim().replace(/^Bearer\s+/i, "").trim();
}

function getAuthorizationHeader(token: string) {
  return `Bearer ${normalizePrivateIntegrationToken(token)}`;
}

function getTokenDebugShape(token: string) {
  const trimmedToken = token.trim();
  const normalizedToken = normalizePrivateIntegrationToken(token);

  return {
    normalizedLength: normalizedToken.length,
    normalizedStartsWithBearer: /^Bearer\s+/i.test(normalizedToken),
    normalizedStartsWithPit: normalizedToken.startsWith("pit-"),
    rawLength: token.length,
    rawStartsWithBearer: /^Bearer\s+/i.test(trimmedToken),
    rawStartsWithPit: trimmedToken.startsWith("pit-"),
    trimmedChangedLength: token.length !== trimmedToken.length,
  };
}

function getContacts(payload: ContactSearchResponse) {
  if (Array.isArray(payload.contacts)) return payload.contacts;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function getContactId(result: unknown): string | null {
  const payload = result as ContactIdResult | null;

  return (
    payload?.contact?.id ||
    payload?.contact?._id ||
    payload?.id ||
    payload?._id ||
    null
  );
}

function cleanTransactionPayload<T extends Record<string, unknown>>(payload: T) {
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => TRANSACTIONS_TABLE_COLUMNS.has(key)),
  );
}

async function findExistingLocalTransaction(
  supabase: TransactionLookupClient,
  locationId: string,
  contactId?: string,
  opportunityId?: string,
  propertyAddress?: string,
): Promise<LocalTransactionMatch | null> {
  if (opportunityId) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id")
      .eq("location_id", locationId)
      .eq("ghl_opportunity_id", opportunityId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Local duplicate transaction lookup failed:", error);
    }

    const transactionId = data?.id;
    if (transactionId) return { id: String(transactionId) };
  }

  if (contactId) {
    const { data, error } = await supabase
      .from("transactions")
      .select("id")
      .eq("location_id", locationId)
      .eq("ghl_contact_id", contactId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Local duplicate transaction contact lookup failed:", error);
    }

    const transactionId = data?.id;
    if (transactionId) return { id: String(transactionId) };

    const { data: legacyContactData, error: legacyContactError } = await supabase
      .from("transactions")
      .select("id")
      .eq("location_id", locationId)
      .eq("contact_id", contactId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (legacyContactError) {
      console.error(
        "Local duplicate transaction legacy contact lookup failed:",
        legacyContactError,
      );
    }

    const legacyTransactionId = legacyContactData?.id;
    if (legacyTransactionId) return { id: String(legacyTransactionId) };
  }

  if (!propertyAddress?.trim()) return null;

  const { data, error } = await supabase
    .from("transactions")
    .select("id")
    .eq("location_id", locationId)
    .eq("property_address", propertyAddress.trim())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Local duplicate transaction property lookup failed:", error);
  }

  const transactionId = data?.id;
  return transactionId ? { id: String(transactionId) } : null;
}

async function getPipelineConfig(accessToken: string, locationId: string) {
  const pipelinesUrl = new URL(PIPELINES_URL);
  pipelinesUrl.searchParams.set("locationId", locationId);

  const pipelinesResponse = await fetch(pipelinesUrl, {
    headers: {
      Accept: "application/json",
      Authorization: getAuthorizationHeader(accessToken),
      Version: API_VERSION,
    },
  });
  const rawBody = await pipelinesResponse.text();

  if (!pipelinesResponse.ok) {
    throw new Error(rawBody || "Unable to load DoorScale pipeline.");
  }

  const pipeline = getPipelines(JSON.parse(rawBody) as PipelinesResponse).find(
    (candidate) => getPipelineName(candidate)?.trim() === PIPELINE_NAME,
  );

  if (!pipeline) {
    throw new Error("Transaction Management System pipeline was not found.");
  }

  const stages = pipeline.stages ?? pipeline.pipelineStages ?? [];
  const stageMap = new Map(
    stages
      .map((stage) => {
        const stageName = getStageName(stage);
        return [stageName ? normalize(stageName) : undefined, getStageId(stage)] as const;
      })
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])),
  );

  return {
    pipelineId: getPipelineId(pipeline),
    stageMap,
  };
}

async function searchContact(
  accessToken: string,
  locationId: string,
  email?: string,
  phone?: string,
) {
  const query = email || phone;

  if (!query) return undefined;

  const searchResponse = await fetch(CONTACTS_SEARCH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: getAuthorizationHeader(accessToken),
      "Content-Type": "application/json",
      Version: API_VERSION,
    },
    body: JSON.stringify({
      locationId,
      page: 1,
      pageLimit: 10,
      query,
    }),
  });
  const rawBody = await searchResponse.text();

  console.log("DoorScale contact search response:", {
    body: getSafeBodyPreview(rawBody),
    location_id: locationId,
    queryType: email ? "email" : "phone",
    status: searchResponse.status,
  });

  if (!searchResponse.ok) {
    console.error("DoorScale contact search failed:", {
      body: rawBody,
      status: searchResponse.status,
    });
    return undefined;
  }

  const contacts = getContacts(JSON.parse(rawBody) as ContactSearchResponse);
  const normalizedEmail = email?.trim().toLowerCase();
  const normalizedPhone = phone?.replace(/\D/g, "");

  return contacts.find((contact) => {
    const contactEmail = contact.email?.trim().toLowerCase();
    const contactPhone = contact.phone?.replace(/\D/g, "");

    return (
      (normalizedEmail && contactEmail === normalizedEmail) ||
      (normalizedPhone && contactPhone === normalizedPhone)
    );
  });
}

async function updateContact(
  accessToken: string,
  contactId: string,
  body: CreateTransactionBody,
) {
  const contactPayload = {
    email: body.clientEmail || undefined,
    firstName: body.clientFirstName,
    lastName: body.clientLastName,
    phone: body.clientPhone || undefined,
  };
  console.log("DoorScale contact update request:", {
    contactId,
    payload: contactPayload,
  });

  const updateResponse = await fetch(`${CONTACTS_URL}${contactId}`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      Authorization: getAuthorizationHeader(accessToken),
      "Content-Type": "application/json",
      Version: API_VERSION,
    },
    body: JSON.stringify(contactPayload),
  });
  const rawBody = await updateResponse.text();

  console.log("DoorScale contact update response:", {
    body: getSafeBodyPreview(rawBody),
    contactId,
    status: updateResponse.status,
  });

  if (!updateResponse.ok) {
    throw new Error(`DoorScale contact update failed (${updateResponse.status}).`);
  }
}

async function createContact(
  accessToken: string,
  locationId: string,
  body: CreateTransactionBody,
) {
  const contactPayload = {
    email: body.clientEmail || undefined,
    firstName: body.clientFirstName,
    lastName: body.clientLastName,
    locationId,
    phone: body.clientPhone || undefined,
  };
  console.log("DoorScale contact create request:", {
    location_id: locationId,
    payload: contactPayload,
  });

  const contactResponse = await fetch(CONTACTS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: getAuthorizationHeader(accessToken),
      "Content-Type": "application/json",
      Version: API_VERSION,
    },
    body: JSON.stringify(contactPayload),
  });
  const rawBody = await contactResponse.text();

  console.log("DoorScale contact create response:", {
    body: getSafeBodyPreview(rawBody),
    location_id: locationId,
    status: contactResponse.status,
  });

  if (!contactResponse.ok) {
    console.error("DoorScale contact create failed:", {
      body: rawBody,
      status: contactResponse.status,
    });
    throw new Error("DoorScale contact create failed.");
  }

  return getContactId(JSON.parse(rawBody) as ContactCreateResponse);
}

async function findOrCreateContact(
  accessToken: string,
  locationId: string,
  body: CreateTransactionBody,
) {
  const existingContact = await searchContact(
    accessToken,
    locationId,
    body.clientEmail,
    body.clientPhone,
  );
  const existingContactId = existingContact ? getContactId(existingContact) : undefined;

  if (existingContactId) {
    console.log("DoorScale contact found for transaction create:", {
      contactId: existingContactId,
      location_id: locationId,
    });
    await updateContact(accessToken, existingContactId, body);
    return existingContactId;
  }

  return createContact(accessToken, locationId, body);
}

function getOpportunityName(body: CreateTransactionBody) {
  const clientName = [body.clientFirstName, body.clientLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (body.propertyAddress?.trim()) {
    return `${clientName} - ${body.propertyAddress.trim()}`;
  }

  return `${clientName} Transaction`;
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
    response.status(500).json({ ok: false, message: "Unable to save transaction." });
    return;
  }

  const body = request.body as CreateTransactionBody;
  const fallbackClientName = body.buyerName || body.sellerName || "";
  const fallbackClientParts = fallbackClientName.trim().split(/\s+/);
  const clientFirstName =
    body.clientFirstName?.trim() || fallbackClientParts[0] || "";
  const clientLastName =
    body.clientLastName?.trim() || fallbackClientParts.slice(1).join(" ") || "";

  const missingFields = [
    !clientFirstName ? "Client First Name" : "",
    !clientLastName ? "Client Last Name" : "",
    !body.propertyAddress?.trim() ? "Property Address" : "",
    !body.transactionType?.trim() ? "Transaction Type" : "",
    !body.stage?.trim() ? "Stage" : "",
  ].filter(Boolean);

  if (missingFields.length) {
    response.status(400).json({
      ok: false,
      message: `Transaction details are missing: ${missingFields.join(", ")}.`,
    });
    return;
  }

  body.clientFirstName = clientFirstName;
  body.clientLastName = clientLastName;

  const activeLocationId = getRequestedLocationId(request);

  if (!activeLocationId) {
    response.status(400).json({ ok: false, message: "DoorScale account is required." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  let opportunityId: string | undefined;
  let contactId: string | undefined;
  let linkedLocationId: string | null = null;
  let pipelineId: string | undefined;
  let pipelineStageId: string | undefined;
  let writeBackFailed = false;
  let syncErrorMessage = "";
  let duplicateOpportunityHandled = false;

  console.log("DoorScale transaction create received:", {
    ghl_location_id: body.locationId ?? null,
    location_id: activeLocationId,
    propertyAddress: body.propertyAddress,
    stage: body.stage,
    transactionId: body.transactionId ?? null,
    transactionType: body.transactionType,
  });

  try {
    const connectedAccount = await getActiveLocation(
      request,
      supabase,
      "/api/ghl/transactions/create",
    );

    if (connectedAccount.location_id !== activeLocationId) {
      throw new Error("DoorScale account does not match this transaction.");
    }

    linkedLocationId = connectedAccount.location_id;
    console.log("DoorScale transaction create connection:", {
      foundConnection: true,
      hasPrivateIntegrationToken: Boolean(connectedAccount.access_token),
      location_id: connectedAccount.location_id,
      tokenShape: getTokenDebugShape(connectedAccount.access_token),
      transactionId: body.transactionId ?? null,
    });

    const pipelineConfig = await getPipelineConfig(
      connectedAccount.access_token,
      connectedAccount.location_id,
    );
    pipelineId = pipelineConfig.pipelineId;
    pipelineStageId = pipelineConfig.stageMap.get(normalize(body.stage));

    console.log("DoorScale transaction create pipeline mapping:", {
      location_id: connectedAccount.location_id,
      matchedPipelineId: pipelineId ?? null,
      matchedPipelineStageId: pipelineStageId ?? null,
      selectedStage: body.stage,
      transactionId: body.transactionId ?? null,
    });

    if (!pipelineId || !pipelineStageId) {
      throw new Error("DoorScale stage could not be matched.");
    }

    contactId = (await findOrCreateContact(
      connectedAccount.access_token,
      connectedAccount.location_id,
      body,
    )) ?? undefined;

    if (!contactId) {
      throw new Error("DoorScale contact could not be created.");
    }

    const opportunityPayload = {
      contactId,
      locationId: connectedAccount.location_id,
      monetaryValue: Number(body.commission || 0),
      name: getOpportunityName(body),
      pipelineId,
      pipelineStageId,
      status: "open",
    };
    console.log("DoorScale opportunity create request:", {
      endpoint: OPPORTUNITIES_URL,
      payload: opportunityPayload,
      transactionId: body.transactionId ?? null,
    });

    const createResponse = await fetch(OPPORTUNITIES_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: getAuthorizationHeader(connectedAccount.access_token),
        "Content-Type": "application/json",
        Version: API_VERSION,
      },
      body: JSON.stringify(opportunityPayload),
    });
    const rawBody = await createResponse.text();
    console.log("DoorScale opportunity create response:", {
      body: getSafeBodyPreview(rawBody),
      endpoint: OPPORTUNITIES_URL,
      status: createResponse.status,
      transactionId: body.transactionId ?? null,
    });

    if (!createResponse.ok) {
      const duplicateOpportunityId = getDuplicateOpportunityId(
        createResponse.status,
        rawBody,
      );

      if (duplicateOpportunityId) {
        duplicateOpportunityHandled = true;
        opportunityId = duplicateOpportunityId;
        console.log("DoorScale duplicate opportunity detected:", {
          contactId,
          existingOpportunityId: duplicateOpportunityId,
          locationId: connectedAccount.location_id,
        });
      } else {
        console.error("DoorScale opportunity create failed:", {
          body: rawBody,
          status: createResponse.status,
        });
        throw new Error("DoorScale opportunity create failed.");
      }
    } else {
      opportunityId = getOpportunityId(
        JSON.parse(rawBody) as OpportunityResponse,
      );
    }

    if (duplicateOpportunityHandled) {
      console.log("DoorScale existing opportunity ID reused:", {
        existingOpportunityId: opportunityId,
      });
    }

    if (!opportunityId) {
      console.error("DoorScale opportunity create failed:", {
        body: rawBody,
        status: createResponse.status,
      });
      throw new Error("DoorScale opportunity id was missing.");
    }
  } catch (error) {
    writeBackFailed = true;
    syncErrorMessage = getErrorMessage(error);
    console.error("DoorScale transaction create write-back failed:", {
      error: syncErrorMessage,
      finalGhlContactId: contactId ?? null,
      finalGhlOpportunityId: opportunityId ?? null,
      finalSyncStatus: "pending_sync",
      ghl_location_id: linkedLocationId,
      location_id: activeLocationId,
      transactionId: body.transactionId ?? null,
    });
  }

  const clientName = [body.clientFirstName, body.clientLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const transactionRow = cleanTransactionPayload({
    buyer_name: body.buyerName || null,
    client_email: body.clientEmail || null,
    client_first_name: body.clientFirstName || null,
    client_last_name: body.clientLastName || null,
    client_phone: body.clientPhone || null,
    closing_date: body.closingDate || null,
    commission: Number(body.commission || 0),
    contact_email: body.clientEmail || null,
    contact_id: contactId ?? null,
    contact_name: clientName || null,
    contact_phone: body.clientPhone || null,
    ghl_contact_id: contactId ?? null,
    ghl_location_id: linkedLocationId,
    ghl_opportunity_id: opportunityId ?? null,
    inspection_date: body.inspectionDate || null,
    location_id: activeLocationId,
    pipeline_id: pipelineId ?? null,
    pipeline_stage_id: pipelineStageId ?? null,
    property_address: body.propertyAddress,
    seller_name: body.sellerName || null,
    stage: body.stage,
    stage_name: body.stage,
    status: body.status || "active",
    sync_status: writeBackFailed ? "pending_sync" : "synced",
    last_sync_error: writeBackFailed ? syncErrorMessage : null,
    last_synced_at: writeBackFailed ? null : new Date().toISOString(),
    transaction_type: body.transactionType,
  });

  console.log("Local transaction create cleaned payload keys:", {
    keys: Object.keys(transactionRow),
    routeName: "/api/ghl/transactions/create",
  });

  let existingLocalTransaction: LocalTransactionMatch | null = null;

  if (!body.transactionId) {
    existingLocalTransaction = await findExistingLocalTransaction(
      supabase,
      activeLocationId,
      contactId,
      opportunityId,
      body.propertyAddress,
    );
  }

  const localTransactionId =
    body.transactionId || existingLocalTransaction?.id || null;

  if (existingLocalTransaction !== null) {
    console.log("Local duplicate transaction found; updating existing row:", {
      transactionId: existingLocalTransaction.id,
      locationId: activeLocationId,
      ghl_contact_id: contactId,
      ghl_opportunity_id: opportunityId ?? null,
    });
  }

  const saveQuery = localTransactionId
    ? supabase
        .from("transactions")
        .update(transactionRow)
        .eq("id", localTransactionId)
        .eq("location_id", activeLocationId)
        .select("*")
        .single()
    : supabase.from("transactions").insert(transactionRow).select("*").single();
  const { data: savedTransaction, error: saveError } = await saveQuery;

  if (saveError) {
    console.error("Local transaction create failed:", saveError);
    response.status(500).json({ ok: false, message: "Unable to save transaction." });
    return;
  }

  console.log("Local transaction saved:", {
    duplicateOpportunityHandled,
    finalGhlContactId: contactId ?? null,
    ghl_opportunity_id: opportunityId ?? null,
    finalSyncStatus: writeBackFailed ? "pending_sync" : "synced",
    lastSyncError: writeBackFailed ? syncErrorMessage : null,
    mode: localTransactionId ? "updated" : "inserted",
    transactionId: savedTransaction?.id,
  });

  if (!writeBackFailed && savedTransaction?.id) {
    try {
      await PostTransactionSync({
        accessToken: connectedAccount.access_token,
        activeLocationId,
        supabase,
        transactionId: String(savedTransaction.id),
      });
    } catch (postSyncError) {
      console.error("DoorScale post transaction sync after create failed:", {
        error: postSyncError,
        transactionId: savedTransaction.id,
      });
    }
  }

  response.status(200).json({
    duplicateOpportunityHandled,
    ghl_opportunity_id: opportunityId ?? null,
    ok: !writeBackFailed,
    success: true,
    message: writeBackFailed
      ? "Transaction saved locally. DoorScale sync will retry later."
      : "Transaction saved.",
    transaction: savedTransaction ?? null,
    transactionId: savedTransaction?.id,
  });
  logRouteDataCounts("/api/ghl/transactions/create", activeLocationId, {
    transactions: savedTransaction ? 1 : 0,
  });
}
