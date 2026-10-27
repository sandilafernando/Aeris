import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  METEO_JSON_MAX_BYTES,
  MeteoJsonError,
  fetchMeteoJson,
  normalizeMeteoJsonPayload,
  parseMeteoRainfall,
} from "../../src/lib/sources/meteo-json.js";

const RAW = JSON.parse(
  await readFile(
    new URL("../fixtures/meteo-snapshot-2026-10-26.json", import.meta.url),
    "utf8",
  ),
);
// The live file is collected continuously, so exact readings change. Keep the
// recorded fixture for value-level assertions and use the live file only to
// detect schema drift.
const LIVE = JSON.parse(
  await readFile(new URL("../../data/meteo.json", import.meta.url), "utf8"),
);
const RETRIEVED_AT = Date.parse("2026-10-26T18:00:00Z");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function jsonResponse(body, { status = 200, contentType = "application/json" } = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": contentType },
  });
}

test("the real repository snapshot normalizes without inventing fields", () => {
  const payload = normalizeMeteoJsonPayload(RAW, { retrievedAt: RETRIEVED_AT });

  assert.equal(payload.stationCount, 24);
  assert.equal(payload.declaredStationCount, 24);
  assert.equal(payload.invalidRecords, 0);
  assert.equal(payload.duplicatesRemoved, 0);
  assert.equal(payload.staleAfterMinutes, 300);
  assert.equal(payload.observationTime, "2026-10-26T15:00:00.000Z");
  assert.equal(payload.collectedAt, "2026-10-26T17:14:11.106Z");
  assert.equal(payload.timezone, "Asia/Colombo");
  assert.equal(payload.source.id, "sri-lanka-dom-json");

  const katunayake = payload.stations.find((station) => station.id === "katunayake");
  assert.ok(katunayake);
  assert.equal(katunayake.name, "KATUNAYAKE");
  assert.equal(katunayake.observationLabel, "2026-10-26 2030");
  assert.equal(katunayake.observationEpochMs, Date.UTC(2026, 9, 26, 15, 0));
  assert.equal(katunayake.temperatureC, 25.1);
  assert.equal(katunayake.relativeHumidity, 97);
  assert.equal(katunayake.rainfall3hMm, 2.8);
  assert.equal(katunayake.rainfall3hTrace, false);
  assert.equal(katunayake.rainfallSince0830Mm, 25.6);
  assert.equal(katunayake.conditionLabel, "fairnight");
  assert.equal(katunayake.conditionKey, "clear");
  assert.equal(katunayake.windSpeedKmh, null);
  assert.equal(katunayake.pressureHpa, null);
  assert.equal(katunayake.cloudCover, null);
  assert.deepEqual(katunayake.referencePoint, {
    latitude: 7.1697,
    longitude: 79.8843,
    label: "Approximate city-centre reference",
    official: false,
  });
});

test("the live repository snapshot still matches the expected schema", () => {
  const payload = normalizeMeteoJsonPayload(LIVE, { retrievedAt: Date.now() });

  assert.equal(payload.source.id, "sri-lanka-dom-json");
  assert.equal(payload.timezone, "Asia/Colombo");
  assert.ok(payload.stations.length > 0);
  assert.equal(payload.declaredStationCount, LIVE.stationCount);
  for (const station of payload.stations) {
    assert.ok(station.name, "every usable station has a name");
    assert.ok(station.id, "every usable station has an id");
    assert.equal(station.referencePoint.official, false);
  }
});

test("Trace rainfall remains trace, not zero and not unavailable", () => {
  assert.deepEqual(parseMeteoRainfall("Trace"), {
    valueMm: null,
    trace: true,
    valid: true,
  });
  assert.deepEqual(parseMeteoRainfall("0.0"), {
    valueMm: 0,
    trace: false,
    valid: true,
  });
  assert.deepEqual(parseMeteoRainfall(""), {
    valueMm: null,
    trace: false,
    valid: false,
  });

  const payload = normalizeMeteoJsonPayload(RAW, { retrievedAt: RETRIEVED_AT });
  const pottuvil = payload.stations.find((station) => station.id === "pottuvil");
  assert.equal(pottuvil.rainfall3hMm, null);
  assert.equal(pottuvil.rainfall3hTrace, true);
  assert.equal(pottuvil.rainfallSince0830Mm, 0.1);
  assert.equal(pottuvil.rainfallSince0830Trace, false);
});

