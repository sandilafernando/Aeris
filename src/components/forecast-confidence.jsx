"use client";

import { AlertTriangle, Gauge, Info, LoaderCircle, RefreshCw } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { useEnsembleForecast } from "@/hooks/use-forecast-tools";
import { formatNumber, formatTime } from "@/lib/format";
import { formatTemperature } from "@/lib/weather";
import { cn } from "@/lib/utils";

const AGREEMENT_STYLES = {
  "very-high": "bg-primary-container text-on-primary-container",
  high: "bg-primary-container text-on-primary-container",
  moderate: "bg-tertiary-container text-on-tertiary-container",
  low: "bg-destructive/10 text-destructive",
};

function Chart({ rows, timezone, temperatureUnit }) {
  const visible = rows.slice(0, 24);
  if (!visible.length) return null;

  const globalMin = Math.min(...visible.map((row) => row.min));
  const globalMax = Math.max(...visible.map((row) => row.max));
  const span = Math.max(0.5, globalMax - globalMin);

  return (
    <div className="mt-4 rounded-2xl border border-outline-variant/70 bg-card/45 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.13em] text-muted-foreground">
          Temperature range by hour
        </p>
        <p className="text-[0.62rem] text-muted-foreground">Ensemble min–max</p>
      </div>
      <div
        className="mt-3 flex h-32 items-stretch gap-1"
        role="img"
        aria-label={`Ensemble temperature range for the next ${visible.length} hours. The coldest member reaches ${formatTemperature(globalMin, temperatureUnit)} and the warmest ${formatTemperature(globalMax, temperatureUnit)}.`}
      >
        {visible.map((row) => {
          const bottom = ((row.min - globalMin) / span) * 100;
          const height = Math.max(4, ((row.max - row.min) / span) * 100);
          const mean = ((row.mean - globalMin) / span) * 100;
          return (
            <div key={row.timeMs} className="relative min-w-0 flex-1">
              <div
                aria-hidden="true"
                className="absolute inset-x-[15%] rounded-full bg-primary/22"
                style={{ bottom: `${bottom}%`, height: `${height}%` }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-x-[30%] h-px bg-primary"
                style={{ bottom: `${mean}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.6rem] text-muted-foreground">
        <span>{formatTime(visible[0].timeMs, timezone)}</span>
        <span>Mean shown as a line</span>
        <span>{formatTime(visible[visible.length - 1].timeMs, timezone)}</span>
      </div>
    </div>
  );
}

export default function ForecastConfidence({ location, timezone }) {
  const { temperatureUnit } = usePreferences();
  const { status, data, error, refresh } = useEnsembleForecast(location);
  const summary = data?.summary;

  if (status === "loading" || status === "idle") {
    return (
      <div>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Loading the 31-member GFS ensemble…
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-20 rounded-2xl bg-surface-container/55" />
          ))}
        </div>
        <p className="mt-3 text-[0.66rem] leading-4 text-muted-foreground">
          This requests an ensemble forecast for the same coordinates. It is a separate
          Open-Meteo endpoint, used only for uncertainty.
        </p>
      </div>
    );
  }

  if (status === "error" || !summary) {
    return (
      <div>
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm">
          <p className="flex items-start gap-2 font-semibold">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-destructive"
            />
            Ensemble forecast unavailable
          </p>
          <p className="mt-1 text-muted-foreground">
            {error || "Open-Meteo did not return enough ensemble members for this place."}
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
          Confidence is optional. The main forecast above does not depend on this dataset.
        </p>
      </div>
    );
  }

  const peak = data.rows.reduce(
    (best, row) => (row.spread > best.spread ? row : best),
    data.rows[0],
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[62ch]">
          <p className="eyebrow">Model agreement</p>
          <h3 className="mt-1 font-display text-lg font-semibold tracking-[-0.03em] sm:text-xl">
            How confident is this forecast?
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {summary.memberCount} GFS ensemble members, compared over the next{" "}
            {summary.hourCount} hours. A narrow spread means the members tell a similar
            story — not a guarantee that the forecast is right.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.1em]",
            AGREEMENT_STYLES[summary.agreement] || AGREEMENT_STYLES.low,
          )}
        >
          <Gauge aria-hidden="true" className="size-3" />
          {summary.agreementLabel}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl bg-surface-container/55 px-3 py-2.5">
          <dt className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Members
          </dt>
          <dd className="mt-1 font-display text-lg font-semibold">{summary.memberCount}</dd>
        </div>
        <div className="rounded-2xl bg-surface-container/55 px-3 py-2.5">
          <dt className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Mean spread
          </dt>
          <dd className="mt-1 font-display text-lg font-semibold">
            {formatNumber(summary.meanSpread, { maximumFractionDigits: 1 })}°
          </dd>
          <dd className="text-[0.62rem] text-muted-foreground">Across all hours</dd>
        </div>
        <div className="rounded-2xl bg-surface-container/55 px-3 py-2.5">
          <dt className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Widest spread
          </dt>
          <dd className="mt-1 font-display text-lg font-semibold">
            {formatNumber(peak.spread, { maximumFractionDigits: 1 })}°
          </dd>
          <dd className="text-[0.62rem] text-muted-foreground">
            {formatTime(peak.timeMs, timezone || "UTC")}
          </dd>
        </div>
        <div className="rounded-2xl bg-surface-container/55 px-3 py-2.5">
          <dt className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Range now
          </dt>
          <dd className="mt-1 font-display text-lg font-semibold">
            {formatTemperature(data.rows[0].mean, temperatureUnit)}
          </dd>
          <dd className="text-[0.62rem] text-muted-foreground">Ensemble mean</dd>
        </div>
      </dl>

      <Chart rows={data.rows} timezone={timezone || "UTC"} temperatureUnit={temperatureUnit} />

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-container/45 px-3 py-2.5 text-[0.66rem] leading-4 text-muted-foreground">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Based on Open-Meteo&apos;s GFS ensemble. Aeris compares member temperatures; it does
          not turn spread into a probability. Larger spread usually means more uncertainty
          about timing or air mass, especially beyond 48 hours.
        </p>
      </div>
    </div>
  );
}
