export const PREFERENCES_KEY = "aeris:preferences:v1";
export const PLACES_KEY = "aeris:places:v1";

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: "system",
  temperatureUnit: "c",
  windUnit: "kmh",
});

const THEMES = new Set(["light", "dark", "system"]);
const TEMPERATURE_UNITS = new Set(["c", "f"]);
const WIND_UNITS = new Set(["kmh", "mph", "ms"]);

export function roundCoordinate(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

export function isValidCoordinate(latitude, longitude) {
  return (
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Number(latitude) >= -90 &&
    Number(latitude) <= 90 &&
    Number(longitude) >= -180 &&
    Number(longitude) <= 180
  );
}

export function normalizePreferences(value) {
  if (!value || typeof value !== "object") return { ...DEFAULT_PREFERENCES };
  return {
    theme: THEMES.has(value.theme) ? value.theme : DEFAULT_PREFERENCES.theme,
    temperatureUnit: TEMPERATURE_UNITS.has(value.temperatureUnit)
      ? value.temperatureUnit
      : DEFAULT_PREFERENCES.temperatureUnit,
    windUnit: WIND_UNITS.has(value.windUnit)
      ? value.windUnit
      : DEFAULT_PREFERENCES.windUnit,
  };
}

export function normalizePlace(value) {
  if (!value || typeof value !== "object") return null;
  if (!isValidCoordinate(value.latitude, value.longitude)) return null;
  if (!value.name || typeof value.name !== "string") return null;

  return {
    id: String(value.id || `${roundCoordinate(value.latitude)},${roundCoordinate(value.longitude)}`),
    name: value.name.slice(0, 120),
    admin1: typeof value.admin1 === "string" ? value.admin1.slice(0, 120) : "",
    country: typeof value.country === "string" ? value.country.slice(0, 120) : "",
    countryCode:
      typeof value.countryCode === "string" ? value.countryCode.slice(0, 2).toUpperCase() : "",
    latitude: roundCoordinate(value.latitude),
    longitude: roundCoordinate(value.longitude),
    timezone: typeof value.timezone === "string" ? value.timezone : "",
  };
}

export function placeFromSearchResult(result) {
  return normalizePlace({
    id: result.id,
    name: result.name,
    admin1: result.admin1,
    country: result.country,
    countryCode: result.country_code,
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
  });
}

export function placeFromCoordinates(latitude, longitude) {
  return normalizePlace({
    id: `current-${roundCoordinate(latitude)},${roundCoordinate(longitude)}`,
    name: "Current location",
    latitude,
    longitude,
  });
}

export function normalizePlacesState(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.saved)) {
    return { saved: [], activeId: null };
  }

  const deduped = [];
  const seen = new Set();
  for (const item of value.saved.slice(0, 20)) {
    const place = normalizePlace(item);
    if (!place) continue;
    const key = `${place.id}:${place.latitude}:${place.longitude}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(place);
  }

  const activeId =
    typeof value.activeId === "string" && deduped.some((place) => place.id === value.activeId)
      ? value.activeId
      : deduped[0]?.id || null;

  return { saved: deduped, activeId };
}

export function readJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readSavedPlaces() {
  return normalizePlacesState(readJson(PLACES_KEY, null));
}

export function savePlacesState(saved, activeId) {
  return writeJson(PLACES_KEY, { saved, activeId });
}

export function readPreferences() {
  return normalizePreferences(readJson(PREFERENCES_KEY, null));
}

export function savePreferences(preferences) {
  return writeJson(PREFERENCES_KEY, normalizePreferences(preferences));
}

export function placeKey(place) {
  if (!place) return "";
  return `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;
}

export function placeLabel(place) {
  if (!place) return "";
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}
