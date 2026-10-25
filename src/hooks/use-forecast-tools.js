"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { localDateKey } from "@/lib/format";
import { computeEnsembleSpread, normalizeArchiveDaily } from "@/lib/insights";

const remoteCache = new Map();

function useRemoteJson(key, url, enabled, ttlMs, transform) {
  const [state, setState] = useState({
    key: "",
    status: "idle",
    data: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !url) return undefined;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      const cached = remoteCache.get(key);
      if (cached && Date.now() - cached.at < ttlMs) {
        if (!cancelled) {
          setState({ key, status: "success", data: cached.data, error: null });
        }
        return;
      }

      if (!cancelled) {
        setState((previous) => ({
          key,
          status: previous.key === key && previous.data ? "refreshing" : "loading",
          data: previous.key === key ? previous.data : null,
          error: null,
        }));
      }

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
        if (!response.ok) {
          throw new Error("The forecast service is temporarily unavailable.");
        }
        const payload = await response.json();
        const data = transform(payload);
        remoteCache.set(key, { data, at: Date.now() });
        if (!cancelled) {
          setState({ key, status: "success", data, error: null });
        }
      } catch (error) {
        if (cancelled || error?.name === "AbortError") return;
        setState((previous) => ({
          key,
          status: previous.key === key && previous.data ? "success" : "error",
          data: previous.key === key ? previous.data : null,
          error:
            error?.name === "TimeoutError"
              ? "This dataset timed out. Try again shortly."
              : error?.message || "This dataset could not be loaded.",
        }));
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [attempt, enabled, key, transform, ttlMs, url]);

  const refresh = useCallback(() => {
    remoteCache.delete(key);
    setAttempt((current) => current + 1);
  }, [key]);

  const active = enabled && Boolean(url);
  const visibleState =
    active && state.key === key
      ? state
      : {
          key,
          status: active ? "loading" : "idle",
          data: null,
          error: null,
        };

  return { ...visibleState, refresh };
}

function coordinateKey(place) {
  if (!place) return "";
  return `${Number(place.latitude).toFixed(3)},${Number(place.longitude).toFixed(3)}`;
}

function ensembleTransform(payload) {
  return computeEnsembleSpread(payload, Date.now(), 48);
}

export function useEnsembleForecast(place, { enabled = true } = {}) {
  const key = place ? `ensemble:${coordinateKey(place)}` : "";
  const url = useMemo(() => {
    if (!place) return "";
    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      hourly: "temperature_2m,precipitation",
      models: "gfs_seamless",
      forecast_days: "3",
      timezone: "auto",
      timeformat: "unixtime",
    });
    return `https://ensemble-api.open-meteo.com/v1/ensemble?${params.toString()}`;
  }, [place]);

  return useRemoteJson(
    key,
    url,
    enabled && Boolean(place),
    15 * 60 * 1000,
    ensembleTransform,
  );
}

export function useArchiveForecast(place, timezone, now, { enabled = true } = {}) {
  const range = useMemo(() => {
    if (!now) return null;
    return {
      start: localDateKey(now - 7 * 86_400_000, timezone),
      end: localDateKey(now - 86_400_000, timezone),
    };
  }, [now, timezone]);

  const key =
    place && range?.start && range?.end
      ? `archive:${coordinateKey(place)}:${range.start}:${range.end}`
      : "";
  const url = useMemo(() => {
    if (!place || !range?.start || !range?.end) return "";
    const params = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      start_date: range.start,
      end_date: range.end,
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
      timezone: "auto",
    });
    return `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`;
  }, [place, range]);

  return useRemoteJson(
    key,
    url,
    enabled && Boolean(place) && Boolean(url),
    30 * 60 * 1000,
    normalizeArchiveDaily,
  );
}
