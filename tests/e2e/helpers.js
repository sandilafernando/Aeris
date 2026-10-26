import { buildWeatherPayload, searchResultsFor, BERLIN } from "../fixtures/weather";
import { SRI_LANKA_HTML } from "../fixtures/official-sources";
import { normalizeSriLankaHtml } from "../../src/lib/sources/sri-lanka-dom";

const GEOCODING_ROUTE = /geocoding-api\.open-meteo\.com\/v1\/search/;
const FORECAST_ROUTE = /api\.open-meteo\.com\/v1\/forecast/;
const ENSEMBLE_ROUTE = /ensemble-api\.open-meteo\.com\/v1\/ensemble/;
const ARCHIVE_ROUTE = /archive-api\.open-meteo\.com\/v1\/archive/;
const DOM_ROUTE = "**/api/weather/sri-lanka-dom";

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
 * Observations are aged relative to the browser clock so freshness behaviour
 * is testable regardless of when the suite runs. `stationAges` maps station
 * IDs to an age in minutes; everything else uses `observationAgeMinutes`.
 */
function buildObservationsPayload({
  observationAgeMinutes = 25,
  stationAges = {},
  omitStations = [],
} = {}) {
  // The route serves a cached fetch, so a small gap between retrieval and
  // response is normal. Keep the two timestamps distinct in tests as they are
  // in the real route handler.
  const servedAt = Date.now();
  const fetchedAt = servedAt - 20_000;
  const payload = normalizeSriLankaHtml(SRI_LANKA_HTML, { fetchedAt });
  const omitted = new Set(omitStations);
  const stations = payload.stations
    .filter((station) => !omitted.has(station.id))
    .map((station) => {
      const age = stationAges[station.id] ?? observationAgeMinutes;
      const observedAt = fetchedAt - age * 60_000;
      return {
        ...station,
        observationTime: new Date(observedAt).toISOString(),
        observationEpochMs: observedAt,
      };
    });
  const observationTimes = [...new Set(stations.map((station) => station.observationTime))].sort(
    (a, b) => Date.parse(b) - Date.parse(a),
  );

  return {
    ...payload,
    fetchedAt: new Date(fetchedAt).toISOString(),
    stations,
    stationCount: stations.length,
    observationTime: observationTimes[0] ?? null,
    observationTimes,
    staleAfterMinutes: 360,
    status: "ok",
    servedAt: new Date(servedAt).toISOString(),
    cache: "fresh",
    upstreamStale: false,
    notice: null,
  };
}

function buildMetarObservationsPayload({ observationAgeMinutes = 12 } = {}) {
  const servedAt = Date.now();
  const fetchedAt = servedAt - 20_000;
  const observedAt = fetchedAt - observationAgeMinutes * 60_000;
  const observationTime = new Date(observedAt).toISOString();
  const notice =
    "The Department of Meteorology page could not be reached from this server. Showing official ICAO airport METAR reports from NOAA AWC instead. These are airport stations, not DoM district stations.";

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
    notice,
    fallback: {
      active: true,
      from: "sri-lanka-dom",
      to: "sri-lanka-metar",
      reason: "timeout",
      notice,
    },
    attempts: [{ attempt: 1, status: null, code: "timeout", durationMs: 3000 }],
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
    officialObservationRequests: 0,
    officialObservationFailures: 0,
    weatherSuccesses: 0,
    weatherFailures: 0,
    failWeatherTimes: options.failWeatherTimes || 0,
    failWeatherAfter: options.failWeatherAfter ?? null,
    failWeatherCount: options.failWeatherCount ?? 1,
    failObservationsTimes: options.failObservationsTimes || 0,
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

  await page.route(DOM_ROUTE, async (route) => {
    state.officialObservationRequests += 1;

    if (state.failObservationsTimes > 0) {
      state.failObservationsTimes -= 1;
      state.officialObservationFailures += 1;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ status: "unavailable", error: "Test observation failure" }),
      });
      return;
    }

    if (options.officialSource === "metar") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          buildMetarObservationsPayload({
            observationAgeMinutes: options.observationAgeMinutes,
          }),
        ),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        buildObservationsPayload({
          observationAgeMinutes: options.observationAgeMinutes,
          stationAges: options.stationAges,
          omitStations: options.omitStations,
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
