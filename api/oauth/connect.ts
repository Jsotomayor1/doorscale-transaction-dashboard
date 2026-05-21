import type { VercelRequest, VercelResponse } from "@vercel/node";

const AUTH_URL = "https://marketplace.leadconnectorhq.com/oauth/chooselocation";
const REDIRECT_URI =
  "https://doorscale-transaction-dashboard.vercel.app/api/oauth/callback";
const STATE = "doorscale_test";
const SCOPES = [
  "locations.readonly",
  "contacts.readonly",
  "opportunities.readonly",
].join(" ");

export default function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  const clientId = process.env.GHL_CLIENT_ID;

  if (!clientId) {
    response.status(500).json({
      error: "GoHighLevel OAuth is not configured.",
    });
    return;
  }

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("state", STATE);

  console.log("GoHighLevel OAuth authorization URL:", authUrl.toString());

  response.redirect(302, authUrl.toString());
}
