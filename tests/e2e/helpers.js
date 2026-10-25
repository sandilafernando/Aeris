import { buildWeatherPayload, searchResultsFor, BERLIN } from "../fixtures/weather";

const GEOCODING_ROUTE = /geocoding-api\.open-meteo\.com\/v1\/search/;
const FORECAST_ROUTE = /api\.open-meteo\.com\/v1\/forecast/;

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
  return { timezone: "Europe/Berlin", temperature: 13.4 };
}

/**
 * Intercept Open-Meteo requests with deterministic, complete fixtures.
 * Returns counters so tests can assert refresh behaviour.
 */
export async function mockOpenMeteo(page, options = {}) {
  const state = {
    weatherRequests: 0,
    searchRequests: 0,
    weatherSuccesses: 0,
    weatherFailures: 0,
    failWeatherTimes: options.failWeatherTimes || 0,
    failWeatherAfter: options.failWeatherAfter ?? null,
    failWeatherCount: options.failWeatherCount ?? 1,
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
    ...preferences,
  };
  await page.addInitScript(
    ({ key, payload }) => window.localStorage.setItem(key, payload),
    { key: PREFS_KEY, payload: JSON.stringify(value) },
  );
}
