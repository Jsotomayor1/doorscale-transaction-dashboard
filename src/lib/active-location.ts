const ACTIVE_LOCATION_KEY = "doorscale.activeLocationId";
const ACTIVE_LOCATION_EVENT = "doorscale-active-location-change";

export function getStoredActiveLocationId() {
  return window.localStorage.getItem(ACTIVE_LOCATION_KEY) || "";
}

export function setStoredActiveLocationId(locationId: string) {
  window.localStorage.setItem(ACTIVE_LOCATION_KEY, locationId);
  window.dispatchEvent(new Event(ACTIVE_LOCATION_EVENT));
}

export function subscribeToActiveLocationChange(callback: () => void) {
  window.addEventListener(ACTIVE_LOCATION_EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(ACTIVE_LOCATION_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
