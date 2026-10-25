import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STATION_REFERENCE_POINTS,
  conditionKeyForLabel,
  normalizeSriLankaHtml,
  parseObservationTimestamp,
} from "../../src/lib/sources/sri-lanka-dom.js";
import { createCachedFetcher } from "../../src/lib/sources/cache.js";
import { SRI_LANKA_HTML } from "../fixtures/official-sources.js";

const FIXED_FETCHED_AT = Date.UTC(2026, 9, 25, 12, 5, 0);

test("Sri Lanka DoM parser reads real station attributes and counts invalid records", () => {
  const result = normalizeSriLankaHtml(SRI_LANKA_HTML, { fetchedAt: FIXED_FETCHED_AT });

  assert.equal(result.stationCount, 4);
  assert.equal(result.invalidRecords, 1);
  assert.equal(result.source.id, "sri-lanka-dom");
  assert.equal(result.source.timezone, "Asia/Colombo");
  assert.equal(result.fetchedAt, "2026-10-25T12:05:00.000Z");
  assert.equal(result.observationTime, "2026-10-25T12:00:00.000Z");
  assert.deepEqual(result.observationTimes, [
    "2026-10-25T12:00:00.000Z",
    "2026-10-25T09:00:00.000Z",
  ]);

  const jaffna = result.stations.find((station) => station.id === "jaffna");
  assert.deepEqual(jaffna, {
    id: "jaffna",
    name: "JAFFNA",
    observationLabel: "2026-10-25 1730",
    observationTime: "2026-10-25T12:00:00.000Z",
    observationEpochMs: Date.UTC(2026, 9, 25, 12, 0, 0),
    temperatureC: 24.5,
    relativeHumidity: 95,
    rainfall3hMm: 27.4,
    rainfallSince0830Mm: 56.1,
    conditionLabel: "thundershowers",
    conditionKey: "storm",
    referencePoint: {
      latitude: 9.6615,
      longitude: 80.0255,
      label: "Approximate city-centre reference",
      official: false,
    },
  });

  const colombo = result.stations.find((station) => station.id === "colombo");
  assert.equal(colombo.rainfall3hMm, 0, "zero rainfall must stay zero, not become null");
  assert.equal(colombo.conditionKey, "rain");

  const partly = result.stations.find((station) => station.id === "partly-town");
  assert.equal(partly.rainfall3hMm, null);
  assert.equal(partly.relativeHumidity, null);
  assert.equal(partly.conditionKey, "partly");
  assert.equal(partly.referencePoint, null);

  const unknown = result.stations.find((station) => station.id === "unknown-place");
  assert.equal(unknown.observationTime, null);
  assert.equal(unknown.temperatureC, null);
  assert.equal(unknown.rainfall3hMm, 1.2);
  assert.equal(unknown.conditionKey, "unknown");

  assert.ok(Object.keys(STATION_REFERENCE_POINTS).length >= 24);
  assert.equal(STATION_REFERENCE_POINTS.COLOMBO.latitude, 6.9271);
});

test("Sri Lanka DoM parser refuses empty or stationless pages", () => {
  assert.throws(() => normalizeSriLankaHtml(""), /no HTML/);
  assert.throws(
    () => normalizeSriLankaHtml("<html><body><p>No map</p></body></html>"),
    /No station records/,
  );
  assert.throws(
    () =>
      normalizeSriLankaHtml(
        '<div class="district-point" data-name="X" data-weather="{bad}"></div>',
      ),
    /none could be read/,
  );
});

test("observation timestamps are converted from Sri Lanka time without guessing", () => {
  assert.deepEqual(parseObservationTimestamp("2026-10-25 1730"), {
    epochMs: Date.UTC(2026, 9, 25, 12, 0, 0),
    iso: "2026-10-25T12:00:00.000Z",
    offsetMinutes: 330,
    sourceLabel: "2026-10-25 1730",
  });
  assert.equal(parseObservationTimestamp("2026-10-25"), null);
  assert.equal(parseObservationTimestamp("2026-13-25 1730"), null);
  assert.equal(parseObservationTimestamp("2026-10-25 2460"), null);
  assert.equal(parseObservationTimestamp(null), null);
});

test("source condition labels map defensively to palette families", () => {
  assert.equal(conditionKeyForLabel("thundershowers"), "storm");
  assert.equal(conditionKeyForLabel("Heavy rain"), "rain");
  assert.equal(conditionKeyForLabel("showers"), "rain");
  assert.equal(conditionKeyForLabel("partly cloudy"), "partly");
  assert.equal(conditionKeyForLabel("cloudy"), "cloudy");
  assert.equal(conditionKeyForLabel("overcast"), "cloudy");
  assert.equal(conditionKeyForLabel("mist"), "fog");
  assert.equal(conditionKeyForLabel("clear sky"), "clear");
  assert.equal(conditionKeyForLabel(""), "unknown");
  assert.equal(conditionKeyForLabel("hail"), "unknown");
});

test("cached fetcher serves fresh data, deduplicates, and falls back to stale", async () => {
  let clock = 0;
  let calls = 0;
  let fail = false;
  const cache = createCachedFetcher(
    async () => {
      calls += 1;
      if (fail) throw new Error("upstream down");
      return { version: calls };
    },
    { ttlMs: 1_000, staleTtlMs: 10_000, now: () => clock },
  );

  const first = await cache.get();
  assert.equal(first.cache, "miss");
  assert.deepEqual(first.data, { version: 1 });

  const second = await cache.get();
  assert.equal(second.cache, "fresh");
  assert.equal(calls, 1);

  clock = 1_500;
  fail = true;
  const stale = await cache.get();
  assert.equal(stale.cache, "stale");
  assert.deepEqual(stale.data, { version: 1 });
  assert.match(stale.error.message, /upstream down/);
  assert.equal(cache.peek().data.version, 1);

  clock = 12_000;
  await assert.rejects(() => cache.get(), /upstream down/);

  fail = false;
  clock = 12_100;
  const recovered = await cache.get();
  assert.equal(recovered.cache, "miss");
  assert.deepEqual(recovered.data, { version: 4 });
});

test("cached fetcher shares one in-flight refresh between concurrent callers", async () => {
  let calls = 0;
  const cache = createCachedFetcher(
    async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { calls };
    },
    { ttlMs: 60_000 },
  );

  const [a, b, c] = await Promise.all([cache.get(), cache.get(), cache.get()]);
  assert.equal(calls, 1);
  assert.deepEqual(a.data, { calls: 1 });
  assert.deepEqual(b.data, { calls: 1 });
  assert.deepEqual(c.data, { calls: 1 });

  cache.clear();
  assert.equal(cache.peek(), null);
});
