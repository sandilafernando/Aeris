const WET_GROUPS = new Set(["rain", "storm", "snow"]);

/**
 * Finds the first upcoming hour with a meaningful chance of precipitation.
 * Returns `null` when it is already wet, when the next hours are dry, or when
 * the forecast does not carry enough information. Used only for the optional
 * local notification; it never changes the displayed forecast.
 */
export function findPrecipitationOnset(hourly, current, now) {
  if (!Array.isArray(hourly) || hourly.length === 0) return null;
  if (WET_GROUPS.has(current?.condition?.group) && (current?.precipitation ?? 0) > 0) {
    return null;
  }
  if (Number.isFinite(current?.precipitation) && current.precipitation > 0.05) {
    return null;
  }

  const reference =
    Number.isFinite(now) && now > 0
      ? now
      : Number.isFinite(current?.time)
        ? current.time
        : hourly[0]?.timeMs;
  if (!Number.isFinite(reference)) return null;

  const upcoming = hourly
    .filter((hour) => Number.isFinite(hour?.timeMs) && hour.timeMs >= reference - 30 * 60_000)
    .slice(0, 4);

  for (const hour of upcoming) {
    const probability = hour.precipitationProbability;
    const amount = hour.precipitation;
    if (
      (Number.isFinite(probability) && probability >= 50) ||
      (Number.isFinite(amount) && amount >= 0.1)
    ) {
      const group = hour.condition?.group;
      return {
        hour,
        minutesAhead: Math.max(0, Math.round((hour.timeMs - reference) / 60_000)),
        kind: group === "snow" ? "Snow" : group === "storm" ? "Storms" : "Rain",
      };
    }
  }

  return null;
}

export function notificationKey(location, onset) {
  const place = location?.id || `${location?.latitude},${location?.longitude}`;
  const hour = Number.isFinite(onset?.hour?.timeMs)
    ? new Date(onset.hour.timeMs).toISOString().slice(0, 13)
    : "unknown";
  return `${place}:${hour}`;
}
