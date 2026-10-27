/**
 * Pure orchestration for the unified "At a glance" widget.
 *
 * The widget combines three genuinely different products:
 *   1. Department of Meteorology station observations (`data/meteo.json`).
 *   2. NOAA AWC ICAO METAR airport observations.
 *   3. Open-Meteo model estimates for the active place ("Air around you").
 *
 * They are never merged into a fictional observation. This module decides
 * which official group to show, whether the five-hour DoM reading is still
 * usable, and which recent airport report is a suitable fallback.
 */

import {
  AUTOMATIC_STATION_ID,
  DEFAULT_OBSERVATION_STALE_MINUTES,
  distanceKm,
  isFreshObservationAge,
  isUsableObservation,
  observationAgeMinutes,
  selectOfficialStation,
} from "./station-selection.js";

export const GLANCE_SOURCES = Object.freeze(["dom", "metar", "combined"]);
export const DEFAULT_GLANCE_SOURCE = "dom";

export const METAR_OBSERVATION_STALE_MINUTES = 3 * 60;

export const GLANCE_METRIC_IDS = Object.freeze([
  "temperature",
  "humidity",
  "rainfall",
  "rainfallTotal",
  "wind",
  "pressure",
  "dewPoint",
  "visibility",
  "cloud",
]);

export const GLANCE_METRIC_LABELS = Object.freeze({
  temperature: "Temperature",
  humidity: "Humidity",
  rainfall: "Rain, last 3 h",
  rainfallTotal: "Rain since 08:30",
  wind: "Wind",
  pressure: "Pressure",
  dewPoint: "Dew point",
  visibility: "Visibility",
  cloud: "Cloud cover",
});

export const DEFAULT_GLANCE_METRICS = Object.freeze([
  "temperature",
  "humidity",
  "rainfall",
]);

export const MAX_GLANCE_METRICS = 6;

export function normalizeGlanceSource(value) {
  return GLANCE_SOURCES.includes(value) ? value : DEFAULT_GLANCE_SOURCE;
}

