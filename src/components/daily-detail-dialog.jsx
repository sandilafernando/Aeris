"use client";

import {
  CloudRain,
  Droplet,
  Gauge,
  Sunrise,
  Sunset,
  SunMedium,
  Wind,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WeatherLineIcon } from "@/components/weather-artwork";
import { usePreferences } from "@/components/preferences-provider";
import {
  formatDaylightDuration,
  formatMonthDay,
  formatNumber,
  formatTime,
  formatWeekday,
} from "@/lib/format";
import {
  formatPrecipitation,
  formatTemperature,
  formatWind,
  uvIndexLabel,
  windDirectionLabel,
} from "@/lib/weather";
import { cn } from "@/lib/utils";

function DetailRow({ icon: Icon, label, value, supporting }) {
  return (
    <div className="rounded-2xl bg-surface-container/60 px-3.5 py-3">
      <dt className="flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        {label}
      </dt>
      <dd className="mt-1.5 font-display text-[1.02rem] font-semibold leading-snug">
        {value}
        {supporting ? (
          <span className="mt-0.5 block font-sans text-[0.68rem] font-normal leading-4 text-muted-foreground">
            {supporting}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

export default function DailyDetailDialog({ day, timezone, locationName, onClose }) {
  const { temperatureUnit, windUnit, measurementSystem } = usePreferences();
  if (!day) return null;

  const uv = uvIndexLabel(day.uvIndexMax);
  const precipitationChance = Number.isFinite(day.precipitationProbability)
    ? `${formatNumber(day.precipitationProbability)}%`
    : "Unavailable";
  const uvValue = Number.isFinite(day.uvIndexMax)
    ? `${formatNumber(day.uvIndexMax, { maximumFractionDigits: 1 })} · ${uv.label}`
    : "Unavailable";
  const windSupport = `${windDirectionLabel(day.windDirectionDominant)} · daily maximum`;

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent
        showCloseButton
        className="dialog-surface max-h-[min(90dvh,760px)] w-[calc(100%-1rem)] max-w-[34rem] gap-0 overflow-hidden rounded-[1.75rem] border-border bg-popover p-0 sm:w-[calc(100%-2rem)] sm:rounded-[2rem]"
      >
        <div className="max-h-[inherit] overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 sm:px-7 sm:pt-7">
          <DialogHeader className="pr-10">
            <p className="eyebrow">Day outlook</p>
            <DialogTitle className="mt-1 font-display text-[1.7rem] font-semibold tracking-[-0.04em] sm:text-3xl">
              {formatWeekday(day.time, timezone)}
            </DialogTitle>
            <DialogDescription>
              {formatMonthDay(day.time, timezone)} · {locationName}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 flex items-center gap-4 rounded-[1.4rem] border border-outline-variant bg-surface-container/55 p-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-container">
              <WeatherLineIcon
                group={day.condition.group}
                isDay
                className="size-9"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold leading-tight">
                {day.condition.label}
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="number-tabular">
                  <span className="font-semibold text-foreground">
                    {formatTemperature(day.temperatureMax, temperatureUnit)}
                  </span>{" "}
                  high
                </span>
                <span className="number-tabular">
                  <span className="font-semibold text-foreground">
                    {formatTemperature(day.temperatureMin, temperatureUnit)}
                  </span>{" "}
                  low
                </span>
              </p>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2">
            <DetailRow
              icon={Droplet}
              label="Chance of rain"
              value={precipitationChance}
              supporting="Daily maximum"
            />
            <DetailRow
              icon={CloudRain}
              label="Precipitation"
              value={formatPrecipitation(day.precipitationSum, measurementSystem)}
              supporting="Forecast total"
            />
            <DetailRow
              icon={Wind}
              label="Peak wind"
              value={formatWind(day.windSpeedMax, windUnit)}
              supporting={windSupport}
            />
            <DetailRow
              icon={SunMedium}
              label="UV index"
              value={
                <span className="flex flex-wrap items-center gap-1.5">
                  {uvValue}
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      uv.tone === "low" && "bg-primary",
                      uv.tone === "moderate" && "bg-tertiary",
                      (uv.tone === "high" ||
                        uv.tone === "very-high" ||
                        uv.tone === "extreme") &&
                        "bg-destructive",
                    )}
                  />
                </span>
              }
              supporting="Daily maximum"
            />
            <DetailRow
              icon={Sunrise}
              label="Sunrise"
              value={
                Number.isFinite(day.sunrise)
                  ? formatTime(day.sunrise, timezone)
                  : "Unavailable"
              }
            />
            <DetailRow
              icon={Sunset}
              label="Sunset"
              value={
                Number.isFinite(day.sunset)
                  ? formatTime(day.sunset, timezone)
                  : "Unavailable"
              }
            />
            <div className="col-span-2 flex items-center justify-between gap-3 rounded-2xl bg-surface-container/60 px-3.5 py-3">
              <dt className="flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <Gauge aria-hidden="true" className="size-3.5" />
                Daylight
              </dt>
              <dd className="font-display text-sm font-semibold">
                {formatDaylightDuration(day.daylightDuration)}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-[0.7rem] leading-5 text-muted-foreground">
            Daily values are model forecasts for this location&apos;s local day. Times may shift
            when daylight saving changes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
