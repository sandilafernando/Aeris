/**
 * Official Sri Lankan airport observations from ICAO METAR reports.
 *
 * The Department of Meteorology page is the preferred source, but its host is
 * not reachable from most public cloud regions. The NOAA Aviation Weather
 * Center publishes the same ICAO METAR reports that Sri Lankan airport
 * meteorological offices transmit, from a globally reachable host. This module
 * keeps that fallback in the same normalized shape as the DoM parser so the
 * interface never has to blend two different observation models.
 *
 * Only fields actually present in the report are populated. Rainfall amount is
 * not included in this feed and is therefore null, never zero.
 */

export const METAR_API_URL = "https://aviationweather.gov/api/data/metar";
export const METAR_SOURCE_URL = "https://aviationweather.gov/data/api/";
export const METAR_OBSERVATION_STALE_MINUTES = 3 * 60;

/**
 * Canonical ids deliberately match the DoM station ids where the airport is
 * the same place. A saved manual station therefore survives a source switch
 * when an equivalent airport report exists.
 */
export const SRI_LANKA_METAR_STATIONS = Object.freeze({
  VCBI: {
    id: "katunayake",
    name: "KATUNAYAKE",
    locationName: "Bandaranaike International Airport",
    latitude: 7.181,
    longitude: 79.884,
    elevationM: 10,
    wmoId: "43450",
  },
  VCCC: {
    id: "ratmalana",
    name: "RATMALANA",
    locationName: "Colombo Ratmalana Airport",
    latitude: 6.822,
    longitude: 79.886,
    elevationM: 6,
    wmoId: "43467",
  },
  VCRI: {
    id: "mattala",
    name: "MATTALA",
    locationName: "Mattala Rajapaksa International Airport",
    latitude: 6.287,
    longitude: 81.125,
    elevationM: 50,
    wmoId: "43497",
  },
  VCCJ: {
    id: "jaffna",
    name: "JAFFNA",
    locationName: "Jaffna International Airport",
    latitude: 9.7931,
    longitude: 80.0707,
    elevationM: 15,
    wmoId: "43400",
  },
  VCCT: {
    id: "trincomalee",
    name: "TRINCOMALEE",
    locationName: "China Bay Airport",
    latitude: 8.541,
    longitude: 81.184,
    elevationM: 3,
    wmoId: "43418",
  },
  VCCB: {
    id: "batticaloa",
    name: "BATTICALOA",
    locationName: "Batticaloa Airport",
    latitude: 7.706,
    longitude: 81.679,
    elevationM: 6,
    wmoId: "43436",
  },
});

export const METAR_STATION_IDS = Object.freeze(Object.keys(SRI_LANKA_METAR_STATIONS));

export const METAR_SOURCE = Object.freeze({
  id: "sri-lanka-metar",
  name: "NOAA Aviation Weather Center — ICAO METAR",
  shortName: "NOAA AWC METAR",
  url: METAR_SOURCE_URL,
  kind: "official-aviation-observations",
  title: "Airport Weather Observations (METAR)",
  timezone: "Asia/Colombo",
  units: {
    temperature: "°C",
    relativeHumidity: "%",
    pressure: "hPa",
    wind: "km/h",
    visibility: "SM (as reported)",
  },
  conditionNote:
    "Condition labels are derived from the raw METAR weather group and cloud cover. Recent-weather groups (RE…) are not treated as current conditions.",
  referenceNote:
    "Coordinates are the airport station coordinates published by NOAA AWC. These are airport stations, not Department of Meteorology district stations.",
  attribution: "NOAA Aviation Weather Center / ICAO METAR",
});

