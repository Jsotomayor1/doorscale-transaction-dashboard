const AUTH_URL = "https://marketplace.leadconnectorhq.com/oauth/chooselocation";
const SCOPES = [
  "contacts.readonly",
  "contacts.write",
  "opportunities.readonly",
  "opportunities.write",
  "tasks.readonly",
  "tasks.write",
  "locations.readonly",
  "users.readonly",
  "custom-fields.readonly",
].join(" ");

export default function handler(_request, response) {
  const clientId = process.env.GHL_CLIENT_ID;
  const redirectUri = process.env.GHL_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    response.status(500).json({
      error: "GoHighLevel OAuth is not configured.",
    });
    return;
  }

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", SCOPES);

  response.redirect(302, authUrl.toString());
}
