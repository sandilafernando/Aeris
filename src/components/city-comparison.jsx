"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowRight, Check, CloudRain, LoaderCircle, MapPinned } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import { useWeather } from "@/hooks/use-weather";
import { formatNumber } from "@/lib/format";
import { formatTemperature } from "@/lib/weather";
import { placeKey } from "@/lib/storage";
import { cn } from "@/lib/utils";

function ComparisonCard({ place, active, baseline, onSelectPlace }) {
  const { temperatureUnit } = usePreferences();
  const weather = useWeather(place);
  const current = weather.data?.current;
  const delta =
    current && baseline && Number.isFinite(current.temperature) && Number.isFinite(baseline.temperature)
      ? Math.round(current.temperature - baseline.temperature)
      : null;
  const rainChances = weather.data?.hourly?.length
    ? weather.data.hourly
        .slice(0, 6)
        .map((hour) => hour.precipitationProbability)
        .filter(Number.isFinite)
    : [];
  const rainChance = rainChances.length ? Math.max(...rainChances) : null;

  return (
    <article
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border p-3.5",
        active
          ? "border-primary/35 bg-primary-container/35"
          : "border-outline-variant/70 bg-surface-container/35",
      )}
      aria-current={active ? "true" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate font-display text-sm font-semibold tracking-[-0.02em]">
            {place.name}
          </h4>
          <p className="truncate text-[0.62rem] text-muted-foreground">
            {[place.admin1, place.country].filter(Boolean).join(" · ") || "Saved place"}
          </p>
        </div>
        {active ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-primary-foreground">
            <Check aria-hidden="true" className="size-2.5" />
            Active
          </span>
        ) : null}
      </div>

      {weather.status === "loading" || weather.status === "idle" ? (
        <p className="mt-4 flex items-center gap-1.5 text-[0.68rem] text-muted-foreground">
          <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
          Loading current conditions…
        </p>
      ) : weather.status === "error" ? (
        <div className="mt-3 text-[0.68rem] leading-4">
          <p className="flex items-start gap-1.5 font-semibold">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-3 shrink-0 text-destructive"
            />
            Unavailable
          </p>
          <p className="mt-0.5 text-muted-foreground">{weather.error?.message}</p>
          <button
            type="button"
            onClick={weather.refresh}
            className="mt-1 min-h-7 rounded-full px-2 text-[0.66rem] font-semibold text-primary hover:bg-primary-container"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-end justify-between gap-2">
            <p className="font-display text-[1.75rem] font-medium leading-none tracking-[-0.05em]">
              {formatTemperature(current.temperature, temperatureUnit)}
            </p>
            {delta != null && active === false ? (
              <p className="mb-0.5 text-right text-[0.62rem] leading-3 text-muted-foreground">
                <span className="block font-semibold text-foreground">
                  {delta > 0 ? "+" : ""}
                  {delta}°
                </span>
                vs active
              </p>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[0.7rem] font-medium text-muted-foreground">
            {current.condition?.shortLabel || "Condition unavailable"}
          </p>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1 text-[0.62rem]">
            <div>
              <dt className="inline text-muted-foreground">High/low </dt>
              <dd className="inline font-semibold">
                {formatTemperature(current.high, temperatureUnit)} /{" "}
                {formatTemperature(current.low, temperatureUnit)}
              </dd>
            </div>
            <div className="flex items-center gap-1">
              <CloudRain aria-hidden="true" className="size-2.5 shrink-0 text-primary" />
              <dt className="sr-only">Rain chance next six hours</dt>
              <dd className="font-semibold">
                {rainChance == null ? "Rain unavailable" : `${formatNumber(rainChance)}% rain`}
              </dd>
            </div>
          </dl>
        </>
      )}

      {!active && onSelectPlace ? (
        <button
          type="button"
          onClick={() => onSelectPlace(place)}
          className="mt-3 inline-flex min-h-8 items-center justify-center gap-1 rounded-full bg-card/80 px-2.5 text-[0.66rem] font-semibold text-foreground ring-1 ring-outline-variant/70 hover:bg-card"
        >
          Show this place
          <ArrowRight aria-hidden="true" className="size-3" />
        </button>
      ) : null}
    </article>
  );
}

export default function CityComparison({
  currentLocation,
  savedLocations = [],
  currentWeather,
  onSelectPlace,
}) {
  const places = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const place of [currentLocation, ...savedLocations]) {
      if (!place) continue;
      const key = placeKey(place);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(place);
      if (list.length >= 4) break;
    }
    return list;
  }, [currentLocation, savedLocations]);

  return (
    <div>
      <div className="max-w-[66ch]">
        <p className="eyebrow flex items-center gap-1.5">
          <MapPinned aria-hidden="true" className="size-3.5" />
          Same moment
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold tracking-[-0.03em] sm:text-xl">
          Compare your places
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Current conditions for up to four saved places, from separate Open-Meteo requests.
          Differences reflect each place&apos;s local weather, not a ranking.
        </p>
      </div>

      {places.length <= 1 ? (
        <p className="mt-4 rounded-2xl bg-surface-container/50 px-4 py-3 text-sm text-muted-foreground">
          Save another place from the location menu to compare it here. Current-location data
          stays session-only.
        </p>
      ) : (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {places.map((place) => (
            <ComparisonCard
              key={placeKey(place)}
              place={place}
              active={placeKey(place) === placeKey(currentLocation)}
              baseline={currentWeather?.current}
              onSelectPlace={onSelectPlace}
            />
          ))}
        </div>
      )}

      <p className="mt-3 text-[0.62rem] leading-4 text-muted-foreground">
        Active place is included first. Rain chance is the highest hourly probability in the
        next six hours; it is not a promise that rain will or will not occur.
      </p>
    </div>
  );
}
