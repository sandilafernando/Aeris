/**
 * First-class adapter for the Department of Meteorology snapshot that the
 * repository's collector writes to `data/meteo.json`.
 *
 * The snapshot is produced by `.github/workflows/fetch-weather.yml` from the
 * public DoM map page. It is not the live workbook feed and it does not publish
 * station coordinates, wind, pressure, cloud cover, or dew point. Missing
 * fields are preserved as `null`; they are never invented.
 *
 * The source's `forecast` field is a reported condition label, not a forecast.
 * Rainfall may be the literal string "Trace"; that is kept as a distinct
 * `rainfallTrace` flag rather than being converted to zero.
 *
 * This module is server-only. The browser consumes the normalized payload from
 * `/api/weather/meteo-json`.
 */

import {
  SRI_LANKA_REFERENCE_NOTE,
  STATION_REFERENCE_POINTS,
  conditionKeyForLabel,
  parseObservationTimestamp,
  slugifyStationName,
} from "./sri-lanka-dom.js";

export const METEO_JSON_URL =
  "https://raw.githubusercontent.com/sandilafernando/Aeris/main/data/meteo.json";
export const METEO_JSON_SOURCE_URL = "https://meteo.gov.lk/";
export const METEO_JSON_STALE_MINUTES = 5 * 60;
export const METEO_JSON_MAX_BYTES = 2 * 1024 * 1024;
export const METEO_JSON_TIMEOUT_MS = 12_000;

export const METEO_JSON_SOURCE = Object.freeze({
  id: "sri-lanka-dom-json",
  name: "Department of Meteorology, Sri Lanka",
  shortName: "Sri Lanka DoM",
  url: METEO_JSON_SOURCE_URL,
  feedUrl: METEO_JSON_URL,
  kind: "official-observations",
  title: "DoM station snapshot",
  timezone: "Asia/Colombo",
  units: {
    temperature: "°C",
    relativeHumidity: "%",
    rainfall3h: "mm",
    rainfallSince0830: "mm",
  },
  windows: {
    rainfall3h: "Rainfall during the previous 3 hours",
    rainfallSince0830: "Rainfall since 08:30 Sri Lanka time",
  },
  conditionNote:
    "The source labels this field “forecast”; it is a reported condition label, not a forecast. Aeris displays it as the reported condition.",
  referenceNote: SRI_LANKA_REFERENCE_NOTE,
  attribution: "Department of Meteorology, Sri Lanka",
  collectionNote:
    "Aeris's collector reads the public DoM map page every 30 minutes and commits the snapshot to the Aeris repository. The collector time and the observation time are separate.",
});

export class MeteoJsonError extends Error {
  constructor(message, code = "meteo-json", details = null) {
    super(message);
    this.name = "MeteoJsonError";
    this.code = code;
    this.details = details;
  }
}

function finiteNumber(value) {
  const number = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isFinite(number) ? number : null;
}

function boundedNumber(value, minimum, maximum) {
  const number = finiteNumber(value);
  if (number == null || number < minimum || number > maximum) return null;
  return number;
}

function cleanLabel(value, maximumLength = 120) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, maximumLength);
}

function isoFromEpoch(epochMs) {
  if (!Number.isFinite(epochMs)) return null;
  const date = new Date(epochMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isoFromUnknown(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? isoFromEpoch(parsed) : null;
}

/**
 * Preserve the source's trace semantics. `Trace` means a measurable amount
 * below the feed's 0.1 mm precision, so it is neither zero nor unavailable.
 */
export function parseMeteoRainfall(value) {
  if (value == null) return { valueMm: null, trace: false, valid: false };
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || value > 2_000) {
      return { valueMm: null, trace: false, valid: false };
    }
    return { valueMm: value, trace: false, valid: true };
  }
  const text = String(value).trim();
  if (!text) return { valueMm: null, trace: false, valid: false };
  if (/^trace$/i.test(text)) return { valueMm: null, trace: true, valid: true };
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2_000) {
    return { valueMm: null, trace: false, valid: false };
  }
  return { valueMm: parsed, trace: false, valid: true };
}

function referencePointFor(name) {
  const reference = STATION_REFERENCE_POINTS[name];
  if (!reference) return null;
  return {
    latitude: reference.latitude,
    longitude: reference.longitude,
    label: "Approximate city-centre reference",
    official: false,
  };
}

/**
 * Normalize one station record. The record is kept when its identity and
 * weather object are readable even if the timestamp is malformed; freshness is
 * decided separately so a broken timestamp can never look live.
 */
