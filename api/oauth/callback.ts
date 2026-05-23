import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";
const INSTALLED_LOCATIONS_URL =
  "https://services.leadconnectorhq.com/oauth/installedLocations";
const API_VERSION = "2021-07-28";

type GhlTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  locationId?: string;
  location_id?: string;
  activeLocation?: string;
  companyId?: string;
  userId?: string;
  userType?: string;
  scope?: string;
  refreshTokenId?: string;
  isBulkInstallation?: boolean;
  [key: string]: unknown;
};

type DoorScaleLocation = {
  id?: string;
  _id?: string;
  locationId?: string;
  name?: string;
  businessName?: string;
  companyId?: string;
  location?: {
    id?: string;
    name?: string;
  };
  locationName?: string;
  location_id?: string;
  [key: string]: unknown;
};

type LocationsResponse = {
  installedLocations?: DoorScaleLocation[];
  installations?: DoorScaleLocation[];
  locations?: DoorScaleLocation[];
  data?: DoorScaleLocation[];
  [key: string]: unknown;
};

function redactTokenValue(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  if (value.length <= 12) {
    return "[redacted]";
  }

  return `${value.slice(0, 6)}...[redacted]...${value.slice(-4)}`;
}

function redactTokens<T extends Record<string, unknown>>(data: T) {
  return {
    ...data,
    access_token: redactTokenValue(data.access_token),
    refresh_token: redactTokenValue(data.refresh_token),
  };
}

function parseTokenResponse(rawBody: string) {
  try {
    return JSON.parse(rawBody) as GhlTokenResponse;
  } catch {
    return null;
  }
}

function redactTokenString(value: string) {
  return value.replace(
    /("(?:access_token|refresh_token)"\s*:\s*")([^"]+)(")/gi,
    `$1[redacted]$3`,
  );
}

function getBaseUrl(request: VercelRequest) {
  const host = request.headers["x-forwarded-host"] ?? request.headers.host;
  const proto = request.headers["x-forwarded-proto"] ?? "https";

  return `${proto}://${host}`;
}

function redirectWithStatus(
  request: VercelRequest,
  response: VercelResponse,
  status: string,
  message: string,
) {
  const redirectUrl = new URL("/", getBaseUrl(request));
  redirectUrl.searchParams.set(status, message);
  response.redirect(302, redirectUrl.toString());
}

function getLocationId(location: DoorScaleLocation) {
  return (
    location.id ??
    location._id ??
    location.locationId ??
    location.location_id ??
    location.location?.id
  );
}

function getLocationName(location: DoorScaleLocation) {
  return (
    location.name ??
    location.businessName ??
    location.locationName ??
    location.location?.name ??
    "DoorScale Account"
  );
}

