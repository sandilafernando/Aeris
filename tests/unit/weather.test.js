import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildOutlook,
  buildWeatherUrl,
  convertTemperature,
  convertWind,
  formatPrecipitation,
  formatTemperature,
  formatVisibility,
  formatWind,
  getWeatherCondition,
  normalizeWeather,
  temperatureRange,
  uvIndexLabel,
  windDirectionLabel,
} from "../../src/lib/weather.js";
import {
  formatDaylightDuration,
  formatHour,
  formatLocalDate,
  formatShortDate,
  formatTime,
  localDateKey,
  relativeElapsedLabel,
  relativeFetchLabel,
  relativeObservationLabel,
  relativeUpdateLabel,
  safeTimeZone,
} from "../../src/lib/format.js";
import {
  normalizePlace,
  normalizePlacesState,
  normalizePreferences,
  normalizeStationPreference,
  placeFromCoordinates,
  placeKey,
  placeLabel,
  roundCoordinate,
} from "../../src/lib/storage.js";
import { paletteCssVariables, resolvePalette } from "../../src/lib/palettes.js";
import { buildWeatherPayload } from "../fixtures/weather.js";

const FIXED_NOW = Date.UTC(2026, 9, 25, 9, 30, 0);
const BERLIN = {
  id: "2950159",
  name: "Berlin",
  admin1: "Land Berlin",
  country: "Germany",
  countryCode: "DE",
  latitude: 52.52,
  longitude: 13.405,
  timezone: "Europe/Berlin",
};

test("weather condition lookup handles known, unknown, and missing codes", () => {
  assert.deepEqual(getWeatherCondition(0), { code: 0, label: "Clear sky", group: "clear", shortLabel: "Clear" });
  assert.equal(getWeatherCondition(61).group, "rain");
  assert.equal(getWeatherCondition(95).label, "Thunderstorm");
  assert.equal(getWeatherCondition(42).label, "Condition unavailable");
  assert.equal(getWeatherCondition(42).code, null);
  assert.equal(getWeatherCondition(null).code, null);
  assert.equal(getWeatherCondition("").code, null);
});

test("normalizeWeather maps current, hourly, and daily values", () => {
  const payload = buildWeatherPayload({ now: FIXED_NOW });
  const data = normalizeWeather(payload, BERLIN, FIXED_NOW);

  assert.equal(data.timezone, "Europe/Berlin");
  assert.equal(data.current.temperature, 13.4);
  assert.equal(data.current.condition.label, "Partly cloudy");
  assert.equal(data.current.isDay, true);
  assert.equal(data.current.humidity, 72);
  assert.equal(data.current.high, 15.2);
  assert.equal(data.current.low, 7.4);
  assert.equal(data.current.uvIndex, 0);
  assert.equal(data.hourly.length, 24);
  assert.equal(data.daily.length, 7);
  assert.equal(data.hourly[0].condition.group, "partly");
  assert.ok(data.current.sunrise > 0);
  assert.ok(data.current.sunset > data.current.sunrise);
});

test("normalizeWeather rejects incomplete responses", () => {
  assert.throws(() => normalizeWeather(null, BERLIN), /incomplete/);
  assert.throws(() => normalizeWeather({ current: null }, BERLIN), /incomplete/);
  assert.throws(
    () => normalizeWeather({ current: { time: 1 }, hourly: { time: "bad" } }, BERLIN),
    /incomplete/,
  );
});

test("normalizeWeather degrades gracefully when optional fields are absent", () => {
  const payload = buildWeatherPayload({ now: FIXED_NOW });
  delete payload.current.relative_humidity_2m;
  delete payload.current.pressure_msl;
  delete payload.daily.uv_index_max;
  delete payload.daily.precipitation_sum;

  const data = normalizeWeather(payload, BERLIN, FIXED_NOW);
  assert.equal(data.current.humidity, null);
  assert.equal(data.current.pressure, null);
  assert.equal(data.daily[0].uvIndexMax, null);
  assert.equal(data.daily[0].precipitationSum, null);
});

test("buildWeatherUrl requests the expected Open-Meteo units and ranges", () => {
  const url = new URL(buildWeatherUrl(BERLIN));
  assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
  assert.equal(url.searchParams.get("latitude"), "52.52");
  assert.equal(url.searchParams.get("longitude"), "13.405");
  assert.equal(url.searchParams.get("timezone"), "auto");
  assert.equal(url.searchParams.get("timeformat"), "unixtime");
  assert.equal(url.searchParams.get("forecast_days"), "7");
  assert.equal(url.searchParams.get("forecast_hours"), "24");
  assert.match(url.searchParams.get("hourly"), /precipitation_probability/);
  assert.match(url.searchParams.get("daily"), /sunrise/);
  assert.throws(() => buildWeatherUrl(null), /location/i);
});