export function normalizeGlanceMetrics(value) {
  if (!Array.isArray(value)) return [...DEFAULT_GLANCE_METRICS];
  const seen = new Set();
  const metrics = [];
  for (const item of value) {
    if (typeof item !== "string" || !GLANCE_METRIC_IDS.includes(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    metrics.push(item);
    if (metrics.length >= MAX_GLANCE_METRICS) break;
  }
  return metrics.length ? metrics : [...DEFAULT_GLANCE_METRICS];
}

export function toggleGlanceMetric(metrics, metric) {
  const current = normalizeGlanceMetrics(metrics);
  if (current.includes(metric)) {
    if (current.length === 1) return current;
    return current.filter((entry) => entry !== metric);
  }
  if (current.length >= MAX_GLANCE_METRICS) return current;
  return normalizeGlanceMetrics([...current, metric]);
}

function usableAge(station, now, staleAfterMinutes) {
  const age = observationAgeMinutes(station, now);
  return {
    ageMinutes: age,
    fresh: isUsableObservation(station) && isFreshObservationAge(age, staleAfterMinutes),
    timestampInFuture: Number.isFinite(age) && age < 0,
  };
}

function defaultStationFor(stations, preferredId) {
  return (
    stations.find((station) => station.id === preferredId) ||
    stations.find((station) => station.id === "colombo") ||
    stations[0] ||
    null
  );
}

/**
 * Choose a station for one source. Outside Sri Lanka (or without reference
 * coordinates) an explicit default is shown and labelled as a default, never
 * as the nearest station.
 */
export function chooseGlanceStation(
  stations = [],
  {
    location = null,
    preference = AUTOMATIC_STATION_ID,
    now = 0,
    staleAfterMinutes = DEFAULT_OBSERVATION_STALE_MINUTES,
    allowDefault = true,
    defaultStationId = "colombo",
  } = {},
) {
  const selection = selectOfficialStation(stations, {
    location,
    preference,
    now,
    staleAfterMinutes,
  });
  if (selection.station) {
    return {
      ...selection,
      ...usableAge(selection.station, now, staleAfterMinutes),
      defaulted: false,
    };
  }

  const canDefault =
    allowDefault &&
    preference === AUTOMATIC_STATION_ID &&
    ["outside-sri-lanka", "no-reference-points"].includes(selection.reason);
  if (!canDefault) {
    return {
      ...selection,
      ageMinutes: null,
      fresh: false,
      timestampInFuture: false,
      defaulted: false,
    };
  }

  const station = defaultStationFor(stations, defaultStationId);
  if (!station) {
    return {
      ...selection,
      ageMinutes: null,
      fresh: false,
      timestampInFuture: false,
      defaulted: false,
    };
  }
  const age = usableAge(station, now, staleAfterMinutes);
  return {
    mode: "automatic",
    station,
    requestedId: preference,
    reason: "default-outside-sri-lanka",
    distanceKm: null,
    alternatives: stations.slice(0, 3),
    manualMissing: false,
    ...age,
    defaulted: true,
  };
}

function nearestStationTo(stations, point, now, staleAfterMinutes, freshOnly) {
  if (!point) return null;
  const ranked = stations
    .map((station) => ({
      station,
      distance: station.referencePoint
        ? distanceKm(point, station.referencePoint)
        : null,
      age: observationAgeMinutes(station, now),
      usable: isUsableObservation(station),
    }))
    .filter((entry) => entry.distance != null)
    .sort((a, b) => a.distance - b.distance);
  if (freshOnly) {
    return (
      ranked.find((entry) => entry.usable && isFreshObservationAge(entry.age, staleAfterMinutes)) ||
      null
    );
  }
  return ranked.find((entry) => entry.usable) || ranked[0] || null;
}

/**
 * A suitable METAR fallback for a DoM station. Prefer the airport with the same
 * slug (so a saved station survives a source switch), then the nearest fresh
 * airport to the DoM reference point (or the active place), then the newest
 * usable report. A stale report is returned only when nothing fresher exists.
 */
export function selectMetarFallback(
  stations = [],
  {
    domStation = null,
    location = null,
    now = 0,
    staleAfterMinutes = METAR_OBSERVATION_STALE_MINUTES,
  } = {},
) {
  if (!Array.isArray(stations) || stations.length === 0) {
    return { station: null, reason: "no-metar-stations", fresh: false, ageMinutes: null };
  }

  const sameId = domStation
    ? stations.find((station) => station.id === domStation.id && isUsableObservation(station))
    : null;
  if (sameId) {
    const age = usableAge(sameId, now, staleAfterMinutes);
    if (age.fresh) {
      return { station: sameId, reason: "same-station", ...age };
    }
    // Keep the same airport as a last resort, but try fresher airports first.
  }

  const point =
    (domStation?.referencePoint || null) ||
    (location && Number.isFinite(location.latitude) ? location : null);
  const nearestFresh = nearestStationTo(stations, point, now, staleAfterMinutes, true);
  if (nearestFresh) {
    return {
      station: nearestFresh.station,
      reason: "nearest-fresh",
      ...usableAge(nearestFresh.station, now, staleAfterMinutes),
    };
  }

  if (sameId) {
    return {
      station: sameId,
      reason: "same-station-stale",
      ...usableAge(sameId, now, staleAfterMinutes),
    };
  }

  const newest = [...stations]
    .filter(isUsableObservation)
    .sort(
      (a, b) =>
        (b.observationEpochMs ?? 0) - (a.observationEpochMs ?? 0),
    )[0];
  if (newest) {
    return {
      station: newest,
      reason: "newest-stale",
      ...usableAge(newest, now, staleAfterMinutes),
    };
  }

  return { station: null, reason: "no-usable-metar", fresh: false, ageMinutes: null };
}

function groupFor({
  data,
  sourceId,
  selection,
  staleAfterMinutes,
  now,
}) {
  if (!data || !selection?.station) return null;
  const station = selection.station;
  const age = usableAge(station, now, staleAfterMinutes);
  return {
    id: sourceId,
    source: data.source || null,
    data,
    station,
    selection,
    stale: !age.fresh,
    fresh: age.fresh,
    ageMinutes: age.ageMinutes,
    timestampInFuture: age.timestampInFuture,
    defaulted: Boolean(selection.defaulted),
    staleAfterMinutes,
  };
}

function fallbackNotice({ domGroup, metarGroup, reason }) {
  const domName = domGroup?.station?.name || "the selected station";
  const domAge = domGroup?.ageMinutes;
  const ageText = Number.isFinite(domAge)
    ? domAge > 60
      ? `about ${Math.round(domAge / 60)} hours`
      : `${Math.round(domAge)} minutes`
    : "an unknown period";
  const prefix =
    reason === "dom-stale"
      ? `The Department of Meteorology reading for ${domName} is ${ageText} old, beyond the five-hour limit.`
      : `The Department of Meteorology reading for ${domName} is unavailable or has no valid timestamp.`;
  if (metarGroup?.fresh) {
    return `${prefix} Showing a recent NOAA AWC airport METAR observation as the labelled fallback. Airport data is not a DoM district reading.`;
  }
  return `${prefix} No recent METAR fallback is available, so Aeris is not presenting a current official observation.`;
}

/**
 * Resolve the whole widget. `dom` and `metar` are the normalized route
 * payloads (or null while loading).
 */
export function buildGlanceView({
  source = DEFAULT_GLANCE_SOURCE,
  dom = null,
  metar = null,
  location = null,
  preference = AUTOMATIC_STATION_ID,
  now = 0,
  domStaleAfterMinutes = DEFAULT_OBSERVATION_STALE_MINUTES,
  metarStaleAfterMinutes = METAR_OBSERVATION_STALE_MINUTES,
} = {}) {
  const resolvedSource = normalizeGlanceSource(source);
  const domStations = dom?.stations || [];
  const metarStations = metar?.stations || [];

  const domSelection = chooseGlanceStation(domStations, {
    location,
    preference,
    now,
    staleAfterMinutes: domStaleAfterMinutes,
    defaultStationId: "colombo",
  });
  const domGroup = groupFor({
    data: dom,
    sourceId: "dom",
    selection: domSelection,
    staleAfterMinutes: domStaleAfterMinutes,
    now,
  });

  const metarSelection = chooseGlanceStation(metarStations, {
    location,
    preference,
    now,
    staleAfterMinutes: metarStaleAfterMinutes,
    defaultStationId: "katunayake",
  });
  const selectedMetarGroup = groupFor({
    data: metar,
    sourceId: "metar",
    selection: metarSelection,
    staleAfterMinutes: metarStaleAfterMinutes,
    now,
  });

  // In DoM mode the fallback is chosen relative to the selected DoM station,
  // not relative to a saved METAR station preference.
  const fallbackSelection =
    resolvedSource === "dom" && metarStations.length
      ? selectMetarFallback(metarStations, {
          domStation: domGroup?.station ?? null,
          location,
          now,
          staleAfterMinutes: metarStaleAfterMinutes,
        })
      : null;
  const fallbackGroup =
    fallbackSelection?.station && metar
      ? {
          ...selectedMetarGroup,
          station: fallbackSelection.station,
          selection: {
            ...metarSelection,
            station: fallbackSelection.station,
            reason: fallbackSelection.reason,
            distanceKm: domGroup?.station?.referencePoint
              ? distanceKm(
                  domGroup.station.referencePoint,
                  fallbackSelection.station.referencePoint,
                )
              : null,
          },
          stale: !fallbackSelection.fresh,
          fresh: fallbackSelection.fresh,
          ageMinutes: fallbackSelection.ageMinutes,
        }
      : null;

  const domUsable = Boolean(domGroup?.fresh);
  const domProblem = domGroup
    ? !domGroup.fresh
    : Boolean(dom);
  const needsFallback = resolvedSource === "dom" && (domProblem || !domGroup);
  // A stale airport report is not a current observation. It may be reported in
  // the fallback details, but it must not replace the stale DoM group as if it
  // were a usable current reading.
  const fallbackActive = needsFallback && Boolean(fallbackGroup?.fresh);

  let groups = [];
  if (resolvedSource === "dom") {
    groups = fallbackActive ? [fallbackGroup] : domGroup ? [domGroup] : [];
  } else if (resolvedSource === "metar") {
    groups = selectedMetarGroup ? [selectedMetarGroup] : [];
  } else {
    groups = [domGroup, selectedMetarGroup].filter(Boolean);
  }

  const needsMetar =
    resolvedSource === "metar" ||
    resolvedSource === "combined" ||
    (resolvedSource === "dom" && !domUsable);

  let fallback = null;
  if (resolvedSource === "dom" && domProblem && domGroup) {
    fallback = {
      active: fallbackActive,
      reason: domGroup.fresh ? null : "dom-stale",
      domGroup,
      metarGroup: fallbackGroup,
      notice: fallbackNotice({
        domGroup,
        metarGroup: fallbackGroup,
        reason: "dom-stale",
      }),
    };
  } else if (resolvedSource === "dom" && !domGroup && needsFallback) {
    fallback = {
      active: fallbackActive,
      reason: "dom-unavailable",
      domGroup: null,
      metarGroup: fallbackGroup,
      notice: fallbackNotice({
        domGroup: null,
        metarGroup: fallbackGroup,
        reason: "dom-unavailable",
      }),
    };
  }

  if (resolvedSource === "combined" && domGroup && !domGroup.fresh) {
    fallback = {
      active: false,
      reason: "combined-dom-stale",
      domGroup,
      metarGroup: selectedMetarGroup,
      notice:
        "The DoM reading is beyond the five-hour limit. The METAR group is shown separately and is not a replacement DoM observation.",
    };
  }

  return {
    source: resolvedSource,
    domGroup,
    metarGroup: fallbackActive ? fallbackGroup : selectedMetarGroup,
    groups,
    primary: groups[0] || null,
    fallback,
    needsMetar,
    domUsable,
  };
}

export function metricAppliesToGroup(metric, sourceId) {
  if (sourceId === "dom") {
    return ["temperature", "humidity", "rainfall", "rainfallTotal"].includes(metric);
  }
  if (sourceId === "metar") {
    return [
      "temperature",
      "humidity",
      "wind",
      "pressure",
      "dewPoint",
      "visibility",
      "cloud",
    ].includes(metric);
  }
  return false;
}
