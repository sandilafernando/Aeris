"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const sourceCache = new Map();

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

export function useOfficialSource(key, url, { ttlMs = 5 * 60 * 1000, enabled = true } = {}) {
  // Initialize state based on enabled flag using useState initializer
  // This runs once during component construction, not on every render
  const initialState = {
    status: enabled ? "loading" : "unavailable",
    data: null,
    error: null,
  };
  const [state, setState] = useState(() => initialState);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const load = useCallback(
    async (force = false) => {
      // When disabled, don't attempt to load
      if (!enabled) return;

      const cached = sourceCache.get(key);
      if (!force && cached && Date.now() - cached.at < ttlMs) {
        setState({ status: "success", data: cached.data, error: null });
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState((current) => ({
        status: current.data ? "refreshing" : "loading",
        data: current.data,
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
        if (mountedRef.current) {
          setState({ status: "success", data: payload, error: null });
        }
      } catch (error) {
        if (!mountedRef.current || error?.name === "AbortError") return;
        setState((current) => ({
          status: current.data ? "success" : "error",
          data: current.data,
          error:
            error?.name === "TimeoutError"
              ? "The official source timed out. Try again shortly."
              : error?.message || "The official source could not be loaded.",
        }));
      }
    },
    [key, ttlMs, url, enabled],
  );

  useEffect(() => {
    if (enabled) load(false);
  }, [load, enabled]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);
  return { ...state, refresh };
}

export function useSriLankaObservations(options = {}) {
  // Make the official source optionally enabled based on storage readiness
  // and user preference. If disabled or data fails to load, the app gracefully
  // degrades showing only the Open-Meteo forecast.
  const { enabled = true, ...rest } = options;
  return useOfficialSource("sri-lanka-dom", "/api/weather/sri-lanka-dom", {
    ttlMs: 5 * 60 * 1000,
    enabled,
    ...rest,
  });
}