export class MetarSourceError extends Error {
  constructor(message, code = "metar", details = null) {
    super(message);
    this.name = "MetarSourceError";
    this.code = code;
    this.details = details;
  }
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function humidityFromDewpoint(temperatureC, dewpointC) {
  const temperature = finiteNumber(temperatureC);
  const dewpoint = finiteNumber(dewpointC);
  if (temperature == null || dewpoint == null) return null;
  if (temperature < -60 || temperature > 60) return null;
  if (dewpoint < -80 || dewpoint > 60) return null;
  // Condensation cannot meaningfully exceed the air temperature.
  if (dewpoint > temperature + 0.5) return null;
  const exponent =
    (17.625 * dewpoint) / (243.04 + dewpoint) -
    (17.625 * temperature) / (243.04 + temperature);
  const humidity = 100 * Math.exp(exponent);
  if (!Number.isFinite(humidity)) return null;
  return Math.round(Math.min(100, Math.max(1, humidity)));
}

function dominantCover(clouds) {
  if (!Array.isArray(clouds)) return null;
  const priority = ["OVC", "BKN", "SCT", "FEW", "SKC", "CLR", "NSC", "NCD"];
  for (const cover of priority) {
    if (clouds.some((cloud) => String(cloud?.cover || "").toUpperCase() === cover)) {
      return cover;
    }
  }
  return null;
}

function conditionFromReport(rawObservation, cover) {
  const currentWeather = String(rawObservation || "")
    // "RE..." groups describe recent weather before the observation, not now.
    .replace(/\bRE[A-Z]{2,4}\b/g, " ")
    .replace(/\bRMK\b[\s\S]*$/, " ");

  if (/\bTS(?:RA|GR|GS)?\b/.test(currentWeather)) {
    return { label: "Thunderstorm", key: "storm" };
  }
  if (/\b(?:SN|SG)\b/.test(currentWeather)) {
    return { label: "Snow", key: "snow" };
  }
  if (/\b(?:GR|GS)\b/.test(currentWeather)) {
    return { label: "Hail", key: "unknown" };
  }
  if (/\b(?:SHRA|SH|RA)\b/.test(currentWeather)) {
    return { label: "Rain", key: "rain" };
  }
  if (/\bDZ\b/.test(currentWeather)) {
    return { label: "Drizzle", key: "rain" };
  }
  if (/\bFG\b/.test(currentWeather)) {
    return { label: "Fog", key: "fog" };
  }
  if (/\bBR\b/.test(currentWeather)) {
    return { label: "Mist", key: "fog" };
  }
  if (/\b(?:HZ|FU|SA|DU)\b/.test(currentWeather)) {
    return { label: "Haze", key: "fog" };
  }

  const normalisedCover = String(cover || "").toUpperCase();
  if (normalisedCover === "OVC") return { label: "Overcast", key: "cloudy" };
  if (normalisedCover === "BKN") return { label: "Cloudy", key: "cloudy" };
  if (normalisedCover === "SCT" || normalisedCover === "FEW") {
    return { label: "Partly cloudy", key: "partly" };
  }
  if (["SKC", "CLR", "NSC", "NCD"].includes(normalisedCover)) {
    return { label: "Clear", key: "clear" };
  }
  return { label: "Not reported", key: "unknown" };
}

function visibilityLabel(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return `${text} SM`;
}

function windSpeedKmh(knots) {
  const value = finiteNumber(knots);
  if (value == null) return null;
  return Math.round(value * 1.852 * 10) / 10;
}

/**
 * Normalize one AWC report. A single station can publish several reports in a
 * six-hour window; callers should keep the latest per station.
 */
export function normalizeMetarReport(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) return null;
  const icaoId = String(report.icaoId || "").trim().toUpperCase();
  const station = SRI_LANKA_METAR_STATIONS[icaoId];
  if (!station) return null;

  const observedAt = finiteNumber(report.obsTime);
  const observationEpochMs =
    observedAt == null ? null : observedAt > 10_000_000_000 ? observedAt : observedAt * 1000;
  const observationTime =
    observationEpochMs == null ? null : new Date(observationEpochMs).toISOString();
  const rawObservation = String(report.rawOb || "").trim();
  const cover = String(report.cover || dominantCover(report.clouds) || "").toUpperCase() || null;
  const condition = conditionFromReport(rawObservation, cover);
  const temperatureC = finiteNumber(report.temp);

