type DoorScaleDevEnv = {
  apiBase: string;
  locationId: string;
  privateIntegrationToken: string;
};

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required local DoorScale setting: ${name}`);
  }

  return value;
}

export function getDoorScaleDevEnv(): DoorScaleDevEnv {
  return {
    apiBase: readRequiredEnv("GHL_API_BASE"),
    locationId: readRequiredEnv("GHL_LOCATION_ID"),
    privateIntegrationToken: readRequiredEnv("GHL_CODEX_PIT"),
  };
}
