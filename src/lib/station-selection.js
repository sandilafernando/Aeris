export const AUTOMATIC_STATION_ID = "auto";
// The Department of Meteorology publishes a 3-hourly cycle, but the product
// rule for using a reading as the current station observation is five hours.
export const DEFAULT_OBSERVATION_STALE_MINUTES = 5 * 60;
// A small clock skew is tolerated. A timestamp further ahead than this is not
// treated as fresh, because doing so would let a bad clock hide stale data.
export const FUTURE_OBSERVATION_TOLERANCE_MINUTES = 10;

const EARTH_RADIUS_KM = 6_371;

function coordinatePair(value) {
  if (!value) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

export function withinSriLanka(location) {
  if (!location) return false;
  if (String(location.countryCode || "").toUpperCase() === "LK") return true;
  const coordinates = coordinatePair(location);
  if (!coordinates) return false;
  return (
    coordinates.latitude >= 5.7 &&
    coordinates.latitude <= 10 &&
    coordinates.longitude >= 79.4 &&
    coordinates.longitude <= 82
  );
}

export function distanceKm(a, b) {
  const first = coordinatePair(a);
  const second = coordinatePair(b);
  if (!first || !second) return null;

  const toRadians = (value) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function stationDistanceKm(station, location) {
  if (!station?.referencePoint) return null;
  return distanceKm(station.referencePoint, location);
}

export function observationAgeMinutes(station, now) {
  if (!Number.isFinite(station?.observationEpochMs)) return null;
  if (!Number.isFinite(now) || now <= 0) return null;
  // Keep negative ages. A future observation must be distinguishable from a
  // reading that is genuinely zero minutes old.
  return (now - station.observationEpochMs) / 60_000;
}

export function isFreshObservationAge(
  ageMinutes,
  staleAfterMinutes = DEFAULT_OBSERVATION_STALE_MINUTES,
  futureToleranceMinutes = FUTURE_OBSERVATION_TOLERANCE_MINUTES,
) {
  if (!Number.isFinite(ageMinutes)) return false;
  if (ageMinutes > staleAfterMinutes) return false;
  if (ageMinutes < -futureToleranceMinutes) return false;
  return true;
}

export function isUsableObservation(station) {
  if (!Number.isFinite(station?.observationEpochMs)) return false;
  return Number.isFinite(station.temperatureC) || Boolean(station.conditionLabel);
}

export function isObservationStale(
  station,
  now,
  staleAfterMinutes = DEFAULT_OBSERVATION_STALE_MINUTES,
) {
  const age = observationAgeMinutes(station, now);
  return !isFreshObservationAge(age, staleAfterMinutes);
}

function automaticSelection(stations, { location, now, staleAfterMinutes }) {
  if (!withinSriLanka(location)) {
    return {
      mode: "automatic",
      station: null,
      requestedId: AUTOMATIC_STATION_ID,
      reason: "outside-sri-lanka",
      distanceKm: null,
      ageMinutes: null,
      stale: true,
      manualMissing: false,
      alternatives: [],
    };
  }

  const ranked = stations
    .map((station) => ({
      station,
      distanceKm: stationDistanceKm(station, location),
      ageMinutes: observationAgeMinutes(station, now),
      usable: isUsableObservation(station),
    }))
    .filter((entry) => entry.distanceKm != null)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (ranked.length === 0) {
    return {
      mode: "automatic",
      station: null,
      requestedId: AUTOMATIC_STATION_ID,
      reason: "no-reference-points",
      distanceKm: null,
      ageMinutes: null,
      stale: true,
      manualMissing: false,
      alternatives: stations.slice(0, 3),
    };
  }

  const fresh = ranked.filter(
    (entry) =>
      entry.usable &&
      isFreshObservationAge(entry.ageMinutes, staleAfterMinutes),
  );
  const nearest = ranked[0];
  const nearestFresh = fresh[0];
  const alternatives = ranked.slice(0, 3).map((entry) => entry.station);

  if (nearestFresh) {
    return {
      mode: "automatic",
      station: nearestFresh.station,
      requestedId: AUTOMATIC_STATION_ID,
      reason:
        nearest?.station.id === nearestFresh.station.id
          ? "nearest-fresh"
          : "fresher-alternative",
      distanceKm: nearestFresh.distanceKm,
      ageMinutes: nearestFresh.ageMinutes,
      stale: false,
      manualMissing: false,
      alternatives,
    };
  }

  const staleUsable = ranked.find((entry) => entry.usable);
  if (staleUsable) {
    return {
      mode: "automatic",
      station: staleUsable.station,
      requestedId: AUTOMATIC_STATION_ID,
      reason: "nearest-stale",
      distanceKm: staleUsable.distanceKm,
      ageMinutes: staleUsable.ageMinutes,
      stale: true,
      manualMissing: false,
      alternatives,
    };
  }

  return {
    mode: "automatic",
    station: nearest.station,
    requestedId: AUTOMATIC_STATION_ID,
    reason: "no-usable-observation",
    distanceKm: nearest.distanceKm,
    ageMinutes: null,
    stale: true,
    manualMissing: false,
    alternatives,
  };
}

/**
 * Keeps manual and automatic selection deliberately separate. A manual choice
 * is returned exactly as chosen, even when the observation is stale or the
 * station disappears from a later response.
 */
export function selectOfficialStation(
  stations = [],
  {
    location = null,
    preference = AUTOMATIC_STATION_ID,
    now = 0,
    staleAfterMinutes = DEFAULT_OBSERVATION_STALE_MINUTES,
  } = {},
) {
  if (!Array.isArray(stations) || stations.length === 0) {
    return {
      mode: preference === AUTOMATIC_STATION_ID ? "automatic" : "manual",
      station: null,
      requestedId: preference,
      reason: "no-stations",
      distanceKm: null,
      ageMinutes: null,
      stale: true,
      manualMissing: false,
      alternatives: [],
    };
  }

  if (preference && preference !== AUTOMATIC_STATION_ID) {
    const station = stations.find((entry) => entry.id === preference) || null;
    if (!station) {
      return {
        mode: "manual",
        station: null,
        requestedId: preference,
        reason: "manual-missing",
        distanceKm: null,
        ageMinutes: null,
        stale: true,
        manualMissing: true,
        alternatives: stations.slice(0, 3),
      };
    }

    const ageMinutes = observationAgeMinutes(station, now);
    return {
      mode: "manual",
      station,
      requestedId: preference,
      reason: "manual",
      distanceKm: stationDistanceKm(station, location),
      ageMinutes,
      stale:
        !isFreshObservationAge(ageMinutes, staleAfterMinutes) ||
        !isUsableObservation(station),
      manualMissing: false,
      alternatives: [],
    };
  }

  return automaticSelection(stations, { location, now, staleAfterMinutes });
}

export function stationReferenceLabel(station) {
  if (!station?.referencePoint) return "Approximate location unavailable";
  const latitude = Number(station.referencePoint.latitude);
  const longitude = Number(station.referencePoint.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return "Approximate location unavailable";
  }
  const latitudeLabel = `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"}`;
  const longitudeLabel = `${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "W"}`;
  if (station.referencePoint.official) {
    return `Official station point ${latitudeLabel}, ${longitudeLabel}`;
  }
  return `Approx. reference ${latitudeLabel}, ${longitudeLabel}`;
}
