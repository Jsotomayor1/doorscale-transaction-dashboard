import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPPORTUNITIES_URL = "https://services.leadconnectorhq.com/opportunities";
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

type TransactionRow = {
  ghl_opportunity_id: string | null;
  location_id: string;
};

type UpdateTransactionBody = {
  buyerName?: string;
  closingDate?: string;
  commission?: string;
  inspectionDate?: string;
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

  if (!body.transactionId) {
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
    .maybeSingle();

  if (transactionError || !transaction) {
    response.status(404).json({ ok: false, message: "Transaction not found." });
    return;
  }

  const transactionRow = transaction as TransactionRow;
  let writeBackFailed = false;

  if (transactionRow.ghl_opportunity_id) {
    try {
      const connectedAccount = await getConnectedAccount(supabase);

      if (!connectedAccount?.access_token) {
        throw new Error("DoorScale account is not connected.");
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

      if (!updateResponse.ok) {
        console.error("DoorScale opportunity update failed:", {
          body: rawBody,
          status: updateResponse.status,
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
    .update(buildLocalUpdate(body))
    .eq("id", body.transactionId);

  if (updateError) {
    console.error("Local transaction update failed:", updateError);
    response.status(500).json({ ok: false, message: "Unable to save transaction." });
    return;
  }

  response.status(200).json({
    ok: !writeBackFailed,
    message: writeBackFailed
      ? "Transaction saved locally. DoorScale sync will retry later."
      : "Transaction saved.",
  });
}
