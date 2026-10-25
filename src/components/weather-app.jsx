"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CloudAlert, WifiOff } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import AppHeader from "@/components/app-header";
import Atmosphere from "@/components/atmosphere";
import CurrentWeatherHero from "@/components/current-weather-hero";
import DailyForecast from "@/components/daily-forecast";
import HourlyForecast from "@/components/hourly-forecast";
import LocationDialog from "@/components/location-dialog";
import Onboarding from "@/components/onboarding";
import SettingsDialog from "@/components/settings-dialog";
import SiteFooter from "@/components/site-footer";
import SunCard from "@/components/sun-card";
import WeatherError from "@/components/weather-error";
import WeatherSkeleton from "@/components/weather-skeleton";
import { usePreferences } from "@/components/preferences-provider";
import { useNow, useOnlineStatus } from "@/hooks/use-environment";
import { useWeather } from "@/hooks/use-weather";
import { formatTime, relativeUpdateLabel } from "@/lib/format";
import {
  normalizePlace,
  placeKey,
  placeLabel,
  readSavedPlaces,
  savePlacesState,
} from "@/lib/storage";
import { paletteCssVariables, resolvePalette } from "@/lib/palettes";

const MAX_SAVED_PLACES = 20;

function findSavedMatch(saved, place) {
  return saved.find(
    (entry) => entry.id === place.id || placeKey(entry) === placeKey(place),
  );
}

