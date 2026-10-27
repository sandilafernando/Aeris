"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Droplet } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { WeatherLineIcon } from "@/components/weather-artwork";
import { usePreferences } from "@/components/preferences-provider";
import { formatHour } from "@/lib/format";
import { formatTemperature } from "@/lib/weather";
import { cn } from "@/lib/utils";

function HourlyForecast({ hourly, timezone, locationName }) {
  const { temperatureUnit } = usePreferences();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    const maxScroll = node.scrollWidth - node.clientWidth;
    setCanScrollLeft(node.scrollLeft > 4);
    setCanScrollRight(maxScroll - node.scrollLeft > 4);
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return undefined;
    updateScrollState();
    node.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState, hourly.length]);

  const scroll = (direction) => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = Math.max(240, node.clientWidth * 0.75) * direction;
    node.scrollBy({ left: distance, behavior: reduceMotion ? "auto" : "smooth" });
  };

  if (!hourly?.length) {
    return (
      <section className="surface-card p-5" aria-labelledby="hourly-heading">
        <p className="eyebrow">Hour by hour</p>
        <h2
          id="hourly-heading"
          className="mt-1 font-display text-xl font-semibold tracking-[-0.03em]"
        >
          Next 24 hours
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Hourly detail isn&apos;t available for this location right now.
        </p>
      </section>
    );
  }

  return (
    <section
      className="surface-card flex h-full flex-col p-4 sm:p-5"
      aria-labelledby="hourly-heading"
      data-testid="hourly-forecast"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div>
          <p className="eyebrow">Hour by hour</p>
          <h2
            id="hourly-heading"
            className="mt-1 font-display text-xl font-semibold tracking-[-0.035em] sm:text-[1.4rem]"
          >
            Next 24 hours
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Local time in {locationName} · {hourly.length} hourly steps
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden text-[0.68rem] text-muted-foreground sm:inline">
            Scroll
          </span>
          <button
            type="button"
            onClick={() => scroll(-1)}
            disabled={!canScrollLeft}
            aria-label="Scroll hourly forecast backwards"
            className="grid size-9 place-items-center rounded-full border border-outline-variant bg-card text-foreground transition-colors hover:bg-surface-container-high disabled:opacity-35"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            disabled={!canScrollRight}
            aria-label="Scroll hourly forecast forwards"
            className="grid size-9 place-items-center rounded-full border border-outline-variant bg-card text-foreground transition-colors hover:bg-surface-container-high disabled:opacity-35"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      <ol
        ref={scrollRef}
        tabIndex={0}
        aria-label={`Hourly forecast for ${locationName}. Scroll horizontally for all ${hourly.length} hours.`}
        className="hourly-scroll -mx-1 mt-4 flex flex-1 snap-x items-stretch gap-2 overflow-x-auto px-1 py-1 pb-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card"
      >
        {hourly.map((hour, index) => {
          const isNow = index === 0;
          const probability = Number.isFinite(hour.precipitationProbability)
            ? Math.round(hour.precipitationProbability)
            : null;
          return (
            <li
              key={hour.time}
              data-condition={hour.condition.group}
              className={cn(
                "hour-tile relative flex min-h-[7.65rem] w-[4.85rem] shrink-0 snap-start flex-col items-center justify-between rounded-2xl border px-2 py-3 sm:w-[5.35rem]",
                isNow
                  ? "border-primary/25 bg-primary-container/75 text-on-primary-container"
                  : "border-outline-variant/65 bg-surface-container/45",
              )}
            >
              <time
                dateTime={new Date(hour.time).toISOString()}
                className="text-[0.7rem] font-bold tracking-[0.01em]"
              >
                {isNow ? "Now" : formatHour(hour.time, timezone)}
              </time>
              <span className="hour-icon mt-2 inline-flex will-change-transform">
                <WeatherLineIcon group={hour.condition.group} isDay={hour.isDay} className="size-7" />
              </span>
              <span className="number-tabular mt-1.5 font-display text-[1.2rem] font-semibold leading-none">
                {formatTemperature(hour.temperature, temperatureUnit)}
              </span>
              <span
                className={cn(
                  "mt-1.5 flex items-center gap-0.5 text-[0.66rem] font-semibold",
                  isNow ? "text-on-primary-container/80" : "text-muted-foreground",
                  probability === null && "opacity-0",
                )}
                aria-hidden="true"
              >
                <Droplet className="size-2.5 shrink-0" />
                {probability === null ? "0%" : `${probability}%`}
              </span>
              <span className="sr-only">
                {hour.condition.label}, {formatTemperature(hour.temperature, temperatureUnit, { withUnit: true })},{" "}
                {probability === null
                  ? "precipitation probability unavailable"
                  : `${probability}% chance of precipitation`}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default memo(HourlyForecast);
