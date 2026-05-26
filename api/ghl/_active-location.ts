import { createClient } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";

export type ActiveLocation = {
  access_token: string;
  id: number | string;
  location_id: string;
  location_name: string;
};

type LocationRow = {
  access_token: string | null;
  connection_status: string | null;
  id: number | string;
  location_id: string;
  location_name: string | null;
};

type RequestBody = {
  active_location_id?: string;
  location_id?: string;
  locationId?: string;
};

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function getRequestedLocationId(request: VercelRequest) {
  const body = (request.body ?? {}) as RequestBody;
  const queryLocationId = firstHeaderValue(
    request.query.location_id as string | string[] | undefined,
  );
  const headerLocationId = firstHeaderValue(
    request.headers["x-doorscale-location-id"],
  );

  return (
    headerLocationId?.trim() ||
    queryLocationId?.trim() ||
    body.active_location_id?.trim() ||
    body.location_id?.trim() ||
    body.locationId?.trim() ||
    ""
  );
}

export async function getActiveLocation(
  request: VercelRequest,
  supabase: ReturnType<typeof createClient>,
  routeName: string,
): Promise<ActiveLocation> {
  const requestedLocationId = getRequestedLocationId(request);
  let query = supabase
    .from("ghl_locations")
    .select("access_token, connection_status, id, location_id, location_name")
    .or("connection_status.eq.connected,connection_status.is.null")
    .not("location_id", "like", "company:%");

  if (requestedLocationId) {
    query = query.eq("location_id", requestedLocationId);
  }

  const { data, error } = await query
    .order("selected_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("DoorScale active account lookup failed:", {
      error,
      requestedLocationId: requestedLocationId || null,
      routeName,
    });
    throw new Error("active_location_lookup_failed");
  }

  const rows = (data ?? []) as LocationRow[];

  console.log("DoorScale active account lookup:", {
    connectedLocationCount: rows.length,
    requestedLocationId: requestedLocationId || null,
    routeName,
  });

  if (!requestedLocationId && rows.length > 1) {
    throw new Error("active_location_required");
  }

  const row = rows[0];

  if (!row?.location_id || !row.access_token) {
    throw new Error("active_location_not_connected");
  }

  return {
    access_token: row.access_token,
    id: row.id,
    location_id: row.location_id,
    location_name: row.location_name || "DoorScale Account",
  };
}

export function logRouteDataCounts(
  routeName: string,
  locationId: string,
  counts: {
    documents?: number;
    tasks?: number;
    transactions?: number;
  },
) {
  console.log("DoorScale route data counts:", {
    activeLocationId: locationId,
    documents: counts.documents ?? 0,
    routeName,
    tables: ["transactions", "tasks", "transaction_documents"],
    tasks: counts.tasks ?? 0,
    transactions: counts.transactions ?? 0,
  });
}
