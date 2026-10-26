"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudRain,
  CloudOff,
  Droplets,
  ExternalLink,
  Eye,
  Gauge,
  Info,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Thermometer,
  Waves,
  Wind,
  X,
} from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";
import StationSelect from "@/components/station-select";
import { useWeather } from "@/hooks/use-weather";
import {
  formatNumber,
  formatShortDate,
  formatTime,
  relativeFetchLabel,
  relativeObservationLabel,
} from "@/lib/format";
import {
  DEFAULT_OBSERVATION_STALE_MINUTES,
  isObservationStale,
  observationAgeMinutes,
  selectOfficialStation,
  stationReferenceLabel,
} from "@/lib/station-selection";
import { convertTemperature, formatWind, windDirectionLabel } from "@/lib/weather";
import { cn } from "@/lib/utils";

const COLOMBO_TIME_ZONE = "Asia/Colombo";

function colomboTime(iso) {
  if (!iso) return "Time unavailable";
  return `${formatShortDate(iso, COLOMBO_TIME_ZONE)} · ${formatTime(iso, COLOMBO_TIME_ZONE)}`;
}

function officialTemperature(valueC, unit) {
  const converted = convertTemperature(valueC, unit);
  if (!Number.isFinite(converted)) return "Unavailable";
  return `${formatNumber(converted, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}°${unit === "f" ? "F" : "C"}`;
}

function millimetres(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  return `${formatNumber(value, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} mm`;
}

function percent(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  return `${formatNumber(value)}%`;
}

function pressure(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  return `${formatNumber(value, { maximumFractionDigits: 0 })} hPa`;
}

function distanceLabel(distance) {
  if (!Number.isFinite(distance)) return null;
  return `${formatNumber(distance, {
    maximumFractionDigits: distance < 10 ? 1 : 0,
  })} km`;
}

function cloudCover(value) {
  if (!Number.isFinite(value)) return "Unavailable";
  return `${formatNumber(value)}/8 oktas`;
}

