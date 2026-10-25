import * as cheerio from "cheerio";

export const SRI_LANKA_DOM_URL = "https://meteo.gov.lk/";
export const SRI_LANKA_OBSERVATION_STALE_MINUTES = 6 * 60;

const SRI_LANKA_OFFSET_MINUTES = 330;

/**
 * Approximate city-centre points used only to request a comparable
 * Open-Meteo forecast. The Department of Meteorology does not publish
 * station coordinates in the inspected page, so these are explicitly
 * labelled as Aeris reference points, not official station locations.
 */
export const STATION_REFERENCE_POINTS = Object.freeze({
  JAFFNA: { latitude: 9.6615, longitude: 80.0255 },
  MANNAR: { latitude: 8.981, longitude: 79.9044 },
  VAVUNIYA: { latitude: 8.7514, longitude: 80.4971 },
  ANURADHAPURA: { latitude: 8.3114, longitude: 80.4037 },
  "MAHA ILLUPPALLAMA": { latitude: 8.1167, longitude: 80.4667 },
  TRINCOMALEE: { latitude: 8.5874, longitude: 81.2152 },
  POLONNARUWA: { latitude: 7.9403, longitude: 81.0188 },
  BATTICALOA: { latitude: 7.717, longitude: 81.7 },
  PUTTALAM: { latitude: 8.0362, longitude: 79.8283 },
  KURUNEGALA: { latitude: 7.4863, longitude: 80.3623 },
  KATUGASTOTA: { latitude: 7.3167, longitude: 80.6167 },
  "NUWARA ELIYA": { latitude: 6.9497, longitude: 80.7891 },
  BADULLA: { latitude: 6.9934, longitude: 81.055 },
  BANDARAWELA: { latitude: 6.8333, longitude: 80.9833 },
  MONARAGALA: { latitude: 6.8728, longitude: 81.3506 },
  POTTUVIL: { latitude: 6.8667, longitude: 81.8333 },
  COLOMBO: { latitude: 6.9271, longitude: 79.8612 },
  KATUNAYAKE: { latitude: 7.1697, longitude: 79.8843 },
  RATMALANA: { latitude: 6.8189, longitude: 79.8864 },
  RATNAPURA: { latitude: 6.6828, longitude: 80.3992 },
  GALLE: { latitude: 6.0535, longitude: 80.221 },
  MATTALA: { latitude: 5.9485, longitude: 80.5353 },
  HAMBANTOTA: { latitude: 6.1246, longitude: 81.1185 },
  MULLATIVU: { latitude: 9.267, longitude: 80.814 },
});

export const SRI_LANKA_REFERENCE_NOTE =
  "Approximate city-centre reference points created by Aeris for provider comparison. They are not official station coordinates.";

const CONDITION_RULES = [
  ["storm", /thunder|lightning/i],
  ["snow", /snow/i],
  ["rain", /rain|shower|drizzle/i],
  ["fog", /fog|mist/i],
  ["partly", /partly/i],
  ["cloudy", /cloud|overcast/i],
  ["clear", /clear|sunny|\bsun\b/i],
];

export class OfficialSourceError extends Error {
  constructor(message, code = "source") {
    super(message);
    this.name = "OfficialSourceError";
    this.code = code;
  }
}

export function slugifyStationName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function conditionKeyForLabel(label) {
  const text = String(label || "").trim();
  if (!text) return "unknown";
  for (const [key, pattern] of CONDITION_RULES) {
    if (pattern.test(text)) return key;
  }
  return "unknown";
}

export function parseNumericValue(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseObservationTimestamp(label) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2})(\d{2})$/.exec(
    String(label || "").trim(),
  );
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const monthIndex = Number(month) - 1;
  const dayNumber = Number(day);
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  if (monthIndex < 0 || monthIndex > 11) return null;
  if (dayNumber < 1 || dayNumber > 31) return null;
  if (hourNumber > 23 || minuteNumber > 59) return null;

  const utcMs =
    Date.UTC(Number(year), monthIndex, dayNumber, hourNumber, minuteNumber) -
    SRI_LANKA_OFFSET_MINUTES * 60 * 1000;
  const date = new Date(utcMs);
  if (Number.isNaN(date.getTime())) return null;
  return {
    epochMs: utcMs,
    iso: date.toISOString(),
    offsetMinutes: SRI_LANKA_OFFSET_MINUTES,
    sourceLabel: String(label).trim(),
  };
}

