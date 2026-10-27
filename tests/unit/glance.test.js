import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  DEFAULT_GLANCE_METRICS,
  GLANCE_METRIC_LABELS,
  MAX_GLANCE_METRICS,
  buildGlanceView,
  chooseGlanceStation,
  metricAppliesToGroup,
  normalizeGlanceMetrics,
  normalizeGlanceSource,
  selectMetarFallback,
  toggleGlanceMetric,
} from "../../src/lib/glance.js";
import { normalizeMeteoJsonPayload } from "../../src/lib/sources/meteo-json.js";

const RAW = JSON.parse(
  await readFile(new URL("../../data/meteo.json", import.meta.url), "utf8"),
);
const OBSERVATION_MS = Date.UTC(2026, 9, 26, 15, 0); // 20:30 Asia/Colombo
const FRESH_NOW = OBSERVATION_MS + 60 * 60_000; // one hour later
const STALE_NOW = OBSERVATION_MS + 6 * 60 * 60_000; // beyond the five-hour limit
const COLOMBO = {
  name: "Colombo",
  countryCode: "LK",
  latitude: 6.9271,
  longitude: 79.8612,
};

const dom = normalizeMeteoJsonPayload(RAW, { retrievedAt: FRESH_NOW });
const metarAt = (observationMs) => [
  {
    id: "katunayake",
    name: "KATUNAYAKE",
    icaoId: "VCBI",
    observationTime: new Date(observationMs).toISOString(),
    observationEpochMs: observationMs,
    temperatureC: 25,
    relativeHumidity: 94,
    rainfall3hMm: null,
    windSpeedKmh: 18,
    pressureHpa: 1009,
    conditionLabel: "Cloudy",
    conditionKey: "cloudy",
    referencePoint: {
      latitude: 7.181,
      longitude: 79.884,
      label: "Airport station coordinates (NOAA AWC)",
      official: true,
    },
  },
  {
    id: "mattala",
    name: "MATTALA",
    icaoId: "VCRI",
    observationTime: new Date(observationMs).toISOString(),
    observationEpochMs: observationMs,
    temperatureC: 28,
    relativeHumidity: 80,
    rainfall3hMm: null,
    windSpeedKmh: 10,
    pressureHpa: 1008,
    conditionLabel: "Clear",
    conditionKey: "clear",
    referencePoint: {
      latitude: 6.287,
      longitude: 81.125,
      label: "Airport station coordinates (NOAA AWC)",
      official: true,
    },
  },
];
const metar = {
  source: { id: "sri-lanka-metar", name: "NOAA AWC METAR" },
  status: "ok",
  stations: metarAt(OBSERVATION_MS + 20 * 60_000),
  staleAfterMinutes: 180,
};

test("source and metric preferences are normalized and bounded", () => {
  assert.equal(normalizeGlanceSource("metar"), "metar");
  assert.equal(normalizeGlanceSource("combined"), "combined");
  assert.equal(normalizeGlanceSource("nonsense"), "dom");
  assert.deepEqual(normalizeGlanceMetrics(null), [...DEFAULT_GLANCE_METRICS]);
  assert.deepEqual(
    normalizeGlanceMetrics(["wind", "wind", "nope", "pressure"]),
    ["wind", "pressure"],
  );
  assert.deepEqual(normalizeGlanceMetrics([]), [...DEFAULT_GLANCE_METRICS]);
  assert.equal(GLANCE_METRIC_LABELS.rainfallTotal, "Rain since 08:30");
  assert.equal(metricAppliesToGroup("rainfall", "dom"), true);
  assert.equal(metricAppliesToGroup("rainfall", "metar"), false);
  assert.equal(metricAppliesToGroup("pressure", "metar"), true);
});

test("metric toggles keep at least one and never exceed the maximum", () => {
  const onlyTemperature = toggleGlanceMetric(["temperature"], "temperature");
  assert.deepEqual(onlyTemperature, ["temperature"]);

  const added = toggleGlanceMetric(["temperature"], "wind");
  assert.deepEqual(added, ["temperature", "wind"]);

  const removed = toggleGlanceMetric(["temperature", "wind"], "wind");
  assert.deepEqual(removed, ["temperature"]);

  const full = [
    "temperature",
    "humidity",
    "rainfall",
    "rainfallTotal",
    "wind",
    "pressure",
  ];
  assert.equal(full.length, MAX_GLANCE_METRICS);
  assert.deepEqual(toggleGlanceMetric(full, "visibility"), full);
});

test("automatic selection uses the nearest station, and a default outside Sri Lanka is labelled", () => {
  const selection = chooseGlanceStation(dom.stations, {
    location: COLOMBO,
    now: FRESH_NOW,
    allowDefault: true,
  });
  assert.equal(selection.station.id, "colombo");
  assert.equal(selection.defaulted, false);
  assert.equal(selection.fresh, true);

  const outside = chooseGlanceStation(dom.stations, {
    location: { name: "Berlin", countryCode: "DE", latitude: 52.52, longitude: 13.405 },
    now: FRESH_NOW,
    allowDefault: true,
  });
  assert.equal(outside.station.id, "colombo");
  assert.equal(outside.defaulted, true);
  assert.equal(outside.reason, "default-outside-sri-lanka");
  assert.equal(outside.distanceKm, null);

  const manual = chooseGlanceStation(dom.stations, {
    location: COLOMBO,
    preference: "katunayake",
    now: FRESH_NOW,
  });
  assert.equal(manual.station.id, "katunayake");
  assert.equal(manual.reason, "manual");
});

