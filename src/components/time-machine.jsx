"use client";

import { AlertTriangle, History, LoaderCircle, RefreshCw } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { useArchiveForecast } from "@/hooks/use-forecast-tools";
import { formatMonthDay, formatWeekdayShort } from "@/lib/format";
import {
  formatPrecipitation,
  formatTemperature,
  formatWind,
  getWeatherCondition,
} from "@/lib/weather";

function dateStamp(date) {
  return Date.parse(`${date}T12:00:00Z`);
}

function SummaryMetric({ label, value, supporting }) {
  return (
    <div className="rounded-2xl bg-surface-container/55 px-3 py-2.5">
      <dt className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-display text-lg font-semibold">
        {value}
        <span className="block font-sans text-[0.62rem] font-normal text-muted-foreground">
          {supporting}
        </span>
      </dd>
    </div>
  );
}

export default function TimeMachine({ location, timezone, now }) {
  const { temperatureUnit, windUnit, measurementSystem } = usePreferences();
  const { status, data, error, refresh } = useArchiveForecast(location, timezone, now);

  if (status === "loading" || status === "idle") {
    return (
      <div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Loading the last seven days from Open-Meteo&apos;s archive…
        </p>
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-14 rounded-2xl bg-surface-container/55" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error" || !Array.isArray(data)) {
    return (
      <div>
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
          <p className="flex items-start gap-2 font-semibold">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-destructive"
            />
            Archive unavailable
          </p>
          <p className="mt-1 text-muted-foreground">
            {error || "The historical dataset could not be loaded."}
          </p>
          <button
            type="button"
            onClick={refresh}
            className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-primary hover:bg-primary-container"
          >
            <RefreshCw aria-hidden="true" className="size-3" />
            Try again
          </button>
        </div>
        <p className="mt-3 text-[0.66rem] leading-4 text-muted-foreground">
          History is optional and separate from the live forecast.
        </p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="rounded-2xl bg-surface-container/50 px-4 py-3 text-sm text-muted-foreground">
        The archive returned no daily records for the last seven days.
      </p>
    );
  }

  const temperatures = data
    .flatMap((day) => [day.temperatureMax, day.temperatureMin])
    .filter(Number.isFinite);
  const globalMin = temperatures.length ? Math.min(...temperatures) : null;
  const globalMax = temperatures.length ? Math.max(...temperatures) : null;
  const span = globalMin != null && globalMax != null ? Math.max(1, globalMax - globalMin) : 1;
  const warmest = data.reduce(
    (best, day) =>
      Number.isFinite(day.temperatureMax) && day.temperatureMax > (best?.temperatureMax ?? -Infinity)
        ? day
        : best,
    null,
  );
  const coolest = data.reduce(
    (best, day) =>
      Number.isFinite(day.temperatureMin) && day.temperatureMin < (best?.temperatureMin ?? Infinity)
        ? day
        : best,
    null,
  );
  const wettest = data.reduce(
    (best, day) =>
      Number.isFinite(day.precipitationSum) &&
      day.precipitationSum > (best?.precipitationSum ?? -Infinity)
        ? day
        : best,
    null,
  );
  const totalRain = data
    .map((day) => day.precipitationSum)
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + value, 0);

  return (
    <div>
      <div className="max-w-[66ch]">
        <p className="eyebrow flex items-center gap-1.5">
          <History aria-hidden="true" className="size-3.5" />
          Last seven days
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold tracking-[-0.03em] sm:text-xl">
          Time machine
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Reanalysis data for the same coordinates. It describes the recent past and is not a
          station observation — official readings can differ.
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryMetric
          label="Warmest"
          value={warmest ? formatTemperature(warmest.temperatureMax, temperatureUnit) : "Unavailable"}
          supporting={warmest ? formatShortDay(warmest.date) : "No daily maximum"}
        />
        <SummaryMetric
          label="Coolest"
          value={coolest ? formatTemperature(coolest.temperatureMin, temperatureUnit) : "Unavailable"}
          supporting={coolest ? formatShortDay(coolest.date) : "No daily minimum"}
        />
        <SummaryMetric
          label="Wettest day"
          value={
            wettest?.precipitationSum == null
              ? "Unavailable"
              : formatPrecipitation(wettest.precipitationSum, measurementSystem)
          }
          supporting={wettest ? formatShortDay(wettest.date) : "No daily total"}
        />
        <SummaryMetric
          label="Seven-day rain"
          value={
            Number.isFinite(totalRain)
              ? formatPrecipitation(totalRain, measurementSystem)
              : "Unavailable"
          }
          supporting="Sum of daily totals"
        />
      </dl>

      <ul className="mt-4 divide-y divide-outline-variant/70 overflow-hidden rounded-2xl border border-outline-variant/70">
        {data.map((day) => {
          const condition = getWeatherCondition(day.weatherCode);
          const stamp = dateStamp(day.date);
          const min = Number.isFinite(day.temperatureMin) ? day.temperatureMin : null;
          const max = Number.isFinite(day.temperatureMax) ? day.temperatureMax : null;
          return (
            <li
              key={day.date}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-card/40 px-3 py-2.5 sm:grid-cols-[7rem_minmax(0,1fr)_7rem_6rem]"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold">{formatWeekdayShort(stamp, "UTC")}</p>
                <p className="text-[0.62rem] text-muted-foreground">
                  {formatMonthDay(stamp, "UTC")}
                </p>
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{condition.shortLabel}</p>
                {min != null && max != null ? (
                  <div className="relative mt-1.5 h-1.5 rounded-full bg-surface-container-high">
                    <div
                      aria-hidden="true"
                      className="absolute inset-y-0 rounded-full bg-primary/55"
                      style={{
                        left: `${((min - globalMin) / span) * 100}%`,
                        right: `${100 - ((max - globalMin) / span) * 100}%`,
                      }}
                    />
                  </div>
                ) : (
                  <p className="mt-1 text-[0.62rem] text-muted-foreground">Range unavailable</p>
                )}
              </div>
              <div className="text-right sm:text-left">
                <p className="number-tabular text-xs font-semibold">
                  {max == null || min == null
                    ? "–"
                    : `${formatTemperature(max, temperatureUnit)} / ${formatTemperature(min, temperatureUnit)}`}
                </p>
                <p className="text-[0.62rem] text-muted-foreground">
                  {day.precipitationSum == null
                    ? "Rain unavailable"
                    : formatPrecipitation(day.precipitationSum, measurementSystem)}
                </p>
              </div>
              <p className="hidden text-right text-[0.62rem] text-muted-foreground sm:block">
                {day.windSpeedMax == null
                  ? "Wind unavailable"
                  : `Max ${formatWind(day.windSpeedMax, windUnit)}`}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[0.62rem] leading-4 text-muted-foreground">
        Archive: Open-Meteo historical reanalysis. It can lag the present by several days and
        does not use Aeris&apos;s live forecast cache.
      </p>
    </div>
  );
}

function formatShortDay(date) {
  const stamp = dateStamp(date);
  return `${formatWeekdayShort(stamp, "UTC")} ${formatMonthDay(stamp, "UTC")}`;
}