  if (!observationTime && !rawObservation && temperatureC == null) return null;

  return {
    id: station.id,
    name: station.name,
    locationName: station.locationName,
    icaoId,
    wmoId: station.wmoId,
    observationLabel: report.reportTime || observationTime || "",
    observationTime,
    observationEpochMs,
    temperatureC,
    dewpointC: finiteNumber(report.dewp),
    relativeHumidity: humidityFromDewpoint(temperatureC, report.dewp),
    rainfall3hMm: null,
    rainfallSince0830Mm: null,
    pressureHpa: finiteNumber(report.altim),
    windSpeedKmh: windSpeedKmh(report.wspd),
    windGustKmh: windSpeedKmh(report.wgst),
    windDirection: finiteNumber(report.wdir),
    visibilityLabel: visibilityLabel(report.visib),
    cloudCover: cover,
    cloudBaseFt: finiteNumber(report.clouds?.[0]?.base),
    conditionLabel: condition.label,
    conditionKey: condition.key,
    rawObservation: rawObservation || null,
    referencePoint: {
      latitude: station.latitude,
      longitude: station.longitude,
      label: "Airport station coordinates (NOAA AWC)",
      official: true,
      elevationM: station.elevationM,
    },
  };
}

export function normalizeMetarPayload(payload, { fetchedAt = Date.now() } = {}) {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new MetarSourceError(
      "NOAA AWC returned no Sri Lankan airport reports.",
      "empty-response",
    );
  }

  const latestByStation = new Map();
  let invalidRecords = 0;
  for (const report of payload) {
    const normalized = normalizeMetarReport(report);
    if (!normalized) {
      invalidRecords += 1;
      continue;
    }
    const existing = latestByStation.get(normalized.icaoId);
    if (!existing) {
      latestByStation.set(normalized.icaoId, normalized);
      continue;
    }
    const existingTime = existing.observationEpochMs ?? 0;
    const nextTime = normalized.observationEpochMs ?? 0;
    if (nextTime > existingTime) latestByStation.set(normalized.icaoId, normalized);
  }

  const stations = [...latestByStation.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  if (stations.length === 0) {
    throw new MetarSourceError(
      "NOAA AWC reports were present but none could be read as Sri Lankan stations.",
      "unreadable-stations",
    );
  }

  const observationTimes = [...new Set(stations.map((station) => station.observationTime))]
    .filter(Boolean)
    .sort((a, b) => Date.parse(b) - Date.parse(a));

  return {
    source: METAR_SOURCE,
    fetchedAt: new Date(fetchedAt).toISOString(),
    observationTime: observationTimes[0] ?? null,
    observationTimes,
    stationCount: stations.length,
    invalidRecords,
    staleAfterMinutes: METAR_OBSERVATION_STALE_MINUTES,
    stations,
  };
}

export async function fetchSriLankaMetarObservations({
  timeoutMs = 15_000,
  fetchImpl = fetch,
  now = Date.now(),
  hours = 6,
} = {}) {
  const url = new URL(METAR_API_URL);
  url.searchParams.set("ids", METAR_STATION_IDS.join(","));
  url.searchParams.set("format", "json");
  url.searchParams.set("hours", String(hours));

  let response;
  try {
    response = await fetchImpl(url.toString(), {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Aeris/1.0 (+https://github.com/sandilafernando/Aeris; official-observation-fallback)",
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new MetarSourceError(
      error?.name === "TimeoutError"
        ? "NOAA AWC did not respond in time."
        : "NOAA AWC could not be reached.",
      "network",
      { name: error?.name },
    );
  }

  if (!response.ok) {
    throw new MetarSourceError(
      `NOAA AWC returned HTTP ${response.status}.`,
      "http",
      { status: response.status },
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new MetarSourceError("NOAA AWC returned an unreadable response.", "response");
  }

  return normalizeMetarPayload(payload, { fetchedAt: now });
}
