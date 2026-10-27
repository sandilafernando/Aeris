import assert from "node:assert/strict";
import { test } from "node:test";
import {
  STATION_REFERENCE_POINTS,
  conditionKeyForLabel,
  fetchSriLankaObservations,
  normalizeSriLankaHtml,
  parseObservationTimestamp,
} from "../../src/lib/sources/sri-lanka-dom.js";
import {
  humidityFromDewpoint,
  normalizeMetarPayload,
  normalizeMetarReport,
} from "../../src/lib/sources/metar.js";
import {
  OFFICIAL_FALLBACK_NOTICE,
  fetchOfficialObservations,
  resolveDomTargets,
} from "../../src/lib/sources/official-observations.js";
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

const METAR_FIXED_OBSERVED_AT = Math.floor(FIXED_FETCHED_AT / 1000) - 300;

function metarReports() {
  return [
    {
      icaoId: "VCBI",
      obsTime: METAR_FIXED_OBSERVED_AT,
      temp: 28,
      dewp: 27,
      wspd: 10,
      wgst: 18,
      wdir: 220,
      visib: "6+",
      altim: 1009,
      cover: "BKN",
      clouds: [{ cover: "BKN", base: 1600 }],
      rawOb: "METAR VCBI 260010Z 22010G18KT 9999 BKN016 28/27 Q1009 RESHRA NOSIG",
      reportTime: "2026-10-25 17:35",
    },
    {
      icaoId: "VCBI",
      obsTime: METAR_FIXED_OBSERVED_AT - 3600,
      temp: 25,
      dewp: 25,
      cover: "FEW",
      rawOb: "METAR VCBI 252310Z 22010KT 9999 FEW016 25/25 Q1008",
    },
    {
      icaoId: "VCCC",
      obsTime: METAR_FIXED_OBSERVED_AT - 120,
      temp: 27,
      dewp: 26,
      wspd: 8,
      wdir: 220,
      visib: "6+",
      altim: 1009,
      cover: "FEW",
      rawOb: "METAR VCCC 260000Z 22008KT 9999 FEW016 27/26 Q1009",
    },
    {
      icaoId: "XXXX",
      obsTime: METAR_FIXED_OBSERVED_AT,
      temp: 30,
    },
  ];
}

test("METAR fallback normalizes only Sri Lankan airport reports and keeps missing rainfall null", () => {
  const result = normalizeMetarPayload(metarReports(), { fetchedAt: FIXED_FETCHED_AT });

  assert.equal(result.stationCount, 2);
  assert.equal(result.invalidRecords, 1);
  assert.equal(result.source.id, "sri-lanka-metar");
  assert.equal(result.staleAfterMinutes, 180);
  assert.equal(
    result.observationTime,
    new Date(METAR_FIXED_OBSERVED_AT * 1000).toISOString(),
  );

  const katunayake = result.stations.find((station) => station.icaoId === "VCBI");
  assert.equal(katunayake.temperatureC, 28, "the latest station report must win");
  assert.equal(katunayake.relativeHumidity, humidityFromDewpoint(28, 27));
  assert.equal(katunayake.rainfall3hMm, null);
  assert.equal(katunayake.rainfallSince0830Mm, null);
  assert.equal(katunayake.cloudBaseFt, 1600);
  assert.equal(katunayake.visibilityLabel, "6+ SM");
  assert.equal(katunayake.windSpeedKmh, 18.5);
  assert.equal(katunayake.conditionKey, "cloudy", "RESHRA is recent weather, not current rain");
  assert.equal(katunayake.referencePoint.official, true);
  assert.equal(katunayake.referencePoint.label, "Airport station coordinates (NOAA AWC)");
});

