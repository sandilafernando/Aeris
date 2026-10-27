"use client";

import { useCallback, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Cloud,
  CloudOff,
  CloudRain,
  Droplets,
  ExternalLink,
  Eye,
  Gauge,
  LoaderCircle,
  LocateFixed,
  MapPin,
  RefreshCw,
  SlidersHorizontal,
  Thermometer,
  ThermometerSun,
  Umbrella,
  Wind,
} from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import StationSelect from "@/components/station-select";
import { useMetarObservations, useMeteoJson } from "@/hooks/use-official-source";
import { formatNumber, formatShortDate, formatTime, relativeElapsedLabel } from "@/lib/format";
import {
  GLANCE_METRIC_IDS,
  GLANCE_METRIC_LABELS,
  MAX_GLANCE_METRICS,
  buildGlanceView,
  normalizeGlanceMetrics,
  normalizeGlanceSource,
  stationOptionsForSource,
} from "@/lib/glance";
import { requestCurrentPlace, geolocationErrorMessage } from "@/lib/geolocation";
import { AUTOMATIC_STATION_ID } from "@/lib/station-selection";
import {
  convertTemperature,
  formatVisibility,
  formatWind,
  windDirectionLabel,
} from "@/lib/weather";
import { cn } from "@/lib/utils";

const COLOMBO_TIME_ZONE = "Asia/Colombo";

const SOURCE_OPTIONS = [
  { value: "dom", label: "DoM", title: "Department of Meteorology stations" },
  { value: "metar", label: "Airports", title: "NOAA AWC airport METAR reports" },
  { value: "combined", label: "Both", title: "DoM and airport reports, side by side" },
];

const METRIC_ICONS = {
  temperature: Thermometer,
  humidity: Droplets,
  rainfall: Umbrella,
  rainfallTotal: CloudRain,
  wind: Wind,
  pressure: Gauge,
  dewPoint: ThermometerSun,
  visibility: Eye,
  cloud: Cloud,
};

const MODEL_METRICS = new Set([
  "temperature",
  "humidity",
  "rainfall",
  "wind",
  "pressure",
  "visibility",
  "cloud",
]);

