import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";

type GhlTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  locationId?: string;
  location_id?: string;
  activeLocation?: string;
  companyId?: string;
  company_id?: string;
  userId?: string;
  userType?: string;
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
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri ||
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

    const locationId =
      tokenData.locationId ??
      tokenData.location_id ??
      tokenData.companyId ??
      tokenData.company_id ??
      tokenData.userId;

    if (!locationId) {
      throw new Error("HighLevel token response did not include a location, company, or user id.");
    }

    if (!tokenData.access_token || !tokenData.refresh_token) {
      response.status(502).json({
        error: "invalid_token_response",
        tokenResponse: tokenData,
      });
      return;
    }

    const payload = {
      location_id: locationId,
      location_name: tokenData.userType || "HighLevel Account",
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: new Date(
        Date.now() + Number(tokenData.expires_in || 86400) * 1000,
      ).toISOString(),
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

    const redirectUrl = new URL("/", getBaseUrl(request));
    redirectUrl.searchParams.set("oauth_success", "true");
    response.redirect(302, redirectUrl.toString());
  } catch (error) {
    console.error("GoHighLevel OAuth callback unexpected error:", error);
    redirectWithStatus(request, response, "oauth_error", "unexpected_error");
  }
}
