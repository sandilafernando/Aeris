import {
  DEFAULT_GLANCE_METRICS,
  DEFAULT_GLANCE_SOURCE,
  normalizeGlanceMetrics,
  normalizeGlanceSource,
} from "./glance.js";

export const PREFERENCES_KEY = "aeris:preferences:v1";
export const PLACES_KEY = "aeris:places:v1";
export const SESSION_LOCATION_KEY = "aeris:session-location:v1";
export const LAST_FORECAST_KEY = "aeris:last-forecast:v1";

const LAST_FORECAST_LIMIT = 3;
const LAST_FORECAST_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LAST_FORECAST_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: "system",
  temperatureUnit: "c",
  windUnit: "kmh",
  reducedEffects: false,
  stationId: "auto",
  weatherNotifications: false,
  glanceSource: DEFAULT_GLANCE_SOURCE,
  glanceMetrics: DEFAULT_GLANCE_METRICS,
});

const THEMES = new Set(["light", "dark", "system"]);
const TEMPERATURE_UNITS = new Set(["c", "f"]);
const WIND_UNITS = new Set(["kmh", "mph", "ms"]);
const STATION_ID_PATTERN = /^(auto|[a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function normalizeStationPreference(value) {
  if (typeof value !== "string") return DEFAULT_PREFERENCES.stationId;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length > 80 || !STATION_ID_PATTERN.test(trimmed)) {
    return DEFAULT_PREFERENCES.stationId;
  }
  return trimmed;
}

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
    reducedEffects:
      typeof value.reducedEffects === "boolean"
        ? value.reducedEffects
        : DEFAULT_PREFERENCES.reducedEffects,
    stationId: normalizeStationPreference(value.stationId),
    weatherNotifications:
      typeof value.weatherNotifications === "boolean"
        ? value.weatherNotifications
        : DEFAULT_PREFERENCES.weatherNotifications,
    glanceSource: normalizeGlanceSource(value.glanceSource),
    glanceMetrics: normalizeGlanceMetrics(value.glanceMetrics),
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

/*
 * Offline last-known forecast.
 *
 * Only the normalized forecast that was already rendered is stored, never the
 * raw provider payload, and only for the three most recently used places. The
 * reader enforces a 24-hour ceiling so a stale copy can never masquerade as a
 * current forecast; callers must label the copy with its original fetch time.
 */
function normalizeForecastSnapshot(value) {
  if (!value || typeof value !== "object") return null;
  if (!value.current || typeof value.current !== "object") return null;
  if (!Array.isArray(value.hourly) || !Array.isArray(value.daily)) return null;
  const fetchedAt = Number(value.fetchedAt);
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return null;
  return value;
}

export function readLastForecast(key) {
  if (!key) return null;
  const store = readJson(LAST_FORECAST_KEY, null);
  const entry = store?.places?.[key];
  const data = normalizeForecastSnapshot(entry);
  if (!data) return null;
  const age = Date.now() - data.fetchedAt;
  if (age > LAST_FORECAST_MAX_AGE_MS) return null;
  if (age < -LAST_FORECAST_FUTURE_TOLERANCE_MS) return null;
  return data;
}

export function saveLastForecast(key, data) {
  if (!key) return false;
  const snapshot = normalizeForecastSnapshot(data);
  if (!snapshot) return false;

  const store = readJson(LAST_FORECAST_KEY, null);
  const existing =
    store && typeof store === "object" && store.places && typeof store.places === "object"
      ? store.places
      : {};

  const entries = Object.entries({ ...existing, [key]: snapshot })
    .filter(([, entry]) => normalizeForecastSnapshot(entry))
    .sort((a, b) => b[1].fetchedAt - a[1].fetchedAt)
    .slice(0, LAST_FORECAST_LIMIT);

  return writeJson(LAST_FORECAST_KEY, { places: Object.fromEntries(entries) });
}

export function placeKey(place) {
  if (!place) return "";
  return `${place.latitude.toFixed(3)},${place.longitude.toFixed(3)}`;
}

export function placeLabel(place) {
  if (!place) return "";
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

/*
 * Current-location data stays out of the saved-places list. A tab-scoped
 * sessionStorage record lets a reload keep using the same place without
 * turning it into a saved city. Closing the tab clears it.
 */
export function readSessionLocation() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_LOCATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const place = normalizePlace(parsed?.place);
    if (!place) return null;
    return { place, active: parsed?.active === true };
  } catch {
    return null;
  }
}

export function saveSessionLocation(place, active = false) {
  if (typeof window === "undefined") return false;
  try {
    const normalized = normalizePlace(place);
    if (!normalized) {
      window.sessionStorage.removeItem(SESSION_LOCATION_KEY);
      return true;
    }
    window.sessionStorage.setItem(
      SESSION_LOCATION_KEY,
      JSON.stringify({ place: normalized, active: Boolean(active) }),
    );
    return true;
  } catch {
    return false;
  }
}

/*
 * Last active location.
 *
 * The installed app reopens with the place that was last shown, including the
 * current-location place, so a home-screen launch never starts on onboarding
 * again. It is a separate single-entry record: the saved-places list is
 * unchanged and current coordinates still never enter it.
 */
export const ACTIVE_LOCATION_KEY = "aeris:active-location:v1";

export function readActiveLocation() {
  return normalizePlace(readJson(ACTIVE_LOCATION_KEY, null));
}

export function saveActiveLocation(place) {
  const normalized = normalizePlace(place);
  if (!normalized) {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.removeItem(ACTIVE_LOCATION_KEY);
      return true;
    } catch {
      return false;
    }
  }
  return writeJson(ACTIVE_LOCATION_KEY, normalized);
}

export function clearSessionLocation() {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.removeItem(SESSION_LOCATION_KEY);
    return true;
  } catch {
    return false;
  }
}
