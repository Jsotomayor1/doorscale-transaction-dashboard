import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

type StoredLocation = {
  available_locations?: Array<{ id?: string; name?: string }> | null;
  connection_status?: string | null;
  location_id: string;
  location_name?: string | null;
};

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(200).json({
      connected: false,
      locations: [],
      needsLocationSelection: false,
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("ghl_locations")
    .select("available_locations, connection_status, location_id, location_name")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("DoorScale account list lookup failed:", error);
    response.status(200).json({
      connected: false,
      locations: [],
      needsLocationSelection: false,
    });
    return;
  }

  const rows = (data ?? []) as StoredLocation[];
  const pendingInstall = rows.find(
    (row) => row.connection_status === "location_selection_required",
  );
  const connectedRows = rows.filter(
    (row) =>
      row.connection_status === "connected" ||
      row.connection_status === null ||
      row.connection_status === undefined,
  );
  const availableLocations =
    pendingInstall?.available_locations
      ?.map((location) => ({
        id: location.id ?? "",
        name: location.name ?? "DoorScale Account",
      }))
      .filter((location) => location.id) ?? [];

  response.status(200).json({
    connected: Boolean(connectedRows.length),
    locations: availableLocations,
    needsLocationSelection: Boolean(pendingInstall),
  });
}