test("temperature conversion and formatting", () => {
  assert.equal(convertTemperature(0, "c"), 0);
  assert.equal(convertTemperature(0, "f"), 32);
  assert.equal(convertTemperature(100, "f"), 212);
  assert.equal(convertTemperature(null, "c"), null);
  assert.equal(formatTemperature(13.4, "c"), "13°");
  assert.equal(formatTemperature(13.4, "f"), "56°");
  assert.equal(formatTemperature(13.4, "f", { withUnit: true }), "56°F");
  assert.equal(formatTemperature(-0.2, "c"), "0°");
  assert.equal(formatTemperature(null, "c"), "–");
});

test("wind and precipitation conversion", () => {
  assert.equal(convertWind(36, "ms"), 10);
  assert.equal(convertWind(10, "mph"), 6.21371);
  assert.equal(windDirectionLabel(0), "north");
  assert.equal(windDirectionLabel(90, true), "E");
  assert.equal(windDirectionLabel(238, true), "WSW");
  assert.equal(windDirectionLabel(null), "Unavailable");
  assert.match(formatWind(20, "kmh"), /^[0-9.,]+ km\/h$/);
  assert.equal(formatWind(20, "kmh", { valueOnly: true }).includes("km/h"), false);
  assert.match(formatPrecipitation(25.4, "imperial"), /1 in/);
  assert.equal(formatPrecipitation(2.5, "metric"), "2.5 mm");
  assert.equal(formatVisibility(1609.344, "imperial"), "1 mi");
  assert.equal(formatVisibility(1500, "metric"), "1.5 km");
  assert.equal(formatWind(null, "kmh"), "Unavailable");
});

test("UV labels and temperature ranges", () => {
  assert.equal(uvIndexLabel(0).label, "Low");
  assert.equal(uvIndexLabel(3).label, "Moderate");
  assert.equal(uvIndexLabel(6).label, "High");
  assert.equal(uvIndexLabel(8).label, "Very high");
  assert.equal(uvIndexLabel(11).label, "Extreme");
  assert.equal(uvIndexLabel(null).label, "Unavailable");
  assert.deepEqual(
    temperatureRange([
      { temperatureMin: 5, temperatureMax: 12 },
      { temperatureMin: 8, temperatureMax: 17 },
    ]),
    { min: 5, max: 17 },
  );
  assert.equal(temperatureRange([]), null);
});

test("buildOutlook describes current and upcoming precipitation", () => {
  const dryHours = Array.from({ length: 6 }, () => ({ precipitationProbability: 5 }));
  assert.match(buildOutlook(dryHours, { condition: { group: "clear" }, precipitation: 0 }), /dry/);
  assert.match(
    buildOutlook(
      [{ precipitationProbability: 65 }],
      { condition: { group: "rain" }, precipitation: 0 },
    ),
    /likely/,
  );
  assert.match(
    buildOutlook(
      [{ precipitationProbability: 35 }],
      { condition: { group: "rain" }, precipitation: 0 },
    ),
    /possible/,
  );
  assert.match(
    buildOutlook([], { condition: { group: "snow" }, precipitation: 0.4 }),
    /Snow is falling/,
  );
  assert.equal(buildOutlook([], null), "Forecast details are limited.");
});

test("date and time helpers respect the location timezone", () => {
  const noonUtc = Date.UTC(2026, 9, 25, 12, 0, 0);
  assert.equal(formatShortDate(noonUtc, "UTC", "en-US"), "Oct 25");
  assert.equal(formatHour(noonUtc, "UTC", "en-US"), "12 PM");
  assert.equal(formatTime(noonUtc, "UTC", "en-US"), "12:00 PM");
  assert.match(formatLocalDate(noonUtc, "UTC", "en-US"), /Sunday, October 25/);
  assert.equal(localDateKey(noonUtc, "UTC"), "2026-10-25");
  assert.equal(safeTimeZone("Not/AZone"), "UTC");
  assert.equal(safeTimeZone("Europe/Berlin"), "Europe/Berlin");
  assert.equal(formatDaylightDuration(3720), "1 hr 2 min");
  assert.equal(formatDaylightDuration(null), "Unavailable");
  assert.equal(relativeUpdateLabel(FIXED_NOW, FIXED_NOW + 10_000), "Updated just now");
  assert.equal(relativeUpdateLabel(FIXED_NOW, FIXED_NOW + 120_000), "Updated 2 min ago");
  assert.equal(relativeElapsedLabel(FIXED_NOW, FIXED_NOW + 30_000), "just now");
  assert.equal(relativeElapsedLabel(FIXED_NOW, FIXED_NOW + 3_600_000), "1 hr ago");
  assert.equal(relativeElapsedLabel(FIXED_NOW, FIXED_NOW + 2 * 86_400_000), "2 days ago");
  assert.equal(relativeElapsedLabel(null, FIXED_NOW), null);
  assert.equal(relativeObservationLabel(null, FIXED_NOW), "Observation time unavailable");
  assert.equal(relativeFetchLabel(null, FIXED_NOW), "Fetch time unavailable");
  assert.equal(
    relativeObservationLabel(FIXED_NOW, FIXED_NOW + 120_000),
    "Observed 2 min ago",
  );
  assert.equal(relativeFetchLabel(FIXED_NOW, FIXED_NOW + 120_000), "Fetched 2 min ago");
});

