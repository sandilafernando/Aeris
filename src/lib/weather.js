export const WEATHER_CODE_MAP = {
  0: { label: "Clear sky", group: "clear", shortLabel: "Clear" },
  1: { label: "Mainly clear", group: "clear", shortLabel: "Mainly clear" },
  2: { label: "Partly cloudy", group: "partly", shortLabel: "Partly cloudy" },
  3: { label: "Overcast", group: "cloudy", shortLabel: "Overcast" },
  45: { label: "Fog", group: "fog", shortLabel: "Fog" },
  48: { label: "Depositing rime fog", group: "fog", shortLabel: "Rime fog" },
  51: { label: "Light drizzle", group: "rain", shortLabel: "Drizzle" },
  53: { label: "Moderate drizzle", group: "rain", shortLabel: "Drizzle" },
  55: { label: "Dense drizzle", group: "rain", shortLabel: "Drizzle" },
  56: { label: "Light freezing drizzle", group: "snow", shortLabel: "Freezing drizzle" },
  57: { label: "Dense freezing drizzle", group: "snow", shortLabel: "Freezing drizzle" },
  61: { label: "Slight rain", group: "rain", shortLabel: "Rain" },
  63: { label: "Moderate rain", group: "rain", shortLabel: "Rain" },
  65: { label: "Heavy rain", group: "rain", shortLabel: "Heavy rain" },
  66: { label: "Light freezing rain", group: "snow", shortLabel: "Freezing rain" },
  67: { label: "Heavy freezing rain", group: "snow", shortLabel: "Freezing rain" },
  71: { label: "Slight snowfall", group: "snow", shortLabel: "Snow" },
  73: { label: "Moderate snowfall", group: "snow", shortLabel: "Snow" },
  75: { label: "Heavy snowfall", group: "snow", shortLabel: "Heavy snow" },
  77: { label: "Snow grains", group: "snow", shortLabel: "Snow grains" },
  80: { label: "Slight rain showers", group: "rain", shortLabel: "Light showers" },
  81: { label: "Moderate rain showers", group: "rain", shortLabel: "Showers" },
  82: { label: "Violent rain showers", group: "rain", shortLabel: "Heavy showers" },
  85: { label: "Slight snow showers", group: "snow", shortLabel: "Snow showers" },
  86: { label: "Heavy snow showers", group: "snow", shortLabel: "Heavy snow" },
  95: { label: "Thunderstorm", group: "storm", shortLabel: "Thunderstorm" },
  96: { label: "Thunderstorm with slight hail", group: "storm", shortLabel: "Storm & hail" },
  97: { label: "Heavy thunderstorm", group: "storm", shortLabel: "Severe storm" },
  99: { label: "Thunderstorm with heavy hail", group: "storm", shortLabel: "Storm & hail" },
};

const UNKNOWN_CONDITION = {
  label: "Condition unavailable",
  group: "cloudy",
  shortLabel: "Unavailable",
};

export function getWeatherCondition(code) {
  const hasCode = code !== null && code !== undefined && code !== "";
  const numericCode = hasCode ? Number(code) : null;
  const info = Number.isFinite(numericCode) ? WEATHER_CODE_MAP[numericCode] : null;
  return {
    code: info ? numericCode : null,
    ...(info || UNKNOWN_CONDITION),
  };
}

function numericOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function booleanish(value, fallback = null) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return fallback;
}

function unixToMs(value) {
  const number = numericOrNull(value);
  return number === null ? null : number * 1000;
}

function valueAtCurrentHour(hourly, timestamp, key) {
  if (!hourly.length) return null;
  let match = null;
  for (const hour of hourly) {
    if (hour.timeMs <= timestamp) match = hour;
    else break;
  }
  if (!match) match = hourly[0];
  return match && match[key] !== undefined ? match[key] : null;
}

function readHourly(hourly = {}) {
  if (!Array.isArray(hourly.time)) return [];
  return hourly.time
    .map((time, index) => {
      const values = {
        time: unixToMs(time),
        temperature: hourly.temperature_2m?.[index],
        apparentTemperature: hourly.apparent_temperature?.[index],
        humidity: hourly.relative_humidity_2m?.[index],
        weatherCode: hourly.weather_code?.[index],
        isDay: hourly.is_day?.[index],
        precipitationProbability: hourly.precipitation_probability?.[index],
        precipitation: hourly.precipitation?.[index],
        windSpeed: hourly.wind_speed_10m?.[index],
        windDirection: hourly.wind_direction_10m?.[index],
        uvIndex: hourly.uv_index?.[index],
        visibility: hourly.visibility?.[index],
        cloudCover: hourly.cloud_cover?.[index],
      };
      const hour = {
        time: values.time,
        temperature: numericOrNull(values.temperature),
        apparentTemperature: numericOrNull(values.apparentTemperature),
        humidity: numericOrNull(values.humidity),
        isDay: booleanish(values.isDay),
        precipitationProbability: numericOrNull(values.precipitationProbability),
        precipitation: numericOrNull(values.precipitation),
        windSpeed: numericOrNull(values.windSpeed),
        windDirection: numericOrNull(values.windDirection),
        uvIndex: numericOrNull(values.uvIndex),
        visibility: numericOrNull(values.visibility),
        cloudCover: numericOrNull(values.cloudCover),
      };
      hour.condition = getWeatherCondition(values.weatherCode);
      hour.timeMs = values.time;
      return hour;
    })
    .filter((hour) => hour.timeMs !== null);
}