export function normalizeStationRecord(name, rawWeather) {
  const stationName = String(name || "").trim();
  if (!stationName) return null;

  let payload;
  try {
    payload = typeof rawWeather === "string" ? JSON.parse(rawWeather) : rawWeather;
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const observation = parseObservationTimestamp(payload.lastUpdated);
  const conditionLabel =
    typeof payload.forecast === "string" ? payload.forecast.trim().slice(0, 80) : "";
  const reference = STATION_REFERENCE_POINTS[stationName] || null;

  return {
    id: slugifyStationName(stationName),
    name: stationName,
    observationLabel:
      typeof payload.lastUpdated === "string" ? payload.lastUpdated.trim() : "",
    observationTime: observation?.iso || null,
    observationEpochMs: observation?.epochMs ?? null,
    temperatureC: parseNumericValue(payload.temp),
    relativeHumidity: parseNumericValue(payload.rh),
    rainfall3hMm: parseNumericValue(payload.rainfall),
    rainfallSince0830Mm: parseNumericValue(payload.totalRainfall),
    conditionLabel: conditionLabel || null,
    conditionKey: conditionKeyForLabel(conditionLabel),
    referencePoint: reference
      ? {
          latitude: reference.latitude,
          longitude: reference.longitude,
          label: "Approximate city-centre reference",
          official: false,
        }
      : null,
  };
}

export function normalizeSriLankaHtml(html, { fetchedAt = Date.now() } = {}) {
  if (typeof html !== "string" || html.trim().length === 0) {
    throw new OfficialSourceError(
      "The Department of Meteorology page returned no HTML.",
      "empty-response",
    );
  }

  const $ = cheerio.load(html);
  const nodes = $(".district-point[data-name][data-weather]");
  if (nodes.length === 0) {
    throw new OfficialSourceError(
      "No station records were found in the Department of Meteorology page.",
      "no-stations",
    );
  }

  const stations = [];
  let invalidRecords = 0;
  nodes.each((_, element) => {
    const station = normalizeStationRecord(
      $(element).attr("data-name"),
      $(element).attr("data-weather"),
    );
    if (station) stations.push(station);
    else invalidRecords += 1;
  });

  if (stations.length === 0) {
    throw new OfficialSourceError(
      "Station records were present but none could be read.",
      "unreadable-stations",
    );
  }

  const observationCounts = new Map();
  for (const station of stations) {
    if (!station.observationTime) continue;
    observationCounts.set(
      station.observationTime,
      (observationCounts.get(station.observationTime) || 0) + 1,
    );
  }
  const latestObservation = [...observationCounts.entries()].sort(
    (a, b) => Date.parse(b[0]) - Date.parse(a[0]),
  )[0]?.[0] || null;

  return {
    source: {
      id: "sri-lanka-dom",
      name: "Department of Meteorology, Sri Lanka",
      shortName: "Sri Lanka DoM",
      url: SRI_LANKA_DOM_URL,
      kind: "official-observations",
      title: "Weather Observations (3 Hourly)",
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
        "The source labels this field “weather”; Aeris shows it as the reported condition, not a forecast.",
      referenceNote: SRI_LANKA_REFERENCE_NOTE,
    },
    fetchedAt: new Date(fetchedAt).toISOString(),
    observationTime: latestObservation,
    observationTimes: [...observationCounts.keys()].sort(
      (a, b) => Date.parse(b) - Date.parse(a),
    ),
    stationCount: stations.length,
    invalidRecords,
    stations,
  };
}

export async function fetchSriLankaObservations({ timeoutMs = 20_000 } = {}) {
  let response;
  try {
    response = await fetch(SRI_LANKA_DOM_URL, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "AerisWeather/1.0 (+official-observation-check)",
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new OfficialSourceError(
      error?.name === "TimeoutError"
        ? "The Department of Meteorology page timed out."
        : "The Department of Meteorology page could not be reached.",
      "network",
    );
  }

  if (!response.ok) {
    throw new OfficialSourceError(
      `The Department of Meteorology page returned HTTP ${response.status}.`,
      "http",
    );
  }

  const html = await response.text();
  return normalizeSriLankaHtml(html, { fetchedAt: Date.now() });
}