function capitalise(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function temperatureValue(valueC, unit) {
  const converted = convertTemperature(valueC, unit);
  if (!Number.isFinite(converted)) return "Unavailable";
  return `${formatNumber(converted, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}°${unit === "f" ? "F" : "C"}`;
}

function percentValue(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  return `${formatNumber(value)}%`;
}

function rainfallValue(valueMm, trace) {
  if (trace) return "Trace";
  if (!Number.isFinite(valueMm)) return "Unavailable";
  return `${formatNumber(valueMm, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} mm`;
}

function pressureValue(valueHpa, measurementSystem) {
  if (!Number.isFinite(valueHpa)) return "Unavailable";
  if (measurementSystem === "imperial") {
    return `${formatNumber(valueHpa * 0.02953, {
      maximumFractionDigits: 2,
    })} inHg`;
  }
  return `${formatNumber(valueHpa)} hPa`;
}

function observationMoment(iso) {
  if (!iso) return "Observation time unavailable";
  return `${formatShortDate(iso, COLOMBO_TIME_ZONE)} · ${formatTime(iso, COLOMBO_TIME_ZONE)}`;
}

function metricCell(metric, group, units) {
  const station = group.station;
  const { temperatureUnit, windUnit, measurementSystem } = units;

  if (group.id === "dom") {
    switch (metric) {
      case "temperature":
        return {
          value: temperatureValue(station.temperatureC, temperatureUnit),
          supporting: capitalise(station.conditionLabel) || "Condition not reported",
        };
      case "humidity":
        return { value: percentValue(station.relativeHumidity), supporting: "Reported" };
      case "rainfall":
        return {
          value: rainfallValue(station.rainfall3hMm, station.rainfall3hTrace),
          supporting: station.rainfall3hTrace ? "Below 0.1 mm" : "Previous 3 hours",
        };
      case "rainfallTotal":
        return {
          value: rainfallValue(station.rainfallSince0830Mm, station.rainfallSince0830Trace),
          supporting: station.rainfallSince0830Trace ? "Below 0.1 mm" : "Since 08:30",
        };
      default:
        return null;
    }
  }

  if (group.id === "metar") {
    const windSupport = [
      windDirectionLabel(station.windDirection),
      Number.isFinite(station.windGustKmh) ? `Gusts ${formatWind(station.windGustKmh, windUnit)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    switch (metric) {
      case "temperature":
        return {
          value: temperatureValue(station.temperatureC, temperatureUnit),
          supporting: Number.isFinite(station.dewpointC)
            ? `Dew point ${temperatureValue(station.dewpointC, temperatureUnit)}`
            : capitalise(station.conditionLabel) || "Airport report",
        };
      case "humidity":
        return {
          value: percentValue(station.relativeHumidity),
          supporting: "From temperature and dew point",
        };
      case "wind":
        return {
          value: formatWind(station.windSpeedKmh, windUnit),
          supporting: windSupport || "Direction unavailable",
        };
      case "pressure":
        return {
          value: pressureValue(station.pressureHpa, measurementSystem),
          supporting: "Altimeter setting",
        };
      case "dewPoint":
        return {
          value: temperatureValue(station.dewpointC, temperatureUnit),
          supporting: "Reported",
        };
      case "visibility":
        return {
          value: station.visibilityLabel || "Unavailable",
          supporting: "Reported statute miles",
        };
      case "cloud":
        return {
          value: station.cloudCover || "Unavailable",
          supporting: Number.isFinite(station.cloudBaseFt)
            ? `Base ${formatNumber(station.cloudBaseFt)} ft`
            : "Cloud cover code",
        };
      default:
        return null;
    }
  }

  return null;
}

function modelCell(metric, current, units) {
  if (!current) return null;
  const { temperatureUnit, windUnit, measurementSystem } = units;
  switch (metric) {
    case "temperature":
      return {
        value: temperatureValue(current.temperature, temperatureUnit),
        supporting: Number.isFinite(current.apparentTemperature)
          ? `Feels like ${temperatureValue(current.apparentTemperature, temperatureUnit)}`
          : "Model estimate",
      };
    case "humidity":
      return { value: percentValue(current.humidity), supporting: "Relative humidity" };
    case "rainfall":
      return {
        value: Number.isFinite(current.precipitation)
          ? `${formatNumber(current.precipitation, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} mm`
          : "Unavailable",
        supporting: "Current hour",
      };
    case "wind":
      return {
        value: formatWind(current.windSpeed, windUnit),
        supporting:
          [
            windDirectionLabel(current.windDirection),
            Number.isFinite(current.windGust)
              ? `Gusts ${formatWind(current.windGust, windUnit)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Direction unavailable",
      };
    case "pressure":
      return {
        value: pressureValue(current.pressure, measurementSystem),
        supporting: "Mean sea level",
      };
    case "visibility":
      return {
        value: formatVisibility(current.visibility, measurementSystem),
        supporting: "Horizontal range",
      };
    case "cloud":
      return {
        value: Number.isFinite(current.cloudCover)
          ? `${formatNumber(current.cloudCover)}%`
          : "Unavailable",
        supporting: "Sky coverage",
      };
    default:
      return null;
  }
}

function MetricCell({ icon: Icon, label, value, supporting, accent = false }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between rounded-[1.1rem] px-3 py-2.5 transition-[background-color,transform] duration-300",
        accent
          ? "bg-primary-container/85 text-on-primary-container"
          : "bg-surface-container/85",
      )}
    >
      <dt
        className={cn(
          "flex items-center gap-1.5 text-[0.55rem] font-bold uppercase leading-3 tracking-[0.11em]",
          accent ? "text-on-primary-container/75" : "text-muted-foreground",
        )}
      >
        <Icon aria-hidden="true" className="size-3 shrink-0" strokeWidth={2.4} />
        <span className="min-w-0 truncate">{label}</span>
      </dt>
      <dd className="mt-1 min-w-0">
        <span className="block truncate font-display text-[1.32rem] font-semibold leading-none tracking-[-0.035em]">
          {value}
        </span>
        {supporting ? (
          <span
            className={cn(
              "mt-1 block text-[0.6rem] font-medium leading-4",
              accent ? "text-on-primary-container/75" : "text-muted-foreground",
            )}
          >
            {supporting}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function StatusStrip({ tone = "info", icon: Icon, label, detail, onRetry, retryLabel }) {
  return (
    <div
      role={tone === "warning" ? "status" : "status"}
      className={cn(
        "mt-3 flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[0.68rem] leading-4",
        tone === "warning"
          ? "border-tertiary/30 bg-tertiary-container/55 text-on-tertiary-container"
          : tone === "error"
            ? "border-destructive/20 bg-destructive/5"
            : "border-outline-variant/70 bg-surface-container/45",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          tone === "error" ? "text-destructive" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        {detail ? <p className="mt-0.5 opacity-85">{detail}</p> : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-8 shrink-0 rounded-full px-2 text-[0.64rem] font-semibold text-primary hover:bg-primary-container"
        >
          {retryLabel || "Retry"}
        </button>
      ) : null}
    </div>
  );
}

function GroupHeader({ group, now }) {
  const isDom = group.id === "dom";
  const freshness = relativeElapsedLabel(group.station.observationTime, now);
  const sourceLabel = isDom
    ? "Department of Meteorology"
    : `${group.station.icaoId || "Airport"} · NOAA AWC METAR`;

  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <MapPin aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{sourceLabel}</span>
        </p>
        <p
          className="mt-0.5 truncate font-display text-base font-semibold tracking-[-0.02em]"
          data-testid={isDom ? "glance-dom-station" : "glance-metar-station"}
        >
          {group.station.name}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-1 text-[0.56rem] font-bold uppercase tracking-[0.09em]",
          group.stale
            ? "bg-tertiary-container text-on-tertiary-container"
            : "bg-primary-container text-on-primary-container",
        )}
        data-testid={isDom ? "glance-dom-freshness-badge" : "glance-metar-freshness-badge"}
      >
        {group.stale ? "Delayed" : isDom ? "Official reading" : "Airport report"}
      </span>
    </div>
  );
}

function GroupFootnote({ group, now }) {
  const isDom = group.id === "dom";
  const observed = relativeElapsedLabel(group.station.observationTime, now);
  const collected = group.data?.collectedAt;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.62rem] leading-4 text-muted-foreground">
      <span data-testid={isDom ? "glance-dom-observed" : "glance-metar-observed"}>
        {isDom ? "Observed" : "Reported"} {observationMoment(group.station.observationTime)}
        {observed ? ` · ${observed}` : ""}
      </span>
      {isDom && collected ? (
        <span>· Collected {formatTime(collected, COLOMBO_TIME_ZONE)}</span>
      ) : null}
      {group.defaulted ? <span>· Default station for this place</span> : null}
    </p>
  );
}

