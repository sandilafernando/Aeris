"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  BellOff,
  Database,
  Download,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Monitor,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { SegmentedControl } from "@/components/segmented-control";
import StationSelect from "@/components/station-select";
import { InstallHint } from "@/components/pwa-manager";
import { usePreferences } from "@/components/preferences-provider";
import { useOnlineStatus } from "@/hooks/use-environment";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useBackgroundSyncSupport } from "@/hooks/use-background-sync";
import { useMetarObservations, useMeteoJson } from "@/hooks/use-official-source";
import {
  GLANCE_METRIC_IDS,
  GLANCE_METRIC_LABELS,
  MAX_GLANCE_METRICS,
  normalizeGlanceMetrics,
  normalizeGlanceSource,
  stationOptionsForSource,
} from "@/lib/glance";
import { AUTOMATIC_STATION_ID } from "@/lib/station-selection";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const TEMPERATURE_OPTIONS = [
  { value: "c", label: "°C" },
  { value: "f", label: "°F" },
];

const WIND_OPTIONS = [
  { value: "kmh", label: "km/h" },
  { value: "mph", label: "mph" },
  { value: "ms", label: "m/s" },
];

export default function SettingsDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
  onOpenSources,
}) {
  const {
    theme,
    temperatureUnit,
    windUnit,
    reducedEffects,
    stationId,
    weatherNotifications,
    glanceSource,
    glanceMetrics,
    setTheme,
    setTemperatureUnit,
    setWindUnit,
    setReducedEffects,
    setStationId,
    setWeatherNotifications,
    setGlanceMetrics,
  } = usePreferences();
  const online = useOnlineStatus();
  const install = useInstallPrompt();
  const resolvedSource = normalizeGlanceSource(glanceSource);
  const dom = useMeteoJson({ enabled: open, online });
  // Airports and Both need the METAR list so the station picker can match the
  // source the dashboard is showing. DoM stays the default and skips the call.
  const metar = useMetarObservations({ enabled: open && resolvedSource !== "dom", online });
  const [notificationPermission, setNotificationPermission] = useState("unknown");

  /* eslint-disable react-hooks/set-state-in-effect -- Notification.permission only exists in the browser and must be read after hydration. */
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(window.Notification.permission);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const notificationsSupported = notificationPermission !== "unsupported";
  const notificationsBlocked =
    notificationPermission === "denied" || notificationPermission === "unsupported";
  const notificationsActive =
    weatherNotifications && notificationPermission === "granted";
  // True only when this browser exposes Periodic Background Sync for the
  // registered worker, so the copy never promises background alerts it cannot
  // deliver.
  const backgroundChecksSupported = useBackgroundSyncSupport(open);

  const handleNotificationsChange = async (checked) => {
    if (!checked) {
      setWeatherNotifications(false);
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      setWeatherNotifications(false);
      return;
    }
    if (window.Notification.permission === "denied") {
      setNotificationPermission("denied");
      setWeatherNotifications(false);
      return;
    }
    if (window.Notification.permission === "granted") {
      setNotificationPermission("granted");
      setWeatherNotifications(true);
      return;
    }
    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
      setWeatherNotifications(permission === "granted");
    } catch {
      setNotificationPermission("denied");
      setWeatherNotifications(false);
    }
  };

  const stations = stationOptionsForSource({
    source: resolvedSource,
    dom: dom?.data,
    metar: metar?.data,
  });
  const activeSource = resolvedSource === "metar" ? metar : dom;
  const sourceLabel = resolvedSource === "metar" ? "airport" : "DoM";
  const stationLoading = activeSource?.status === "loading" && !activeSource?.data;
  const stationError = activeSource?.status === "error" && !activeSource?.data;
  const stationStale =
    (activeSource?.status === "stale" && Boolean(activeSource?.data)) ||
    activeSource?.data?.status === "stale";
  const manualMissing =
    stationId !== AUTOMATIC_STATION_ID &&
    stations.length > 0 &&
    !stations.some((station) => station.id === stationId);

  const metrics = normalizeGlanceMetrics(glanceMetrics);
  const toggleMetric = (metric) => {
    const selected = metrics.includes(metric);
    if (selected && metrics.length === 1) return;
    if (!selected && metrics.length >= MAX_GLANCE_METRICS) return;
    setGlanceMetrics(
      selected ? metrics.filter((entry) => entry !== metric) : [...metrics, metric],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus?.();
        }}
        className="dialog-surface flex max-h-[min(90dvh,760px)] w-[calc(100%-1rem)] max-w-[34rem] flex-col gap-0 overflow-hidden rounded-[1.75rem] border-border bg-popover p-0 sm:w-[calc(100%-2rem)] sm:rounded-[2rem]"
      >
        <DialogHeader className="shrink-0 px-5 pb-4 pt-6 sm:px-7 sm:pt-7">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Preferences
          </p>
          <DialogTitle className="mt-1 pr-10 font-display text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Make it yours
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            Theme and units are saved on this device. Your weather stays in sync everywhere.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-7">
          <section aria-labelledby="appearance-heading">
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <h2
                id="appearance-heading"
                className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Appearance
              </h2>
              <span className="text-xs text-muted-foreground">System follows your device</span>
            </div>
            <SegmentedControl
              label="Appearance"
              name="appearance"
              options={THEME_OPTIONS}
              value={theme}
              onChange={setTheme}
            />
          </section>

          {install.ready && install.isStandalone ? (
            <section aria-labelledby="install-heading">
              <h2
                id="install-heading"
                className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Installed app
              </h2>
              <div className="flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container/55 p-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-container">
                  <Download aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5">
                    Aeris is installed on this device
                  </p>
                  <p className="mt-0.5 text-[0.7rem] leading-5 text-muted-foreground">
                    You are using the standalone app window. Install prompts are hidden because
                    the app is already on this device.
                  </p>
                </div>
              </div>
            </section>
          ) : install.ready && (install.canInstall || install.isIos) ? (
            <section aria-labelledby="install-heading">
              <h2
                id="install-heading"
                className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Install Aeris
              </h2>
              <InstallHint />
              <p className="mt-2 px-1 text-[0.66rem] leading-4 text-muted-foreground">
                Installing adds a home-screen icon and a full-screen window. Aeris still keeps
                every preference and saved place in this browser, and nothing is uploaded to an
                account.
              </p>
            </section>
          ) : null}

          <section aria-labelledby="units-heading">
            <h2
              id="units-heading"
              className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Units
            </h2>
            <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container/55 p-3.5">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Thermometer aria-hidden="true" className="size-4 text-muted-foreground" />
                  Temperature
                </div>
                <SegmentedControl
                  label="Temperature unit"
                  name="temperature-unit"
                  options={TEMPERATURE_OPTIONS}
                  value={temperatureUnit}
                  onChange={setTemperatureUnit}
                />
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Wind aria-hidden="true" className="size-4 text-muted-foreground" />
                  Wind speed
                </div>
                <SegmentedControl
                  label="Wind speed unit"
                  name="wind-unit"
                  options={WIND_OPTIONS}
                  value={windUnit}
                  onChange={setWindUnit}
                />
              </div>
              <p className="px-1 text-[0.7rem] leading-5 text-muted-foreground">
                Choosing mph also switches visibility and precipitation amounts to imperial units.
              </p>
            </div>
          </section>

          <section aria-labelledby="glance-heading">
            <h2
              id="glance-heading"
              className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              At a glance
            </h2>
            <div className="space-y-4 rounded-2xl border border-outline-variant bg-surface-container/55 p-3.5">
              {/* The observation-source control lives in the At a glance widget. It was
                  duplicated here and this copy glitched when the source switched
                  mid-dialog, so this panel only edits metrics. */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Metrics</span>
                  <span className="text-[0.66rem] font-medium text-muted-foreground">
                    {metrics.length} of {MAX_GLANCE_METRICS}
                  </span>
                </div>
                <fieldset>
                  <legend className="sr-only">At a glance metrics</legend>
                  <div className="grid grid-cols-2 gap-1.5">
                    {GLANCE_METRIC_IDS.map((metric) => {
                      const selected = metrics.includes(metric);
                      const atLimit = !selected && metrics.length >= MAX_GLANCE_METRICS;
                      const lastOne = selected && metrics.length === 1;
                      return (
                        <label
                          key={metric}
                          className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[0.7rem] font-medium transition-colors ${
                            selected
                              ? "border-primary/40 bg-primary-container/60 text-on-primary-container"
                              : "border-outline-variant/80 bg-card/60 text-muted-foreground hover:text-foreground"
                          } ${atLimit || lastOne ? "cursor-not-allowed opacity-60" : ""}`}
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
                <p className="mt-2 px-1 text-[0.66rem] leading-4 text-muted-foreground">
                  A metric appears only where its source publishes it. The DoM snapshot has no
                  wind, pressure, cloud, or dew point; METAR has no rainfall total.
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="station-heading">
            <h2
              id="station-heading"
              className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Official station
            </h2>
            <div className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container/55 p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin aria-hidden="true" className="size-4 text-muted-foreground" />
                <label htmlFor="settings-station-select">
                  {resolvedSource === "metar"
                    ? "NOAA AWC airport station"
                    : resolvedSource === "combined"
                      ? "Official station (DoM and airports)"
                      : "Sri Lanka DoM station"}
                </label>
              </div>
              <StationSelect
                id="settings-station-select"
                value={stationId}
                stations={stations}
                onChange={setStationId}
                disabled={!stations.length}
                describedBy="settings-station-help"
              />
              <p
                id="settings-station-help"
                className="min-h-[4.5rem] text-[0.7rem] leading-5 text-muted-foreground"
              >
                {resolvedSource === "metar"
                  ? "Only the four NOAA AWC METAR airports are listed here, because that is all the airport feed publishes. A saved DoM district station stays saved; it simply has no airport report."
                  : resolvedSource === "combined"
                    ? "Both sources are listed together and share their station ids, so a saved station follows you across a source switch."
                    : "Automatic chooses from the selected place and prefers a fresh observation over a stale nearer station. A manual choice is saved on this device and stays selected across refreshes and app restarts."}
              </p>

              {stationLoading ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 text-[0.7rem] text-muted-foreground"
                >
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                  Loading the official station list…
                </p>
              ) : null}

              {stationError ? (
                <div className="rounded-xl bg-card/70 px-3 py-2.5 text-[0.7rem] leading-5">
                  <p className="font-semibold">Station list unavailable</p>
                  <p className="mt-0.5 text-muted-foreground">
                    The {sourceLabel} source did not respond.
                    {activeSource?.retryInSeconds > 0
                      ? ` Retrying in ${activeSource.retryInSeconds}s.`
                      : ""}
                  </p>
                  <button
                    type="button"
                    onClick={activeSource?.refresh}
                    className="mt-1.5 min-h-9 rounded-full px-2.5 text-[0.68rem] font-semibold text-primary hover:bg-primary-container"
                  >
                    Try again
                  </button>
                </div>
              ) : null}

              {stationStale ? (
                <p className="rounded-xl bg-tertiary-container/60 px-3 py-2 text-[0.7rem] leading-5 text-on-tertiary-container">
                  Showing the last successful station list. It is not a live response.
                </p>
              ) : null}

              {manualMissing ? (
                <div className="rounded-xl bg-tertiary-container/65 px-3 py-2.5 text-[0.7rem] leading-5 text-on-tertiary-container">
                  <p className="font-semibold">Saved station unavailable</p>
                  <p className="mt-0.5 opacity-90">
                    That station is not in the current response. Your manual choice has not been
                    changed; choose another station above or Automatic.
                  </p>
                </div>
              ) : null}

              <p className="text-[0.66rem] leading-4 text-muted-foreground">
                Automatic selection uses approximate city-centre reference points, not official
                station coordinates, because the Department&apos;s published feeds do not include
                coordinates. The same airport is used when the source switches to METAR.
              </p>
            </div>
          </section>

          <section aria-labelledby="effects-heading">
            <h2
              id="effects-heading"
              className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Motion &amp; effects
            </h2>
            <div className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container/55 p-3.5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <label
                    htmlFor="reduce-effects"
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    <Sparkles aria-hidden="true" className="size-4 text-muted-foreground" />
                    Reduce motion and effects
                  </label>
                  <p className="mt-1 text-[0.7rem] leading-5 text-muted-foreground">
                    Stops the weather-scene drift, rain, snow, and scroll reveals. System
                    reduced-motion settings are always respected.
                  </p>
                </div>
                <Switch
                  id="reduce-effects"
                  checked={reducedEffects}
                  onCheckedChange={setReducedEffects}
                  className="mt-0.5"
                />
              </div>
            </div>
          </section>

          <section aria-labelledby="notifications-heading">
            <h2
              id="notifications-heading"
              className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Weather alerts
            </h2>
            <div className="space-y-3 rounded-2xl border border-outline-variant bg-surface-container/55 p-3.5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <label
                    htmlFor="weather-notifications"
                    className="flex items-center gap-2 text-sm font-semibold"
                  >
                    {notificationsActive ? (
                      <Bell aria-hidden="true" className="size-4 text-muted-foreground" />
                    ) : (
                      <BellOff aria-hidden="true" className="size-4 text-muted-foreground" />
                    )}
                    Rain and storm notifications
                  </label>
                  <p id="weather-notifications-help" className="mt-1 text-[0.7rem] leading-5 text-muted-foreground">
                    Show a browser notification when the Open-Meteo forecast expects rain,
                    snow, or storms within the next few hours. Alerts are computed on this
                    device from the forecast, kept only in this browser, and are never sent
                    from a server.
                  </p>
                </div>
                <Switch
                  id="weather-notifications"
                  checked={notificationsActive}
                  onCheckedChange={handleNotificationsChange}
                  disabled={notificationsBlocked || notificationPermission === "unknown"}
                  aria-describedby="weather-notifications-help weather-notifications-status"
                  className="mt-0.5"
                />
              </div>

              <p
                id="weather-notifications-status"
                role="status"
                aria-live="polite"
                className="rounded-xl bg-card/70 px-3 py-2 text-[0.68rem] leading-5 text-muted-foreground"
              >
                {notificationPermission === "unsupported"
                  ? "This browser does not support notifications. The forecast remains available."
                  : notificationPermission === "denied"
                    ? "Notifications are blocked for Aeris. Allow them in your browser's site settings, then reopen this panel."
                    : notificationPermission === "granted" && weatherNotifications
                      ? "Notifications are on for this browser." +
                        (backgroundChecksSupported
                          ? " The installed app can also re-check while it is closed."
                          : " Closing the tab stops them.")
                      : notificationPermission === "granted"
                        ? "Browser permission is already granted. Turn this on to receive local alerts."
                        : notificationPermission === "unknown"
                          ? "Checking notification support…"
                          : "Aeris will ask your browser for permission when you turn this on."}
              </p>
              {notificationsSupported && notificationPermission !== "denied" ? (
                <p className="text-[0.66rem] leading-4 text-muted-foreground">
                  Nothing is sent to a server: the forecast is read on this device. In a
                  tab, alerts appear only while Aeris is open. On an installed app your
                  browser can also wake Aeris in the background where it supports Periodic
                  Background Sync.
                </p>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="privacy-heading">
            <h2
              id="privacy-heading"
              className="mb-2.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
              Data & privacy
            </h2>
            <div className="space-y-3 rounded-2xl border border-outline-variant px-4 py-4 text-sm leading-6 text-muted-foreground">
              <p className="flex gap-2.5">
                <ShieldCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                <span>
                  Themes, units, and up to 20 saved places live in this browser&apos;s local
                  storage, along with the last place shown so the installed app reopens
                  there. Current coordinates are never added to the saved list.
                </span>
              </p>
              <p className="flex gap-2.5">
                <Database aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                <span>
                  Forecasts and place search come from{" "}
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-semibold text-foreground underline decoration-outline-variant underline-offset-4 hover:text-primary"
                  >
                    Open-Meteo <span className="sr-only">(opens in a new tab)</span>
                  </a>
                  , including geocoding data from GeoNames. No account or API key is required.
                </span>
              </p>
              <p className="flex gap-2.5">
                <Database aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />
                <span>
                  Official station observations come from the Department of Meteorology, Sri
                  Lanka. At a glance reads the Department&apos;s published station snapshot, and a
                  same-origin route can also read the 3-hourly workbook and public map page. A DoM
                  reading older than five hours is labelled delayed, or replaced by a labelled
                  NOAA AWC airport METAR report. Airport reports are never presented as DoM
                  district readings, and the two sources are never merged.
                </span>
              </p>
              {onOpenSources ? (
                <button
                  type="button"
                  onClick={onOpenSources}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-3 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-primary-container/45"
                >
                  <Database aria-hidden="true" className="size-3.5" />
                  Data sources &amp; limits
                </button>
              ) : null}
            </div>
          </section>

          <details className="group rounded-2xl border border-outline-variant px-4 py-3.5 text-sm">
            <summary className="flex min-h-8 cursor-pointer items-center justify-between gap-3 font-semibold">
              About Aeris and the data
              <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                Open
              </span>
              <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">
                Close
              </span>
            </summary>
            <div className="mt-3 space-y-3 border-t border-outline-variant pt-3 text-xs leading-5 text-muted-foreground">
              <p>
                Forecasts update as Open-Meteo ingests new weather model runs. Some fields, such
                as UV index or visibility, may be unavailable for a place or model; Aeris marks
                those as unavailable rather than filling gaps with estimates.
              </p>
              <p>
                Live radar isn&apos;t included. The public RainViewer API is limited to
                personal and educational use, so it isn&apos;t suitable for a production site
                without a separate licence. Forecast precipitation is shown instead.
              </p>
              <p>
                Aeris is an independent project. Its interface is inspired by Material Design,
                but it is not affiliated with or endorsed by Google.
              </p>
              <a
                href="https://open-meteo.com/en/license"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-8 items-center gap-1.5 font-semibold text-foreground underline decoration-outline-variant underline-offset-4 hover:text-primary"
              >
                Open-Meteo terms and attribution
                <ExternalLink aria-hidden="true" className="size-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </div>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