function StatusStrip({
  tone = "info",
  icon: Icon = Info,
  label,
  detail,
  retryInSeconds = 0,
  onRetry,
  onDismiss,
}) {
  const destructive = tone === "error";
  return (
    <div
      role={destructive ? "alert" : "status"}
      className={cn(
        "relative mt-3 flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[0.68rem] leading-4",
        destructive
          ? "border-destructive/20 bg-destructive/5"
          : "border-outline-variant/70 bg-tertiary-container/55 text-on-tertiary-container",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-3.5 shrink-0",
          destructive && "text-destructive",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        <p className={cn("mt-0.5", destructive ? "text-muted-foreground" : "opacity-85")}>
          {detail}
          {retryInSeconds > 0 ? ` Retrying in ${retryInSeconds}s.` : ""}
        </p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-8 shrink-0 rounded-full px-2 text-[0.64rem] font-semibold text-primary hover:bg-primary-container"
        >
          {retryInSeconds > 0 ? "Retry now" : "Retry"}
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss ${label}`}
          className="-my-1 -mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-container hover:text-foreground"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function Metric({ icon: Icon, label, value, supporting }) {
  return (
    <div className="min-w-0 rounded-xl bg-card/70 px-2.5 py-2">
      <dt className="flex items-center gap-1 text-[0.58rem] font-bold uppercase leading-3 tracking-[0.1em] text-muted-foreground">
        <Icon aria-hidden="true" className="size-3 shrink-0" />
        <span className="min-w-0">{label}</span>
      </dt>
      <dd className="mt-1 text-sm font-semibold leading-tight">
        {value}
        {supporting ? (
          <span className="mt-0.5 block text-[0.6rem] font-normal leading-4 text-muted-foreground">
            {supporting}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function ModelComparisonLoader({ station }) {
  const { temperatureUnit } = usePreferences();
  const place = useMemo(() => {
    if (!station?.referencePoint) return null;
    return {
      id: `official-reference-${station.id}`,
      name: `${station.locationName || station.name} reference point`,
      admin1: "",
      country: "Sri Lanka",
      countryCode: "LK",
      latitude: station.referencePoint.latitude,
      longitude: station.referencePoint.longitude,
      timezone: COLOMBO_TIME_ZONE,
    };
  }, [station]);
  const weather = useWeather(place);

  if (!station?.referencePoint) {
    return (
      <p className="rounded-xl bg-surface-container/55 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
        Aeris does not have a reference point for this station, so it does not show a model
        comparison.
      </p>
    );
  }

  if (weather.status === "error" && !weather.data) {
    return (
      <div className="rounded-xl bg-surface-container/55 px-3 py-2.5 text-xs leading-5">
        <p className="font-semibold">Model comparison unavailable</p>
        <p className="mt-0.5 text-muted-foreground">{weather.error?.message}</p>
        <button
          type="button"
          onClick={weather.refresh}
          className="mt-1.5 min-h-9 rounded-full px-2.5 py-1 font-semibold text-primary hover:bg-primary-container"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!weather.data) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-surface-container/55 px-3 py-2.5 text-xs text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
        Loading the model value at the reference point…
      </p>
    );
  }

  const model = weather.data.current;
  const temperatureGap =
    Number.isFinite(model.temperature) && Number.isFinite(station.temperatureC)
      ? model.temperature - station.temperatureC
      : null;
  const humidityGap =
    Number.isFinite(model.humidity) && Number.isFinite(station.relativeHumidity)
      ? model.humidity - station.relativeHumidity
      : null;
  const observationGapMinutes = Number.isFinite(model.time)
    ? Math.round(Math.abs(model.time - station.observationEpochMs) / 60_000)
    : null;

  return (
    <div className="rounded-xl border border-outline-variant/70 bg-surface-container/35 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Open-Meteo at the reference point
          </p>
          <p className="mt-1 text-[0.66rem] leading-4 text-muted-foreground">
            Model current conditions, not an official observation.
          </p>
        </div>
        <span className="rounded-full bg-card/70 px-2 py-1 text-[0.56rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Model
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-card/65 px-2.5 py-2">
          <dt className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Temperature
          </dt>
          <dd className="mt-0.5 text-xs font-semibold">
            {officialTemperature(model.temperature, temperatureUnit)}
            {temperatureGap != null ? (
              <span className="ml-1 font-normal text-muted-foreground">
                {temperatureGap >= 0 ? "+" : ""}
                {formatNumber(temperatureGap, { maximumFractionDigits: 1 })}°
              </span>
            ) : null}
          </dd>
        </div>
        <div className="rounded-lg bg-card/65 px-2.5 py-2">
          <dt className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Humidity
          </dt>
          <dd className="mt-0.5 text-xs font-semibold">
            {percent(model.humidity)}
            {humidityGap != null ? (
              <span className="ml-1 font-normal text-muted-foreground">
                {humidityGap >= 0 ? "+" : ""}
                {Math.round(humidityGap)} pts
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-[0.64rem] leading-4 text-muted-foreground">
        {observationGapMinutes != null && observationGapMinutes > 90
          ? `The model refresh and the official observation are about ${Math.round(
              observationGapMinutes / 60,
            )} hours apart, so part of any difference is timing. `
          : ""}
        Rainfall is not compared: the official accumulation windows and the model endpoint do
        not share a time basis.
      </p>
    </div>
  );
}

function ModelComparison({ station }) {
  const [requested, setRequested] = useState(false);

  if (!requested) {
    return (
      <button
        type="button"
        onClick={() => setRequested(true)}
        className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-[0.68rem] font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-container/45"
      >
        Compare with Open-Meteo model
        <ArrowRight aria-hidden="true" className="size-3" />
      </button>
    );
  }

  return (
    <div className="mt-3">
      <ModelComparisonLoader station={station} />
      <button
        type="button"
        onClick={() => setRequested(false)}
        className="mt-1.5 min-h-9 rounded-full px-2 text-[0.66rem] font-semibold text-muted-foreground hover:bg-surface-container"
      >
        Hide comparison
      </button>
    </div>
  );
}

function selectionExplanation(selection) {
  switch (selection.reason) {
    case "nearest-fresh":
      return "Automatic chose the nearest station with a recent, usable observation.";
    case "fresher-alternative":
      return "The nearest station's observation was stale or missing, so Aeris used the closest station with a fresher usable observation.";
    case "nearest-stale":
      return "No station had a recent usable observation. Aeris shows the nearest available reading and labels it delayed.";
    case "no-usable-observation":
      return "The nearest station has no usable observation in this response. Aeris does not invent a reading or timestamp.";
    case "manual":
      return "This is your manual choice. Aeris keeps it across refreshes and restarts and never replaces it automatically.";
    case "manual-missing":
      return "The saved manual station is not in the current official response. Your choice has not been changed.";
    case "outside-sri-lanka":
      return "Automatic selection is available for Sri Lankan places. Choose a station manually or open a place in Sri Lanka.";
    case "no-reference-points":
      return "No station in this response has a reference point, so Aeris cannot estimate distance.";
    default:
      return "Automatic selection needs an active place and an available station response.";
  }
}

export default function OfficialObservations({
  activeLocation,
  official,
  now = 0,
  stationId = "auto",
  onStationChange,
  online = true,
}) {
  const { temperatureUnit, windUnit } = usePreferences();
  const { status, data, error, refresh, retryInSeconds = 0 } = official;
  const [dismissed, setDismissed] = useState("");
  const stations = data?.stations || [];
  const sourceId = data?.source?.id || null;
  const isMetar =
    sourceId === "sri-lanka-metar" ||
    data?.source?.kind === "official-aviation-observations";
  const sourceLabel = isMetar ? "NOAA AWC METAR" : "Sri Lanka DoM";
  const sourceLinkLabel = isMetar ? "NOAA" : "DoM";
  const referenceNow =
    Number.isFinite(now) && now > 0
      ? now
      : Date.parse(data?.servedAt || data?.fetchedAt || "") || 0;
  const staleAfterMinutes =
    data?.staleAfterMinutes ?? DEFAULT_OBSERVATION_STALE_MINUTES;
  const selection = selectOfficialStation(stations, {
    location: activeLocation,
    preference: stationId,
    now: referenceNow,
    staleAfterMinutes,
  });
  const selected = selection.station;
  const selectedStale = selected
    ? selection.stale ||
      isObservationStale(selected, referenceNow, staleAfterMinutes)
    : false;
  const selectedAge = selected
    ? observationAgeMinutes(selected, referenceNow)
    : null;
  const upstreamStale = data?.status === "stale" || Boolean(data?.upstreamStale);
  const clientStale = status === "stale";
  // `fetchedAt` is when the DoM page was actually retrieved; `servedAt` is
  // when this response left Aeris. Keep both distinct so a cached response
  // can never make an old observation look freshly fetched.
  const fetchedTime = data?.fetchedAt || null;
  const servedTime = data?.servedAt || null;
  const loading = status === "loading" && !data;
  const failed = status === "error" && !data;
  const stationDistance = distanceLabel(selection.distanceKm);
  const manualMissing = selection.manualMissing;
  const windValue = formatWind(selected?.windSpeedKmh, windUnit);
  const windSupporting =
    selected && Number.isFinite(selected.windDirection)
      ? `${windDirectionLabel(selected.windDirection, true)}${
          Number.isFinite(selected.windGustKmh)
            ? ` · gusts ${formatWind(selected.windGustKmh, windUnit)}`
            : ""
        }`
      : selected?.windDirectionCompass || null;
  const representation = data?.retrieval?.representation || null;
  const representationLabel =
    representation === "workbook"
      ? "3-hourly workbook"
      : representation === "map-page"
        ? "map page subset"
        : null;
  const sourceHref = isMetar
    ? data?.source?.url
    : data?.source?.feedUrl || data?.source?.url;
  const statusSignature = [
    status,
    data?.fallback?.active ? "fallback" : "",
    data?.notice ? "notice" : "",
    upstreamStale ? "upstream-stale" : "",
    clientStale ? "client-stale" : "",
  ].join("|");
  const statusDismissed = dismissed === statusSignature;
  const dismissStatus = () => setDismissed(statusSignature);
  const retryAction = failed || clientStale ? refresh : null;
  const referenceNote = isMetar
    ? "These are airport station coordinates published by NOAA AWC. They are not Department of Meteorology district stations, and they are not approximate city-centre points."
    : `${data?.source?.referenceNote || "Approximate city-centre reference points are not official station coordinates."} The DoM page inspected by Aeris does not publish station coordinates, so distance and automatic selection are approximate.`;

  return (
    <section
      className="surface-card relative flex h-full min-w-0 flex-col overflow-hidden p-4 sm:p-5"
      aria-labelledby="official-observations-heading"
      data-testid="official-observations"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-secondary-container/35 blur-2xl"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            <MapPin aria-hidden="true" className="size-3" />
            Official observation · {sourceLabel}
            {representationLabel ? ` · ${representationLabel}` : ""}
          </p>
          <h2
            id="official-observations-heading"
            className="mt-1 font-display text-xl font-semibold tracking-[-0.035em]"
          >
            Latest station reading
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {sourceHref ? (
            <a
              href={sourceHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-10 items-center gap-1 rounded-full px-2.5 text-[0.68rem] font-semibold text-primary transition-colors hover:bg-primary-container"
            >
              {sourceLinkLabel}
              <ExternalLink aria-hidden="true" className="size-3" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
          <button
            type="button"
            onClick={refresh}
            disabled={status === "refreshing" || loading}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-2.5 text-[0.68rem] font-semibold text-foreground transition-colors hover:bg-surface-container-high disabled:opacity-60"
          >
            <RefreshCw
              aria-hidden="true"
              className={cn("size-3.5", status === "refreshing" && "animate-spin")}
            />
            {status === "refreshing" ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      <div className="relative mt-3">
        <label
          htmlFor="official-station-select"
          className="text-[0.6rem] font-bold uppercase tracking-[0.13em] text-muted-foreground"
        >
          Official station
        </label>
        <StationSelect
          id="official-station-select"
          value={stationId}
          stations={stations}
          onChange={onStationChange}
          disabled={!stations.length}
          describedBy="official-station-help"
          className="mt-1.5"
        />
        <p
          id="official-station-help"
          className="mt-1.5 text-[0.66rem] leading-4 text-muted-foreground"
        >
          {selection.mode === "manual"
            ? "Manual selection stays fixed across refreshes and restarts."
            : selection.reason === "outside-sri-lanka"
              ? "Automatic selection needs a Sri Lankan place. You can still choose a station."
              : "Automatic uses the selected place and prefers a fresh observation over a stale nearer station."}
        </p>
      </div>

      {loading ? (
        <div className="relative mt-3" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            Loading official station observations…
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2" aria-hidden="true">
            {[0, 1, 2].map((item) => (
              <div key={item} className="skeleton-block h-14 rounded-xl" />
            ))}
          </div>
        </div>
      ) : null}

      {failed && !statusDismissed ? (
        <StatusStrip
          tone="error"
          icon={CloudOff}
          label={online ? "Official readings offline" : "No network connection"}
          detail={
            online
              ? "The Department of Meteorology did not respond. The forecast is unaffected."
              : "Reconnect to load official station observations. The forecast is unaffected."
          }
          retryInSeconds={retryInSeconds}
          onRetry={online ? retryAction : null}
          onDismiss={dismissStatus}
        />
      ) : null}

      {!failed && clientStale && !statusDismissed ? (
        <StatusStrip
          icon={AlertTriangle}
          label="Cached official reading"
          detail={
            !online
              ? "This device is offline. Showing the last successful response, not a live reading."
              : error
                ? "This is the last successful response, not a live reading. Aeris retries automatically."
                : "This is the last successful response, not a live reading."
          }
          retryInSeconds={retryInSeconds}
          onRetry={online ? retryAction : null}
          onDismiss={dismissStatus}
        />
      ) : null}

      {!failed && !clientStale && !statusDismissed && data?.fallback?.active ? (
        <StatusStrip
          icon={CloudOff}
          label="Airport fallback active"
          detail="DoM is unreachable. Showing NOAA AWC airport METAR reports, not DoM district observations."
          onDismiss={dismissStatus}
        />
      ) : null}

      {!failed &&
      !clientStale &&
      !statusDismissed &&
      !data?.fallback?.active &&
      data?.notice ? (
        <StatusStrip
          icon={Info}
          label="Limited DoM feed"
          detail="The 3-hourly workbook is unavailable, so Aeris is using the map page. It omits wind, pressure, cloud cover, and dew point."
          onDismiss={dismissStatus}
        />
      ) : null}

      {!failed &&
      !clientStale &&
      !statusDismissed &&
      !data?.fallback?.active &&
      !data?.notice &&
      upstreamStale ? (
        <StatusStrip
          icon={AlertTriangle}
          label="Cached DoM response"
          detail="The Department did not refresh. This is the last successful response, not a live reading."
          onDismiss={dismissStatus}
        />
      ) : null}

      {manualMissing ? (
        <div
          role="alert"
          className="relative mt-3 rounded-xl border border-tertiary/30 bg-tertiary-container/60 px-2.5 py-2 text-[0.68rem] leading-4 text-on-tertiary-container"
        >
          <p className="flex items-start gap-2 font-semibold">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Saved station is not in this response
          </p>
          <p className="mt-0.5 opacity-90">
            Your manual choice has not been changed. Choose another station or Automatic.
          </p>
          {selection.alternatives.length ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] opacity-80">
                Alternatives
              </span>
              {selection.alternatives.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => onStationChange(station.id)}
                  className="min-h-8 rounded-full bg-card/70 px-2 text-[0.64rem] font-semibold text-foreground transition-colors hover:bg-card"
                >
                  {station.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="relative mt-3 flex min-h-0 flex-1 flex-col">
          <div className="rounded-[1.3rem] border border-outline-variant/70 bg-surface-container/40 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {selection.mode === "manual" ? "Manual station" : "Automatic station"}
                </p>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                  <p
                    data-testid="official-station-name"
                    className="truncate font-display text-lg font-semibold tracking-[-0.02em]"
                  >
                    {selected.name}
                  </p>
                  {selected.stationId ? (
                    <span
                      title="Station identifier published by the Department of Meteorology"
                      className="shrink-0 rounded-full bg-surface-container-high px-1.5 py-0.5 font-mono text-[0.58rem] font-semibold text-muted-foreground"
                    >
                      {selected.stationId}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[0.66rem] leading-4 text-muted-foreground">
                  {isMetar && selected.locationName
                    ? `${selected.locationName}${
                        selected.icaoId ? ` (${selected.icaoId})` : ""
                      } · `
                    : ""}
                  {stationDistance && activeLocation
                    ? `${stationDistance} from ${activeLocation.name} · `
                    : ""}
                  {stationReferenceLabel(selected)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p
                  className="font-display text-[2rem] font-semibold leading-none tracking-[-0.05em]"
                  data-testid="official-temperature"
                >
                  {officialTemperature(selected.temperatureC, temperatureUnit)}
                </p>
                <p className="mt-1 text-[0.66rem] font-medium leading-4 text-muted-foreground">
                  {selected.conditionLabel || "Condition not reported"}
                  {Number.isFinite(selected.cloudCoverOktas)
                    ? ` · ${cloudCover(selected.cloudCoverOktas)} cloud`
                    : ""}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.08em]",
                  selectedStale
                    ? "bg-tertiary-container text-on-tertiary-container"
                    : "bg-primary-container text-on-primary-container",
                )}
              >
                {selectedStale ? (
                  <AlertTriangle aria-hidden="true" className="size-3" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="size-3" />
                )}
                {clientStale
                  ? "Cached, not live"
                  : selectedStale
                    ? "Station data delayed"
                    : isMetar
                      ? "Official airport report"
                      : "Official reading"}
              </span>
              <span
                className="text-[0.68rem] font-semibold"
                data-testid="official-freshness"
              >
                {relativeObservationLabel(selected.observationTime, referenceNow)}
              </span>
            </div>

            <p className="mt-1.5 text-[0.66rem] leading-4 text-muted-foreground">
              {selected.observationTime
                ? `${colomboTime(selected.observationTime)} Sri Lanka time`
                : "The source did not include an observation timestamp for this station."}
              {selectedStale && selectedAge != null ? " · delayed for this reading" : ""}
            </p>

            <p
              className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.64rem] leading-4 text-muted-foreground"
              data-testid="official-fetched"
            >
              <RefreshCw aria-hidden="true" className="size-3 shrink-0" />
              <span>{relativeFetchLabel(fetchedTime, referenceNow)}</span>
              {fetchedTime ? <span>· {colomboTime(fetchedTime)} Sri Lanka time</span> : null}
              {servedTime && servedTime !== fetchedTime ? (
                <span>· Aeris checked {colomboTime(servedTime)}</span>
              ) : null}
            </p>

            {isMetar ? (
              <dl className="mt-3 grid grid-cols-2 gap-1.5">
                <Metric
                  icon={Droplets}
                  label="Humidity"
                  value={percent(selected.relativeHumidity)}
                />
                <Metric
                  icon={Wind}
                  label="Wind"
                  value={windValue}
                  supporting={windSupporting}
                />
                <Metric
                  icon={Gauge}
                  label="Pressure"
                  value={pressure(selected.pressureHpa)}
                />
                <Metric
                  icon={Eye}
                  label="Visibility"
                  value={selected.visibilityLabel || "Unavailable"}
                  supporting={selected.visibilityLabel ? "as reported" : null}
                />
              </dl>
            ) : (
              <dl className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                <Metric
                  icon={Droplets}
                  label="Humidity"
                  value={percent(selected.relativeHumidity)}
                />
                <Metric
                  icon={Wind}
                  label="Wind"
                  value={windValue}
                  supporting={windSupporting}
                />
                <Metric
                  icon={Gauge}
                  label="Pressure"
                  value={pressure(selected.pressureHpa)}
                  supporting="MSLP"
                />
                <Metric
                  icon={CloudRain}
                  label="Rain, 3 h"
                  value={millimetres(selected.rainfall3hMm)}
                />
                <Metric
                  icon={Waves}
                  label="Since 08:30"
                  value={millimetres(selected.rainfallSince0830Mm)}
                />
                <Metric
                  icon={Thermometer}
                  label="Dew point"
                  value={officialTemperature(selected.dewPointC, temperatureUnit)}
                />
              </dl>
            )}
            <p className="mt-2 text-[0.62rem] leading-4 text-muted-foreground">
              {isMetar
                ? "Temperature, humidity, wind, pressure, and visibility are official values from the airport METAR report. METAR does not carry a rainfall total, so Aeris leaves rainfall unavailable rather than showing zero."
                : `Temperature, humidity, wind, pressure, dew point, and rainfall are official DoM values from the ${representationLabel || "published feed"}, separate from the Open-Meteo forecast. A blank measurement means unavailable; 0.0 mm is a reported zero.`}
            </p>
          </div>

          <ModelComparison station={selected} />

          {isMetar && selected.rawObservation ? (
            <details className="mt-3 rounded-xl border border-outline-variant/70 px-3 py-2.5 text-[0.66rem] leading-4">
              <summary className="flex min-h-7 cursor-pointer items-center justify-between gap-2 font-semibold">
                Raw METAR report
                <span className="text-[0.62rem] font-normal text-muted-foreground">
                  {selected.icaoId}
                </span>
              </summary>
              <p className="mt-2 break-words rounded-lg bg-surface-container/55 px-2.5 py-2 font-mono text-[0.62rem] leading-5 text-muted-foreground">
                {selected.rawObservation}
              </p>
              <p className="mt-2 text-[0.62rem] leading-4 text-muted-foreground">
                The report as transmitted by the airport station. Aeris decodes the fields above
                and does not alter the raw report.
              </p>
            </details>
          ) : null}

          <details className="group mt-auto rounded-xl border border-outline-variant/70 px-3 py-2.5 text-[0.66rem] leading-4">
            <summary className="flex min-h-7 cursor-pointer items-center justify-between gap-2 font-semibold">
              How this station was chosen
              <span className="text-[0.62rem] font-normal text-muted-foreground group-open:hidden">
                Open
              </span>
              <span className="hidden text-[0.62rem] font-normal text-muted-foreground group-open:inline">
                Close
              </span>
            </summary>
            <div className="mt-2 space-y-1.5 border-t border-outline-variant pt-2 text-muted-foreground">
              <p>{selectionExplanation(selection)}</p>
              <p>{referenceNote}</p>
              {data?.fallback?.notice ? <p>{data.fallback.notice}</p> : null}
              {data?.notice && data.notice !== data?.fallback?.notice ? <p>{data.notice}</p> : null}
            </div>
          </details>
        </div>
      ) : null}

      {!loading && !failed && !selected && !manualMissing ? (
        <div className="relative mt-3 rounded-2xl border border-outline-variant/70 bg-surface-container/40 px-3.5 py-3 text-xs leading-5">
          <p className="flex items-center gap-2 font-semibold">
            <Thermometer aria-hidden="true" className="size-3.5 text-muted-foreground" />
            No automatic station for this place
          </p>
          <p className="mt-1 text-muted-foreground">
            Automatic station selection is designed for Sri Lankan locations. Choose a station
            above to see the latest official observation here.
          </p>
        </div>
      ) : null}

      {data?.stationCount ? (
        <p className="relative mt-2.5 text-[0.62rem] leading-4 text-muted-foreground">
          {data.stationCount} official {isMetar ? "airport " : ""}station record
          {data.stationCount === 1 ? "" : "s"} in this response
          {isMetar ? " from NOAA AWC METAR" : " from Sri Lanka DoM"}. Times shown in Sri Lanka
          Standard Time.
        </p>
      ) : null}
    </section>
  );
}
