import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(200).json({ connected: false });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data, error } = await supabase
    .from("ghl_locations")
    .select("connection_status, location_id, location_name, selected_at")
    .order("selected_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("DoorScale connection status check failed:", error);
    response.status(200).json({ connected: false });
    return;
  }

  const rows = data ?? [];
  const connected = rows.some(
    (row) =>
      (row.connection_status === "connected" ||
        row.connection_status === null) &&
      !String(row.location_id).startsWith("company:"),
  );
  const needsLocationSelection = rows.some(
    (row) => row.connection_status === "location_selection_required",
  );
  const locations = rows
    .filter(
      (row) =>
        (row.connection_status === "connected" ||
          row.connection_status === null) &&
        !String(row.location_id).startsWith("company:"),
    )
    .map((row) => ({
      id: row.location_id,
      name: row.location_name || "DoorScale Account",
    }));

  response.status(200).json({
    activeLocationId: locations[0]?.id ?? "",
    connected,
    locations,
    needsLocationSelection,
  });
}
