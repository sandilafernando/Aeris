const HOUR_MS = 3_600_000;

function toMs(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value > 10_000_000_000 ? value : value * 1000;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function chooseHours(hourly, nowMs, count = 12) {
  if (!Array.isArray(hourly) || hourly.length === 0) return [];
  const cutoff = finite(nowMs) && nowMs > 0 ? Math.floor(nowMs / HOUR_MS) * HOUR_MS : null;
  const upcoming = cutoff ? hourly.filter((hour) => hour.timeMs >= cutoff) : hourly;
  return (upcoming.length ? upcoming : hourly).slice(0, count);
}

export const ACTIVITY_DEFINITIONS = Object.freeze({
  run: {
    label: "Run or walk",
    icon: "footprints",
    criteria: "5–24°C, rain chance ≤40%, wind ≤25 km/h, UV ≤8",
    meets: (hour) =>
      finite(hour.temperature) &&
      hour.temperature >= 5 &&
      hour.temperature <= 24 &&
      (hour.precipitationProbability == null || hour.precipitationProbability <= 40) &&
      (hour.precipitation == null || hour.precipitation <= 0.2) &&
      (hour.windSpeed == null || hour.windSpeed <= 25) &&
      (hour.uvIndex == null || hour.uvIndex <= 8),
  },
  cycle: {
    label: "Cycle",
    icon: "bike",
    criteria: "8–27°C, rain chance ≤30%, wind ≤20 km/h",
    meets: (hour) =>
      finite(hour.temperature) &&
      hour.temperature >= 8 &&
      hour.temperature <= 27 &&
      (hour.precipitationProbability == null || hour.precipitationProbability <= 30) &&
      (hour.precipitation == null || hour.precipitation <= 0.1) &&
      (hour.windSpeed == null || hour.windSpeed <= 20),
  },
  dine: {
    label: "Eat outside",
    icon: "utensils",
    criteria: "16–32°C, rain chance ≤20%, wind ≤15 km/h",
    meets: (hour) =>
      finite(hour.temperature) &&
      hour.temperature >= 16 &&
      hour.temperature <= 32 &&
      (hour.precipitationProbability == null || hour.precipitationProbability <= 20) &&
      (hour.precipitation == null || hour.precipitation <= 0.05) &&
      (hour.windSpeed == null || hour.windSpeed <= 15),
  },
});

function longestRun(hours, meets) {
  let best = { start: null, length: 0 };
  let current = { start: null, length: 0 };
  for (const hour of hours) {
    if (meets(hour)) {
      if (current.length === 0) current.start = hour.timeMs;
      current.length += 1;
      if (current.length > best.length) best = { ...current };
    } else {
      current = { start: null, length: 0 };
    }
  }
  return best;
}

export function buildActivityGuidance(hourly, nowMs) {
  const hours = chooseHours(hourly, nowMs, 12);
  if (hours.length === 0) return [];
  const nextSix = hours.slice(0, 6);

  return Object.entries(ACTIVITY_DEFINITIONS).map(([key, definition]) => {
    const matched = nextSix.filter((hour) => definition.meets(hour)).length;
    const window = longestRun(hours, definition.meets);
    let status = "limited";
    if (matched >= 4) status = "good";
    else if (matched >= 2) status = "fair";
    return {
      key,
      label: definition.label,
      icon: definition.icon,
      criteria: definition.criteria,
      status,
      matched,
      considered: nextSix.length,
      windowStart: window.start,
      windowLength: window.length,
      reason:
        matched === 0
          ? "No hour in the next six meets all of the comfort thresholds."
          : `${matched} of the next ${nextSix.length} hours meet all of the comfort thresholds.`,
    };
  });
}

export function buildRainIntelligence(hourly, nowMs) {
  const hours = chooseHours(hourly, nowMs, 24);
  if (hours.length === 0) {
    return {
      totalMm: null,
      peakMm: null,
      peakTime: null,
      peakProbabilityTime: null,
      wetHours: null,
      maxProbability: null,
      dryWindowStart: null,
      dryWindowLength: null,
      hours: [],
    };
  }

  const amounts = hours.map((hour) => hour.precipitation).filter(finite);
  const probabilities = hours
    .map((hour) => hour.precipitationProbability)
    .filter(finite);
  let peak = null;
  for (const hour of hours) {
    if (!finite(hour.precipitation)) continue;
    if (!peak || hour.precipitation > peak.precipitation) peak = hour;
  }

  // The wettest hour and the likeliest hour are not always the same hour. Keep
  // them separate so a headline percentage is never attributed to the wrong
  // time.
  let chancePeak = null;
  for (const hour of hours) {
    if (!finite(hour.precipitationProbability)) continue;
    if (
      !chancePeak ||
      hour.precipitationProbability > chancePeak.precipitationProbability
    ) {
      chancePeak = hour;
    }
  }

  let dryBest = { start: null, length: 0 };
  let dryCurrent = { start: null, length: 0 };
  for (const hour of hours) {
    const isDry =
      (hour.precipitation == null || hour.precipitation < 0.1) &&
      (hour.precipitationProbability == null || hour.precipitationProbability < 30);
    if (isDry) {
      if (dryCurrent.length === 0) dryCurrent.start = hour.timeMs;
      dryCurrent.length += 1;
      if (dryCurrent.length > dryBest.length) dryBest = { ...dryCurrent };
    } else {
      dryCurrent = { start: null, length: 0 };
    }
  }

  return {
    totalMm: amounts.length ? amounts.reduce((sum, value) => sum + value, 0) : null,
    peakMm: peak ? peak.precipitation : null,
    peakTime: peak ? peak.timeMs : null,
    peakProbabilityTime: chancePeak ? chancePeak.timeMs : null,
    wetHours: amounts.length
      ? hours.filter((hour) => finite(hour.precipitation) && hour.precipitation >= 0.1).length
      : null,
    maxProbability: probabilities.length ? Math.max(...probabilities) : null,
    dryWindowStart: dryBest.start,
    dryWindowLength: dryBest.length || null,
    hours,
  };
}

export function computeEnsembleSpread(payload, nowMs = 0, horizonHours = 48) {
  const hourly = payload?.hourly;
  if (!hourly || !Array.isArray(hourly.time)) return null;
  const memberKeys = Object.keys(hourly).filter((key) =>
    /^temperature_2m_member\d+$/.test(key),
  );
  if (memberKeys.length < 5) return null;

  const cutoff =
    finite(nowMs) && nowMs > 0 ? Math.floor(nowMs / HOUR_MS) * HOUR_MS : null;
  const rows = [];
  for (let index = 0; index < hourly.time.length; index += 1) {
    const timeMs = toMs(hourly.time[index]);
    if (timeMs == null) continue;
    if (cutoff != null && timeMs < cutoff) continue;
    const members = memberKeys
      .map((key) => hourly[key]?.[index])
      .map(Number)
      .filter(Number.isFinite);
    if (members.length < 5) continue;
    const mean = members.reduce((sum, value) => sum + value, 0) / members.length;
    const variance =
      members.reduce((sum, value) => sum + (value - mean) ** 2, 0) / members.length;
    rows.push({
      timeMs,
      mean,
      min: Math.min(...members),
      max: Math.max(...members),
      spread: Math.max(...members) - Math.min(...members),
      stdev: Math.sqrt(variance),
      memberCount: members.length,
    });
    if (rows.length >= horizonHours) break;
  }

  if (rows.length === 0) return null;
  const meanSpread = rows.reduce((sum, row) => sum + row.spread, 0) / rows.length;
  const maxSpread = Math.max(...rows.map((row) => row.spread));
  let agreement = "low";
  let agreementLabel = "Low agreement";
  if (meanSpread <= 1.5) {
    agreement = "very-high";
    agreementLabel = "Very high agreement";
  } else if (meanSpread <= 3) {
    agreement = "high";
    agreementLabel = "High agreement";
  } else if (meanSpread <= 5) {
    agreement = "moderate";
    agreementLabel = "Moderate agreement";
  }

  return {
    rows,
    summary: {
      memberCount: rows[0].memberCount,
      hourCount: rows.length,
      meanSpread,
      maxSpread,
      agreement,
      agreementLabel,
    },
  };
}

export function nearbyHour(rows, targetMs) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.reduce((best, row) =>
    Math.abs(row.timeMs - targetMs) < Math.abs(best.timeMs - targetMs) ? row : best,
  );
}

export function normalizeArchiveDaily(payload) {
  const daily = payload?.daily;
  if (!daily || !Array.isArray(daily.time)) return [];
  return daily.time
    .map((date, index) => {
      if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return {
        date,
        weatherCode: Number.isFinite(Number(daily.weather_code?.[index]))
          ? Number(daily.weather_code[index])
          : null,
        temperatureMax: Number.isFinite(Number(daily.temperature_2m_max?.[index]))
          ? Number(daily.temperature_2m_max[index])
          : null,
        temperatureMin: Number.isFinite(Number(daily.temperature_2m_min?.[index]))
          ? Number(daily.temperature_2m_min[index])
          : null,
        precipitationSum: Number.isFinite(Number(daily.precipitation_sum?.[index]))
          ? Number(daily.precipitation_sum[index])
          : null,
        windSpeedMax: Number.isFinite(Number(daily.wind_speed_10m_max?.[index]))
          ? Number(daily.wind_speed_10m_max[index])
          : null,
      };
    })
    .filter(Boolean);
}
