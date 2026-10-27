"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readJson, writeJson } from "@/lib/storage";

const sourceCache = new Map();
const LAST_GOOD_PREFIX = "aeris:official-last-good:v1:";
const MAX_LAST_GOOD_AGE = 6 * 60 * 60 * 1000;
const RETRY_DELAYS = [30_000, 60_000, 120_000, 240_000, 300_000];

async function readJsonResponse(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new Error("The official source returned an unreadable response.");
  }
  if (!response.ok || payload?.status === "unavailable") {
    throw new Error(payload?.error || "The official source is temporarily unavailable.");
  }
  return payload;
}

function lastGoodKey(key) {
  return `${LAST_GOOD_PREFIX}${key}`;
}

function readLastGood(key) {
  const record = readJson(lastGoodKey(key), null);
  if (!record || typeof record !== "object" || !record.data) return null;
  if (!Number.isFinite(record.savedAt)) return null;
  if (Date.now() - record.savedAt > MAX_LAST_GOOD_AGE) return null;
  return record;
}

function writeLastGood(key, data) {
  writeJson(lastGoodKey(key), { savedAt: Date.now(), data });
}

function retryDelayFor(failures) {
  const index = Math.max(0, Math.min(failures - 1, RETRY_DELAYS.length - 1));
  return RETRY_DELAYS[index];
}

const INITIAL_STATE = {
  status: "loading",
  data: null,
  error: null,
  retryAt: 0,
  retryInSeconds: 0,
  cachedAt: null,
  fromCache: false,
};

/**
 * Loads the official-observation route with a short fresh cache, a bounded
 * last-known-good fallback, and exponential retry backoff. A failed refresh
 * never relabels cached data as live: the hook returns `status: "stale"` and
 * reports when the cached payload was saved.
 */
export function useOfficialSource(
  key,
  url,
  { ttlMs = 5 * 60 * 1000, enabled = true, online = true } = {},
) {
  const [state, setState] = useState(INITIAL_STATE);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);
  const failureCountRef = useRef(0);
  const nextRetryAtRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const load = useCallback(
    async (force = false) => {
      if (!enabled) return;

      if (force) {
        failureCountRef.current = 0;
        nextRetryAtRef.current = 0;
      } else if (!online && !sourceCache.has(key)) {
        const lastGood = readLastGood(key);
        if (lastGood?.data) {
          setState({
            status: "stale",
            data: lastGood.data,
            error: "This device is offline. Showing the last successful response.",
            retryAt: 0,
            retryInSeconds: 0,
            cachedAt: lastGood.savedAt,
            fromCache: true,
          });
        } else {
          setState({
            status: "error",
            data: null,
            error: "This device is offline. Reconnect to load official station observations.",
            retryAt: 0,
            retryInSeconds: 0,
            cachedAt: null,
            fromCache: false,
          });
        }
        return;
      }

      const cached = sourceCache.get(key);
      if (!force && cached && Date.now() - cached.at < ttlMs) {
        setState({
          status: "success",
          data: cached.data,
          error: null,
          retryAt: 0,
          retryInSeconds: 0,
          cachedAt: cached.at,
          fromCache: true,
        });
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState((current) => ({
        ...current,
        status: current.data ? "refreshing" : "loading",
        error: null,
      }));

      try {
        const timeout = AbortSignal.timeout(25_000);
        const signal =
          typeof AbortSignal.any === "function"
            ? AbortSignal.any([controller.signal, timeout])
            : controller.signal;
        const response = await fetch(url, {
          signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const payload = await readJsonResponse(response);
        sourceCache.set(key, { data: payload, at: Date.now() });
        writeLastGood(key, payload);
        failureCountRef.current = 0;
        nextRetryAtRef.current = 0;
        if (mountedRef.current) {
          setState({
            status: "success",
            data: payload,
            error: null,
            retryAt: 0,
            retryInSeconds: 0,
            cachedAt: Date.now(),
            fromCache: false,
          });
        }
      } catch (error) {
        if (!mountedRef.current || error?.name === "AbortError") return;
        const message =
          error?.name === "TimeoutError"
            ? "The official source timed out. Try again shortly."
            : error?.message || "The official source could not be loaded.";
        const cached = sourceCache.get(key);
        const lastGood = readLastGood(key);
        const fallback = cached?.data || lastGood?.data || null;
        const fallbackAt = cached?.at ?? lastGood?.savedAt ?? null;
        let retryAt = 0;
        if (online) {
          failureCountRef.current += 1;
          retryAt = Date.now() + retryDelayFor(failureCountRef.current);
          nextRetryAtRef.current = retryAt;
        }
        setState((current) => {
          const data = current.data || fallback;
          return {
            status: data ? "stale" : "error",
            data,
            error: message,
            retryAt,
            retryInSeconds: retryAt ? Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)) : 0,
            cachedAt: data && !current.data ? fallbackAt : current.cachedAt,
            fromCache: Boolean(data),
          };
        });
      }
    },
    [key, ttlMs, url, enabled, online],
  );

  useEffect(() => {
    // The hook deliberately reads its in-memory cache as soon as it mounts so
    // a cached station list is not replaced by a loading skeleton.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (enabled) load(false);
  }, [load, enabled]);

  useEffect(() => {
    if (!state.retryAt) return undefined;
    const delay = Math.max(0, state.retryAt - Date.now());
    const timer = window.setTimeout(() => load(false), delay);
    return () => window.clearTimeout(timer);
  }, [load, state.retryAt]);

  useEffect(() => {
    if (!state.retryAt) return undefined;
    const timer = window.setInterval(() => {
      setState((current) => {
        if (!current.retryAt) return current;
        const remaining = Math.max(0, Math.ceil((current.retryAt - Date.now()) / 1000));
        return remaining === current.retryInSeconds
          ? current
          : { ...current, retryInSeconds: remaining };
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [state.retryAt]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return { ...state, refresh };
}

export function useSriLankaObservations(options = {}) {
  const { enabled = true, online = true, ...rest } = options;
  return useOfficialSource("sri-lanka-dom", "/api/weather/sri-lanka-dom", {
    ttlMs: 5 * 60 * 1000,
    enabled,
    online,
    ...rest,
  });
}

/**
 * Department of Meteorology snapshot collected into `data/meteo.json`.
 * This is the primary official-station source for the At a glance widget.
 */
export function useMeteoJson(options = {}) {
  const { enabled = true, online = true, ...rest } = options;
  return useOfficialSource("meteo-json", "/api/weather/meteo-json", {
    ttlMs: 2 * 60 * 1000,
    enabled,
    online,
    ...rest,
  });
}

/**
 * NOAA AWC METAR airport reports. Loaded lazily only when the selected source
 * needs it or the DoM observation is stale.
 */
export function useMetarObservations(options = {}) {
  const { enabled = true, online = true, ...rest } = options;
  return useOfficialSource("sri-lanka-metar", "/api/weather/metar", {
    ttlMs: 2 * 60 * 1000,
    enabled,
    online,
    ...rest,
  });
}
