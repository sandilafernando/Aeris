"use client";

import { Cloud, Droplets, Eye, Gauge, ThermometerSun, Wind } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { formatNumber } from "@/lib/format";
import {
  formatTemperature,
  formatVisibility,
  formatWind,
  windDirectionLabel,
} from "@/lib/weather";
import { cn } from "@/lib/utils";

function Metric({ icon: Icon, label, value, supporting, accent = false }) {
  return (
    <div
      className={cn(
        "flex min-h-[5.35rem] flex-col rounded-2xl px-3 py-2.5",
        accent
          ? "bg-primary-container/70 text-on-primary-container"
          : "bg-surface-container/60",
      )}
    >
      <dt
        className={cn(
          "flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.12em]",
          accent ? "text-on-primary-container/80" : "text-muted-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        {label}
      </dt>
      <dd className="mt-1 min-w-0">
        <span className="number-tabular block truncate font-display text-[1.22rem] font-semibold leading-tight tracking-[-0.03em]">
          {value}
        </span>
        <span
          className={cn(
            "mt-0.5 block text-[0.68rem] leading-4",
            accent ? "text-on-primary-container/75" : "text-muted-foreground",
          )}
        >
          {supporting}
        </span>
      </dd>
    </div>
  );
}

export default function Atmosphere({ current }) {
  const { temperatureUnit, windUnit, measurementSystem } = usePreferences();

  const pressure = Number.isFinite(current.pressure)
    ? measurementSystem === "imperial"
      ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(
          current.pressure * 0.02953,
        )} inHg`
      : `${formatNumber(current.pressure)} hPa`
    : "Unavailable";

  const windSupport = [
    windDirectionLabel(current.windDirection),
    Number.isFinite(current.windGust)
      ? `Gusts ${formatWind(current.windGust, windUnit)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className="surface-card flex flex-col p-4 sm:p-5"
      aria-labelledby="atmosphere-heading"
      data-testid="atmosphere-card"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="eyebrow">At a glance</p>
          <h2
            id="atmosphere-heading"
            className="mt-1 font-display text-lg font-semibold tracking-[-0.03em] sm:text-xl"
          >
            Air around you
          </h2>
        </div>
        <span className="text-[0.66rem] font-medium text-muted-foreground">Now</span>
      </div>

      <dl className="mt-3.5 grid grid-cols-2 gap-2">
        <Metric
          icon={ThermometerSun}
          label="Feels like"
          value={formatTemperature(current.apparentTemperature, temperatureUnit)}
          supporting="Apparent temperature"
        />
        <Metric
          icon={Droplets}
          label="Humidity"
          value={Number.isFinite(current.humidity) ? `${formatNumber(current.humidity)}%` : "–"}
          supporting="Relative humidity"
        />
        <Metric
          icon={Wind}
          label="Wind"
          value={formatWind(current.windSpeed, windUnit)}
          supporting={windSupport || "Direction unavailable"}
          accent
        />
        <Metric
          icon={Eye}
          label="Visibility"
          value={formatVisibility(current.visibility, measurementSystem)}
          supporting="Horizontal range"
        />
        <Metric
          icon={Gauge}
          label="Pressure"
          value={pressure}
          supporting="Mean sea level"
        />
        <Metric
          icon={Cloud}
          label="Cloud cover"
          value={Number.isFinite(current.cloudCover) ? `${formatNumber(current.cloudCover)}%` : "–"}
          supporting="Sky coverage"
        />
      </dl>
    </section>
  );
}
