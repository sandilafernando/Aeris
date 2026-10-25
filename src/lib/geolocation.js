import { placeFromCoordinates } from "@/lib/storage";

export const GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 15 * 60 * 1000,
});

export class LocationRequestError extends Error {
  constructor(message, code = "unknown") {
    super(message);
    this.name = "LocationRequestError";
    this.code = code;
  }
}

export function geolocationErrorMessage(error) {
  if (!error) return "We couldn't determine your position. Please try again.";
  if (error.code === 1) {
    return "Location permission was denied. You can still search for a city instead.";
  }
  if (error.code === 2) {
    return "Your position is unavailable right now. Search for a city instead.";
  }
  if (error.code === 3) {
    return "The location request timed out. Please try again or search for a city.";
  }
  return "We couldn't determine your position. Search for a city instead.";
}

/**
 * Resolve the browser's current coordinates into a session-only place.
 * Resolves with a normalized place or rejects with a LocationRequestError.
 */
export function requestCurrentPlace() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(
        new LocationRequestError(
          "Geolocation isn't available in this browser. Search for a city instead.",
          "unsupported",
        ),
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const place = placeFromCoordinates(
          position.coords.latitude,
          position.coords.longitude,
        );
        if (!place) {
          reject(
            new LocationRequestError(
              "We couldn't use those coordinates. Search for a city instead.",
              "invalid",
            ),
          );
          return;
        }
        resolve(place);
      },
      (error) => reject(new LocationRequestError(geolocationErrorMessage(error), error?.code)),
      GEOLOCATION_OPTIONS,
    );
  });
}