export function normalizeMeteoStationRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const name = cleanLabel(record.name, 120);
  if (!name) return null;
  const weather = record.weather;
  if (!weather || typeof weather !== "object" || Array.isArray(weather)) return null;

  const id = slugifyStationName(name);
  if (!id) return null;

  const observation = parseObservationTimestamp(weather.lastUpdated);
  const conditionLabel = cleanLabel(weather.forecast, 80);
  const rainfall = parseMeteoRainfall(weather.rainfall);
  const totalRainfall = parseMeteoRainfall(weather.totalRainfall);
  const temperatureC = boundedNumber(weather.temp, -90, 60);
  const relativeHumidity = boundedNumber(weather.rh, 0, 100);

  return {
    id,
    name,
    locationName: `${name} DoM station`,
    observationLabel:
      typeof weather.lastUpdated === "string" ? weather.lastUpdated.trim().slice(0, 40) : "",
    observationTime: observation?.iso || null,
    observationEpochMs: observation?.epochMs ?? null,
    timestampValid: Boolean(observation),
    temperatureC,
    relativeHumidity,
    rainfall3hMm: rainfall.valueMm,
    rainfall3hTrace: rainfall.trace,
    rainfallSince0830Mm: totalRainfall.valueMm,
    rainfallSince0830Trace: totalRainfall.trace,
    // The snapshot does not publish these fields. They stay null so the
    // interface can distinguish "not reported" from a measured zero.
    windSpeedKmh: null,
    windGustKmh: null,
    windDirection: null,
    windDirectionCompass: null,
    pressureHpa: null,
    dewpointC: null,
    visibilityLabel: null,
    visibilityMeters: null,
    cloudCover: null,
    cloudBaseFt: null,
    conditionLabel,
    conditionKey: conditionKeyForLabel(conditionLabel),
    rawObservation: null,
    referencePoint: referencePointFor(name),
    sourceId: METEO_JSON_SOURCE.id,
  };
}

function dedupeStations(stations) {
  const byId = new Map();
  let duplicatesRemoved = 0;
  for (const station of stations) {
    const existing = byId.get(station.id);
    if (!existing) {
      byId.set(station.id, station);
      continue;
    }
    duplicatesRemoved += 1;
    const existingTime = Number.isFinite(existing.observationEpochMs)
      ? existing.observationEpochMs
      : -Infinity;
    const nextTime = Number.isFinite(station.observationEpochMs)
      ? station.observationEpochMs
      : -Infinity;
    if (nextTime > existingTime) byId.set(station.id, station);
  }
  return {
    stations: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
    duplicatesRemoved,
  };
}

export function normalizeMeteoJsonPayload(
  payload,
  { retrievedAt = Date.now(), remoteUrl = METEO_JSON_URL } = {},
) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new MeteoJsonError(
      "The DoM snapshot is not a JSON object.",
      "malformed-payload",
    );
  }
  if (!Array.isArray(payload.stations) || payload.stations.length === 0) {
    throw new MeteoJsonError(
      "The DoM snapshot contains no station records.",
      "empty-stations",
    );
  }

  const normalized = [];
  let invalidRecords = 0;
  for (const record of payload.stations.slice(0, 500)) {
    const station = normalizeMeteoStationRecord(record);
    if (station) normalized.push(station);
    else invalidRecords += 1;
  }
  if (normalized.length === 0) {
    throw new MeteoJsonError(
      "The DoM snapshot contained station records but none could be read.",
      "unreadable-stations",
    );
  }

  const { stations, duplicatesRemoved } = dedupeStations(normalized);
  const observationTimes = [
    ...new Set(stations.map((station) => station.observationTime).filter(Boolean)),
  ].sort((a, b) => Date.parse(b) - Date.parse(a));
  const observationTime = observationTimes[0] ?? null;

  const declaredCollectorTime =
    isoFromUnknown(payload.fetchedAtSriLanka) || isoFromUnknown(payload.fetchedAt);
  const collectorTime = isoFromUnknown(payload.fetchedAt) || declaredCollectorTime;
  const declaredLatest =
    parseObservationTimestamp(payload.meteoLatestObservationUpdatedAt)?.iso || null;
  const retrievedIso = isoFromEpoch(retrievedAt) || new Date().toISOString();

  return {
    source: {
      ...METEO_JSON_SOURCE,
      feedUrl: remoteUrl || METEO_JSON_SOURCE.feedUrl,
      declaredSourceUrl:
        cleanLabel(payload.source, 200) || METEO_JSON_SOURCE.url,
      declaredTimezone: cleanLabel(payload.timezone, 80) || "Asia/Colombo",
    },
    // The collector time is when the DoM page was read. It is deliberately
    // separate from the observation time and from the route's retrieval time.
    fetchedAt: collectorTime,
    collectedAt: collectorTime,
    collectedAtSriLanka: declaredCollectorTime,
    collectorDisplay:
      cleanLabel(payload.fetchedAtSriLankaDisplay, 40) ||
      (declaredCollectorTime
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Colombo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
            .format(new Date(declaredCollectorTime))
            .replace(",", "")
        : null),
    retrievedAt: retrievedIso,
    observationTime,
    observationTimes,
    declaredLatestObservation: declaredLatest,
    declaredStationCount: Number.isInteger(payload.stationCount)
      ? payload.stationCount
      : finiteNumber(payload.stationCount),
    stationCount: stations.length,
    invalidRecords,
    duplicatesRemoved,
    staleAfterMinutes: METEO_JSON_STALE_MINUTES,
    timezone: "Asia/Colombo",
    stations,
  };
}

