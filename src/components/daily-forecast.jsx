"use client";

import { memo, useRef, useState } from "react";
import { ChevronRight, Droplet } from "lucide-react";
import DailyDetailDialog from "@/components/daily-detail-dialog";
import { WeatherLineIcon } from "@/components/weather-artwork";
import { usePreferences } from "@/components/preferences-provider";
import { formatShortDate, formatWeekdayShort } from "@/lib/format";
import {
  formatTemperature,
  temperatureRange,
} from "@/lib/weather";
import { cn } from "@/lib/utils";

function DailyForecast({ daily, timezone, locationName }) {
  const { temperatureUnit } = usePreferences();
  const [selectedDay, setSelectedDay] = useState(null);
  const openerRef = useRef(null);
  const range = temperatureRange(daily);

  if (!daily?.length) {
    return (
      <section className="surface-card p-5" aria-labelledby="daily-heading">
        <p className="eyebrow">The week ahead</p>
        <h2
          id="daily-heading"
          className="mt-1 font-display text-xl font-semibold tracking-[-0.03em]"
        >
          Seven-day forecast
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          The daily outlook isn&apos;t available for this location right now.
        </p>
      </section>
    );
  }

  return (
    <section
      className="surface-card p-4 sm:p-5"
      aria-labelledby="daily-heading"
      data-testid="daily-forecast"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <p className="eyebrow">The week ahead</p>
          <h2
            id="daily-heading"
            className="mt-1 font-display text-xl font-semibold tracking-[-0.035em] sm:text-[1.4rem]"
          >
            Seven-day forecast
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">Tap any day for the full picture.</p>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
        {daily.map((day, index) => {
          const label = index === 0 ? "Today" : formatWeekdayShort(day.time, timezone);
          const high = formatTemperature(day.temperatureMax, temperatureUnit);
          const low = formatTemperature(day.temperatureMin, temperatureUnit);
          const probability = Number.isFinite(day.precipitationProbability)
            ? Math.round(day.precipitationProbability)
            : null;

          let barLeft = 0;
          let barWidth = 100;
          if (
            range &&
            Number.isFinite(day.temperatureMin) &&
            Number.isFinite(day.temperatureMax) &&
            range.max > range.min
          ) {
            barLeft = ((day.temperatureMin - range.min) / (range.max - range.min)) * 100;
            barWidth = ((day.temperatureMax - day.temperatureMin) / (range.max - range.min)) * 100;
          }

          const ariaLabel = [
            `${label}, ${formatShortDate(day.time, timezone)}.`,
            `${day.condition.shortLabel}.`,
            probability === null
              ? `${high}, ${low}. Precipitation probability unavailable.`
              : `${high}, ${low}, ${probability}% chance of precipitation.`,
            `High ${high}, low ${low}.`,
            "Open day details.",
          ].join(" ");

          return (
            <li key={day.time}>
              <button
                type="button"
                onClick={(event) => {
                  openerRef.current = event.currentTarget;
                  setSelectedDay(day);
                }}
                aria-haspopup="dialog"
                aria-label={ariaLabel}
                className="group flex h-full min-h-[10.6rem] w-full flex-col rounded-[1.25rem] border border-outline-variant/70 bg-surface-container/40 p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-container/80 hover:shadow-[var(--shadow-soft)] focus-visible:-translate-y-0.5"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold">{label}</span>{" "}
                  <span className="text-[0.64rem] font-medium text-muted-foreground">
                    {formatShortDate(day.time, timezone)}
                  </span>
                </span>

                <span className="mt-3 flex min-h-9 items-center gap-2">
                  <WeatherLineIcon
                    group={day.condition.group}
                    isDay
                    className="size-7 text-primary"
                  />{" "}
                  <span className="line-clamp-2 text-[0.7rem] font-semibold leading-4 text-muted-foreground">
                    {day.condition.shortLabel}
                  </span>
                </span>{" "}

                <span className="mt-auto block pt-3">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="number-tabular font-display text-[1.35rem] font-semibold leading-none tracking-[-0.03em]">
                      {high}
                    </span>{" "}
                    <span className="number-tabular text-xs font-semibold text-muted-foreground">
                      {low}
                    </span>
                  </span>{" "}
                  <span className="relative mt-2.5 block h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
                    <span
                      className={cn(
                        "absolute inset-y-0 rounded-full",
                        range ? "bg-primary/75" : "bg-outline",
                      )}
                      style={{
                        left: `${barLeft}%`,
                        width: `${Math.max(barWidth, 8)}%`,
                      }}
                    />
                  </span>

                  <span className="mt-2 flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-[0.65rem] font-semibold text-muted-foreground",
                        probability === null && "opacity-0",
                      )}
                      aria-hidden="true"
                    >
                      <Droplet className="size-2.5 shrink-0" />
                      {probability === null ? "0%" : `${probability}%`}
                    </span>{" "}
                    <ChevronRight
                      aria-hidden="true"
                      className="size-3.5 text-muted-foreground opacity-50 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <DailyDetailDialog
        day={selectedDay}
        timezone={timezone}
        locationName={locationName}
        onClose={() => setSelectedDay(null)}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (openerRef.current?.isConnected) openerRef.current.focus();
        }}
      />
    </section>
  );
}

export default memo(DailyForecast);