function MetricsGrid({ group, metrics, units }) {
  const cells = metrics
    .map((metric) => ({
      metric,
      label: GLANCE_METRIC_LABELS[metric],
      icon: METRIC_ICONS[metric],
      cell: metricCell(metric, group, units),
    }))
    .filter((entry) => entry.cell);

  if (cells.length === 0) {
    return (
      <p className="mt-2 rounded-xl bg-surface-container/55 px-2.5 py-2 text-[0.66rem] leading-4 text-muted-foreground">
        This source does not publish the metrics you selected. Choose another metric.
      </p>
    );
  }

  return (
    <dl className="mt-2 grid grid-cols-2 gap-1.5 [&>div:last-child:nth-child(odd)]:col-span-2">
      {cells.map(({ metric, label, icon, cell }, index) => (
        <MetricCell
          key={metric}
          icon={icon}
          label={label}
          value={cell.value}
          supporting={cell.supporting}
          accent={index === 0}
        />
      ))}
    </dl>
  );
}

function ModelBlock({ current, timezone, metrics, units }) {
  const applicable = metrics.filter((metric) => MODEL_METRICS.has(metric));
  const cells = applicable
    .map((metric) => ({
      metric,
      label: metric === "rainfall" ? "Rain now" : GLANCE_METRIC_LABELS[metric],
      icon: METRIC_ICONS[metric],
      cell: modelCell(metric, current, units),
    }))
    .filter((entry) => entry.cell);

  return (
    <div
      className="mt-3 rounded-[1.35rem] bg-surface-container/40 p-2.5"
      data-testid="atmosphere-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 px-0.5">
        <p className="text-[0.55rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Air around you
        </p>
        <p className="text-[0.55rem] font-medium text-muted-foreground">
          Open-Meteo model · not an observation
        </p>
      </div>
      {cells.length ? (
        <dl className="mt-1.5 grid grid-cols-2 gap-1.5 [&>div:last-child:nth-child(odd)]:col-span-2">
          {cells.map(({ metric, label, icon, cell }) => (
            <MetricCell
              key={metric}
              icon={icon}
              label={label}
              value={cell.value}
              supporting={cell.supporting}
            />
          ))}
        </dl>
      ) : (
        <p className="mt-1.5 text-[0.66rem] leading-4 text-muted-foreground">
          None of your chosen metrics are published by the model. Choose temperature, humidity,
          wind, pressure, visibility, or cloud cover.
        </p>
      )}
      {timezone ? (
        <p className="mt-1.5 text-[0.6rem] leading-4 text-muted-foreground">
          Forecast time zone: {timezone}
        </p>
      ) : null}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div key={item} className="skeleton-block h-14 rounded-xl" />
      ))}
    </div>
  );
}

