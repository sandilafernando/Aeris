import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildActivityGuidance,
  buildRainIntelligence,
} from "../../src/lib/insights.js";

const HOUR = 3_600_000;
const BASE = Date.UTC(2026, 9, 27, 5, 30); // 11:00 Asia/Colombo

function hours(values) {
  return values.map((entry, index) => ({
    timeMs: BASE + index * HOUR,
    temperature: entry.temperature ?? 28,
    precipitation: entry.mm === undefined ? 0 : entry.mm,
    precipitationProbability: entry.pct === undefined ? 0 : entry.pct,
    windSpeed: entry.wind ?? 8,
    uvIndex: entry.uv ?? 4,
  }));
}

test("the likeliest hour is reported separately from the wettest hour", () => {
  const rain = buildRainIntelligence(
    hours([
      { mm: 0, pct: 20 },
      { mm: 2.6, pct: 55 },
      { mm: 0, pct: 94 },
    ]),
    BASE,
  );

  assert.equal(rain.maxProbability, 94);
  assert.equal(rain.peakProbabilityTime, BASE + 2 * HOUR);
  assert.equal(rain.peakMm, 2.6);
  assert.equal(rain.peakTime, BASE + 1 * HOUR);
  assert.notEqual(rain.peakTime, rain.peakProbabilityTime);
});

test("hours that have already passed are excluded from the next-day window", () => {
  const forecast = hours([
    { mm: 9, pct: 99 },
    { mm: 9, pct: 99 },
    { mm: 4, pct: 40 },
    { mm: 0, pct: 10 },
  ]);

  const rain = buildRainIntelligence(forecast, BASE + 2 * HOUR);

  assert.equal(rain.hours.length, 2);
  assert.equal(rain.maxProbability, 40);
  assert.equal(rain.peakProbabilityTime, BASE + 2 * HOUR);
  assert.equal(rain.peakMm, 4);
});

test("a missing probability or amount stays unavailable, never zero", () => {
  const rain = buildRainIntelligence(
    hours([
      { mm: null, pct: null },
      { mm: null, pct: null },
    ]),
    BASE,
  );

  assert.equal(rain.maxProbability, null);
  assert.equal(rain.peakProbabilityTime, null);
  assert.equal(rain.peakMm, null);
  assert.equal(rain.peakTime, null);
  assert.equal(rain.totalMm, null);
  assert.equal(rain.wetHours, null);
});

test("an empty forecast has no invented peaks or windows", () => {
  const rain = buildRainIntelligence([], BASE);
  assert.deepEqual(rain, {
    totalMm: null,
    peakMm: null,
    peakTime: null,
    peakProbabilityTime: null,
    wetHours: null,
    maxProbability: null,
    dryWindowStart: null,
    dryWindowLength: null,
    hours: [],
  });
});

test("activity guidance uses the upcoming hours and explains a limited day", () => {
  const forecast = hours(
    Array.from({ length: 12 }, () => ({
      temperature: 31,
      mm: 0.4,
      pct: 60,
      wind: 10,
      uv: 5,
    })),
  );

  const guidance = buildActivityGuidance(forecast, BASE);
  assert.equal(guidance.length, 3);
  for (const activity of guidance) {
    assert.equal(activity.status, "limited");
    assert.match(activity.reason, /next six/);
    assert.equal(activity.matched, 0);
  }
});