function getLocations(payload: LocationsResponse) {
  if (Array.isArray(payload.installedLocations)) return payload.installedLocations;
  if (Array.isArray(payload.installations)) return payload.installations;
  if (Array.isArray(payload.locations)) return payload.locations;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

async function getInstalledLocations(
  accessToken: string,
  companyId: string,
  appId: string,
) {
  if (!companyId) {
    console.error("GoHighLevel installed locations missing companyId.");
    throw new Error("HighLevel token response did not include a company id.");
  }

  if (!appId) {
    console.error("GoHighLevel installed locations missing appId.");
    throw new Error("HighLevel app id is not configured.");
  }

  const installedLocationsEndpoint = `${INSTALLED_LOCATIONS_URL}?companyId=${encodeURIComponent(
    companyId,
  )}&appId=${encodeURIComponent(
    appId,
  )}`;

  console.log(
    "GoHighLevel installed locations final endpoint URL:",
    installedLocationsEndpoint,
  );
  console.log("GoHighLevel installed locations companyId:", companyId);
  console.log("GoHighLevel installed locations appId:", appId);

  const locationsResponse = await fetch(installedLocationsEndpoint, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      Version: API_VERSION,
    },
  });
  const rawBody = await locationsResponse.text();

  console.log(
    "GoHighLevel installed locations response status:",
    locationsResponse.status,
  );
  console.log("GoHighLevel installed locations response body:", rawBody);

  if (!locationsResponse.ok) {
    return [];
  }

  try {
    return getLocations(JSON.parse(rawBody) as LocationsResponse)
      .map((location) => ({
        id: getLocationId(location),
        name: getLocationName(location),
      }))
      .filter((location): location is { id: string; name: string } =>
        Boolean(location.id),
      );
  } catch (error) {
    console.error("GoHighLevel installed locations response parse failed:", error);
    return [];
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  console.log("GoHighLevel OAuth callback query:", request.query);

  if (request.query.test) {
    response.status(200).json({ ok: true });
    return;
  }

  const code = request.query?.code;
  const authorizationCode = Array.isArray(code) ? code[0] : code;
  console.log("GoHighLevel OAuth callback code exists:", Boolean(authorizationCode));

  if (!authorizationCode) {
    response.status(400).json({
      error: "missing_code",
      query: request.query,
    });
    return;
  }

  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;
  const redirectUri = process.env.GHL_REDIRECT_URI;
  const appId = process.env.GHL_APP_ID || process.env.GHL_APP_VERSION_ID;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    !appId ||
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    redirectWithStatus(request, response, "oauth_error", "server_not_configured");
    return;
  }

  try {
    console.log("GoHighLevel OAuth token endpoint:", TOKEN_URL);

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code: authorizationCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody,
    });

    console.log("GoHighLevel OAuth token response status:", tokenResponse.status);

    const rawTokenBody = await tokenResponse.text();
    const tokenData = parseTokenResponse(rawTokenBody);
    console.log(
      "GoHighLevel OAuth token response body:",
      tokenData ? redactTokens(tokenData) : redactTokenString(rawTokenBody),
    );

    if (!tokenResponse.ok || !tokenData) {
      redirectWithStatus(request, response, "oauth_error", "token_exchange_failed");
      return;
    }

    if (!tokenData.access_token || !tokenData.refresh_token) {
      response.status(502).json({
        error: "invalid_token_response",
        tokenResponse: tokenData,
      });
      return;
    }

    const directLocationId = tokenData.locationId ?? tokenData.location_id;
    const companyId = tokenData.companyId;
    const needsLocationSelection =
      !directLocationId ||
      tokenData.userType?.toLowerCase() === "company" ||
      tokenData.isBulkInstallation === true;
    const installedLocations = needsLocationSelection
      ? await getInstalledLocations(tokenData.access_token, companyId, appId)
      : [];
    const locationId =
      directLocationId ??
      (companyId ? `company:${companyId}` : undefined) ??
      (tokenData.userId ? `user:${tokenData.userId}` : undefined);

    if (!locationId) {
      throw new Error("HighLevel token response did not include an install id.");
    }

    const payload = {
      location_id: locationId,
      location_name: needsLocationSelection
        ? "DoorScale Account Selection"
        : "DoorScale Account",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(
        Date.now() + Number(tokenData.expires_in || 86400) * 1000,
      ).toISOString(),
      company_id: companyId ?? null,
      user_id: typeof tokenData.userId === "string" ? tokenData.userId : null,
      user_type: typeof tokenData.userType === "string" ? tokenData.userType : null,
      scope: typeof tokenData.scope === "string" ? tokenData.scope : null,
      refresh_token_id:
        typeof tokenData.refreshTokenId === "string"
          ? tokenData.refreshTokenId
          : null,
      is_bulk_installation: Boolean(tokenData.isBulkInstallation),
      connection_status: needsLocationSelection
        ? "location_selection_required"
        : "connected",
      available_locations: installedLocations,
      selected_at: needsLocationSelection ? null : new Date().toISOString(),
    };

    console.log("Supabase ghl_locations payload:", {
      ...payload,
      access_token: "[redacted]",
      refresh_token: "[redacted]",
    });

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const { error } = await supabase
      .from("ghl_locations")
      .upsert(payload, { onConflict: "location_id" })
      .select();

    if (error) {
      console.error("Supabase ghl_locations upsert error:", error);
      response.status(500).json({
        error: "token_storage_failed",
        supabaseError: error,
      });
      return;
    }

    const redirectUrl = new URL(
      needsLocationSelection ? "/choose-account" : "/",
      getBaseUrl(request),
    );
    redirectUrl.searchParams.set(
      needsLocationSelection ? "connection_ready" : "oauth_success",
      "true",
    );
    response.redirect(302, redirectUrl.toString());
  } catch (error) {
    console.error("GoHighLevel OAuth callback unexpected error:", error);
    redirectWithStatus(request, response, "oauth_error", "unexpected_error");
  }
}
