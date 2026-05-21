import { createClient } from "@supabase/supabase-js";

const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";

function getBaseUrl(request) {
  const host = request.headers["x-forwarded-host"] ?? request.headers.host;
  const proto = request.headers["x-forwarded-proto"] ?? "https";

  return `${proto}://${host}`;
}

function redirectWithStatus(request, response, status, message) {
  const redirectUrl = new URL("/", getBaseUrl(request));
  redirectUrl.searchParams.set(status, message);
  response.redirect(302, redirectUrl.toString());
}

export default async function handler(request, response) {
  const code = request.query?.code;
  const authorizationCode = Array.isArray(code) ? code[0] : code;

  if (!authorizationCode) {
    redirectWithStatus(request, response, "oauth_error", "missing_code");
    return;
  }

  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;
  const redirectUri = process.env.GHL_REDIRECT_URI;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !redirectUri || !supabaseUrl || !serviceRoleKey) {
    redirectWithStatus(request, response, "oauth_error", "server_not_configured");
    return;
  }

  try {
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: authorizationCode,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      redirectWithStatus(request, response, "oauth_error", "token_exchange_failed");
      return;
    }

    const tokenData = await tokenResponse.json();
    const locationId =
      tokenData.locationId ??
      tokenData.location_id ??
      tokenData.activeLocation ??
      tokenData.active_location;

    if (!locationId || !tokenData.access_token || !tokenData.refresh_token) {
      redirectWithStatus(request, response, "oauth_error", "invalid_token_response");
      return;
    }

    const expiresInSeconds = Number(tokenData.expires_in ?? 86400);
    const expiresAt = new Date(
      Date.now() + expiresInSeconds * 1000,
    ).toISOString();
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const { error } = await supabase.from("ghl_locations").upsert(
      {
        location_id: locationId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt,
      },
      { onConflict: "location_id" },
    );

    if (error) {
      redirectWithStatus(request, response, "oauth_error", "token_storage_failed");
      return;
    }

    const redirectUrl = new URL("/", getBaseUrl(request));
    redirectUrl.searchParams.set("connected", "true");
    response.redirect(302, redirectUrl.toString());
  } catch (_error) {
    redirectWithStatus(request, response, "oauth_error", "unexpected_error");
  }
}
