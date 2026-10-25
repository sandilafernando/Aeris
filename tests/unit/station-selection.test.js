import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUTOMATIC_STATION_ID,
  distanceKm,
  isObservationStale,
  isUsableObservation,
  observationAgeMinutes,
  selectOfficialStation,
  stationReferenceLabel,
  withinSriLanka,
} from "../../src/lib/station-selection.js";

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const COLOMBO_LOCATION = {
  name: "Colombo",
  countryCode: "LK",
  latitude: 6.9271,
  longitude: 79.8612,
};
const BERLIN_LOCATION = {
  name: "Berlin",
  countryCode: "DE",
  latitude: 52.52,
  longitude: 13.405,
};

function station(id, name, { latitude, longitude }, ageMinutes, extra = {}) {
  return {
    id,
    name,
    observationTime: new Date(NOW - ageMinutes * 60_000).toISOString(),
    observationEpochMs: NOW - ageMinutes * 60_000,
    temperatureC: 29.4,
    conditionLabel: "showers",
    referencePoint:
      latitude == null
        ? null
        : { latitude, longitude, label: "Approximate city-centre reference", official: false },
    ...extra,
  };
}

const COLOMBO = station("colombo", "COLOMBO", { latitude: 6.9271, longitude: 79.8612 }, 720);
const KATUNAYAKE = station(
  "katunayake",
  "KATUNAYAKE",
  { latitude: 7.1697, longitude: 79.8843 },
  20,
);
const JAFFNA = station("jaffna", "JAFFNA", { latitude: 9.6615, longitude: 80.0255 }, 10);
const NO_REFERENCE = station("partly-town", "PARTLY TOWN", {}, 30, {
  referencePoint: null,
});

test("Sri Lankan places are recognised by country code or coordinate bounds", () => {
  assert.equal(withinSriLanka(COLOMBO_LOCATION), true);
  assert.equal(withinSriLanka({ latitude: 6.9, longitude: 79.9 }), true);
  assert.equal(withinSriLanka({ countryCode: "LK" }), true);
  assert.equal(withinSriLanka(BERLIN_LOCATION), false);
  assert.equal(withinSriLanka({ countryCode: "LK", latitude: 40, longitude: 10 }), true);
  assert.equal(withinSriLanka(null), false);
  assert.equal(withinSriLanka({ latitude: "nope", longitude: 79.9 }), false);
});

test("distance and observation freshness stay separate and honest", () => {
  const galle = { latitude: 6.0535, longitude: 80.221 };
  const distance = distanceKm(COLOMBO_LOCATION, galle);
  assert.ok(distance > 95 && distance < 115, `expected ~103 km, received ${distance}`);

  assert.equal(observationAgeMinutes(COLOMBO, NOW), 720);
  assert.equal(observationAgeMinutes({ observationEpochMs: NOW + 60_000 }, NOW), 0);
  assert.equal(observationAgeMinutes(COLOMBO, 0), null);
  assert.equal(isObservationStale(COLOMBO, NOW), true);
  assert.equal(isObservationStale(KATUNAYAKE, NOW), false);
  assert.equal(isObservationStale(KATUNAYAKE, NOW, 10), true);

  assert.equal(isUsableObservation(COLOMBO), true);
  assert.equal(isUsableObservation({ ...COLOMBO, temperatureC: null }), true);
  assert.equal(isUsableObservation({ ...COLOMBO, conditionLabel: null, temperatureC: null }), false);
  assert.equal(isUsableObservation({ observationEpochMs: NOW, temperatureC: null }), false);
  assert.equal(
    isUsableObservation({ observationEpochMs: NOW, temperatureC: 0 }),
    true,
    "zero degrees must count as a real reading",
  );
  assert.equal(
    stationReferenceLabel(COLOMBO),
    "Approx. reference 6.93°N, 79.86°E",
  );
  assert.match(stationReferenceLabel(NO_REFERENCE), /unavailable/);
});

