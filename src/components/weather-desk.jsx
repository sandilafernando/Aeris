"use client";

import { useRef, useState } from "react";
import {
  Bike,
  CalendarRange,
  CloudRain,
  Droplets,
  Footprints,
  Gauge,
  History,
  MapPinned,
  Umbrella,
  UtensilsCrossed,
} from "lucide-react";
import ForecastConfidence from "@/components/forecast-confidence";
import TimeMachine from "@/components/time-machine";
import CityComparison from "@/components/city-comparison";
import { WeatherLineIcon } from "@/components/weather-artwork";
import { formatNumber, formatTime, localDateKey } from "@/lib/format";
import { buildActivityGuidance, buildRainIntelligence } from "@/lib/insights";
import { formatPrecipitation } from "@/lib/weather";
import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "plan", label: "Plan", icon: CalendarRange },
  { id: "rain", label: "Rain", icon: CloudRain },
  { id: "confidence", label: "Spread", icon: Gauge },
  { id: "archive", label: "History", icon: History },
  { id: "compare", label: "Compare", icon: MapPinned },
];

const ACTIVITY_ICONS = {
  run: Footprints,
  cycle: Bike,
  dine: UtensilsCrossed,
};

const STATUS_STYLES = {
  good: {
    label: "Good window",
    chip: "bg-primary-container text-on-primary-container",
    dot: "bg-primary",
  },
  fair: {
    label: "Fair window",
    chip: "bg-tertiary-container text-on-tertiary-container",
    dot: "bg-tertiary",
  },
  limited: {
    label: "Limited",
    chip: "bg-surface-container-high text-muted-foreground",
    dot: "bg-outline",
  },
};

function PanelHeading({ eyebrow, title, description }) {
  return (
    <div className="max-w-[70ch]">
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="mt-1 font-display text-lg font-semibold tracking-[-0.03em] sm:text-xl">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

function TimeRange({ start, hours, timezone }) {
  if (!Number.isFinite(start) || !hours) return "No clear window";
  const end = start + hours * 3_600_000;
  return `${formatTime(start, timezone)} – ${formatTime(end, timezone)}`;
}

/**
 * A 24-hour window crosses midnight, so a bare clock time can point at the
 * wrong day. Name the day whenever it is not today, in the location's timezone
 * rather than the device's.
 */
function formatMoment(timestamp, timezone, now) {
  const time = formatTime(timestamp, timezone);
  if (!Number.isFinite(timestamp) || !Number.isFinite(now) || now <= 0) return time;
  const today = localDateKey(now, timezone);
  const day = localDateKey(timestamp, timezone);
  if (!today || !day) return time;
  if (day === today) return `Today ${time}`;
  if (day === localDateKey(now + 86_400_000, timezone)) return `Tomorrow ${time}`;
  return time;
}

function BriefStat({ icon: Icon, label, value, supporting }) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-xl border border-outline-variant/50 bg-card/55 px-2.5 py-2">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-card/90 text-primary shadow-sm">
        <Icon aria-hidden="true" className="size-3" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.56rem] font-bold uppercase leading-3 tracking-[0.1em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[0.8rem] font-semibold leading-4">{value}</p>
        <p className="truncate text-[0.6rem] leading-4 text-muted-foreground">{supporting}</p>
      </div>
    </div>
  );
}

/**
 * The desk opens with a short, data-derived brief. It is computed from the same
 * forecast as the panels, so it cannot drift from them, and it never claims a
 * dry window that the hourly probabilities do not support.
 */
function DeskBrief({ data, now }) {
  const { measurementSystem } = usePreferences();
  const guidance = buildActivityGuidance(data.hourly, now);
  const rain = buildRainIntelligence(data.hourly, now);
  const best =
    guidance.find((activity) => activity.status === "good") ||
    guidance.find((activity) => activity.status === "fair") ||
    null;

  return (
    <div className="relative mt-3 grid gap-2 sm:grid-cols-3">
      <BriefStat
        icon={CloudRain}
        label="Rain peak"
        value={
          rain.maxProbability == null ? "Unavailable" : `${formatNumber(rain.maxProbability)}%`
        }
        supporting={
          rain.peakProbabilityTime
            ? formatMoment(rain.peakProbabilityTime, data.timezone, now)
            : "No peak hour"
        }
      />
      <BriefStat
        icon={Footprints}
        label="Best outdoor window"
        value={
          best
            ? TimeRange({
                start: best.windowStart,
                hours: best.windowLength,
                timezone: data.timezone,
              })
            : "No strong window"
        }
        supporting={best ? best.label : "Every activity is limited"}
      />
      <BriefStat
        icon={Umbrella}
        label="Expected rain"
        value={
          rain.totalMm == null
            ? "Unavailable"
            : formatPrecipitation(rain.totalMm, measurementSystem)
        }
        supporting="Next 24 hours"
      />
    </div>
  );
}

