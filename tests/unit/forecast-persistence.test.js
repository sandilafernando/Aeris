import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  LAST_FORECAST_KEY,
  readLastForecast,
  saveLastForecast,
} from "../../src/lib/storage.js";

const HOUR = 60 * 60 * 1000;

function createStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

function snapshot(fetchedAt, temperature = 29.4) {
  return {
    timezone: "Asia/Colombo",
    fetchedAt,
    current: { temperature, condition: { label: "Cloudy" } },
    hourly: [],
    daily: [],
  };
}

beforeEach(() => {
  globalThis.window = {
    localStorage: createStorage(),
    sessionStorage: createStorage(),
  };
});

afterEach(() => {
  delete globalThis.window;
});

describe("last-known forecast persistence", () => {
  it("round-trips a normalized forecast for the requested place only", () => {
    const now = Date.now();
    assert.equal(saveLastForecast("6.927,79.861", snapshot(now)), true);

    const restored = readLastForecast("6.927,79.861");
    assert.equal(restored?.current.temperature, 29.4);
    assert.equal(restored?.fetchedAt, now);

    assert.equal(readLastForecast("52.520,13.405"), null);
    assert.equal(readLastForecast(""), null);
  });

  it("refuses malformed snapshots without destroying the stored copy", () => {
    const now = Date.now();
    saveLastForecast("6.927,79.861", snapshot(now));

    assert.equal(saveLastForecast("6.927,79.861", null), false);
    assert.equal(saveLastForecast("6.927,79.861", { current: {} }), false);
    assert.equal(
      saveLastForecast("6.927,79.861", {
        current: {},
        hourly: [],
        daily: [],
        fetchedAt: "not-a-number",
      }),
      false,
    );

    assert.equal(readLastForecast("6.927,79.861")?.current.temperature, 29.4);
  });

  it("never serves a copy older than 24 hours", () => {
    saveLastForecast("6.927,79.861", snapshot(Date.now() - 25 * HOUR));
    assert.equal(readLastForecast("6.927,79.861"), null);

    saveLastForecast("6.927,79.861", snapshot(Date.now() - 23 * HOUR));
    assert.notEqual(readLastForecast("6.927,79.861"), null);
  });

  it("rejects an obviously future-dated copy", () => {
    saveLastForecast("6.927,79.861", snapshot(Date.now() + 30 * 60 * 1000));
    assert.equal(readLastForecast("6.927,79.861"), null);
  });

  it("keeps only the three most recently fetched places", () => {
    const now = Date.now();
    const keys = ["a", "b", "c", "d"];
    keys.forEach((key, index) => {
      saveLastForecast(key, snapshot(now - (keys.length - index) * 60_000, index));
    });

    assert.equal(readLastForecast("a"), null);
    assert.notEqual(readLastForecast("b"), null);
    assert.notEqual(readLastForecast("c"), null);
    assert.notEqual(readLastForecast("d"), null);

    const stored = JSON.parse(window.localStorage.getItem(LAST_FORECAST_KEY));
    assert.deepEqual(Object.keys(stored.places).sort(), ["b", "c", "d"]);
  });

  it("treats unreadable storage as empty instead of throwing", () => {
    window.localStorage.setItem(LAST_FORECAST_KEY, "{not json");
    assert.equal(readLastForecast("6.927,79.861"), null);
  });
});