function readDaily(daily = {}) {
  if (!Array.isArray(daily.time)) return [];
  return daily.time
    .map((time, index) => {
      const conditionCode = daily.weather_code?.[index];
      return {
        time: unixToMs(time),
        weatherCode: numericOrNull(conditionCode),
        condition: getWeatherCondition(conditionCode),
        temperatureMax: numericOrNull(daily.temperature_2m_max?.[index]),
        temperatureMin: numericOrNull(daily.temperature_2m_min?.[index]),
        precipitationProbability: numericOrNull(daily.precipitation_probability_max?.[index]),
        precipitationSum: numericOrNull(daily.precipitation_sum?.[index]),
        sunrise: unixToMs(daily.sunrise?.[index]),
        sunset: unixToMs(daily.sunset?.[index]),
        uvIndexMax: numericOrNull(daily.uv_index_max?.[index]),
        windSpeedMax: numericOrNull(daily.wind_speed_10m_max?.[index]),
        windDirectionDominant: numericOrNull(daily.wind_direction_10m_dominant?.[index]),
        daylightDuration: numericOrNull(daily.daylight_duration?.[index]),
      };
    })
    .filter((day) => day.time !== null);
}

export function normalizeWeather(payload, location, fetchedAt = Date.now()) {
  if (!payload || !payload.current || !Array.isArray(payload.hourly?.time)) {
    throw new Error("The weather service returned an incomplete response.");
  }

  const timezone = payload.timezone || location?.timezone || "UTC";
  const currentTime = unixToMs(payload.current.time) || fetchedAt;
  const hourly = readHourly(payload.hourly);
  const daily = readDaily(payload.daily);
  const currentHourTs = Math.floor(currentTime / 3_600_000) * 3_600_000;
  let upcoming = hourly.filter((hour) => hour.timeMs >= currentHourTs);
  if (!upcoming.length) upcoming = hourly;
  const next24 = upcoming.slice(0, 24);

  const currentCode =
    payload.current.weather_code ??
    daily[0]?.weatherCode ??
    next24[0]?.weatherCode ??
    null;
  const currentCondition = getWeatherCondition(currentCode);
  const currentIsDay =
    booleanish(payload.current.is_day) ?? next24[0]?.isDay ?? true;

  const today = daily[0] || null;

  return {
    timezone,
    latitude: numericOrNull(payload.latitude) ?? location?.latitude ?? null,
    longitude: numericOrNull(payload.longitude) ?? location?.longitude ?? null,
    elevation: numericOrNull(payload.elevation),
    fetchedAt,
    current: {
      time: currentTime,
      temperature: numericOrNull(payload.current.temperature_2m),
      apparentTemperature: numericOrNull(payload.current.apparent_temperature),
      humidity: numericOrNull(payload.current.relative_humidity_2m),
      weatherCode: currentCondition.code,
      condition: currentCondition,
      isDay: currentIsDay,
      precipitation: numericOrNull(payload.current.precipitation),
      cloudCover: numericOrNull(payload.current.cloud_cover),
      pressure: numericOrNull(payload.current.pressure_msl),
      windSpeed: numericOrNull(payload.current.wind_speed_10m),
      windDirection: numericOrNull(payload.current.wind_direction_10m),
      windGust: numericOrNull(payload.current.wind_gusts_10m),
      visibility: numericOrNull(payload.current.visibility),
      uvIndex:
        numericOrNull(payload.current.uv_index) ??
        valueAtCurrentHour(hourly, currentTime, "uvIndex"),
      high: today?.temperatureMax ?? null,
      low: today?.temperatureMin ?? null,
      sunrise: today?.sunrise ?? null,
      sunset: today?.sunset ?? null,
      daylightDuration: today?.daylightDuration ?? null,
    },
    hourly: next24,
    daily,
  };
}

