import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const OPPORTUNITIES_URL =
  "https://services.leadconnectorhq.com/opportunities/search";
const API_VERSION = "2021-07-28";

type StoredConnection = {
  access_token: string;
  created_at?: string;
  location_id: string;
};

type OpportunitiesResponse = {
  opportunities?: unknown[];
  data?: unknown[];
  [key: string]: unknown;
};

function getOpportunityCount(payload: OpportunitiesResponse) {
  if (Array.isArray(payload.opportunities)) {
    return payload.opportunities.length;
  }

  if (Array.isArray(payload.data)) {
    return payload.data.length;
  }

  return 0;
}

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({
      ok: false,
      message: "Unable to sync DoorScale data.",
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: connections, error: connectionError } = await supabase
    .from("ghl_locations")
    .select("access_token, created_at, location_id")
    .order("created_at", { ascending: false })
    .limit(1);

  if (connectionError) {
    console.error("DoorScale sync connection lookup failed:", connectionError);
    response.status(500).json({
      ok: false,
      message: "Unable to sync DoorScale data.",
    });
    return;
  }

  const connection = connections?.[0] as StoredConnection | undefined;

  if (!connection?.access_token) {
    response.status(404).json({
      ok: false,
      message: "DoorScale account is not connected.",
    });
    return;
  }

  const opportunitiesUrl = new URL(OPPORTUNITIES_URL);
  opportunitiesUrl.searchParams.set("location_id", connection.location_id);

  const opportunitiesResponse = await fetch(opportunitiesUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${connection.access_token}`,
      Version: API_VERSION,
    },
  });

  const rawBody = await opportunitiesResponse.text();
  console.log("DoorScale opportunities sync response:", rawBody);

  let opportunitiesPayload: OpportunitiesResponse = {};

  try {
    opportunitiesPayload = JSON.parse(rawBody) as OpportunitiesResponse;
  } catch {
    opportunitiesPayload = {};
  }

  if (!opportunitiesResponse.ok) {
    response.status(opportunitiesResponse.status).json({
      ok: false,
      message: "Unable to sync DoorScale data.",
    });
    return;
  }

  response.status(200).json({
    ok: true,
    message: "DoorScale data synced successfully.",
    opportunityCount: getOpportunityCount(opportunitiesPayload),
  });
}
