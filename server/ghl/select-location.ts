import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const LOCATION_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/locationToken";
const API_VERSION = "2021-07-28";

type SelectLocationBody = {
  locationId?: string;
};

type PendingInstall = {
  id: number;
  access_token: string;
  available_locations?: Array<{ id?: string; name?: string }> | null;
  company_id?: string | null;
  expires_at: string;
  is_bulk_installation?: boolean | null;
  location_id: string;
  refresh_token: string;
  refresh_token_id?: string | null;
  scope?: string | null;
  user_id?: string | null;
  user_type?: string | null;
};

type LocationTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  [key: string]: unknown;
};

function redactTokenValue(value: unknown) {
  if (typeof value !== "string") return value;
  if (value.length <= 12) return "[redacted]";

  return `${value.slice(0, 6)}...[redacted]...${value.slice(-4)}`;
}

function redactTokens<T extends Record<string, unknown>>(data: T) {
  return {
    ...data,
    access_token: redactTokenValue(data.access_token),
    refresh_token: redactTokenValue(data.refresh_token),
  };
}

async function createLocationToken(
  companyAccessToken: string,
  companyId: string,
  locationId: string,
) {
  const body = {
    companyId,
    locationId,
  };

  console.log("DoorScale selected account location token request:", {
    body,
    endpoint: LOCATION_TOKEN_URL,
    hasCompanyAccessToken: Boolean(companyAccessToken),
    headers: {
      Accept: "application/json",
      Authorization: companyAccessToken ? "Bearer [redacted]" : "missing",
      "Content-Type": "application/json",
      Version: API_VERSION,
    },
    method: "POST",
    parentCompanyId: companyId,
    selectedLocationId: locationId,
  });

  const tokenResponse = await fetch(LOCATION_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${companyAccessToken}`,
      "Content-Type": "application/json",
      Version: API_VERSION,
    },
    body: JSON.stringify(body),
  });
  const rawBody = await tokenResponse.text();
  let tokenData: LocationTokenResponse | null = null;

  try {
    tokenData = JSON.parse(rawBody) as LocationTokenResponse;
  } catch {
    tokenData = null;
  }

  console.log("DoorScale selected account location token response:", {
    body: tokenData ? redactTokens(tokenData) : rawBody,
    selectedLocationId: locationId,
    status: tokenResponse.status,
  });

  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw new Error("location_token_unavailable");
  }

  return tokenData;
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== "POST") {
    response.status(405).json({ message: "Unable to save DoorScale account." });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ message: "Unable to save DoorScale account." });
    return;
  }

  const body = request.body as SelectLocationBody;

  if (!body.locationId) {
    response.status(400).json({ message: "Choose a DoorScale account." });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: pendingInstall, error: pendingError } = await supabase
    .from("ghl_locations")
    .select(
      "id, access_token, available_locations, company_id, expires_at, is_bulk_installation, location_id, refresh_token, refresh_token_id, scope, user_id, user_type",
    )
    .eq("connection_status", "location_selection_required")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingError || !pendingInstall) {
    console.error("DoorScale pending account lookup failed:", pendingError);
    response.status(404).json({ message: "DoorScale account setup was not found." });
    return;
  }

  const install = pendingInstall as PendingInstall;
  const selectedLocation = install.available_locations?.find(
    (location) => location.id === body.locationId,
  );

  if (!selectedLocation) {
    response.status(400).json({ message: "Choose a DoorScale account." });
    return;
  }

  if (!install.access_token || !install.company_id) {
    console.error("DoorScale selected account missing parent company data:", {
      hasCompanyAccessToken: Boolean(install.access_token),
      parentConnectionId: install.location_id,
      companyId: install.company_id,
      selectedLocationId: body.locationId,
    });
    response.status(409).json({
      message: "Unable to access this DoorScale account. Please reconnect DoorScale.",
    });
    return;
  }

  let locationToken: LocationTokenResponse;

  try {
    locationToken = await createLocationToken(
      install.access_token,
      install.company_id,
      body.locationId,
    );
  } catch (error) {
    console.error("DoorScale selected account token creation failed:", error);
    response.status(409).json({
      message: "Unable to access this DoorScale account. Please reconnect DoorScale.",
    });
    return;
  }

  const selectedPayload = {
    access_token: null,
    available_locations: [],
    company_id: install.company_id ?? null,
    connection_status: "connected",
    expires_at: install.expires_at,
    is_bulk_installation: Boolean(install.is_bulk_installation),
    location_access_token: locationToken.access_token,
    location_refresh_token: locationToken.refresh_token ?? null,
    location_token_expires_at: new Date(
      Date.now() + Number(locationToken.expires_in || 86400) * 1000,
    ).toISOString(),
    location_id: body.locationId,
    location_name: selectedLocation.name || "DoorScale Account",
    parent_connection_id: install.id,
    selected_location_id: body.locationId,
    selected_location_name: selectedLocation.name || "DoorScale Account",
    refresh_token: null,
    refresh_token_id: install.refresh_token_id ?? null,
    scope: install.scope ?? null,
    selected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: install.user_id ?? null,
    user_type: install.user_type ?? null,
  };

  const { error: selectedError } = await supabase
    .from("ghl_locations")
    .upsert(selectedPayload, { onConflict: "location_id" });

  if (selectedError) {
    console.error("DoorScale selected account save failed:", selectedError);
    response.status(500).json({ message: "Unable to save DoorScale account." });
    return;
  }

  const { error: installUpdateError } = await supabase
    .from("ghl_locations")
    .update({
      connection_status: "company_connected",
      selected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("location_id", install.location_id);

  if (installUpdateError) {
    console.error("DoorScale install status update failed:", installUpdateError);
  }

  response.status(200).json({
    connected: true,
    locationName: selectedPayload.location_name,
    message: "DoorScale account connected.",
  });
}