function PlanPanel({ data, now }) {
  const { temperatureUnit } = usePreferences();
  const guidance = buildActivityGuidance(data.hourly, now);

  return (
    <div>
      <PanelHeading
        eyebrow="Outdoor comfort"
        title="When to head outside"
        description="Aeris checks the next 12 forecast hours against temperature, rain, wind and UV thresholds. These are comfort rules, not safety advice."
      />

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {guidance.map((activity, index) => {
          const Icon = ACTIVITY_ICONS[activity.icon] || CalendarRange;
          const status = STATUS_STYLES[activity.status] || STATUS_STYLES.limited;
          return (
            <article
              key={activity.key}
              className="desk-card-enter group relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border border-outline-variant/70 bg-gradient-to-br from-surface-container/70 via-card/60 to-surface-container/35 p-3.5 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_14px_30px_-24px_var(--primary)]"
              style={{ animationDelay: `${index * 65}ms` }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-7 -top-7 -z-10 size-20 rounded-full bg-primary-container/35 blur-xl transition-transform duration-500 group-hover:scale-125"
              />
              <div className="relative flex items-start justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-full bg-card/90 text-primary shadow-sm transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em]",
                    status.chip,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("size-1.5 rounded-full", status.dot)}
                  />
                  {status.label}
                </span>
              </div>
              <h4 className="mt-2.5 font-display text-base font-semibold tracking-[-0.02em]">
                {activity.label}
              </h4>
              <p className="mt-1 text-xs font-semibold">
                {activity.status === "limited"
                  ? "No strong window"
                  : TimeRange({
                      start: activity.windowStart,
                      hours: activity.windowLength,
                      timezone: data.timezone,
                    })}
              </p>
              <p className="mt-1 text-[0.68rem] leading-4 text-muted-foreground">
                {activity.reason}
              </p>
              <p className="mt-2 border-t border-outline-variant/70 pt-2 text-[0.62rem] leading-4 text-muted-foreground">
                {activity.criteria}
              </p>
            </article>
          );
        })}
      </div>

      <p className="mt-3 text-[0.66rem] leading-4 text-muted-foreground">
        Temperatures are shown in {temperatureUnit === "f" ? "Fahrenheit" : "Celsius"} across
        the app; thresholds are evaluated in Celsius. Official warnings always take priority
        over these suggestions.
      </p>
    </div>
  );
}

