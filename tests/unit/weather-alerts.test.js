import assert from "node:assert/strict";
import { test } from "node:test";
import { findPrecipitationOnset, notificationKey } from "../../src/lib/weather-alerts.js";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);

function hour(index, overrides = {}) {
  return {
    timeMs: NOW + index * HOUR,
    precipitationProbability: 0,
    precipitation: 0,
    condition: { group: "cloudy" },
    ...overrides,
  };
}

test("no onset is reported when it is already raining", () => {
  assert.equal(
    findPrecipitationOnset(
      [hour(0, { precipitationProbability: 80, precipitation: 1.4 })],
      { condition: { group: "rain" }, precipitation: 1.4, time: NOW / 1000 },
      NOW,
    ),
    null,
  );
});

test("no onset is reported for a dry outlook", () => {
  assert.equal(
    findPrecipitationOnset(
      [
        hour(0, { precipitationProbability: 12 }),
        hour(1, { precipitationProbability: 24 }),
        hour(2, { precipitationProbability: 39 }),
      ],
      { condition: { group: "clear" }, precipitation: 0, time: NOW / 1000 },
      NOW,
    ),
    null,
  );
});

test("the first likely hour is returned with real timing and condition kind", () => {
  const onset = findPrecipitationOnset(
    [
      hour(0, { precipitationProbability: 20 }),
      hour(1, { precipitationProbability: 55, condition: { group: "rain" } }),
      hour(2, { precipitationProbability: 80, condition: { group: "storm" } }),
    ],
    { condition: { group: "partly" }, precipitation: 0, time: NOW / 1000 },
    NOW,
  );

  assert.ok(onset);
  assert.equal(onset.minutesAhead, 60);
  assert.equal(onset.kind, "Rain");
  assert.equal(onset.hour.timeMs, NOW + HOUR);
});

test("snow and storm hours keep distinct labels", () => {
  const snow = findPrecipitationOnset(
    [hour(1, { precipitation: 0.2, condition: { group: "snow" } })],
    { condition: { group: "cloudy" }, precipitation: 0, time: NOW / 1000 },
    NOW,
  );
  assert.equal(snow.kind, "Snow");

  const storm = findPrecipitationOnset(
    [hour(1, { precipitationProbability: 70, condition: { group: "storm" } })],
    { condition: { group: "cloudy" }, precipitation: 0, time: NOW / 1000 },
    NOW,
  );
  assert.equal(storm.kind, "Storms");
});

test("a missing clock falls back to the current observation time", () => {
  const onset = findPrecipitationOnset(
    [hour(1, { precipitationProbability: 60, condition: { group: "rain" } })],
    { condition: { group: "partly" }, precipitation: 0, time: NOW },
    0,
  );

  assert.ok(onset);
  assert.equal(onset.minutesAhead, 60);
});

test("hourly entries already in the past are not announced", () => {
  const onset = findPrecipitationOnset(
    [
      hour(-2, { precipitationProbability: 90, condition: { group: "storm" } }),
      hour(2, { precipitationProbability: 60, condition: { group: "rain" } }),
    ],
    { condition: { group: "partly" }, precipitation: 0, time: NOW / 1000 },
    NOW,
  );

  assert.ok(onset);
  assert.equal(onset.hour.timeMs, NOW + 2 * HOUR);
});

test("notification keys change with the place and the forecast hour", () => {
  const base = { hour: { timeMs: Date.UTC(2026, 9, 26, 14, 0, 0) } };
  const berlin = { id: "berlin" };
  const colombo = { id: "colombo" };

  assert.equal(notificationKey(berlin, base), "berlin:2026-10-26T14");
  assert.notEqual(notificationKey(berlin, base), notificationKey(colombo, base));
  assert.notEqual(
    notificationKey(berlin, base),
    notificationKey(berlin, { hour: { timeMs: base.hour.timeMs + HOUR } }),
  );
  assert.equal(notificationKey({ latitude: 6.927, longitude: 79.861 }, base), "6.927,79.861:2026-10-26T14");
  assert.equal(notificationKey(berlin, null), "berlin:unknown");
});
