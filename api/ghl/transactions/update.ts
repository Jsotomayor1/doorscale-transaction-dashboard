import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getActiveLocation,
  getRequestedLocationId,
  logRouteDataCounts,
} from "../_active-location";

const OPPORTUNITIES_URL = "https://services.leadconnectorhq.com/opportunities";
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
  ghl_opportunity_id: string | null;
  location_id: string;
};

type UpdateTransactionBody = {
  buyerName?: string;
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
      .map((stage) => [getStageName(stage), getStageId(stage)] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1])),
  );

  return {
    pipelineId: getPipelineId(pipeline),
    stageMap,
  };
}

function buildLocalUpdate(body: UpdateTransactionBody) {
  return {
    ...(body.buyerName !== undefined ? { buyer_name: body.buyerName || null } : {}),
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

function buildOpportunityUpdate(
  body: UpdateTransactionBody,
  pipelineId?: string,
  pipelineStageId?: string,
) {
  return {
    ...(body.commission !== undefined ? { monetaryValue: Number(body.commission || 0) } : {}),
    ...(body.propertyAddress !== undefined ? { name: body.propertyAddress } : {}),
    ...(pipelineId ? { pipelineId } : {}),
    ...(pipelineStageId ? { pipelineStageId } : {}),
    ...(body.status !== undefined ? { status: mapStatus(body.status) } : {}),
  };
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
    .select("ghl_opportunity_id, location_id")
    .eq("id", body.transactionId)
    .eq("location_id", activeLocationId)
    .maybeSingle();

  if (transactionError || !transaction) {
    response.status(404).json({ ok: false, message: "Transaction not found." });
    return;
  }

  const transactionRow = transaction as TransactionRow;
  let writeBackFailed = false;
  let matchedPipelineStageId: string | undefined;

  if (!transactionRow.ghl_opportunity_id) {
    writeBackFailed = true;
    console.log("DoorScale transaction update pending linked opportunity:", {
      selectedStage: body.stage,
      transactionId: body.transactionId,
    });
  } else {
    try {
      const connectedAccount = await getActiveLocation(
        request,
        supabase,
        "/api/ghl/transactions/update",
      );

      if (connectedAccount.location_id !== transactionRow.location_id) {
        throw new Error("DoorScale account does not match this transaction.");
      }

      let pipelineId: string | undefined;
      let pipelineStageId: string | undefined;

      if (body.stage) {
        const pipelineConfig = await getPipelineConfig(
          connectedAccount.access_token,
          connectedAccount.location_id,
        );
        pipelineId = pipelineConfig.pipelineId;
        pipelineStageId = pipelineConfig.stageMap.get(body.stage);
        matchedPipelineStageId = pipelineStageId;

        console.log("DoorScale transaction stage update mapping:", {
          ghl_opportunity_id: transactionRow.ghl_opportunity_id,
          matchedPipelineStageId,
          selectedStage: body.stage,
          transactionId: body.transactionId,
        });

        if (!pipelineStageId) {
          throw new Error("DoorScale stage could not be matched.");
        }
      }

      const updateResponse = await fetch(
        `${OPPORTUNITIES_URL}/${transactionRow.ghl_opportunity_id}`,
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
    } catch (error) {
      writeBackFailed = true;
      console.error("DoorScale transaction update write-back failed:", error);
    }
  }

  const { error: updateError } = await supabase
    .from("transactions")
    .update({
      ...buildLocalUpdate(body),
      ...getSyncFields(body, writeBackFailed),
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
  logRouteDataCounts("/api/ghl/transactions/update", activeLocationId, {
    transactions: 1,
  });
}