function RainPanel({ data, now }) {
  const { measurementSystem } = usePreferences();
  const rain = buildRainIntelligence(data.hourly, now);
  const probabilityMax = Math.max(
    10,
    ...rain.hours
      .map((hour) => hour.precipitationProbability)
      .filter((value) => Number.isFinite(value)),
  );

  return (
    <div>
      <PanelHeading
        eyebrow="Next 24 hours"
        title="Rain intelligence"
        description="Model precipitation amount and chance, hour by hour. Bars show the forecast chance of any precipitation; the line above each bar is not a radar echo."
      />

      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-outline-variant/50 bg-gradient-to-br from-surface-container/80 to-card/40 px-3 py-2.5 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/25">
          <dt className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Expected total
          </dt>
          <dd className="mt-1 font-display text-lg font-semibold">
            {rain.totalMm == null
              ? "Unavailable"
              : formatPrecipitation(rain.totalMm, measurementSystem)}
          </dd>
        </div>
        <div className="rounded-2xl border border-outline-variant/50 bg-gradient-to-br from-surface-container/80 to-card/40 px-3 py-2.5 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/25">
          <dt className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Peak chance
          </dt>
          <dd className="mt-1 font-display text-lg font-semibold">
            {rain.maxProbability == null
              ? "Unavailable"
              : `${formatNumber(rain.maxProbability)}%`}
          </dd>
        </div>
        <div className="rounded-2xl border border-outline-variant/50 bg-gradient-to-br from-surface-container/80 to-card/40 px-3 py-2.5 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/25">
          <dt className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Peak hour
          </dt>
          <dd className="mt-1 font-display text-lg font-semibold">
            {rain.peakTime ? formatMoment(rain.peakTime, data.timezone, now) : "None"}
          </dd>
          <dd className="text-[0.62rem] text-muted-foreground">
            {rain.peakMm == null ? "No amount" : formatPrecipitation(rain.peakMm, measurementSystem)}
          </dd>
        </div>
        <div className="rounded-2xl border border-outline-variant/50 bg-gradient-to-br from-surface-container/80 to-card/40 px-3 py-2.5 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/25">
          <dt className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Driest stretch
          </dt>
          <dd className="mt-1 font-display text-lg font-semibold">
            {rain.dryWindowLength
              ? `${rain.dryWindowLength} h`
              : "No dry stretch"}
          </dd>
          <dd className="text-[0.62rem] text-muted-foreground">
            {rain.dryWindowStart
              ? `From ${formatMoment(rain.dryWindowStart, data.timezone, now)}`
              : "Chance stays elevated"}
          </dd>
        </div>
      </dl>

      {rain.hours.length ? (
        <div className="mt-4 rounded-2xl border border-outline-variant/70 bg-gradient-to-b from-card/70 to-secondary-container/25 px-3 pb-2 pt-3">
          <div
            className="flex h-28 items-end gap-1"
            role="img"
            aria-label={`Hourly precipitation chance for the next ${rain.hours.length} hours, peaking at ${rain.maxProbability == null ? "an unavailable value" : `${Math.round(rain.maxProbability)} percent`}.`}
          >
            {rain.hours.map((hour) => {
              const chance = Number.isFinite(hour.precipitationProbability)
                ? hour.precipitationProbability
                : 0;
              return (
                <div
                  key={hour.timeMs}
                  className="group relative flex h-full min-w-0 flex-1 items-end"
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      "w-full rounded-t-[0.3rem] transition-[height,background-color] duration-300",
                      chance >= 60
                        ? "bg-primary"
                        : chance >= 30
                          ? "bg-primary/60"
                          : "bg-primary/25",
                    )}
                    style={{ height: `${Math.max(3, (chance / probabilityMax) * 100)}%` }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-popover px-1.5 py-1 text-[0.6rem] text-popover-foreground shadow-sm ring-1 ring-border group-hover:block">
                    {formatTime(hour.timeMs, data.timezone)} · {Math.round(chance)}%
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[0.6rem] text-muted-foreground">
            <span>{formatTime(rain.hours[0].timeMs, data.timezone)}</span>
            <span>Now → +24 h</span>
            <span>{formatTime(rain.hours[rain.hours.length - 1].timeMs, data.timezone)}</span>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-surface-container/50 px-3 py-3 text-xs text-muted-foreground">
          Hourly precipitation data is unavailable for this forecast.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.66rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Droplets aria-hidden="true" className="size-3" />
          {rain.wetHours == null
            ? "Wet-hour count unavailable"
            : `${rain.wetHours} hour${rain.wetHours === 1 ? "" : "s"} at or above 0.1 mm`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Umbrella aria-hidden="true" className="size-3" />
          Amount and chance are separate fields and can disagree.
        </span>
      </div>
    </div>
  );
}

export default function WeatherDesk({ data, location, savedLocations = [], now, onSelectPlace }) {
  const [active, setActive] = useState("plan");
  const tabRefs = useRef([]);

  function onKeyDown(event) {
    const currentIndex = TABS.findIndex((tab) => tab.id === active);
    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    setActive(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  const condition = data.current?.condition?.group || "partly";
  const isDay = data.current?.isDay ?? true;

  return (
    <section
      className="surface-card relative min-w-0 overflow-hidden bg-gradient-to-br from-card/95 via-card/90 to-secondary-container/20 p-4 sm:p-5"
      aria-labelledby="weather-desk-heading"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-primary-container/35 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -left-16 size-52 rounded-full bg-tertiary-container/20 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
      />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-outline-variant/60 bg-card/75 text-primary shadow-sm">
            <WeatherLineIcon group={condition} isDay={isDay} className="size-7" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Weather desk</p>
            <h2
              id="weather-desk-heading"
              className="mt-1 font-display text-xl font-semibold tracking-[-0.035em] sm:text-2xl"
            >
              Make sense of the forecast
            </h2>
          </div>
        </div>
        <p className="max-w-[36ch] text-[0.68rem] leading-4 text-muted-foreground sm:text-right">
          Five local tools from the same Open-Meteo forecast. All times are{" "}
          {data.timezone || "local"}.
        </p>
      </div>

      <DeskBrief data={data} now={now} />

      <div
        role="tablist"
        aria-label="Weather desk tools"
        onKeyDown={onKeyDown}
        className="relative mt-4 flex gap-1 overflow-x-auto rounded-[1.2rem] border border-outline-variant/60 bg-surface-container/55 p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.035)]"
      >
        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`desk-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`desk-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.id)}
              className={cn(
                "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-[0.7rem] font-semibold transition-[background-color,color,box-shadow,transform] duration-200 sm:px-3.5",
                selected
                  ? "bg-gradient-to-br from-card to-primary-container/30 text-foreground shadow-[0_2px_0_rgba(0,0,0,0.035),0_8px_20px_-16px_var(--primary)]"
                  : "text-muted-foreground hover:-translate-y-px hover:bg-card/60 hover:text-foreground",
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "size-3.5 shrink-0 transition-transform duration-200",
                  selected && "scale-110",
                )}
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        key={active}
        role="tabpanel"
        id={`desk-panel-${active}`}
        aria-labelledby={`desk-tab-${active}`}
        tabIndex={0}
        className="desk-panel-enter relative mt-4 rounded-[1.35rem] border border-outline-variant/55 bg-gradient-to-br from-card/70 via-card/45 to-surface-container/25 p-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
      >
        {active === "plan" ? <PlanPanel data={data} now={now} /> : null}
        {active === "rain" ? <RainPanel data={data} now={now} /> : null}
        {active === "confidence" ? (
          <ForecastConfidence location={location} timezone={data.timezone} />
        ) : null}
        {active === "archive" ? (
          <TimeMachine location={location} timezone={data.timezone} now={now} />
        ) : null}
        {active === "compare" ? (
          <CityComparison
            currentLocation={location}
            savedLocations={savedLocations}
            currentWeather={data}
            onSelectPlace={onSelectPlace}
          />
        ) : null}
      </div>
    </section>
  );
}
