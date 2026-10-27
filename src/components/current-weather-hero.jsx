"use client";

import { ArrowUpRight, CloudRain, ExternalLink, ThermometerSun, Wind } from "lucide-react";
import { WeatherHeroArt } from "@/components/weather-artwork";
import WeatherScene from "@/components/weather-scene";
import { usePreferences } from "@/components/preferences-provider";
import { formatLocalDate, formatFullDateTime, formatTime } from "@/lib/format";
import {
  buildOutlook,
  formatPrecipitation,
  formatTemperature,
  formatWind,
} from "@/lib/weather";

export default function CurrentWeatherHero({ data, location, now }) {
  const { temperatureUnit, windUnit, measurementSystem } = usePreferences();
  const { current, timezone } = data;
  const unitLabel = temperatureUnit === "f" ? "Fahrenheit" : "Celsius";
  const outlook = buildOutlook(data.hourly, current);
  const localDate = formatLocalDate(now, timezone);
  const localTime = formatTime(now, timezone);
  const updated = formatTime(data.fetchedAt, timezone);
  const fetchedAtMs = Number.isFinite(data.fetchedAt) ? data.fetchedAt : null;
  const fetchedAtIso = fetchedAtMs == null ? undefined : new Date(fetchedAtMs).toISOString();
  const precipitation = formatPrecipitation(current.precipitation, measurementSystem);
  const wind = formatWind(current.windSpeed, windUnit);
  const hasRange = Number.isFinite(current.high) && Number.isFinite(current.low);
  const conditionKey = `${current.condition.group}-${current.isDay ? "day" : "night"}`;

  return (
    <section
      aria-labelledby="current-weather-heading"
      className="hero-surface relative flex h-full min-h-[29rem] flex-col overflow-hidden rounded-[1.85rem] p-5 shadow-[var(--shadow-soft)] sm:p-7 md:rounded-[2.4rem] md:p-8 lg:min-h-[32rem] lg:p-9"
    >
      <WeatherScene
        group={current.condition.group}
        isDay={current.isDay}
        intensity="subtle"
      />
      <div aria-hidden="true" className="hero-ambient" />
      <h2 id="current-weather-heading" className="sr-only">
        Current conditions in {location.name}
      </h2>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p
            className="text-[0.66rem] font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--hero-muted)" }}
          >
            Right now
          </p>
          <p className="mt-1 text-sm font-medium" style={{ color: "var(--hero-muted)" }}>
            {localDate} · {localTime}
          </p>
        </div>
        <p
          className="flex items-center gap-1.5 whitespace-nowrap text-[0.68rem] font-medium sm:justify-end sm:text-right"
          style={{ color: "var(--hero-muted)" }}
        >
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{ backgroundColor: "var(--hero-art-detail)" }}
          />
          <span>
            Updated{" "}
            <time dateTime={fetchedAtIso}>{fetchedAtMs == null ? "Unavailable" : updated}</time>
          </span>
          {fetchedAtMs == null ? null : (
            <span className="sr-only"> local time, {formatFullDateTime(fetchedAtMs, timezone)}</span>
          )}
        </p>
      </div>

      <div className="mt-6 grid flex-1 grid-cols-[minmax(0,1fr)_clamp(9rem,33vw,20rem)] items-center gap-1 sm:mt-8 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative z-10 min-w-0">
          <p
            data-testid="current-temperature"
            className="number-tabular relative flex items-start font-display text-[clamp(4.6rem,17.5vw,9.75rem)] font-medium leading-[0.78] tracking-[-0.075em]"
          >
            <span className="sr-only">
              Current temperature{" "}
              {Number.isFinite(current.temperature)
                ? Math.round(
                    temperatureUnit === "f"
                      ? (current.temperature * 9) / 5 + 32
                      : current.temperature,
                  )
                : "unavailable"}{" "}
              degrees {unitLabel}
            </span>
            <span aria-hidden="true">
              {Number.isFinite(current.temperature)
                ? formatTemperature(current.temperature, temperatureUnit)
                : "–"}
            </span>
            <span
              aria-hidden="true"
              className="ml-1 mt-[0.55em] rounded-full border px-1.5 py-0.5 font-sans text-[0.62rem] font-bold tracking-[0.06em] sm:ml-2 sm:text-[0.7rem]"
              style={{ borderColor: "var(--hero-line)", color: "var(--hero-muted)" }}
            >
              {temperatureUnit === "f" ? "F" : "C"}
            </span>
          </p>

          <p className="mt-4 max-w-[18ch] font-display text-[clamp(1.55rem,4vw,2.35rem)] font-medium leading-[1.05] tracking-[-0.04em] sm:mt-5">
            {current.condition.label}
          </p>

          <div
            className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.82rem] font-medium sm:text-sm"
            style={{ color: "var(--hero-muted)" }}
          >
            <span className="inline-flex items-center gap-1.5">
              <ThermometerSun aria-hidden="true" className="size-4 shrink-0" />
              Feels like{" "}
              <span className="font-semibold" style={{ color: "var(--hero-ink)" }}>
                {formatTemperature(current.apparentTemperature, temperatureUnit)}
              </span>
            </span>
            {hasRange ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="font-semibold" style={{ color: "var(--hero-ink)" }}>
                  H {formatTemperature(current.high, temperatureUnit)}
                </span>
                <span aria-hidden="true">/</span>
                <span className="font-semibold" style={{ color: "var(--hero-ink)" }}>
                  L {formatTemperature(current.low, temperatureUnit)}
                </span>
              </span>
            ) : (
              <span>High and low unavailable</span>
            )}
          </div>
        </div>

        <div className="relative -my-2 flex items-center justify-center sm:my-0">
          <div className="hero-art-float mx-auto w-full max-w-[22rem]">
            <WeatherHeroArt
              key={conditionKey}
              group={current.condition.group}
              isDay={current.isDay}
              windSpeed={current.windSpeed}
            />
          </div>
        </div>
      </div>

      <div
        className="mt-5 flex flex-col gap-2.5 border-t pt-4 text-sm sm:flex-row sm:items-center sm:justify-between"
        style={{ borderColor: "var(--hero-line)" }}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p
            className="inline-flex items-center gap-2 font-medium"
            style={{ color: "var(--hero-ink)" }}
          >
            <CloudRain
              aria-hidden="true"
              className="size-4 shrink-0"
              style={{ color: "var(--hero-art-detail)" }}
            />
            {precipitation === "Unavailable"
              ? "Precipitation unavailable"
              : `${precipitation} precipitation now`}
          </p>
          <p
            className="inline-flex items-center gap-1.5 text-[0.8rem] font-medium"
            style={{ color: "var(--hero-muted)" }}
          >
            <Wind aria-hidden="true" className="size-4 shrink-0" />
            {wind === "Unavailable" ? "Wind unavailable" : `${wind} wind`}
          </p>
        </div>
        <p
          className="inline-flex items-center gap-1.5 text-[0.8rem] font-medium"
          style={{ color: "var(--hero-muted)" }}
        >
          <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" />
          {outlook}
        </p>
      </div>

      <p
        className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.66rem] leading-4"
        style={{ color: "var(--hero-muted)" }}
      >
        <span className="font-semibold" style={{ color: "var(--hero-ink)" }}>
          Model forecast
        </span>
        <span aria-hidden="true">·</span>
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex min-h-7 items-center gap-1 font-semibold underline decoration-current/35 underline-offset-2 transition-opacity hover:opacity-80"
          style={{ color: "var(--hero-ink)" }}
        >
          Open-Meteo
          <ExternalLink aria-hidden="true" className="size-2.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <span aria-hidden="true">·</span>
        <span>not an official station observation.</span>
      </p>

      <span className="sr-only">Temperature shown in degrees {unitLabel}.</span>
    </section>
  );
}
