export const BERLIN = {
  id: 2950159,
  name: "Berlin",
  latitude: 52.52,
  longitude: 13.405,
  country_code: "DE",
  country: "Germany",
  admin1: "Land Berlin",
  timezone: "Europe/Berlin",
  population: 3426354,
};

export const LISBON = {
  id: 2267057,
  name: "Lisbon",
  latitude: 38.7167,
  longitude: -9.1333,
  country_code: "PT",
  country: "Portugal",
  admin1: "Lisbon",
  timezone: "Europe/Lisbon",
  population: 517802,
};

export const TAIPEI = {
  id: 1668341,
  name: "Taipei",
  latitude: 25.0478,
  longitude: 121.5319,
  country_code: "TW",
  country: "Taiwan",
  admin1: "Taipei",
  timezone: "Asia/Taipei",
  population: 7871900,
};

const SEARCH_PLACES = [BERLIN, LISBON, TAIPEI];

export function searchResultsFor(query) {
  const normalized = String(query || "").toLowerCase();
  return SEARCH_PLACES.filter((place) => place.name.toLowerCase().includes(normalized));
}

/**
 * Build a complete Open-Meteo forecast response with 24 hourly steps and
 * seven daily steps. Values vary a little so the UI does not look synthetic.
 */
export function buildWeatherPayload({
  now = Date.now(),
  timezone = "Europe/Berlin",
  latitude = BERLIN.latitude,
  longitude = BERLIN.longitude,
  isDay = 1,
  conditionCode = 2,
  temperature = 13.4,
} = {}) {
  const hourMs = 3_600_000;
  const currentHour = Math.floor(now / hourMs) * hourMs;
  const dayMs = 86_400_000;
  const startOfDay = Math.floor(now / dayMs) * dayMs;
  const toSeconds = (value) => Math.floor(value / 1000);

  const hours = Array.from({ length: 24 }, (_, index) => currentHour + index * hourMs);
  const days = Array.from({ length: 7 }, (_, index) => startOfDay + index * dayMs);

  const hourlyCodes = [conditionCode, 2, 3, 61, 61, 80, 2, 0, 0, 1, 2, 3, 3, 61, 63, 2, 1, 0, 0, 2, 3, 45, 2, 1];
  const hourlyTemps = hours.map((_, index) => {
    const curve = Math.sin(((index + 6) / 24) * Math.PI * 2) * 3.2;
    return Number((temperature + curve).toFixed(1));
  });

  return {
    latitude,
    longitude,
    generationtime_ms: 0.13,
    utc_offset_seconds: 0,
    timezone,
    timezone_abbreviation: "CET",
    elevation: 34,
    current_units: {
      time: "unixtime",
      interval: "seconds",
      temperature_2m: "°C",
      relative_humidity_2m: "%",
      apparent_temperature: "°C",
      is_day: "",
      precipitation: "mm",
      weather_code: "wmo code",
      cloud_cover: "%",
      pressure_msl: "hPa",
      wind_speed_10m: "km/h",
      wind_direction_10m: "°",
      wind_gusts_10m: "km/h",
      visibility: "m",
    },
    current: {
      time: toSeconds(now),
      interval: 900,
      temperature_2m: temperature,
      relative_humidity_2m: 72,
      apparent_temperature: Number((temperature - 1.8).toFixed(1)),
      is_day: isDay,
      precipitation: 0,
      weather_code: conditionCode,
      cloud_cover: 58,
      pressure_msl: 1014.6,
      wind_speed_10m: 18.4,
      wind_direction_10m: 238,
      wind_gusts_10m: 31.2,
      visibility: 24_000,
    },
    hourly_units: {
      time: "unixtime",
      temperature_2m: "°C",
      apparent_temperature: "°C",
      relative_humidity_2m: "%",
      weather_code: "wmo code",
      precipitation_probability: "%",
      precipitation: "mm",
      wind_speed_10m: "km/h",
      wind_direction_10m: "°",
      is_day: "",
      uv_index: "",
      visibility: "m",
    },
    hourly: {
      time: hours.map(toSeconds),
      temperature_2m: hourlyTemps,
      apparent_temperature: hourlyTemps.map((value) => Number((value - 1.5).toFixed(1))),
      relative_humidity_2m: hours.map((_, index) => 60 + ((index * 3) % 28)),
      weather_code: hours.map((_, index) => hourlyCodes[index % hourlyCodes.length]),
      precipitation_probability: hours.map((_, index) =>
        [8, 10, 16, 42, 61, 38, 12, 4, 2, 3, 8, 15, 20, 55, 66, 30, 12, 5, 3, 8, 16, 22, 11, 6][index],
      ),
      precipitation: hours.map((_, index) =>
        [0, 0, 0, 0.4, 1.2, 0.3, 0, 0, 0, 0, 0, 0, 0, 0.8, 1.6, 0.2, 0, 0, 0, 0, 0, 0, 0, 0][index],
      ),
      wind_speed_10m: hours.map((_, index) => Number((14 + (index % 7) * 1.7).toFixed(1))),
      wind_direction_10m: hours.map((_, index) => (225 + index * 4) % 360),
      is_day: hours.map((_, index) => (index >= 7 && index <= 16 ? 1 : 0)),
      uv_index: hours.map((_, index) => {
        if (index < 7 || index > 17) return 0;
        return Number((Math.sin(((index - 6) / 12) * Math.PI) * 3.6).toFixed(2));
      }),
      visibility: hours.map(() => 24_000),
    },
    daily_units: {
      time: "unixtime",
      weather_code: "wmo code",
      temperature_2m_max: "°C",
      temperature_2m_min: "°C",
      precipitation_probability_max: "%",
      precipitation_sum: "mm",
      sunrise: "unixtime",
      sunset: "unixtime",
      uv_index_max: "",
      wind_speed_10m_max: "km/h",
      wind_direction_10m_dominant: "°",
      daylight_duration: "s",
    },
    daily: {
      time: days.map(toSeconds),
      weather_code: [conditionCode, 3, 61, 80, 1, 0, 45],
      temperature_2m_max: [15.2, 14.1, 12.8, 13.6, 16.3, 17.1, 14.9],
      temperature_2m_min: [7.4, 6.8, 7.9, 8.2, 6.1, 5.7, 8.4],
      precipitation_probability_max: [24, 38, 72, 64, 18, 5, 31],
      precipitation_sum: [0.2, 0.6, 4.8, 2.1, 0.1, 0, 0.4],
      sunrise: days.map((day) => toSeconds(day + 7 * hourMs + 20 * 60_000)),
      sunset: days.map((day) => toSeconds(day + 17 * hourMs + 5 * 60_000)),
      uv_index_max: [3.1, 2.6, 1.9, 2.3, 3.4, 3.6, 2.8],
      wind_speed_10m_max: [24.8, 27.3, 31.6, 29.1, 22.4, 19.7, 25.2],
      wind_direction_10m_dominant: [232, 245, 251, 260, 226, 214, 238],
      daylight_duration: [34_200, 33_900, 33_600, 33_300, 33_100, 32_900, 32_700],
    },
  };
}
