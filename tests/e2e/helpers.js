import { readFileSync } from "node:fs";
import path from "node:path";
import { buildWeatherPayload, searchResultsFor, BERLIN } from "../fixtures/weather";
import { normalizeMeteoJsonPayload } from "../../src/lib/sources/meteo-json";
import { slugifyStationName } from "../../src/lib/sources/sri-lanka-dom";

const GEOCODING_ROUTE = /geocoding-api\.open-meteo\.com\/v1\/search/;
const FORECAST_ROUTE = /api\.open-meteo\.com\/v1\/forecast/;
const ENSEMBLE_ROUTE = /ensemble-api\.open-meteo\.com\/v1\/ensemble/;
const ARCHIVE_ROUTE = /archive-api\.open-meteo\.com\/v1\/archive/;
const METEO_JSON_ROUTE = "**/api/weather/meteo-json";
const METAR_ROUTE = "**/api/weather/metar";
const GIBS_ROUTE = "https://gibs.earthdata.nasa.gov/**";

// A recorded real 24-station DoM snapshot. Tests copy its names and readings
// and only move `lastUpdated` so freshness behaviour is deterministic. The live
// `data/meteo.json` is collected continuously and its readings change, so it
// must never be the source of an asserted value here.
const REAL_METEO_SNAPSHOT = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests", "fixtures", "meteo-snapshot-2026-10-26.json"),
    "utf8",
  ),
);

const SRI_LANKA_OFFSET_MS = (5 * 60 + 30) * 60_000;

function sriLankaShiftedIso(epochMs) {
  return new Date(epochMs + SRI_LANKA_OFFSET_MS).toISOString();
}

function sriLankaObservationStamp(epochMs) {
  const iso = sriLankaShiftedIso(epochMs);
  return `${iso.slice(0, 10)} ${iso.slice(11, 13)}${iso.slice(14, 16)}`;
}

function sriLankaIso(epochMs) {
  return `${sriLankaShiftedIso(epochMs).slice(0, 23)}+05:30`;
}

function sriLankaDisplay(epochMs) {
  return sriLankaShiftedIso(epochMs).slice(0, 19).replace("T", " ");
}

// A valid 1×1 PNG followed by ignored padding. The satellite card rejects
// frames below 5 KB because GIBS advertises blank frames before ingestion
// finishes, so the fixture must clear that threshold while staying decodable.
const SATELLITE_FRAME = Buffer.concat([
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  ),
  Buffer.alloc(6_000),
]);