test("absent METAR fields stay absent instead of becoming measured zeros", () => {
  const report = normalizeMetarReport({
    icaoId: "VCBI",
    obsTime: Math.floor(METAR_FIXED_OBSERVED_AT),
    temp: null,
    dewp: null,
    wspd: null,
    wgst: null,
    wdir: null,
    altim: null,
    visib: null,
    cover: "BKN",
    clouds: [{ cover: "BKN", base: null }],
    rawOb: "METAR VCBI 260010Z ///// ///// BKN016",
  });

  // A partial but readable report is kept, with the missing measurements null.
  assert.ok(report);
  assert.equal(report.temperatureC, null);
  assert.equal(report.dewpointC, null);
  assert.equal(report.relativeHumidity, null);
  assert.equal(report.windSpeedKmh, null, "a missing wind speed is not 0 km/h");
  assert.equal(report.windGustKmh, null, "a missing gust is not 0 km/h");
  assert.equal(report.windDirection, null, "a missing direction is not due north");
  assert.equal(report.pressureHpa, null, "a missing pressure is not 0 hPa");
  assert.equal(report.visibilityLabel, null);
  assert.equal(report.cloudBaseFt, null);
  assert.equal(report.conditionKey, "cloudy");

  const emptyStrings = normalizeMetarReport({
    icaoId: "VCBI",
    obsTime: METAR_FIXED_OBSERVED_AT,
    temp: "",
    dewp: "",
    wspd: "",
    wdir: "",
    altim: "",
    rawOb: "METAR VCBI 260010Z CAVOK",
  });
  assert.equal(emptyStrings.temperatureC, null);
  assert.equal(emptyStrings.pressureHpa, null);
  assert.equal(emptyStrings.windSpeedKmh, null);

  // No time, no raw report, and no temperature is not an observation.
  assert.equal(
    normalizeMetarReport({ icaoId: "VCBI", obsTime: null, temp: null, rawOb: "" }),
    null,
  );
});

test("DoM fetch falls through to the alternate host and reports safe attempts", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    if (url.includes("first.example")) throw new TypeError("connect failed");
    return new Response(SRI_LANKA_HTML, { status: 200 });
  };

  const result = await fetchSriLankaObservations({
    urls: ["https://first.example/", "https://second.example/"],
    fetchImpl,
    timeoutMs: 1_000,
    now: () => FIXED_FETCHED_AT,
  });

  assert.deepEqual(requested, ["https://first.example/", "https://second.example/"]);
  assert.equal(result.stationCount, 4);
  assert.equal(result.fetchedAt, "2026-10-25T12:05:00.000Z");
  assert.equal(result.retrieval.attempts.length, 2);
  assert.equal(result.retrieval.attempts[0].code, "network");
  assert.equal(result.retrieval.attempts[1].code, "ok");
  assert.equal(result.retrieval.url, "https://second.example/");
});

test("DoM fetch fails honestly after every bounded attempt", async () => {
  await assert.rejects(
    () =>
      fetchSriLankaObservations({
        urls: ["https://only.example/"],
        fetchImpl: async () => {
          const error = new Error("timed out");
          error.name = "TimeoutError";
          throw error;
        },
        timeoutMs: 1_000,
        now: () => FIXED_FETCHED_AT,
      }),
    (error) => {
      assert.equal(error.code, "timeout");
      assert.equal(error.details.attempts.length, 1);
      assert.match(error.message, /did not respond in time/i);
      return true;
    },
  );
});

test("official observations prefer DoM and never call the fallback on success", async () => {
  const domData = normalizeSriLankaHtml(SRI_LANKA_HTML, { fetchedAt: FIXED_FETCHED_AT });
  let metarCalled = false;

  const result = await fetchOfficialObservations({
    env: {},
    now: FIXED_FETCHED_AT,
    domFetcher: async () => domData,
    metarFetcher: async () => {
      metarCalled = true;
      return normalizeMetarPayload(metarReports(), { fetchedAt: FIXED_FETCHED_AT });
    },
  });

  assert.equal(result.source.id, "sri-lanka-dom");
  assert.equal(result.fallback, null);
  assert.equal(result.staleAfterMinutes, 360);
  assert.equal(metarCalled, false);
});