test("invalid records are reported and a malformed timestamp is never usable", () => {
  const source = clone(RAW);
  source.stations.push(null, { name: "", weather: {} }, { name: "NO WEATHER" });
  source.stations.push({
    name: "BROKEN TIME",
    weather: {
      lastUpdated: "2026-02-30 2500",
      rainfall: "not-a-number",
      totalRainfall: "-3",
      temp: "999",
      rh: "140",
      forecast: 42,
    },
  });

  const payload = normalizeMeteoJsonPayload(source, { retrievedAt: RETRIEVED_AT });
  assert.equal(payload.invalidRecords, 3);
  const broken = payload.stations.find((station) => station.id === "broken-time");
  assert.ok(broken);
  assert.equal(broken.timestampValid, false);
  assert.equal(broken.observationTime, null);
  assert.equal(broken.observationEpochMs, null);
  assert.equal(broken.temperatureC, null);
  assert.equal(broken.relativeHumidity, null);
  assert.equal(broken.rainfall3hMm, null);
  assert.equal(broken.rainfall3hTrace, false);
  assert.equal(broken.rainfallSince0830Mm, null);
  assert.equal(broken.conditionLabel, null);
  assert.equal(broken.conditionKey, "unknown");
});

test("duplicate stations keep the newest readable observation", () => {
  const source = clone(RAW);
  const latest = source.stations.find((station) => station.name === "COLOMBO");
  source.stations.push({
    name: "COLOMBO",
    weather: { ...latest.weather, lastUpdated: "2026-10-26 1730", temp: "24.0" },
  });

  const payload = normalizeMeteoJsonPayload(source, { retrievedAt: RETRIEVED_AT });
  assert.equal(payload.stationCount, 24);
  assert.equal(payload.duplicatesRemoved, 1);
  assert.equal(
    payload.stations.filter((station) => station.id === "colombo").length,
    1,
  );
  assert.equal(
    payload.stations.find((station) => station.id === "colombo").observationLabel,
    "2026-10-26 2030",
  );
});

test("empty and malformed payloads fail closed", () => {
  assert.throws(
    () => normalizeMeteoJsonPayload({ stations: [] }, { retrievedAt: RETRIEVED_AT }),
    (error) => error instanceof MeteoJsonError && error.code === "empty-stations",
  );
  assert.throws(
    () => normalizeMeteoJsonPayload([], { retrievedAt: RETRIEVED_AT }),
    (error) => error instanceof MeteoJsonError && error.code === "malformed-payload",
  );
  assert.throws(
    () =>
      normalizeMeteoJsonPayload(
        { stations: [{ name: "X", weather: "not-an-object" }] },
        { retrievedAt: RETRIEVED_AT },
      ),
    (error) => error instanceof MeteoJsonError && error.code === "unreadable-stations",
  );
});

test("fetch validates the remote response and never caches a broken one", async () => {
  const remote = await fetchMeteoJson({
    now: RETRIEVED_AT,
    fetchImpl: async () => jsonResponse(RAW),
    localLoader: async () => {
      throw new Error("local fallback must not be used for a valid response");
    },
  });
  assert.equal(remote.retrieval.mode, "remote");
  assert.equal(remote.data.stationCount, 24);

  await assert.rejects(
    fetchMeteoJson({
      now: RETRIEVED_AT,
      fetchImpl: async () => jsonResponse("{not json", { contentType: "application/json" }),
    }),
    (error) => error instanceof MeteoJsonError && error.code === "invalid-json",
  );

  await assert.rejects(
    fetchMeteoJson({
      now: RETRIEVED_AT,
      fetchImpl: async () => jsonResponse("<html>not the snapshot</html>", { contentType: "text/html" }),
    }),
    (error) => error instanceof MeteoJsonError && error.code === "content-type",
  );

  await assert.rejects(
    fetchMeteoJson({
      now: RETRIEVED_AT,
      fetchImpl: async () => jsonResponse(JSON.stringify({ stations: [] })),
    }),
    (error) => error instanceof MeteoJsonError && error.code === "empty-stations",
  );

  await assert.rejects(
    fetchMeteoJson({
      now: RETRIEVED_AT,
      fetchImpl: async () => jsonResponse("x".repeat(METEO_JSON_MAX_BYTES + 1), { contentType: "text/plain" }),
    }),
    (error) => error instanceof MeteoJsonError && error.code === "response-too-large",
  );
});

test("a network failure may use the checked-in snapshot, but a malformed remote does not", async () => {
  const local = await fetchMeteoJson({
    now: RETRIEVED_AT,
    fetchImpl: async () => {
      throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    },
    localLoader: async () => RAW,
  });
  assert.equal(local.retrieval.mode, "local-fallback");
  assert.equal(local.retrieval.remoteError, "timeout");
  assert.equal(local.data.stationCount, 24);

  const http404 = await fetchMeteoJson({
    now: RETRIEVED_AT,
    fetchImpl: async () => jsonResponse("not found", { status: 404, contentType: "text/plain" }),
    localLoader: async () => RAW,
  });
  assert.equal(http404.retrieval.remoteError, "http-404");

  await assert.rejects(
    fetchMeteoJson({
      now: RETRIEVED_AT,
      fetchImpl: async () => jsonResponse("[]"),
      localLoader: async () => RAW,
    }),
    (error) => error instanceof MeteoJsonError && error.code === "malformed-payload",
  );
});