export function buildWeatherUrl(location) {
  if (!location) throw new Error("A location is required.");
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "pressure_msl",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "visibility",
    ].join(","),
    hourly: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "weather_code",
      "precipitation_probability",
      "precipitation",
      "wind_speed_10m",
      "wind_direction_10m",
      "is_day",
      "uv_index",
      "visibility",
      "cloud_cover",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "precipitation_sum",
      "sunrise",
      "sunset",
      "uv_index_max",
      "wind_speed_10m_max",
      "wind_direction_10m_dominant",
      "daylight_duration",
    ].join(","),
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: "7",
    forecast_hours: "24",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    cell_selection: "land",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export function buildOutlook(hourly, current) {
  const group = current?.condition?.group;
  const noun = group === "snow" ? "Snow" : group === "storm" ? "Storms" : "Rain";

  if ((current?.precipitation ?? 0) > 0) {
    if (group === "snow") return "Snow is falling now.";
    if (group === "storm") return "Storms are nearby now.";
    return "Rain is falling now.";
  }
  if (!hourly?.length) return "Forecast details are limited.";
  const nextSix = hourly.slice(0, 6);
  const probabilities = nextSix
    .map((hour) => hour.precipitationProbability)
    .filter((value) => Number.isFinite(value));
  const maxProbability = probabilities.length ? Math.max(...probabilities) : null;

  if (maxProbability !== null && maxProbability >= 60) {
    return `${noun} likely within 6 hours.`;
  }
  if (maxProbability !== null && maxProbability >= 30) {
    return `${noun} possible within 6 hours.`;
  }
  if (group === "fog") return "Low visibility may persist.";
  return "Mostly dry over the next 6 hours.";
}

export function convertTemperature(valueC, unit = "c") {
  if (!Number.isFinite(valueC)) return null;
  return unit === "f" ? (valueC * 9) / 5 + 32 : valueC;
}

export function temperatureSymbol(unit = "c") {
  return unit === "f" ? "°F" : "°C";
}

export function formatTemperature(valueC, unit = "c", options = {}) {
  const converted = convertTemperature(valueC, unit);
  if (converted === null) return "–";
  const rounded = Math.round(converted);
  return `${rounded === 0 ? 0 : rounded}°${options.withUnit ? (unit === "f" ? "F" : "C") : ""}`;
}

const WIND_FACTORS = { kmh: 1, mph: 0.621371, ms: 1 / 3.6 };
export const WIND_UNIT_LABELS = { kmh: "km/h", mph: "mph", ms: "m/s" };

export function convertWind(valueKmh, unit = "kmh") {
  if (!Number.isFinite(valueKmh)) return null;
  return valueKmh * (WIND_FACTORS[unit] ?? 1);
}

export function formatWind(valueKmh, unit = "kmh", options = {}) {
  const converted = convertWind(valueKmh, unit);
  if (converted === null) return "Unavailable";
  const maximumFractionDigits = unit === "ms" ? 1 : 0;
  const value = new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(converted);
  return options.valueOnly ? value : `${value} ${WIND_UNIT_LABELS[unit] || "km/h"}`;
}

export function formatPrecipitation(valueMm, unit = "metric") {
  if (!Number.isFinite(valueMm)) return "Unavailable";
  if (unit === "imperial") {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(valueMm / 25.4)} in`;
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(valueMm)} mm`;
}

export function formatVisibility(valueMeters, unit = "metric") {
  if (!Number.isFinite(valueMeters)) return "Unavailable";
  if (unit === "imperial") {
    return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(valueMeters / 1609.344)} mi`;
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(valueMeters / 1000)} km`;
}

export function measurementSystem(windUnit) {
  return windUnit === "mph" ? "imperial" : "metric";
}

const COMPASS_POINTS = [
  "north",
  "north-northeast",
  "northeast",
  "east-northeast",
  "east",
  "east-southeast",
  "southeast",
  "south-southeast",
  "south",
  "south-southwest",
  "southwest",
  "west-southwest",
  "west",
  "west-northwest",
  "northwest",
  "north-northwest",
];
const COMPASS_SHORT = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function windDirectionLabel(degrees, short = false) {
  if (!Number.isFinite(degrees)) return "Unavailable";
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return short ? COMPASS_SHORT[index] : COMPASS_POINTS[index];
}

export function uvIndexLabel(value) {
  if (!Number.isFinite(value)) return { label: "Unavailable", tone: "neutral" };
  if (value < 3) return { label: "Low", tone: "low" };
  if (value < 6) return { label: "Moderate", tone: "moderate" };
  if (value < 8) return { label: "High", tone: "high" };
  if (value < 11) return { label: "Very high", tone: "very-high" };
  return { label: "Extreme", tone: "extreme" };
}

export function temperatureRange(days = []) {
  const lows = days.map((day) => day.temperatureMin).filter(Number.isFinite);
  const highs = days.map((day) => day.temperatureMax).filter(Number.isFinite);
  if (!lows.length || !highs.length) return null;
  return { min: Math.min(...lows), max: Math.max(...highs) };
}
