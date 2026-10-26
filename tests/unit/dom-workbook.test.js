import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DOM_WORKBOOK_HEADERS,
  parseDomWorkbook,
  readZipEntries,
} from "../../src/lib/sources/dom-workbook.js";
import {
  fetchSriLankaOfficialFeed,
  normalizeSriLankaWorkbook,
  normalizeWorkbookStationRecord,
  parseObservationTimestamp,
} from "../../src/lib/sources/sri-lanka-dom.js";
import { SRI_LANKA_HTML } from "../fixtures/official-sources.js";

const FIXTURE_PATH = fileURLToPath(
  new URL("../fixtures/dom-3hourly-2026-10-26.xlsx", import.meta.url),
);
const WORKBOOK = readFileSync(FIXTURE_PATH);
const FIXED_FETCHED_AT = Date.UTC(2026, 9, 26, 9, 5, 0);

test("the recorded DoM workbook parses all 24 station rows", () => {
  const parsed = parseDomWorkbook(WORKBOOK);

  assert.equal(parsed.rowCount, 24);
  assert.equal(parsed.invalidRows, 0);
  assert.equal(parsed.headerRowIndex, 0);
  assert.equal(parsed.sheetName, "Sheet1");
  assert.equal(parsed.sourceUrl, "https://meteo.gov.lk/excels/3hourly.xlsx");
  assert.deepEqual(Object.keys(parsed.rows[0]).sort(), [...DOM_WORKBOOK_HEADERS].sort());

  const identifiers = parsed.rows.map((row) => row.stationId);
  assert.equal(new Set(identifiers).size, identifiers.length, "station ids must be unique");
  assert.ok(identifiers.includes("43450"));
});

test("station 43450 keeps the official Katunayake observation exactly", () => {
  const result = normalizeSriLankaWorkbook(WORKBOOK, { fetchedAt: FIXED_FETCHED_AT });

  assert.equal(result.stationCount, 24);
  assert.equal(result.invalidRecords, 0);
  assert.equal(result.observationTime, "2026-10-26T09:00:00.000Z");
  assert.deepEqual(result.observationTimes, ["2026-10-26T09:00:00.000Z"]);
  assert.equal(result.fetchedAt, new Date(FIXED_FETCHED_AT).toISOString());
  assert.equal(result.retrieval.format, "xlsx");

  const katunayake = result.stations.find((station) => station.stationId === "43450");
  assert.deepEqual(katunayake, {
    id: "katunayake",
    stationId: "43450",
    name: "KATUNAYAKE",
    observationLabel: "2026-10-26 1430",
    observationTime: "2026-10-26T09:00:00.000Z",
    observationEpochMs: Date.UTC(2026, 9, 26, 9, 0, 0),
    temperatureC: 29.4,
    relativeHumidity: 79,
    rainfall3hMm: 0.1,
    rainfallSince0830Mm: 18.5,
    dewPointC: 25.3,
    pressureHpa: 1008,
    windSpeedKmh: 14.04,
    windDirection: 270,
    windDirectionCompass: "W",
    windGustKmh: null,
    cloudCoverOktas: 8,
    conditionLabel: "cloudy",
    conditionKey: "cloudy",
    referencePoint: {
      latitude: 7.1697,
      longitude: 79.8843,
      label: "Approximate city-centre reference",
      official: false,
    },
  });

  assert.equal(result.source.stationIdentifiers, true);
  assert.equal(result.source.product, "3-hourly station workbook (XLSX)");
});

test("workbook rows reject impossible timestamps and unsafe identifiers", () => {
  assert.equal(
    normalizeWorkbookStationRecord({
      stationId: "43450",
      stationName: "KATUNAYAKE",
      reportTime: "2026-02-30 1430",
    }).observationTime,
    null,
  );
  assert.equal(
    normalizeWorkbookStationRecord({
      stationId: "43450",
      stationName: "KATUNAYAKE",
      reportTime: "2026-10-26 1430",
      temperatureC: "not-a-number",
      cloudCoverOktas: 12,
    }).temperatureC,
    null,
  );
  assert.equal(
    normalizeWorkbookStationRecord({
      stationId: "abc",
      stationName: "KATUNAYAKE",
      reportTime: "2026-10-26 1430",
    }),
    null,
  );
  assert.equal(normalizeWorkbookStationRecord(null), null);
  assert.equal(parseObservationTimestamp("2026-02-30 1430"), null);
});

test("the workbook reader bounds malformed archives instead of throwing raw errors", () => {
  assert.throws(() => readZipEntries(Buffer.from("not a zip")), /too small|ZIP/);
  assert.throws(
    () => normalizeSriLankaWorkbook(Buffer.from("PK\u0003\u0004broken")),
    /workbook/,
  );
});

test("the official feed prefers the workbook and labels its representation", async () => {
  const result = await fetchSriLankaOfficialFeed({
    workbookUrl: "https://meteo.gov.lk/excels/3hourly.xlsx",
    urls: ["https://meteo.gov.lk/"],
    now: () => FIXED_FETCHED_AT,
    fetchImpl: async (url) => {
      assert.match(String(url), /3hourly\.xlsx$/);
      return new Response(WORKBOOK, { status: 200 });
    },
  });

  assert.equal(result.stationCount, 24);
  assert.equal(result.retrieval.representation, "workbook");
  assert.equal(result.retrieval.format, "xlsx");
  assert.equal(result.retrieval.receivedBytes, WORKBOOK.length);
  assert.equal(result.notice, undefined);
});

test("the official feed falls back to the map page and says what it loses", async () => {
  const result = await fetchSriLankaOfficialFeed({
    workbookUrl: "https://meteo.gov.lk/excels/3hourly.xlsx",
    urls: ["https://meteo.gov.lk/"],
    now: () => FIXED_FETCHED_AT,
    fetchImpl: async (url) =>
      String(url).endsWith(".xlsx")
        ? Promise.reject(new TypeError("workbook blocked"))
        : new Response(SRI_LANKA_HTML, { status: 200 }),
  });

  assert.equal(result.stationCount, 4);
  assert.equal(result.retrieval.representation, "map-page");
  assert.equal(result.retrieval.workbookError.code, "network");
  assert.match(result.notice, /omits station IDs, wind, pressure, cloud cover, and dew point/);
});