function responseLooksLikeJson(response) {
  const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
  // raw.githubusercontent.com serves JSON as text/plain. Accept both, but
  // reject an HTML error page before attempting to parse it.
  return (
    !contentType ||
    contentType.includes("json") ||
    contentType.includes("text/plain") ||
    contentType.includes("application/octet-stream")
  );
}

async function readBoundedText(response) {
  const text = await response.text();
  if (typeof text !== "string" || text.length === 0) {
    throw new MeteoJsonError("The DoM snapshot response was empty.", "empty-response");
  }
  if (text.length > METEO_JSON_MAX_BYTES) {
    throw new MeteoJsonError(
      "The DoM snapshot response was larger than the accepted limit.",
      "response-too-large",
    );
  }
  return text;
}

/**
 * Fetch and validate the published snapshot. A failed remote fetch may use a
 * caller-supplied local loader (the checked-in repository copy) so the route
 * still works when GitHub is unreachable. A malformed remote response never
 * silently falls back: callers must see that validation failed.
 */
/**
 * Read the checked-in snapshot as a labelled fallback. A missing or unreadable
 * local copy must not mask the original upstream failure with a raw filesystem
 * error.
 */
async function localFallbackResult(localLoader, { now, url, remoteError }) {
  let local;
  try {
    local = await localLoader();
  } catch (error) {
    throw new MeteoJsonError(
      "The DoM snapshot could not be reached and no committed copy is available.",
      "unavailable",
      { remoteError, localError: error?.code || null },
    );
  }
  return {
    data: normalizeMeteoJsonPayload(local, { retrievedAt: now, remoteUrl: url }),
    retrieval: { mode: "local-fallback", remoteError },
  };
}

export async function fetchMeteoJson({
  url = METEO_JSON_URL,
  timeoutMs = METEO_JSON_TIMEOUT_MS,
  fetchImpl = fetch,
  now = Date.now(),
  localLoader = null,
} = {}) {
  let response;
  try {
    response = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json, text/plain;q=0.9",
        "User-Agent":
          "Aeris/1.0 (+https://github.com/sandilafernando/Aeris; official-observation-snapshot)",
      },
      cache: "no-store",
    });
  } catch (error) {
    const remoteError = error?.name === "TimeoutError" ? "timeout" : "network";
    if (typeof localLoader === "function") {
      return localFallbackResult(localLoader, { now, url, remoteError });
    }
    throw new MeteoJsonError(
      error?.name === "TimeoutError"
        ? "The DoM snapshot did not respond in time."
        : "The DoM snapshot could not be reached.",
      remoteError,
    );
  }

  if (!response.ok) {
    if (typeof localLoader === "function") {
      return localFallbackResult(localLoader, {
        now,
        url,
        remoteError: `http-${response.status}`,
      });
    }
    throw new MeteoJsonError(
      `The DoM snapshot returned HTTP ${response.status}.`,
      "http",
      { status: response.status },
    );
  }

  if (!responseLooksLikeJson(response)) {
    throw new MeteoJsonError(
      "The DoM snapshot returned a non-JSON response.",
      "content-type",
    );
  }

  const text = await readBoundedText(response);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new MeteoJsonError(
      "The DoM snapshot returned unreadable JSON.",
      "invalid-json",
    );
  }

  return {
    data: normalizeMeteoJsonPayload(payload, { retrievedAt: now, remoteUrl: url }),
    retrieval: { mode: "remote", remoteError: null },
  };
}

export function meteoStaleAfterMinutes(value) {
  const parsed = finiteNumber(value);
  return parsed != null && parsed > 0 ? parsed : METEO_JSON_STALE_MINUTES;
}
