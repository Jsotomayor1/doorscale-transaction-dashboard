import type { VercelRequest, VercelResponse } from "@vercel/node";

const AUTH_URL =
  "https://marketplace.leadconnectorhq.com/v2/oauth/chooselocation";
const REDIRECT_URI =
  "https://doorscale-transaction-dashboard.vercel.app/api/oauth/callback";
const STATE = "doorscale_test";
const SCOPES = [
  "oauth.readonly",
  "oauth.write",
  "locations.readonly",
  "contacts.readonly",
  "opportunities.readonly",
].join(" ");

export default function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  const clientId = process.env.GHL_CLIENT_ID;
  const versionId = process.env.GHL_APP_VERSION_ID;

  if (!clientId || !versionId) {
    response.status(500).json({
      error: "GoHighLevel OAuth is not configured.",
      missing: {
        clientId: !clientId,
        versionId: !versionId,
      },
    });
    return;
  }

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("version_id", versionId);
  authUrl.searchParams.set("state", STATE);

  console.log("GoHighLevel OAuth authorization URL:", authUrl.toString());

  response.redirect(302, authUrl.toString());
}
