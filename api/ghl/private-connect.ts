import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getRequestedLocationId } from "./_active-location.js";

type PrivateConnectBody = {
  accountName?: string;
  locationId?: string;
  privateIntegrationToken?: string;
};

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    response.status(405).json({ message: "Unable to save DoorScale connection." });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ message: "Unable to save DoorScale connection." });
    return;
  }

  const body = request.body as PrivateConnectBody;
  const accountName = body.accountName?.trim();
  const locationId = getRequestedLocationId(request);
  const privateIntegrationToken = body.privateIntegrationToken?.trim();

  if (!accountName || !locationId || !privateIntegrationToken) {
    response.status(400).json({ message: "Complete all DoorScale connection fields." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("ghl_locations")
    .upsert(
      {
        access_token: privateIntegrationToken,
        connection_status: "connected",
        expires_at: null,
        location_id: locationId,
        location_name: accountName,
        selected_location_id: locationId,
        selected_location_name: accountName,
        updated_at: now,
        user_type: "PrivateIntegration",
      },
      { onConflict: "location_id" },
    );

  if (error) {
    console.error("DoorScale private connection save failed:", error);
    response.status(500).json({ message: "Unable to save DoorScale connection." });
    return;
  }

  response.status(200).json({
    ok: true,
    message: "DoorScale connected successfully.",
  });
}