test("automatic selection skips a stale nearer station for a fresh usable one", () => {
  const selection = selectOfficialStation(
    [COLOMBO, KATUNAYAKE, JAFFNA, NO_REFERENCE],
    { location: COLOMBO_LOCATION, now: NOW },
  );

  assert.equal(selection.mode, "automatic");
  assert.equal(selection.requestedId, AUTOMATIC_STATION_ID);
  assert.equal(selection.station.id, "katunayake");
  assert.equal(selection.reason, "fresher-alternative");
  assert.equal(selection.stale, false);
  assert.equal(selection.distanceKm > 20 && selection.distanceKm < 40, true);
  assert.deepEqual(
    selection.alternatives.map((entry) => entry.id),
    ["colombo", "katunayake", "jaffna"],
  );
});

test("automatic selection reports the nearest fresh station and stale fallback", () => {
  const freshNearest = selectOfficialStation([COLOMBO, KATUNAYAKE, JAFFNA], {
    location: COLOMBO_LOCATION,
    now: NOW,
    staleAfterMinutes: 12 * 60,
  });
  assert.equal(freshNearest.station.id, "colombo");
  assert.equal(freshNearest.reason, "nearest-fresh");
  assert.equal(freshNearest.stale, false);

  const allStale = selectOfficialStation([COLOMBO, JAFFNA, KATUNAYAKE], {
    location: COLOMBO_LOCATION,
    now: NOW + 900 * 60_000,
  });
  assert.equal(allStale.station.id, "colombo");
  assert.equal(allStale.reason, "nearest-stale");
  assert.equal(allStale.stale, true);
});

test("manual selection is preserved even when stale, missing, or outside Sri Lanka", () => {
  const manualStale = selectOfficialStation([COLOMBO, KATUNAYAKE], {
    location: COLOMBO_LOCATION,
    preference: "colombo",
    now: NOW,
  });
  assert.equal(manualStale.mode, "manual");
  assert.equal(manualStale.station.id, "colombo");
  assert.equal(manualStale.reason, "manual");
  assert.equal(manualStale.stale, true);

  const manualOutside = selectOfficialStation([COLOMBO, KATUNAYAKE], {
    location: BERLIN_LOCATION,
    preference: "colombo",
    now: NOW,
  });
  assert.equal(manualOutside.mode, "manual");
  assert.equal(manualOutside.station.id, "colombo");
  assert.equal(manualOutside.reason, "manual");

  const automaticOutside = selectOfficialStation([COLOMBO, KATUNAYAKE], {
    location: BERLIN_LOCATION,
    now: NOW,
  });
  assert.equal(automaticOutside.mode, "automatic");
  assert.equal(automaticOutside.station, null);
  assert.equal(automaticOutside.reason, "outside-sri-lanka");

  const missing = selectOfficialStation([COLOMBO, KATUNAYAKE], {
    location: COLOMBO_LOCATION,
    preference: "kandy",
    now: NOW,
  });
  assert.equal(missing.mode, "manual");
  assert.equal(missing.station, null);
  assert.equal(missing.reason, "manual-missing");
  assert.equal(missing.manualMissing, true);
  assert.deepEqual(
    missing.alternatives.map((entry) => entry.id),
    ["colombo", "katunayake"],
  );
});

test("selection never invents a reading when stations are empty or unusable", () => {
  const empty = selectOfficialStation([], { location: COLOMBO_LOCATION, now: NOW });
  assert.equal(empty.station, null);
  assert.equal(empty.reason, "no-stations");
  assert.equal(empty.stale, true);

  const noUsable = selectOfficialStation(
    [
      { ...COLOMBO, temperatureC: null, conditionLabel: null },
      { ...KATUNAYAKE, temperatureC: null, conditionLabel: null },
    ],
    { location: COLOMBO_LOCATION, now: NOW },
  );
  assert.equal(noUsable.reason, "no-usable-observation");
  assert.equal(noUsable.station.id, "colombo");
  assert.equal(noUsable.stale, true);

  const noReference = selectOfficialStation([NO_REFERENCE], {
    location: COLOMBO_LOCATION,
    now: NOW,
  });
  assert.equal(noReference.reason, "no-reference-points");
  assert.equal(noReference.station, null);
  assert.equal(noReference.stale, true);
});