test("a stale DoM station cannot be fresh, but a five-hour-old one can be used", () => {
  const fiveHours = chooseGlanceStation(dom.stations, {
    location: COLOMBO,
    now: OBSERVATION_MS + 5 * 60 * 60_000,
  });
  assert.equal(fiveHours.fresh, true);

  const overFiveHours = chooseGlanceStation(dom.stations, {
    location: COLOMBO,
    now: OBSERVATION_MS + 5 * 60 * 60_000 + 1,
  });
  assert.equal(overFiveHours.fresh, false);
  assert.equal(overFiveHours.stale, true);
});

test("METAR fallback prefers the same airport, then the nearest fresh airport", () => {
  const same = selectMetarFallback(metar.stations, {
    domStation: dom.stations.find((station) => station.id === "katunayake"),
    location: COLOMBO,
    now: FRESH_NOW,
  });
  assert.equal(same.station.id, "katunayake");
  assert.equal(same.reason, "same-station");
  assert.equal(same.fresh, true);

  const nearest = selectMetarFallback(metar.stations, {
    domStation: dom.stations.find((station) => station.id === "nuwara-eliya"),
    location: COLOMBO,
    now: FRESH_NOW,
  });
  assert.equal(nearest.station.id, "mattala");
  assert.equal(nearest.reason, "nearest-fresh");

  const stale = selectMetarFallback(
    metarAt(OBSERVATION_MS - 4 * 60 * 60_000),
    {
      domStation: dom.stations.find((station) => station.id === "katunayake"),
      location: COLOMBO,
      now: FRESH_NOW,
    },
  );
  assert.equal(stale.station.id, "katunayake");
  assert.equal(stale.fresh, false);
});

test("fresh DoM data is used alone in DoM mode", () => {
  const view = buildGlanceView({
    source: "dom",
    dom,
    metar: null,
    location: COLOMBO,
    now: FRESH_NOW,
  });
  assert.equal(view.needsMetar, false);
  assert.equal(view.fallback, null);
  assert.equal(view.groups.length, 1);
  assert.equal(view.primary.station.id, "colombo");
  assert.equal(view.primary.fresh, true);
});

test("stale DoM data is replaced by a labelled, fresh METAR fallback", () => {
  const freshMetar = {
    ...metar,
    stations: metarAt(STALE_NOW - 20 * 60_000),
  };
  const view = buildGlanceView({
    source: "dom",
    dom,
    metar: freshMetar,
    location: COLOMBO,
    now: STALE_NOW,
  });
  assert.equal(view.needsMetar, true);
  assert.equal(view.fallback.active, true);
  assert.equal(view.fallback.reason, "dom-stale");
  assert.match(view.fallback.notice, /five-hour limit/);
  assert.match(view.fallback.notice, /not a DoM district reading/);
  assert.equal(view.groups.length, 1);
  assert.equal(view.primary.id, "metar");
  assert.equal(view.primary.station.id, "katunayake"); // nearest airport to Colombo
  assert.equal(view.primary.fresh, true);
});

test("stale DoM data with no METAR stays visible as stale and does not invent a fallback", () => {
  const view = buildGlanceView({
    source: "dom",
    dom,
    metar: null,
    location: COLOMBO,
    now: STALE_NOW,
  });
  assert.equal(view.needsMetar, true);
  assert.equal(view.fallback.active, false);
  assert.equal(view.fallback.reason, "dom-stale");
  assert.match(view.fallback.notice, /not presenting a current official observation/);
  assert.equal(view.groups.length, 1);
  assert.equal(view.primary.id, "dom");
  assert.equal(view.primary.fresh, false);
});

test("combined mode groups both sources without merging their readings", () => {
  const view = buildGlanceView({
    source: "combined",
    dom,
    metar,
    location: COLOMBO,
    now: FRESH_NOW,
  });
  assert.equal(view.groups.length, 2);
  assert.deepEqual(
    view.groups.map((group) => group.id),
    ["dom", "metar"],
  );
  assert.equal(view.groups[0].station.temperatureC, 25.7); // Colombo DoM
  assert.equal(view.groups[1].station.temperatureC, 25); // nearest airport METAR
  assert.equal(view.groups[1].source.id, "sri-lanka-metar");

  const stale = buildGlanceView({
    source: "combined",
    dom,
    metar,
    location: COLOMBO,
    now: STALE_NOW,
  });
  assert.equal(stale.groups.length, 2);
  assert.equal(stale.fallback.reason, "combined-dom-stale");
  assert.match(stale.fallback.notice, /not a replacement DoM observation/);
});

test("METAR-only mode never shows a DoM station", () => {
  const view = buildGlanceView({
    source: "metar",
    dom,
    metar,
    location: COLOMBO,
    now: FRESH_NOW,
  });
  assert.equal(view.needsMetar, true);
  assert.equal(view.groups.length, 1);
  assert.equal(view.primary.id, "metar");
  assert.equal(view.primary.source.id, "sri-lanka-metar");
});