function satelliteAvailabilityXml() {
  const time = new Date(Date.now() - 20 * 60_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  return `<Domains><SpaceDomain><BoundingBox miny='-90' maxx='180' maxy='90' minx='-180' crs='urn:ogc:def:crs:OGC:2:84'/></SpaceDomain><DimensionDomain><ows:Identifier>time</ows:Identifier><Domain>${time}/PT10M</Domain><Size>1</Size></DimensionDomain></Domains>`;
}

function environmentFor(latitude, longitude) {
  if (Math.abs(latitude - 38.7167) < 0.2) {
    return { timezone: "Europe/Lisbon", temperature: 18.4 };
  }
  if (Math.abs(latitude - 25.0478) < 0.2) {
    return { timezone: "Asia/Taipei", temperature: 25.8, conditionCode: 80 };
  }
  if (Math.abs(latitude - 40.7128) < 0.2) {
    return { timezone: "America/New_York", temperature: 20.6, conditionCode: 1 };
  }
  if (latitude > 5.7 && latitude < 10 && longitude > 79.4 && longitude < 82) {
    return { timezone: "Asia/Colombo", temperature: 30.2, conditionCode: 80 };
  }
  return { timezone: "Europe/Berlin", temperature: 13.4 };
}

/**
 * Build the same response shape as `/api/weather/meteo-json` from the real
 * 24-station snapshot. Only `lastUpdated` is shifted so freshness is
 * deterministic. `stationAges` maps station IDs to an age in minutes.
 */
function buildMeteoJsonPayload({
  observationAgeMinutes = 25,
  stationAges = {},
  omitStations = [],
} = {}) {
  const servedAt = Date.now();
  const fetchedAt = servedAt - 20_000;
  const omitted = new Set(omitStations);
  let youngestAge = observationAgeMinutes;

  const stations = REAL_METEO_SNAPSHOT.stations
    .filter((station) => !omitted.has(slugifyStationName(station.name)))
    .map((station) => {
      const id = slugifyStationName(station.name);
      const age = stationAges[id] ?? observationAgeMinutes;
      youngestAge = Math.min(youngestAge, age);
      return {
        ...station,
        weather: {
          ...station.weather,
          // Live rainfall changes with the weather. Pin Pottuvil to a trace
          // value so the trace-rendering test stays deterministic without
          // inventing a value in production code.
          rainfall: id === "pottuvil" ? "Trace" : station.weather.rainfall,
          lastUpdated: sriLankaObservationStamp(fetchedAt - age * 60_000),
        },
      };
    });

  const latestEpoch = fetchedAt - youngestAge * 60_000;
  const raw = {
    source: REAL_METEO_SNAPSHOT.source,
    fetchedAt: new Date(fetchedAt).toISOString(),
    fetchedAtSriLanka: sriLankaIso(fetchedAt),
    fetchedAtSriLankaDisplay: sriLankaDisplay(fetchedAt),
    timezone: "Asia/Colombo",
    meteoLatestObservationUpdatedAt: sriLankaObservationStamp(latestEpoch),
    meteoLatestObservationUpdatedAtSriLanka: sriLankaIso(latestEpoch),
    stationCount: stations.length,
    stations,
  };

  const normalized = normalizeMeteoJsonPayload(raw, {
    retrievedAt: servedAt,
    remoteUrl:
      "https://raw.githubusercontent.com/sandilafernando/Aeris/main/data/meteo.json",
  });
  const observationAge = Date.parse(normalized.observationTime || "");
  const observationAgeMinutesValue = Number.isFinite(observationAge)
    ? (servedAt - observationAge) / 60_000
    : null;
  const observationStale =
    observationAgeMinutesValue == null ||
    observationAgeMinutesValue > normalized.staleAfterMinutes;

  return {
    ...normalized,
    status: observationStale ? "stale" : "ok",
    servedAt: new Date(servedAt).toISOString(),
    cache: "fresh",
    upstreamStale: false,
    observationAgeMinutes:
      observationAgeMinutesValue == null ? null : Math.round(observationAgeMinutesValue),
    collectionAgeMinutes: 0,
    observationStale,
    collectionStale: false,
    collectionStaleAfterMinutes: 90,
    notice: observationStale
      ? "The latest observation in the DoM snapshot is older than 5 hours."
      : null,
  };
}

function buildMetarObservationsPayload({ observationAgeMinutes = 12 } = {}) {
  const servedAt = Date.now();
  const fetchedAt = servedAt - 20_000;
  const observedAt = fetchedAt - observationAgeMinutes * 60_000;
  const observationTime = new Date(observedAt).toISOString();

  const stations = [
    {
      id: "ratmalana",
      name: "RATMALANA",
      locationName: "Colombo Ratmalana Airport",
      icaoId: "VCCC",
      wmoId: "43467",
      observationLabel: "2026-10-26 0000",
      observationTime,
      observationEpochMs: observedAt,
      temperatureC: 28,
      dewpointC: 26,
      relativeHumidity: 89,
      rainfall3hMm: null,
      rainfallSince0830Mm: null,
      pressureHpa: 1009,
      windSpeedKmh: 14.8,
      windGustKmh: 27.8,
      windDirection: 220,
      visibilityLabel: "6+ SM",
      cloudCover: "FEW",
      cloudBaseFt: 1600,
      conditionLabel: "Partly cloudy",
      conditionKey: "partly",
      rawObservation: "METAR VCCC 260000Z 22008KT 9999 FEW016 28/26 Q1009",
      referencePoint: {
        latitude: 6.822,
        longitude: 79.886,
        label: "Airport station coordinates (NOAA AWC)",
        official: true,
        elevationM: 6,
      },
    },
    {
      id: "katunayake",
      name: "KATUNAYAKE",
      locationName: "Bandaranaike International Airport",
      icaoId: "VCBI",
      wmoId: "43450",
      observationLabel: "2026-10-26 0000",
      observationTime,
      observationEpochMs: observedAt,
      temperatureC: 28,
      dewpointC: 27,
      relativeHumidity: 94,
      rainfall3hMm: null,
      rainfallSince0830Mm: null,
      pressureHpa: 1009,
      windSpeedKmh: 18.5,
      windGustKmh: null,
      windDirection: 220,
      visibilityLabel: "6+ SM",
      cloudCover: "BKN",
      cloudBaseFt: 1600,
      conditionLabel: "Cloudy",
      conditionKey: "cloudy",
      rawObservation: "METAR VCBI 260010Z 22010KT 9999 BKN016 28/27 Q1009",
      referencePoint: {
        latitude: 7.181,
        longitude: 79.884,
        label: "Airport station coordinates (NOAA AWC)",
        official: true,
        elevationM: 10,
      },
    },
  ];

  return {
    source: {
      id: "sri-lanka-metar",
      name: "NOAA Aviation Weather Center — ICAO METAR",
      shortName: "NOAA AWC METAR",
      url: "https://aviationweather.gov/data/api/",
      kind: "official-aviation-observations",
      title: "Airport Weather Observations (METAR)",
      timezone: "Asia/Colombo",
      units: { temperature: "°C", relativeHumidity: "%", pressure: "hPa", wind: "km/h" },
      conditionNote:
        "Condition labels are derived from the raw METAR weather group and cloud cover.",
      referenceNote:
        "Coordinates are the airport station coordinates published by NOAA AWC. These are airport stations, not Department of Meteorology district stations.",
      attribution: "NOAA Aviation Weather Center / ICAO METAR",
    },
    fetchedAt: new Date(fetchedAt).toISOString(),
    observationTime,
    observationTimes: [observationTime],
    stationCount: stations.length,
    invalidRecords: 0,
    staleAfterMinutes: 180,
    stations,
    status: "ok",
    servedAt: new Date(servedAt).toISOString(),
    cache: "fresh",
    upstreamStale: false,
    observationAgeMinutes: Math.round(observationAgeMinutes),
    observationStale: observationAgeMinutes > 180,
    notice: null,
  };
}

function buildEnsemblePayload() {
  const start = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  const time = [];
  const memberSeries = Array.from({ length: 31 }, () => []);
  for (let index = 0; index < 72; index += 1) {
    time.push((start + index * 3_600_000) / 1000);
    const base = 27 + Math.sin(index / 7) * 2;
    for (let member = 0; member < 31; member += 1) {
      memberSeries[member].push(
        Number((base + ((member - 15) / 15) * (0.8 + index * 0.05)).toFixed(2)),
      );
    }
  }
  const hourly = { time, temperature_2m: memberSeries[0] };
  memberSeries.forEach((series, index) => {
    const key = `temperature_2m_member${String(index + 1).padStart(2, "0")}`;
    hourly[key] = series;
  });
  return {
    latitude: 52.52,
    longitude: 13.405,
    timezone: "Europe/Berlin",
    hourly_units: { time: "unixtime", temperature_2m: "°C" },
    hourly,
  };
}

function buildArchivePayload() {
  const time = [];
  const temperatureMax = [];
  const temperatureMin = [];
  const precipitationSum = [];
  for (let index = 7; index >= 1; index -= 1) {
    const date = new Date(Date.now() - index * 86_400_000);
    time.push(date.toISOString().slice(0, 10));
    temperatureMax.push(15 + index);
    temperatureMin.push(8 + index);
    precipitationSum.push(index % 3 === 0 ? 3.4 : 0);
  }
  return {
    latitude: 52.52,
    longitude: 13.405,
    timezone: "Europe/Berlin",
    daily_units: { time: "iso8601", temperature_2m_max: "°C" },
    daily: {
      time,
      weather_code: time.map((_, index) => (index % 2 === 0 ? 2 : 61)),
      temperature_2m_max: temperatureMax,
      temperature_2m_min: temperatureMin,
      precipitation_sum: precipitationSum,
      wind_speed_10m_max: time.map((_, index) => 12 + index),
    },
  };
}

export async function mockOpenMeteo(page, options = {}) {
  const state = {
    weatherRequests: 0,
    searchRequests: 0,
    ensembleRequests: 0,
    archiveRequests: 0,
    meteoJsonRequests: 0,
    meteoJsonFailures: 0,
    metarRequests: 0,
    metarFailures: 0,
    satelliteImageRequests: 0,
    satelliteMetadataRequests: 0,
    weatherSuccesses: 0,
    weatherFailures: 0,
    failWeatherTimes: options.failWeatherTimes || 0,
    failWeatherAfter: options.failWeatherAfter ?? null,
    failWeatherCount: options.failWeatherCount ?? 1,
    failMeteoJsonTimes:
      options.failMeteoJsonTimes ?? options.failObservationsTimes ?? 0,
    failMetarTimes: options.failMetarTimes ?? 0,
    weatherDelayMs: options.weatherDelayMs ?? 0,
    isDay: options.isDay ?? 1,
  };

  await page.route(GEOCODING_ROUTE, async (route) => {
    state.searchRequests += 1;
    const url = new URL(route.request().url());
    const query = url.searchParams.get("name") || "";
    const results = searchResultsFor(query);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generationtime_ms: 0.12,
        ...(results.length ? { results } : {}),
      }),
    });
  });

  await page.route(FORECAST_ROUTE, async (route) => {
    state.weatherRequests += 1;

    const delayedFailure =
      state.failWeatherAfter !== null &&
      state.weatherSuccesses >= state.failWeatherAfter &&
      state.weatherFailures < state.failWeatherCount;
    const shouldFail = state.failWeatherTimes > 0 || delayedFailure;

    if (state.failWeatherTimes > 0) state.failWeatherTimes -= 1;
    if (delayedFailure) state.weatherFailures += 1;

    if (shouldFail) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: true, reason: "Test failure" }),
      });
      return;
    }

    if (state.weatherDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, state.weatherDelayMs));
    }

    const url = new URL(route.request().url());
    const latitude = Number(url.searchParams.get("latitude"));
    const longitude = Number(url.searchParams.get("longitude"));
    const environment = environmentFor(latitude, longitude);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        buildWeatherPayload({
          now: Date.now(),
          latitude,
          longitude,
          timezone: environment.timezone,
          temperature: environment.temperature,
          conditionCode: environment.conditionCode ?? 2,
          isDay: state.isDay,
        }),
      ),
    });
    state.weatherSuccesses += 1;
  });

  await page.route(ENSEMBLE_ROUTE, async (route) => {
    state.ensembleRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildEnsemblePayload()),
    });
  });

  await page.route(ARCHIVE_ROUTE, async (route) => {
    state.archiveRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildArchivePayload()),
    });
  });

  await page.route(GIBS_ROUTE, async (route) => {
    const url = route.request().url();
    if (url.includes(".xml")) {
      state.satelliteMetadataRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "text/xml",
        body: satelliteAvailabilityXml(),
      });
      return;
    }
    state.satelliteImageRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: SATELLITE_FRAME,
    });
  });

  await page.route(METEO_JSON_ROUTE, async (route) => {
    state.meteoJsonRequests += 1;

    const forcedMetar = options.officialSource === "metar";
    if (state.failMeteoJsonTimes > 0 || forcedMetar) {
      if (state.failMeteoJsonTimes > 0) state.failMeteoJsonTimes -= 1;
      state.meteoJsonFailures += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          status: "unavailable",
          error: "Test DoM snapshot failure",
          code: "test-unavailable",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        buildMeteoJsonPayload({
          observationAgeMinutes: options.observationAgeMinutes,
          stationAges: options.stationAges,
          omitStations: options.omitStations,
        }),
      ),
    });
  });

  await page.route(METAR_ROUTE, async (route) => {
    state.metarRequests += 1;

    if (state.failMetarTimes > 0) {
      state.failMetarTimes -= 1;
      state.metarFailures += 1;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          status: "unavailable",
          error: "Test METAR failure",
          code: "test-unavailable",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        buildMetarObservationsPayload({
          observationAgeMinutes: options.metarObservationAgeMinutes ?? 12,
        }),
      ),
    });
  });

  return state;
}