export default function AtAGlance({
  activeLocation,
  model,
  timezone,
  now,
  online,
  stationId,
  onStationChange,
}) {
  const {
    temperatureUnit,
    windUnit,
    measurementSystem,
    glanceSource,
    glanceMetrics,
    setGlanceSource,
    setGlanceMetrics,
  } = usePreferences();
  const metricsPanelId = useId();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [nearMe, setNearMe] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const dom = useMeteoJson({ enabled: true, online });
  const selectionLocation = nearMe || activeLocation || null;

  // DoM is the default source, so the METAR route is only requested when the
  // selected view needs it or the DoM reading has gone stale. Loading it on
  // every page view would add a call for data most visits do not display.
  const domProbe = useMemo(
    () =>
      buildGlanceView({
        source: "dom",
        dom: dom.data,
        metar: null,
        location: selectionLocation,
        preference: stationId,
        now,
      }),
    [dom.data, now, selectionLocation, stationId],
  );
  const domSettled = ["success", "stale", "error"].includes(dom.status) || Boolean(dom.data);
  const metarEnabled =
    glanceSource !== "dom" || (domSettled && !domProbe.domUsable) || dom.status === "error";

  const metar = useMetarObservations({ enabled: metarEnabled, online });

  const view = useMemo(
    () =>
      buildGlanceView({
        source: glanceSource,
        dom: dom.data,
        metar: metar.data,
        location: selectionLocation,
        preference: stationId,
        now,
      }),
    [dom.data, glanceSource, metar.data, now, selectionLocation, stationId],
  );

  const metrics = normalizeGlanceMetrics(glanceMetrics);
  const units = { temperatureUnit, windUnit, measurementSystem };

  const stationOptions = useMemo(
    () =>
      stationOptionsForSource({ source: glanceSource, dom: dom.data, metar: metar.data }),
    [glanceSource, dom.data, metar.data],
  );

  const handleNearMe = useCallback(async () => {
    if (locating) return;
    setLocating(true);
    setLocationError("");
    try {
      const place = await requestCurrentPlace();
      setNearMe({
        name: place.name || "Your location",
        latitude: place.latitude,
        longitude: place.longitude,
        countryCode: place.countryCode || "",
      });
    } catch (error) {
      setNearMe(null);
      setLocationError(geolocationErrorMessage(error));
    } finally {
      setLocating(false);
    }
  }, [locating]);

  const clearNearMe = useCallback(() => {
    setNearMe(null);
    setLocationError("");
  }, []);

  const toggleMetric = useCallback(
    (metric) => {
      const selected = metrics.includes(metric);
      if (selected && metrics.length === 1) return;
      if (!selected && metrics.length >= MAX_GLANCE_METRICS) return;
      setGlanceMetrics(
        selected ? metrics.filter((entry) => entry !== metric) : [...metrics, metric],
      );
    },
    [metrics, setGlanceMetrics],
  );

  const domLoading = !dom.data && (dom.status === "loading" || dom.status === "idle");
  const domFailed = !dom.data && dom.status === "error";
  const clientCached = dom.status === "stale" && Boolean(dom.data);
  const upstreamStale = dom.data?.status === "stale";
  const groups = view.groups;

  return (
    <section
      aria-label="At a glance"
      className="surface-card relative flex h-full flex-col overflow-hidden p-4 sm:p-5"
      data-testid="at-a-glance"
    >
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            <LocateFixed aria-hidden="true" className="size-3" />
            At a glance
            <span className="ml-1 text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
              Now
            </span>
          </p>
          <h2
            id="at-a-glance-heading"
            className="mt-1.5 font-display text-[1.6rem] font-semibold leading-tight tracking-[-0.035em] sm:text-[1.75rem]"
          >
            {nearMe?.name || activeLocation?.name || "This place"}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={nearMe ? clearNearMe : handleNearMe}
            disabled={locating}
            aria-pressed={Boolean(nearMe)}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-[0.68rem] font-semibold transition-colors disabled:opacity-60",
              nearMe
                ? "bg-primary-container text-on-primary-container"
                : "text-foreground hover:bg-surface-container-high",
            )}
          >
            {locating ? (
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            ) : (
              <LocateFixed aria-hidden="true" className="size-3.5" />
            )}
            {locating ? "Locating" : nearMe ? "Using my location" : "Near me"}
          </button>
          <button
            type="button"
            onClick={dom.refresh}
            disabled={dom.status === "refreshing" || domLoading}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-[0.68rem] font-semibold text-foreground transition-colors hover:bg-surface-container-high disabled:opacity-60"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn("size-3.5", dom.status === "refreshing" && "animate-spin")}
            />
            <span className="sr-only">Refresh official observations</span>
            <span aria-hidden="true">Refresh</span>
          </button>
        </div>
      </div>

      <fieldset className="relative mt-3">
        <legend className="sr-only">Observation source</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-container p-1">
          {SOURCE_OPTIONS.map((option) => (
            <label
              key={option.value}
              title={option.title}
              className={cn(
                "relative flex min-h-9 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-[0.7rem] font-semibold transition-[background-color,color,box-shadow] duration-200",
                "has-[:checked]:bg-primary-container has-[:checked]:text-on-primary-container has-[:checked]:shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-1 has-[:focus-visible]:ring-offset-card",
                "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="glance-source"
                value={option.value}
                checked={normalizeGlanceSource(glanceSource) === option.value}
                onChange={() => setGlanceSource(option.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[0.62rem] leading-4 text-muted-foreground">
          {normalizeGlanceSource(glanceSource) === "dom"
            ? "Department of Meteorology district stations. A stale reading is replaced by a labelled airport report."
            : normalizeGlanceSource(glanceSource) === "metar"
              ? "NOAA AWC airport reports. These are airport stations, not DoM district readings."
              : "Both sources, kept separate. Their readings are never merged."}
        </p>
      </fieldset>

      <div className="relative mt-3">
        <label
          htmlFor="glance-station-select"
          className="text-[0.6rem] font-bold uppercase tracking-[0.13em] text-muted-foreground"
        >
          Station preference
        </label>
        <StationSelect
          id="glance-station-select"
          value={stationId}
          stations={stationOptions}
          onChange={onStationChange}
          disabled={stationOptions.length === 0}
          describedBy="glance-station-help"
          className="mt-1.5"
        />
        <p
          id="glance-station-help"
          className="mt-1.5 min-h-[2.4rem] text-[0.62rem] leading-4 text-muted-foreground"
        >
          {normalizeGlanceSource(glanceSource) === "metar"
            ? stationOptions.length > 0 &&
              stationId !== AUTOMATIC_STATION_ID &&
              !stationOptions.some((station) => station.id === stationId)
              ? "That station has no airport report. Airports lists only the four NOAA AWC METAR stations, so choose one of them or Automatic."
              : "Airports lists only the four NOAA AWC METAR stations that report in Sri Lanka. Automatic picks the nearest fresh one."
            : stationId !== AUTOMATIC_STATION_ID
              ? "A manual station stays fixed. The same airport is used when it has one."
              : nearMe
                ? `Automatic picks the nearest fresh station to ${nearMe.name}. It does not change your forecast location.`
                : view.domGroup?.selection?.defaulted
                  ? "Using a default station for this place."
                  : "Automatic picks the nearest fresh station to the active place."}
        </p>
      </div>

      {locationError ? (
        <StatusStrip
          tone="warning"
          icon={AlertTriangle}
          label="Location unavailable"
          detail={locationError}
        />
      ) : null}

      {domLoading ? (
        <div className="relative mt-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Loading DoM station observations…
          </p>
          <SkeletonRows />
        </div>
      ) : null}

      {clientCached ? (
        <StatusStrip
          tone="warning"
          icon={AlertTriangle}
          label="Cached DoM snapshot"
          detail={
            online
              ? "The last successful snapshot is shown while Aeris retries. It is not a live reading."
              : "This device is offline. Showing the last successful snapshot, not a live reading."
          }
          onRetry={online ? dom.refresh : null}
          retryLabel={dom.retryInSeconds > 0 ? `Retry in ${dom.retryInSeconds}s` : "Retry"}
        />
      ) : null}

      {!clientCached && upstreamStale && dom.data?.notice ? (
        <StatusStrip
          tone="warning"
          icon={AlertTriangle}
          label="DoM snapshot is stale"
          detail={dom.data.notice}
        />
      ) : null}

      {groups.map((group, index) => (
        <div
          key={group.id}
          className={cn("relative", index > 0 && "mt-3 border-t border-outline-variant/60 pt-3")}
          data-testid={`glance-group-${group.id}`}
        >
          <GroupHeader group={group} now={now} />
          <MetricsGrid group={group} metrics={metrics} units={units} />
          <GroupFootnote group={group} now={now} />

          {group.id === "metar" ? (
            <p className="mt-2 text-[0.62rem] leading-4 text-muted-foreground">
              METAR reports do not include a rainfall total, so Aeris never shows one for an
              airport station.
            </p>
          ) : null}

          {group.id === "dom" && group.data?.source?.url ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.62rem] leading-4 text-muted-foreground">
              <span>Source: {group.data.source.attribution || "Department of Meteorology"}</span>
              <a
                href={group.data.source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline"
              >
                meteo.gov.lk
                <ExternalLink aria-hidden="true" className="size-2.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </p>
          ) : null}

          {group.id === "metar" && group.data?.source?.url ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.62rem] leading-4 text-muted-foreground">
              <span>Source: NOAA Aviation Weather Center</span>
              <a
                href={group.data.source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline"
              >
                aviationweather.gov
                <ExternalLink aria-hidden="true" className="size-2.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </p>
          ) : null}
        </div>
      ))}

      {view.fallback?.notice ? (
        <StatusStrip
          tone="warning"
          icon={AlertTriangle}
          label={
            view.fallback.active
              ? "DoM reading replaced by a labelled airport fallback"
              : "No current DoM observation"
          }
          detail={view.fallback.notice}
          onRetry={online ? dom.refresh : null}
        />
      ) : null}

      {!domLoading && groups.length === 0 ? (
        <div className="relative mt-3">
          <StatusStrip
            tone={domFailed ? "error" : "info"}
            icon={CloudOff}
            label={
              glanceSource === "metar"
                ? "Airport reports unavailable"
                : domFailed
                  ? online
                    ? "DoM observations unavailable"
                    : "No network connection"
                  : "No station reading available"
            }
            detail={
              glanceSource === "metar"
                ? metar.error ||
                  "NOAA AWC is temporarily unreachable. Aeris does not invent an airport report."
                : online
                  ? "The DoM snapshot did not respond. The Open-Meteo forecast is unaffected."
                  : "Reconnect to load official station observations. The forecast is unaffected."
            }
            onRetry={online ? (glanceSource === "metar" ? metar.refresh : dom.refresh) : null}
          />
        </div>
      ) : null}

      <div className="relative mt-3 border-t border-outline-variant/60 pt-2.5">
        <button
          type="button"
          onClick={() => setCustomizeOpen((open) => !open)}
          aria-expanded={customizeOpen}
          aria-controls={metricsPanelId}
          className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-1 text-left text-[0.68rem] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="inline-flex items-center gap-1.5">
            <SlidersHorizontal aria-hidden="true" className="size-3.5" />
            Metrics
          </span>
          <span className="inline-flex items-center gap-1 text-[0.62rem] font-medium">
            {metrics.length} of {MAX_GLANCE_METRICS}
            <Check aria-hidden="true" className={cn("size-3", !customizeOpen && "opacity-60")} />
          </span>
        </button>

        {customizeOpen ? (
          <div id={metricsPanelId} className="mt-1.5">
            <fieldset>
              <legend className="sr-only">Choose At a glance metrics</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {GLANCE_METRIC_IDS.map((metric) => {
                  const selected = metrics.includes(metric);
                  const atLimit = !selected && metrics.length >= MAX_GLANCE_METRICS;
                  const lastOne = selected && metrics.length === 1;
                  return (
                    <label
                      key={metric}
                      className={cn(
                        "flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[0.66rem] font-medium transition-colors",
                        selected
                          ? "border-primary/40 bg-primary-container/60 text-on-primary-container"
                          : "border-outline-variant/80 bg-card/60 text-muted-foreground hover:text-foreground",
                        (atLimit || lastOne) && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={atLimit || lastOne}
                        onChange={() => toggleMetric(metric)}
                        className="size-3.5 accent-[var(--primary)]"
                      />
                      <span className="min-w-0 truncate">{GLANCE_METRIC_LABELS[metric]}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <p className="mt-1.5 text-[0.6rem] leading-4 text-muted-foreground">
              Choose up to {MAX_GLANCE_METRICS}. A metric only appears where its source reports
              it.
            </p>
          </div>
        ) : null}
      </div>

      <ModelBlock
        current={model}
        timezone={timezone}
        metrics={metrics}
        units={units}
      />
    </section>
  );
}
