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
    .select("location_id")
    .limit(1);

  if (error) {
    console.error("DoorScale connection status check failed:", error);
    response.status(200).json({ connected: false });
    return;
  }

  response.status(200).json({ connected: Boolean(data?.length) });
}
