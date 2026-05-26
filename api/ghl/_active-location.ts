import { createClient } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";

export type ActiveLocation = {
  access_token: string;
  activeLocationId: string;
  connection: LocationRow;
  id: number | string;
  location_id: string;
  location_name: string;
};

export type LocationRow = {
  access_token: string | null;
  connection_status: string | null;
  id: number | string;
  location_id: string;
  location_name: string | null;
  user_type: string | null;
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

  if (!requestedLocationId) {
    console.error("DoorScale active account missing location:", { routeName });
    throw new Error("active_location_required");
  }

  const { data, error } = await supabase
    .from("ghl_locations")
    .select("access_token, connection_status, id, location_id, location_name, user_type")
    .eq("location_id", requestedLocationId)
    .eq("user_type", "PrivateIntegration")
    .maybeSingle();

  if (error) {
    console.error("DoorScale active account lookup failed:", {
      error,
      requestedLocationId: requestedLocationId || null,
      routeName,
    });
    throw new Error("active_location_lookup_failed");
  }

  const row = data as LocationRow | null;

  console.log("DoorScale active account lookup:", {
    foundConnection: Boolean(row),
    requestedLocationId: requestedLocationId || null,
    routeName,
  });

  if (!row?.location_id || !row.access_token) {
    console.error("DoorScale active account not connected:", {
      activeLocationId: requestedLocationId,
      routeName,
    });
    throw new Error("active_location_not_connected");
  }

  return {
    access_token: row.access_token,
    activeLocationId: row.location_id,
    connection: row,
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
