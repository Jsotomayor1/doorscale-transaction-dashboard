import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getActiveLocation,
  getRequestedLocationId,
  logRouteDataCounts,
} from "../_active-location.js";

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

type TransactionRow = {
  contact_id: string | null;
  ghl_contact_id: string | null;
  ghl_opportunity_id: string | null;
  location_id: string;
  stage: string | null;
};

type UpdateTransactionBody = {
  assignedTo?: string;
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
  _id?: string;
  email?: string;
  id?: string;
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
    _id?: string;
    id?: string;
  };
};

type DuplicateOpportunityResponse = {
  message?: string | string[];
  meta?: {
    existingId?: string;
  };
};

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

function mapStatus(status?: string) {
  switch (status?.toLowerCase()) {
    case "closed":
      return "won";
    case "dead":
      return "lost";
    case "active":
      return "open";
    default:
      return status;
  }
}

async function getPipelineConfig(accessToken: string, locationId: string) {
  const pipelinesUrl = new URL(PIPELINES_URL);
  pipelinesUrl.searchParams.set("locationId", locationId);

  const pipelinesResponse = await fetch(pipelinesUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
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

function buildLocalUpdate(body: UpdateTransactionBody) {
  const clientName = [body.clientFirstName, body.clientLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    ...(body.assignedTo !== undefined ? { assigned_to: body.assignedTo || null } : {}),
    ...(body.buyerName !== undefined ? { buyer_name: body.buyerName || null } : {}),
    ...(body.clientEmail !== undefined ? { client_email: body.clientEmail || null, contact_email: body.clientEmail || null } : {}),
    ...(body.clientFirstName !== undefined ? { client_first_name: body.clientFirstName || null } : {}),
    ...(body.clientLastName !== undefined ? { client_last_name: body.clientLastName || null } : {}),
    ...(body.clientPhone !== undefined ? { client_phone: body.clientPhone || null, contact_phone: body.clientPhone || null } : {}),
    ...(clientName ? { contact_name: clientName } : {}),
    ...(body.closingDate !== undefined ? { closing_date: body.closingDate || null } : {}),
    ...(body.commission !== undefined ? { commission: Number(body.commission || 0) } : {}),
    ...(body.inspectionDate !== undefined ? { inspection_date: body.inspectionDate || null } : {}),
    ...(body.propertyAddress !== undefined ? { property_address: body.propertyAddress } : {}),
    ...(body.sellerName !== undefined ? { seller_name: body.sellerName || null } : {}),
    ...(body.stage !== undefined ? { stage: body.stage } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.transactionType !== undefined ? { transaction_type: body.transactionType } : {}),
  };
}

function getLocalSaveMessage(body: UpdateTransactionBody, writeBackFailed: boolean) {
  if (!writeBackFailed) return "Transaction saved.";

  return body.stage
    ? "Stage saved locally. DoorScale sync will retry."
    : "Transaction saved locally. DoorScale sync will retry later.";
}

function getSyncFields(body: UpdateTransactionBody, writeBackFailed: boolean) {
  return {
    sync_status: writeBackFailed ? "pending_sync" : "synced",
    last_sync_error: writeBackFailed ? getLocalSaveMessage(body, true) : null,
    last_synced_at: writeBackFailed ? null : new Date().toISOString(),
  };
}

function getSafeBodyPreview(rawBody: string) {
  return rawBody.length > 2000 ? `${rawBody.slice(0, 2000)}...` : rawBody;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "DoorScale sync failed.";
}

function buildOpportunityUpdate(
  body: UpdateTransactionBody,
  pipelineId?: string,
  pipelineStageId?: string,
) {
  return {
    ...(body.commission !== undefined ? { monetaryValue: Number(body.commission || 0) } : {}),
    ...(body.propertyAddress !== undefined ? { name: getOpportunityName(body) } : {}),
    ...(pipelineId ? { pipelineId } : {}),
    ...(pipelineStageId ? { pipelineStageId } : {}),
    ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo || undefined } : {}),
    ...(body.status !== undefined ? { status: mapStatus(body.status) } : {}),
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
      Authorization: `Bearer ${accessToken}`,
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
  const matchedContact = contacts.find((contact) => {
    const contactEmail = contact.email?.trim().toLowerCase();
    const contactPhone = contact.phone?.replace(/\D/g, "");

    return (
      (normalizedEmail && contactEmail === normalizedEmail) ||
      (normalizedPhone && contactPhone === normalizedPhone)
    );
  });

  console.log("DoorScale contact search result:", {
    matchedContactId: matchedContact ? getContactId(matchedContact) : null,
    resultCount: contacts.length,
  });

  return matchedContact;
}

async function createContact(
  accessToken: string,
  locationId: string,
  body: UpdateTransactionBody,
) {
  const fallbackName = body.buyerName || body.sellerName || "";
  const nameParts = fallbackName.trim().split(/\s+/);
  const firstName = body.clientFirstName || nameParts[0] || "";
  const lastName = body.clientLastName || nameParts.slice(1).join(" ");
  const contactPayload = {
    email: body.clientEmail || undefined,
    firstName,
    lastName,
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
      Authorization: `Bearer ${accessToken}`,
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

  const contactId = getContactId(JSON.parse(rawBody) as ContactCreateResponse);

  console.log("DoorScale contact created:", {
    contactId,
    locationId,
  });

  return contactId;
}

async function updateContact(
  accessToken: string,
  contactId: string,
  body: UpdateTransactionBody,
) {
  const contactPayload = {
    email: body.clientEmail || undefined,
    firstName: body.clientFirstName || undefined,
    lastName: body.clientLastName || undefined,
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
      Authorization: `Bearer ${accessToken}`,
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
    console.error("DoorScale contact update failed:", {
      body: rawBody,
      status: updateResponse.status,
    });
  }
}

async function findOrCreateContact(
  accessToken: string,
  locationId: string,
  body: UpdateTransactionBody,
  existingContactId?: string | null,
) {
  if (existingContactId) {
    await updateContact(accessToken, existingContactId, body);
    console.log("DoorScale contact found:", { contactId: existingContactId });
    return existingContactId;
  }

  const existingContact = await searchContact(
    accessToken,
    locationId,
    body.clientEmail,
    body.clientPhone,
  );
  const existingContactIdFromSearch = existingContact
    ? getContactId(existingContact)
    : undefined;

  if (existingContactIdFromSearch) {
    await updateContact(accessToken, existingContactIdFromSearch, body);
    console.log("DoorScale contact found:", { contactId: existingContactIdFromSearch });
    return existingContactIdFromSearch;
  }

  return createContact(accessToken, locationId, body);
}

function getOpportunityName(body: UpdateTransactionBody) {
  const clientName =
    [body.clientFirstName, body.clientLastName].filter(Boolean).join(" ").trim() ||
    body.buyerName ||
    body.sellerName ||
    "";

  if (body.propertyAddress?.trim()) {
    return `${clientName} - ${body.propertyAddress.trim()}`;
  }

  return clientName ? `${clientName} Transaction` : "Transaction";
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST" && request.method !== "PATCH") {
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ ok: false, message: "Unable to save transaction." });
    return;
  }

  const body = request.body as UpdateTransactionBody;

  const activeLocationId = getRequestedLocationId(request);

  if (!body.transactionId || !activeLocationId) {
    response.status(400).json({ ok: false, message: "Transaction details are missing." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("contact_id, ghl_contact_id, ghl_opportunity_id, location_id, stage")
    .eq("id", body.transactionId)
    .eq("location_id", activeLocationId)
    .maybeSingle();

  if (transactionError || !transaction) {
    response.status(404).json({ ok: false, message: "Transaction not found." });
    return;
  }

  const transactionRow = transaction as TransactionRow;
  let writeBackFailed = false;
  let syncErrorMessage = "";
  let contactId = transactionRow.ghl_contact_id ?? transactionRow.contact_id ?? undefined;
  let opportunityId = transactionRow.ghl_opportunity_id ?? undefined;
  let pipelineId: string | undefined;
  let pipelineStageId: string | undefined;
  let matchedPipelineStageId: string | undefined;
  let stageName: string | undefined;

  console.log("DoorScale transaction update received:", {
    existingGhlContactId: transactionRow.ghl_contact_id,
    existingGhlOpportunityId: transactionRow.ghl_opportunity_id,
    ghl_location_id: body.locationId ?? null,
    location_id: activeLocationId,
    stage: body.stage ?? transactionRow.stage,
    transactionId: body.transactionId,
    transactionType: body.transactionType ?? null,
  });

  try {
    const connectedAccount = await getActiveLocation(
      request,
      supabase,
      "/api/ghl/transactions/update",
    );

    if (connectedAccount.location_id !== transactionRow.location_id) {
      throw new Error("DoorScale account does not match this transaction.");
    }

    console.log("DoorScale transaction update connection:", {
      foundConnection: true,
      hasPrivateIntegrationToken: Boolean(connectedAccount.access_token),
      location_id: connectedAccount.location_id,
      transactionId: body.transactionId,
    });

    const selectedStage = body.stage || transactionRow.stage || "";
    stageName = selectedStage || undefined;

    if (selectedStage) {
      const pipelineConfig = await getPipelineConfig(
        connectedAccount.access_token,
        connectedAccount.location_id,
      );
      pipelineId = pipelineConfig.pipelineId;
      pipelineStageId = pipelineConfig.stageMap.get(normalize(selectedStage));
      matchedPipelineStageId = pipelineStageId;

      console.log("DoorScale transaction stage update mapping:", {
        ghl_opportunity_id: transactionRow.ghl_opportunity_id,
        matchedPipelineStageId,
        selectedStage,
        transactionId: body.transactionId,
      });

      if (!pipelineStageId) {
        throw new Error("DoorScale stage could not be matched.");
      }
    }

    contactId = (await findOrCreateContact(
      connectedAccount.access_token,
      connectedAccount.location_id,
      body,
      contactId,
    )) ?? undefined;

    if (!contactId) {
      throw new Error("DoorScale contact could not be created.");
    }

    if (!transactionRow.ghl_opportunity_id) {
      if (!pipelineId || !pipelineStageId) {
        throw new Error("DoorScale stage could not be matched.");
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
        ...opportunityPayload,
      });

      const createResponse = await fetch(OPPORTUNITIES_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${connectedAccount.access_token}`,
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
      });

      if (!createResponse.ok) {
        const duplicateOpportunityId = getDuplicateOpportunityId(
          createResponse.status,
          rawBody,
        );

        if (duplicateOpportunityId) {
          opportunityId = duplicateOpportunityId;
          console.log("DoorScale duplicate opportunity detected during retry:", {
            contactId,
            existingOpportunityId: duplicateOpportunityId,
            locationId: connectedAccount.location_id,
            transactionId: body.transactionId,
          });
        } else {
          console.error("DoorScale opportunity create failed:", {
            body: getSafeBodyPreview(rawBody),
            status: createResponse.status,
            transactionId: body.transactionId,
          });
          throw new Error(`DoorScale opportunity create failed (${createResponse.status}).`);
        }
      } else {
        opportunityId = getOpportunityId(JSON.parse(rawBody) as OpportunityResponse);
        console.log("DoorScale opportunity created:", {
          opportunityId,
          status: createResponse.status,
        });
      }

      if (!opportunityId) {
        throw new Error("DoorScale opportunity id was missing.");
      }
    } else {
      const updateResponse = await fetch(
        `${OPPORTUNITIES_URL}${transactionRow.ghl_opportunity_id}`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${connectedAccount.access_token}`,
            "Content-Type": "application/json",
            Version: API_VERSION,
          },
          body: JSON.stringify(buildOpportunityUpdate(body, pipelineId, pipelineStageId)),
        },
      );
      const rawBody = await updateResponse.text();

      if (body.stage) {
        console.log("DoorScale transaction stage update response:", {
          body: rawBody,
          ghl_opportunity_id: transactionRow.ghl_opportunity_id,
          matchedPipelineStageId,
          selectedStage: body.stage,
          status: updateResponse.status,
          transactionId: body.transactionId,
        });
      }

      if (!updateResponse.ok) {
        console.error("DoorScale opportunity update failed:", {
          body: rawBody,
          ghl_opportunity_id: transactionRow.ghl_opportunity_id,
          matchedPipelineStageId,
          selectedStage: body.stage,
          status: updateResponse.status,
          transactionId: body.transactionId,
        });
        throw new Error("DoorScale opportunity update failed.");
      }
    }
  } catch (error) {
    writeBackFailed = true;
    syncErrorMessage = getErrorMessage(error);
    console.error("DoorScale transaction update write-back failed:", {
      error: syncErrorMessage,
      finalGhlContactId: contactId ?? null,
      finalGhlOpportunityId: opportunityId ?? null,
      finalSyncStatus: "pending_sync",
      location_id: activeLocationId,
      transactionId: body.transactionId,
    });
  }

  const clientName = [body.clientFirstName, body.clientLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      ...buildLocalUpdate(body),
      ...(contactId
        ? {
            contact_id: contactId,
            ghl_contact_id: contactId,
          }
        : {}),
      ...(opportunityId ? { ghl_opportunity_id: opportunityId } : {}),
      ...(pipelineId ? { pipeline_id: pipelineId } : {}),
      ...(pipelineStageId ? { pipeline_stage_id: pipelineStageId } : {}),
      ...(stageName ? { stage_name: stageName } : {}),
      ...(clientName ? { contact_name: clientName } : {}),
      ...getSyncFields(body, writeBackFailed),
      ...(writeBackFailed ? { last_sync_error: syncErrorMessage } : {}),
    })
    .eq("id", body.transactionId)
    .eq("location_id", activeLocationId);

  if (updateError) {
    console.error("Local transaction update failed:", updateError);
    response.status(500).json({ ok: false, message: "Unable to save transaction." });
    return;
  }

  response.status(200).json({
    ok: !writeBackFailed,
    message: getLocalSaveMessage(body, writeBackFailed),
  });
  console.log("DoorScale transaction update final sync state:", {
    finalGhlContactId: contactId ?? null,
    finalGhlOpportunityId: opportunityId ?? null,
    finalSyncStatus: writeBackFailed ? "pending_sync" : "synced",
    lastSyncError: writeBackFailed ? syncErrorMessage : null,
    transactionId: body.transactionId,
  });
  logRouteDataCounts("/api/ghl/transactions/update", activeLocationId, {
    transactions: 1,
  });
}
