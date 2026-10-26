"use client";

import {
  Database,
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
import { usePreferences } from "@/components/preferences-provider";
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
  official,
}) {
  const {
    theme,
    temperatureUnit,
    windUnit,
    reducedEffects,
    stationId,
    setTheme,
    setTemperatureUnit,
    setWindUnit,
    setReducedEffects,
    setStationId,
  } = usePreferences();

  const stations = official?.data?.stations || [];
  const stationSource = official?.data?.source || null;
  const usingMetar =
    stationSource?.id === "sri-lanka-metar" ||
    stationSource?.kind === "official-aviation-observations";
  const stationLabel = usingMetar ? "NOAA AWC airport station" : "Sri Lanka DoM station";
  const stationReference = usingMetar
    ? "These are official airport station coordinates published by NOAA AWC, not Department of Meteorology district stations."
    : "Automatic selection uses approximate city-centre reference points, not official station coordinates, because the DoM page does not publish them.";
  const stationLoading = official?.status === "loading" && !official?.data;
  const stationError = official?.status === "error" && !official?.data;
  const manualMissing =
    stationId !== AUTOMATIC_STATION_ID &&
    stations.length > 0 &&
    !stations.some((station) => station.id === stationId);

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
                <label htmlFor="settings-station-select">{stationLabel}</label>
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
                className="text-[0.7rem] leading-5 text-muted-foreground"
              >
                Automatic chooses from the selected place and prefers a fresh observation over
                a stale nearer station. A manual choice is saved on this device and stays
                selected across refreshes and app restarts.
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
                  <p className="mt-0.5 text-muted-foreground">{official?.error}</p>
                  <button
                    type="button"
                    onClick={official?.refresh}
                    className="mt-1.5 min-h-9 rounded-full px-2.5 text-[0.68rem] font-semibold text-primary hover:bg-primary-container"
                  >
                    Try again
                  </button>
                </div>
              ) : null}

              {manualMissing ? (
                <div className="rounded-xl bg-tertiary-container/65 px-3 py-2.5 text-[0.7rem] leading-5 text-on-tertiary-container">
                  <p className="font-semibold">Saved station unavailable</p>
                  <p className="mt-0.5 opacity-90">
                    That station is not in the current official response. Your manual choice
                    has not been changed; choose another station above or Automatic.
                  </p>
                </div>
              ) : null}

              <p className="text-[0.66rem] leading-4 text-muted-foreground">
                {stationReference}
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
                  storage. Current coordinates stay in session storage for this tab only —
                  never in the saved list — and are cleared when the tab closes.
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
                  Lanka when its public page is reachable. If it is not, Aeris shows official
                  ICAO airport METAR reports from NOAA AWC and labels them as airport stations,
                  not DoM district stations. Both are fetched through Aeris&apos;s own route
                  handler and shown separately from the Open-Meteo forecast.
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
