"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildWeatherUrl, normalizeWeather } from "@/lib/weather";
import { placeKey } from "@/lib/storage";

const CACHE_TTL = 10 * 60 * 1000;
const REQUEST_TIMEOUT = 15_000;
const weatherCache = new Map();
const inFlightRequests = new Map();

export class WeatherRequestError extends Error {
  constructor(message, kind = "service", status = null) {
    super(message);
    this.name = "WeatherRequestError";
    this.kind = kind;
    this.status = status;
  }
}

function errorMessageForResponse(response) {
  if (response.status === 429) {
    return "The weather service is receiving too many requests. Please try again shortly.";
  }
  if (response.status >= 500) {
    return "The weather service is temporarily unavailable. Please try again.";
  }
  if (response.status === 400) {
    return "The weather service could not understand this location. Try another place.";
  }
  return "The weather forecast could not be loaded. Please try again.";
}

async function requestWeather(place, { force = false } = {}) {
  const key = placeKey(place);
  if (!force) {
    const cached = weatherCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      return cached;
    }

    if (inFlightRequests.has(key)) return inFlightRequests.get(key);
  }

  const request = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const response = await fetch(buildWeatherUrl(place), {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new WeatherRequestError(
          errorMessageForResponse(response),
          "service",
          response.status,
        );
      }
      const payload = await response.json();
      const data = normalizeWeather(payload, place, Date.now());
      weatherCache.set(key, data);
      return data;
    } catch (error) {
      if (error instanceof WeatherRequestError) throw error;
      if (error?.name === "AbortError") {
        throw new WeatherRequestError(
          "The weather service took too long to respond. Please try again.",
          "timeout",
        );
      }
      throw new WeatherRequestError(
        "We couldn't reach the weather service. Check your connection and try again.",
        "network",
      );
    } finally {
      clearTimeout(timer);
      if (!force) inFlightRequests.delete(key);
    }
  })();

  if (!force) inFlightRequests.set(key, request);
  return request;
}

export function useWeather(location) {
  const key = location ? placeKey(location) : "";
  const [refreshCount, setRefreshCount] = useState(0);
  const [state, setState] = useState({
    locationKey: "",
    status: "idle",
    data: null,
    error: null,
    refreshing: false,
  });
  const forceNextRequest = useRef(false);

  useEffect(() => {
    if (!location) return undefined;

    const force = forceNextRequest.current;
    forceNextRequest.current = false;
    let cancelled = false;

    if (force) {
      // A manual refresh must bypass both the cache read above and the short
      // circuit inside requestWeather.
      weatherCache.delete(key);
    }

    requestWeather(location, { force })
      .then((data) => {
        if (cancelled) return;
        setState({
          locationKey: key,
          status: "success",
          data,
          error: null,
          refreshing: false,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState((previous) => {
          const hasSameLocation = previous.locationKey === key && Boolean(previous.data);
          return {
            locationKey: key,
            status: hasSameLocation ? "success" : "error",
            data: hasSameLocation ? previous.data : null,
            error,
            refreshing: false,
          };
        });
      });

    return () => {
      cancelled = true;
    };
  }, [key, location, refreshCount]);

  const refresh = useCallback(() => {
    forceNextRequest.current = true;
    setState((previous) => ({ ...previous, refreshing: true }));
    setRefreshCount((count) => count + 1);
  }, []);

  const visibleState =
    state.locationKey === key
      ? state
      : {
          locationKey: key,
          status: location ? "loading" : "idle",
          data: null,
          error: null,
          refreshing: false,
        };

  return {
    ...visibleState,
    refresh,
  };
}

export function invalidateWeatherCache() {
  weatherCache.clear();
}
