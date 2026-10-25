"use client";

import { useCallback, useEffect, useState } from "react";

const SEARCH_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const EMPTY_STATE = { query: "", status: "idle", results: [], error: null };

export function useCitySearch(query) {
  const trimmed = query.trim();
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState(EMPTY_STATE);

  useEffect(() => {
    if (trimmed.length < 2) return undefined;

    const controller = new AbortController();
    let active = true;

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          name: trimmed,
          count: "8",
          language: "en",
          format: "json",
        });
        const timeoutSignal = AbortSignal.timeout(12_000);
        const signal =
          typeof AbortSignal.any === "function"
            ? AbortSignal.any([controller.signal, timeoutSignal])
            : controller.signal;
        const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
          signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          throw new Error("Place search is temporarily unavailable.");
        }
        const payload = await response.json();
        if (!active) return;
        const results = Array.isArray(payload.results)
          ? payload.results.filter(
              (result) =>
                result &&
                typeof result.name === "string" &&
                Number.isFinite(Number(result.latitude)) &&
                Number.isFinite(Number(result.longitude)),
            )
          : [];
        setState({ query: trimmed, status: "success", results, error: null });
      } catch (error) {
        if (!active || error?.name === "AbortError") return;
        setState({
          query: trimmed,
          status: "error",
          results: [],
          error:
            error?.name === "TimeoutError"
              ? "Place search timed out. Check your connection and try again."
              : "We couldn't search for places. Check your connection and try again.",
        });
      }
    }, 350);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [trimmed, retryCount]);

  const retry = useCallback(() => {
    setState(EMPTY_STATE);
    setRetryCount((count) => count + 1);
  }, []);

  // Derive the visible state from the current query. This clears stale results
  // immediately, before the debounced request even starts.
  const visibleState =
    trimmed.length < 2
      ? EMPTY_STATE
      : state.query === trimmed
        ? state
        : { ...EMPTY_STATE, query: trimmed, status: "loading" };

  return {
    ...visibleState,
    query: trimmed,
    retry,
  };
}
