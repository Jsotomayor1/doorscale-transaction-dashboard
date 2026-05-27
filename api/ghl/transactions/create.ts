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

type OpportunityResponse = {
  id?: string;
  opportunity?: {
    id?: string;
    _id?: string;
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

function getOpportunityId(payload: OpportunityResponse) {
  return payload.id ?? payload.opportunity?.id ?? payload.opportunity?._id;
}

function getContacts(payload: ContactSearchResponse) {
  if (Array.isArray(payload.contacts)) return payload.contacts;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function getContactId(result: any): string | null {
  return (
    result?.contact?.id ||
    result?.contact?._id ||
    result?.id ||
    result?._id ||
    null
  );
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

async function createContact(
  accessToken: string,
  locationId: string,
  body: CreateTransactionBody,
) {
  const contactResponse = await fetch(CONTACTS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Version: API_VERSION,
    },
    body: JSON.stringify({
      email: body.clientEmail || undefined,
      firstName: body.clientFirstName,
      first_name: body.clientFirstName,
      lastName: body.clientLastName,
      last_name: body.clientLastName,
      locationId,
      location_id: locationId,
      phone: body.clientPhone || undefined,
    }),
  });
  const rawBody = await contactResponse.text();

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

  if (existingContactId) return existingContactId;

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

  if (
    !body.clientFirstName?.trim() ||
    !body.clientLastName?.trim() ||
    (!body.clientEmail?.trim() && !body.clientPhone?.trim()) ||
    !body.propertyAddress ||
    !body.transactionType ||
    !body.stage
  ) {
    response.status(400).json({ ok: false, message: "Transaction details are missing." });
    return;
  }

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
    const pipelineConfig = await getPipelineConfig(
      connectedAccount.access_token,
      connectedAccount.location_id,
    );
    pipelineId = pipelineConfig.pipelineId;
    pipelineStageId = pipelineConfig.stageMap.get(normalize(body.stage));

    if (!pipelineId || !pipelineStageId) {
      throw new Error("DoorScale stage could not be matched.");
    }

    contactId = await findOrCreateContact(
      connectedAccount.access_token,
      connectedAccount.location_id,
      body,
    );

    if (!contactId) {
      throw new Error("DoorScale contact could not be created.");
    }

    const createResponse = await fetch(OPPORTUNITIES_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${connectedAccount.access_token}`,
        "Content-Type": "application/json",
        Version: API_VERSION,
      },
      body: JSON.stringify({
        contactId,
        locationId: connectedAccount.location_id,
        monetaryValue: Number(body.commission || 0),
        name: getOpportunityName(body),
        pipelineId,
        pipelineStageId,
        status: "open",
      }),
    });
    const rawBody = await createResponse.text();

    if (!createResponse.ok) {
      console.error("DoorScale opportunity create failed:", {
        body: rawBody,
        status: createResponse.status,
      });
      throw new Error("DoorScale opportunity create failed.");
    }

    opportunityId = getOpportunityId(JSON.parse(rawBody) as OpportunityResponse);
  } catch (error) {
    writeBackFailed = true;
    console.error("DoorScale transaction create write-back failed:", error);
  }

  const clientName = [body.clientFirstName, body.clientLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const transactionRow = {
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
    monetary_value: Number(body.commission || 0),
    pipeline_id: pipelineId ?? null,
    pipeline_stage_id: pipelineStageId ?? null,
    property_address: body.propertyAddress,
    seller_name: body.sellerName || null,
    stage: body.stage,
    stage_name: body.stage,
    status: body.status || "active",
    sync_status: writeBackFailed ? "pending_sync" : "synced",
    last_sync_error: writeBackFailed
      ? "Transaction saved locally. DoorScale sync will retry later."
      : null,
    last_synced_at: writeBackFailed ? null : new Date().toISOString(),
    transaction_type: body.transactionType,
  };
  const saveQuery = body.transactionId
    ? supabase
        .from("transactions")
        .update(transactionRow)
        .eq("id", body.transactionId)
        .eq("location_id", activeLocationId)
        .select("id")
        .single()
    : supabase.from("transactions").insert(transactionRow).select("id").single();
  const { data: savedTransaction, error: saveError } = await saveQuery;

  if (saveError) {
    console.error("Local transaction create failed:", saveError);
    response.status(500).json({ ok: false, message: "Unable to save transaction." });
    return;
  }

  response.status(200).json({
    ok: !writeBackFailed,
    message: writeBackFailed
      ? "Transaction saved locally. DoorScale sync will retry later."
      : "Transaction saved.",
    transactionId: savedTransaction?.id,
  });
  logRouteDataCounts("/api/ghl/transactions/create", activeLocationId, {
    transactions: savedTransaction ? 1 : 0,
  });
}
