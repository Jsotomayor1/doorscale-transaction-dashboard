import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRequestedLocationId } from "./_active-location.js";

export default async function handler(
  request: VercelRequest,
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
  const activeLocationId = getRequestedLocationId(request);

  if (!activeLocationId) {
    response.status(200).json({ connected: false, locationRequired: true });
    return;
  }

  const { data, error } = await supabase
    .from("ghl_locations")
    .select("connection_status, location_id, location_name, selected_at, user_type")
    .eq("location_id", activeLocationId)
    .eq("user_type", "PrivateIntegration")
    .maybeSingle();

  if (error) {
    console.error("DoorScale connection status check failed:", error);
    response.status(200).json({ connected: false });
    return;
  }

  const connected =
    Boolean(data) &&
    (data.connection_status === "connected" || data.connection_status === null);

  console.log("DoorScale status check:", {
    activeLocationId,
    connected,
    routeName: "/api/ghl/status",
  });

  response.status(200).json({
    activeLocationId,
    connected,
    locationName: data?.location_name || "",
  });
}