export const PREFS_KEY = "aeris:preferences:v1";
export const PLACES_KEY = "aeris:places:v1";

export async function openCityFromOnboarding(page, query = "Ber", result = "Berlin") {
  await page.getByRole("combobox", { name: /search for a city/i }).fill(query);
  const option = page.getByRole("option", { name: new RegExp(result, "i") });
  await option.waitFor();
  await option.click();
}

export function savedPlaceFor(place = BERLIN) {
  return {
    id: String(place.id),
    name: place.name,
    admin1: place.admin1,
    country: place.country,
    countryCode: place.country_code,
    latitude: Math.round(place.latitude * 1000) / 1000,
    longitude: Math.round(place.longitude * 1000) / 1000,
    timezone: place.timezone,
  };
}

export async function seedPlaces(page, places = [BERLIN], activeIndex = 0) {
  const saved = places.map((place) => savedPlaceFor(place));
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, value),
    {
      key: PLACES_KEY,
      value: JSON.stringify({
        saved,
        activeId: saved[activeIndex]?.id ?? null,
      }),
    },
  );
}

export async function seedPreferences(page, preferences = {}) {
  const value = {
    theme: "system",
    temperatureUnit: "c",
    windUnit: "kmh",
    reducedEffects: false,
    stationId: "auto",
    ...preferences,
  };
  await page.addInitScript(
    ({ key, payload }) => window.localStorage.setItem(key, payload),
    { key: PREFS_KEY, payload: JSON.stringify(value) },
  );
}