export default function WeatherApp() {
  const { resolvedTheme } = usePreferences();
  const reduceMotion = useReducedMotion();
  const clock = useNow(30_000);
  const online = useOnlineStatus();

  const [savedLocations, setSavedLocations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [sessionLocation, setSessionLocation] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locationsNotice, setLocationsNotice] = useState("");

  /* eslint-disable react-hooks/set-state-in-effect -- localStorage is read after hydration so the server and client markup match. */
  useEffect(() => {
    const stored = readSavedPlaces();
    setSavedLocations(stored.saved);
    setActiveId(stored.activeId);
    setStorageReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!storageReady) return;
    savePlacesState(savedLocations, activeId);
  }, [savedLocations, activeId, storageReady]);

  const activeLocation = useMemo(() => {
    if (sessionLocation && activeId === sessionLocation.id) return sessionLocation;
    return (
      savedLocations.find((place) => place.id === activeId) ||
      savedLocations[0] ||
      null
    );
  }, [activeId, savedLocations, sessionLocation]);

  const weather = useWeather(activeLocation);
  const refreshWeather = weather.refresh;
  const now = clock || weather.data?.fetchedAt || 0;
  const paletteGroup = weather.data?.current?.condition?.group || "partly";
  const paletteDay = weather.data?.current?.isDay ?? true;

  useEffect(() => {
    const palette = resolvePalette(paletteGroup, paletteDay, resolvedTheme);
    const variables = paletteCssVariables(palette);
    const root = document.documentElement;
    for (const [property, value] of Object.entries(variables)) {
      root.style.setProperty(property, value);
    }
    root.dataset.condition = palette.group;
    root.dataset.daylight = paletteDay ? "day" : "night";
  }, [paletteDay, paletteGroup, resolvedTheme]);

  useEffect(() => {
    document.title = activeLocation
      ? `${activeLocation.name} — Weather · Aeris`
      : "Aeris — Weather, in colour";
  }, [activeLocation]);

  useEffect(() => {
    if (!activeLocation || !online) return undefined;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshWeather();
    }, 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [activeLocation, online, refreshWeather]);

  const wasOnline = useRef(true);
  useEffect(() => {
    if (online && !wasOnline.current && activeLocation) {
      refreshWeather();
    }
    wasOnline.current = online;
  }, [activeLocation, online, refreshWeather]);

  const handleSelectPlace = useCallback(
    (input) => {
      const place = normalizePlace(input);
      if (!place) return;

      const existing = findSavedMatch(savedLocations, place);
      if (existing) {
        setActiveId(existing.id);
        setLocationsNotice("");
        setLocationsOpen(false);
        return;
      }

      if (savedLocations.length >= MAX_SAVED_PLACES) {
        setLocationsNotice(
          `Your saved list is full (${MAX_SAVED_PLACES}). Remove a place before adding ${place.name}.`,
        );
        return;
      }

      setSavedLocations((current) => [...current, place]);
      setActiveId(place.id);
      setLocationsNotice("");
      setLocationsOpen(false);
    },
    [savedLocations],
  );

  const handleSelectCurrentPlace = useCallback((input) => {
    const place = normalizePlace(input);
    if (!place) return;
    setSessionLocation(place);
    setActiveId(place.id);
    setLocationsNotice("");
    setLocationsOpen(false);
  }, []);

  const handleRemovePlace = useCallback(
    (id) => {
      const next = savedLocations.filter((place) => place.id !== id);
      setSavedLocations(next);
      setLocationsNotice("");
      if (activeId === id) {
        const fallback = next[0] || (sessionLocation?.id === activeId ? null : sessionLocation);
        setActiveId(fallback?.id || null);
      }
    },
    [activeId, savedLocations, sessionLocation],
  );

  const openLocations = useCallback(() => {
    setLocationsNotice("");
    setLocationsOpen(true);
  }, []);

  const closeLocations = useCallback((open) => {
    setLocationsOpen(open);
    if (!open) setLocationsNotice("");
  }, []);

  const hasData = Boolean(weather.data);
  const showLoading = storageReady && activeLocation && !hasData && weather.status !== "error";
  const showError = storageReady && activeLocation && !hasData && weather.status === "error";
  const refreshError = hasData && weather.error;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <AppHeader
        activeLocation={activeLocation}
        loading={showLoading}
        refreshing={weather.refreshing}
        online={online}
        onOpenLocations={openLocations}
        onRefresh={weather.refresh}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main
        id="main-content"
        aria-busy={showLoading || weather.refreshing || !storageReady}
        className="mx-auto w-full max-w-[1320px] flex-1 px-4 pb-4 pt-4 sm:px-5 sm:pt-5 md:px-8 md:pt-7"
      >
        {activeLocation ? (
          <h1 className="sr-only">Weather forecast for {placeLabel(activeLocation)}</h1>
        ) : null}

        {!online ? (
          <div
            role="status"
            className="mb-3 flex items-start gap-3 rounded-2xl border border-tertiary/25 bg-tertiary-container/65 px-4 py-3 text-on-tertiary-container md:mb-4"
          >
            <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">You&apos;re offline</p>
              <p className="mt-0.5 text-xs leading-5 opacity-80">
                {weather.data
                  ? `Showing the last forecast for ${activeLocation?.name || "this place"}, updated ${formatTime(weather.data.fetchedAt, weather.data.timezone)}.`
                  : "Reconnect to load a forecast. Saved places are still available."}
              </p>
            </div>
          </div>
        ) : null}

        {refreshError ? (
          <div
            role="alert"
            className="mb-3 flex flex-col gap-2 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between md:mb-4"
          >
            <p className="flex items-start gap-2.5">
              <CloudAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-destructive"
              />
              <span>
                <span className="font-semibold">Couldn&apos;t refresh.</span>{" "}
                {weather.error.message} Showing the last forecast —{" "}
                {relativeUpdateLabel(weather.data.fetchedAt, now).toLowerCase()}.
              </span>
            </p>
            {online ? (
              <button
                type="button"
                onClick={weather.refresh}
                className="shrink-0 self-start rounded-full px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary-container sm:self-auto"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : null}

        {!storageReady ? (
          <WeatherSkeleton message="Opening Aeris" />
        ) : !activeLocation ? (
          <Onboarding
            onSelectPlace={handleSelectPlace}
            onSelectCurrentPlace={handleSelectCurrentPlace}
          />
        ) : showError ? (
          <WeatherError
            error={weather.error}
            location={activeLocation}
            online={online}
            onRetry={weather.refresh}
            onOpenLocations={openLocations}
          />
        ) : showLoading || !weather.data ? (
          <WeatherSkeleton
            message={activeLocation ? `Loading weather for ${activeLocation.name}` : "Loading weather"}
          />
        ) : (
          <motion.div
            key={placeKey(activeLocation)}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="grid min-w-0 gap-3 md:gap-4 lg:grid-cols-12"
            data-testid="weather-dashboard"
          >
            <div className="min-w-0 lg:col-span-7 xl:col-span-8">
              <CurrentWeatherHero
                data={weather.data}
                location={activeLocation}
                now={now}
              />
            </div>

            <div className="flex min-w-0 flex-col gap-3 md:gap-4 lg:col-span-5 xl:col-span-4">
              <SunCard
                current={weather.data.current}
                timezone={weather.data.timezone}
                now={now}
              />
              <Atmosphere current={weather.data.current} />
            </div>

            <div className="min-w-0 lg:col-span-12">
              <HourlyForecast
                hourly={weather.data.hourly}
                timezone={weather.data.timezone}
                locationName={activeLocation.name}
              />
            </div>

            <div className="min-w-0 lg:col-span-12">
              <DailyForecast
                daily={weather.data.daily}
                timezone={weather.data.timezone}
                locationName={activeLocation.name}
              />
            </div>
          </motion.div>
        )}

        <SiteFooter />
      </main>

      <LocationDialog
        open={locationsOpen}
        onOpenChange={closeLocations}
        savedLocations={savedLocations}
        activeLocation={activeLocation}
        currentLocation={sessionLocation}
        notice={locationsNotice}
        onSelectPlace={handleSelectPlace}
        onSelectCurrentPlace={handleSelectCurrentPlace}
        onRemovePlace={handleRemovePlace}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
