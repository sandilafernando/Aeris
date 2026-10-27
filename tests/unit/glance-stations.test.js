import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_GLANCE_SOURCE, stationOptionsForSource } from "../../src/lib/glance.js";

// Deliberately small, hand-written payloads: this test is about which stations
// a source may offer, not about any real reading. Real snapshots live in
// tests/fixtures/meteo-snapshot-2026-10-26.json.
const DOM = {
  stations: [
    { id: "colombo", name: "COLOMBO" },
    { id: "badulla", name: "BADULLA" },
    { id: "katunayake", name: "KATUNAYAKE" },
  ],
};

const METAR = {
  stations: [
    { id: "katunayake", icaoId: "VCBI", name: "KATUNAYAKE" },
    { id: "ratmalana", icaoId: "VCCC", name: "RATMALANA" },
  ],
};

describe("stationOptionsForSource", () => {
  it("offers every DoM station when the DoM source is active", () => {
    const options = stationOptionsForSource({ source: "dom", dom: DOM, metar: METAR });
    assert.deepEqual(
      options.map((station) => station.id),
      ["colombo", "badulla", "katunayake"],
    );
  });

  it("offers only airports when the METAR source is active", () => {
    const options = stationOptionsForSource({ source: "metar", dom: DOM, metar: METAR });
    assert.deepEqual(
      options.map((station) => station.id),
      ["katunayake", "ratmalana"],
    );
  });

  it("labels an airport with its ICAO code so it cannot read as a district station", () => {
    const options = stationOptionsForSource({ source: "metar", dom: DOM, metar: METAR });
    assert.deepEqual(
      options.map((station) => station.stationId),
      ["VCBI", "VCCC"],
    );
  });

  it("never offers a DoM-only district station while airports are shown", () => {
    const options = stationOptionsForSource({ source: "metar", dom: DOM, metar: METAR });
    assert.equal(
      options.some((station) => station.id === "badulla"),
      false,
      "Badulla has no airport report, so choosing it would do nothing",
    );
  });

  it("unions both sources in combined mode without duplicating a shared id", () => {
    const options = stationOptionsForSource({ source: "combined", dom: DOM, metar: METAR });
    assert.deepEqual(
      options.map((station) => station.id),
      ["badulla", "colombo", "katunayake", "ratmalana"],
    );
    assert.equal(new Set(options.map((station) => station.id)).size, options.length);
  });

  it("keeps the DoM record when an airport shares its id in combined mode", () => {
    const options = stationOptionsForSource({ source: "combined", dom: DOM, metar: METAR });
    const shared = options.find((station) => station.id === "katunayake");
    assert.equal(shared.icaoId, undefined, "the DoM station keeps its own representation");
  });

  it("falls back to the default source for an unknown value", () => {
    const options = stationOptionsForSource({ source: "nonsense", dom: DOM, metar: METAR });
    assert.equal(options.length, DOM.stations.length);
    assert.equal(DEFAULT_GLANCE_SOURCE, "dom");
  });

  it("returns an empty list instead of inventing stations when a source is missing", () => {
    assert.deepEqual(stationOptionsForSource({ source: "metar", dom: DOM }), []);
    assert.deepEqual(stationOptionsForSource({ source: "dom" }), []);
    assert.deepEqual(stationOptionsForSource(), []);
  });
});
