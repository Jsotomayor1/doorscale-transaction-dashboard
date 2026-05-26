const ACTIVE_LOCATION_KEY = "active_location_id";
const LEGACY_ACTIVE_LOCATION_KEY = "doorscale.activeLocationId";
const ACTIVE_LOCATION_EVENT = "doorscale-active-location-change";

export function getUrlActiveLocationId() {
  return new URLSearchParams(window.location.search).get("location_id")?.trim() || "";
}

export function getStoredActiveLocationId() {
  const urlLocationId = getUrlActiveLocationId();

  if (urlLocationId) return urlLocationId;

  return (
    window.localStorage.getItem(ACTIVE_LOCATION_KEY) ||
    window.localStorage.getItem(LEGACY_ACTIVE_LOCATION_KEY) ||
    ""
  );
}

export function setStoredActiveLocationId(locationId: string) {
  if (!locationId) return;

  window.localStorage.setItem(ACTIVE_LOCATION_KEY, locationId);
  window.localStorage.setItem(LEGACY_ACTIVE_LOCATION_KEY, locationId);
  window.dispatchEvent(new Event(ACTIVE_LOCATION_EVENT));
}

export function getDoorScaleLocationHeaders(
  locationId = getStoredActiveLocationId(),
): Record<string, string> {
  return locationId ? { "x-doorscale-location-id": locationId } : {};
}

export function withActiveLocationPath(path: string) {
  const locationId = getStoredActiveLocationId();

  if (!locationId) return path;

  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("location_id", locationId);

  return `${pathname}?${params.toString()}`;
}

export function subscribeToActiveLocationChange(callback: () => void) {
  window.addEventListener(ACTIVE_LOCATION_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(ACTIVE_LOCATION_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
