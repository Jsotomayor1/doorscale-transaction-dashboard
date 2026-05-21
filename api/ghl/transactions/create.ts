import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPPORTUNITIES_URL = "https://services.leadconnectorhq.com/opportunities/";
const PIPELINES_URL = "https://services.leadconnectorhq.com/opportunities/pipelines";
const API_VERSION = "2021-07-28";
const PIPELINE_NAME = "Transaction Management System";

type ConnectedAccount = {
  access_token: string;
  location_id: string;
};

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
  closingDate?: string;
  commission?: string;
  inspectionDate?: string;
  propertyAddress?: string;
  sellerName?: string;
  stage?: string;
  status?: string;
  transactionType?: string;
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

function getPipelines(payload: PipelinesResponse) {
  if (Array.isArray(payload.pipelines)) return payload.pipelines;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function getOpportunityId(payload: OpportunityResponse) {
  return payload.id ?? payload.opportunity?.id ?? payload.opportunity?._id;
}

function mapStatus(status?: string) {
  switch (status?.toLowerCase()) {
    case "closed":
      return "won";
    case "dead":
      return "lost";
    default:
      return "open";
  }
}

async function getConnectedAccount(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .from("ghl_locations")
    .select("access_token, location_id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data as ConnectedAccount | null;
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
      .map((stage) => [getStageName(stage), getStageId(stage)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])),
  );

  return {
    pipelineId: getPipelineId(pipeline),
    stageMap,
  };
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

  if (!body.propertyAddress || !body.transactionType || !body.stage) {
    response.status(400).json({ ok: false, message: "Transaction details are missing." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  let opportunityId: string | undefined;
  let writeBackFailed = false;

  try {
    const connectedAccount = await getConnectedAccount(supabase);

    if (!connectedAccount?.access_token) {
      throw new Error("DoorScale account is not connected.");
    }

    const { pipelineId, stageMap } = await getPipelineConfig(
      connectedAccount.access_token,
      connectedAccount.location_id,
    );
    const pipelineStageId = stageMap.get(body.stage);

    if (!pipelineId || !pipelineStageId) {
      throw new Error("DoorScale stage could not be matched.");
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
        locationId: connectedAccount.location_id,
        monetaryValue: Number(body.commission || 0),
        name: body.propertyAddress,
        pipelineId,
        pipelineStageId,
        status: mapStatus(body.status),
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

  const { data: savedTransaction, error: saveError } = await supabase
    .from("transactions")
    .insert({
      buyer_name: body.buyerName || null,
      closing_date: body.closingDate || null,
      commission: Number(body.commission || 0),
      ghl_opportunity_id: opportunityId ?? null,
      inspection_date: body.inspectionDate || null,
      location_id: "demo-location",
      property_address: body.propertyAddress,
      seller_name: body.sellerName || null,
      stage: body.stage,
      status: body.status || "active",
      transaction_type: body.transactionType,
    })
    .select("id")
    .single();

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
}