test("official observations fall back to clearly labelled NOAA AWC METAR", async () => {
  const primaryError = Object.assign(new Error("DoM timed out"), {
    code: "timeout",
    details: {
      attempts: [{ attempt: 1, status: null, code: "timeout", durationMs: 3_000 }],
    },
  });

  const result = await fetchOfficialObservations({
    env: {},
    now: FIXED_FETCHED_AT,
    domFetcher: async () => {
      throw primaryError;
    },
    metarFetcher: async () =>
      normalizeMetarPayload(metarReports(), { fetchedAt: FIXED_FETCHED_AT }),
  });

  assert.equal(result.source.id, "sri-lanka-metar");
  assert.equal(result.fallback.active, true);
  assert.equal(result.fallback.reason, "timeout");
  assert.equal(result.fallback.to, "sri-lanka-metar");
  assert.equal(result.staleAfterMinutes, 180);
  assert.equal(result.attempts.length, 1);
  assert.match(result.notice, /not DoM district stations/);
  assert.equal(result.notice, OFFICIAL_FALLBACK_NOTICE);
  assert.equal(result.stationCount, 2);
});

test("serverless deployments allow for measured DoM latency before falling back", async () => {
  let receivedTimeout = null;
  let receivedUrls = null;
  const result = await fetchOfficialObservations({
    env: { VERCEL: "1" },
    now: FIXED_FETCHED_AT,
    domFetcher: async ({ timeoutMs, urls }) => {
      receivedTimeout = timeoutMs;
      receivedUrls = urls;
      throw Object.assign(new Error("DoM timed out"), { code: "timeout" });
    },
    metarFetcher: async () =>
      normalizeMetarPayload(metarReports(), { fetchedAt: FIXED_FETCHED_AT }),
  });

  assert.equal(receivedTimeout, 22_000);
  assert.ok(receivedTimeout >= 20_000, "the timeout must cover measured DoM latency");
  assert.equal(receivedUrls.length, 1, "serverless attempts the primary host only");
  assert.equal(result.source.id, "sri-lanka-metar");
});

test("forcing the METAR source skips DoM and labels the configuration reason", async () => {
  let domCalled = false;
  const result = await fetchOfficialObservations({
    env: { AERIS_OFFICIAL_SOURCE: "metar" },
    now: FIXED_FETCHED_AT,
    domFetcher: async () => {
      domCalled = true;
      return normalizeSriLankaHtml(SRI_LANKA_HTML, { fetchedAt: FIXED_FETCHED_AT });
    },
    metarFetcher: async () =>
      normalizeMetarPayload(metarReports(), { fetchedAt: FIXED_FETCHED_AT }),
  });

  assert.equal(domCalled, false);
  assert.equal(result.fallback.reason, "disabled");
  assert.match(result.notice, /disabled by configuration/);
});

test("all-source failure carries safe diagnostics and invents no station", async () => {
  await assert.rejects(
    () =>
      fetchOfficialObservations({
        env: {},
        now: FIXED_FETCHED_AT,
        domFetcher: async () => {
          throw Object.assign(new Error("DoM timed out"), {
            code: "timeout",
            details: { attempts: [{ attempt: 1, code: "timeout" }] },
          });
        },
        metarFetcher: async () => {
          throw Object.assign(new Error("NOAA unavailable"), { code: "network" });
        },
      }),
    (error) => {
      assert.equal(error.code, "all-sources-failed");
      assert.equal(error.details.primaryError.code, "timeout");
      assert.equal(error.details.fallbackError.code, "network");
      assert.equal(error.details.attempts.length, 1);
      return true;
    },
  );
});

test("a private DoM relay is used only when configured", () => {
  assert.deepEqual(resolveDomTargets({ AERIS_DOM_PROXY_URL: "https://relay.example/dom" }), {
    urls: ["https://relay.example/dom"],
    viaRelay: true,
  });
  assert.equal(resolveDomTargets({}).viaRelay, false);
  assert.ok(resolveDomTargets({}).urls.length >= 2);
});