test("preference storage normalizes invalid values", () => {
  assert.deepEqual(normalizePreferences(null), {
    theme: "system",
    temperatureUnit: "c",
    windUnit: "kmh",
    reducedEffects: false,
    stationId: "auto",
    weatherNotifications: false,
    glanceSource: "dom",
    glanceMetrics: ["temperature", "humidity", "rainfall"],
  });
  assert.deepEqual(
    normalizePreferences({ theme: "sepia", temperatureUnit: "f", windUnit: "knots" }),
    {
      theme: "system",
      temperatureUnit: "f",
      windUnit: "kmh",
      reducedEffects: false,
      stationId: "auto",
      weatherNotifications: false,
      glanceSource: "dom",
      glanceMetrics: ["temperature", "humidity", "rainfall"],
    },
  );
  assert.deepEqual(
    normalizePreferences({
      theme: "dark",
      temperatureUnit: "c",
      windUnit: "mph",
      reducedEffects: true,
      stationId: "colombo",
      weatherNotifications: true,
      glanceSource: "metar",
      glanceMetrics: ["wind", "pressure"],
    }),
    {
      theme: "dark",
      temperatureUnit: "c",
      windUnit: "mph",
      reducedEffects: true,
      stationId: "colombo",
      weatherNotifications: true,
      glanceSource: "metar",
      glanceMetrics: ["wind", "pressure"],
    },
  );
  assert.equal(normalizePreferences({ reducedEffects: "yes" }).reducedEffects, false);
  assert.equal(normalizePreferences({ weatherNotifications: "yes" }).weatherNotifications, false);
  assert.equal(normalizePreferences({ glanceSource: "satellite" }).glanceSource, "dom");
  assert.deepEqual(normalizePreferences({ glanceMetrics: [] }).glanceMetrics, [
    "temperature",
    "humidity",
    "rainfall",
  ]);
  assert.deepEqual(
    normalizePreferences({
      glanceMetrics: ["wind", "wind", "nonsense", "pressure"],
    }).glanceMetrics,
    ["wind", "pressure"],
  );
  assert.equal(normalizeStationPreference("  COLOMBO  "), "colombo");
  assert.equal(normalizeStationPreference("auto"), "auto");
  assert.equal(normalizeStationPreference("bad id!"), "auto");
  assert.equal(normalizeStationPreference("x".repeat(81)), "auto");
  assert.equal(normalizeStationPreference(null), "auto");
  assert.equal(
    normalizePreferences({ stationId: "not a station" }).stationId,
    "auto",
    "unknown or malformed manual IDs fall back to Automatic",
  );
});

test("place storage rounds coordinates and de-duplicates saved places", () => {
  assert.equal(roundCoordinate(52.520008), 52.52);
  const place = normalizePlace({
    id: 1,
    name: "Berlin",
    admin1: "Land Berlin",
    country: "Germany",
    countryCode: "de",
    latitude: 52.520008,
    longitude: 13.404954,
    timezone: "Europe/Berlin",
  });
  assert.equal(place.latitude, 52.52);
  assert.equal(place.longitude, 13.405);
  assert.equal(place.countryCode, "DE");
  assert.equal(placeKey(place), "52.520,13.405");
  assert.equal(placeLabel(place), "Berlin, Land Berlin, Germany");

  const state = normalizePlacesState({
    saved: [place, place, { name: "Bad" }],
    activeId: "missing",
  });
  assert.equal(state.saved.length, 1);
  assert.equal(state.activeId, "1");

  const located = placeFromCoordinates(40.7128, -74.006);
  assert.equal(located.name, "Current location");
  assert.equal(located.id, "current-40.713,-74.006");
  assert.equal(normalizePlace(null), null);
});

test("palettes resolve for groups, day, and theme", () => {
  const day = resolvePalette("rain", true, "light");
  const night = resolvePalette("rain", false, "dark");
  assert.equal(day.group, "rain");
  assert.notEqual(day.hero.bg, night.hero.bg);
  const fallback = resolvePalette("unknown", true, "dark");
  assert.equal(fallback.group, "partly");
  const variables = paletteCssVariables(day);
  assert.equal(variables["--hero-bg"], day.hero.bg);
  assert.equal(variables["--primary"], day.primary);
});
