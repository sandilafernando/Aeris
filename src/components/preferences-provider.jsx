"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { readPreferences, savePreferences } from "@/lib/storage";

const PreferencesContext = createContext(null);

function systemPrefersDark() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(theme, resolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;
  root.dataset.theme = theme;
}

export function PreferencesProvider({ children }) {
  // The initializer is hydration-safe here: no markup is rendered directly
  // from preference values before the client has mounted.
  const [preferences, setPreferences] = useState(readPreferences);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme =
    preferences.theme === "dark" || (preferences.theme === "system" && systemDark)
      ? "dark"
      : "light";

  useEffect(() => {
    applyTheme(preferences.theme, resolvedTheme);
    document.documentElement.dataset.effects = preferences.reducedEffects
      ? "reduced"
      : "full";
    savePreferences(preferences);
  }, [preferences, resolvedTheme]);

  const updatePreferences = useCallback((partial) => {
    setPreferences((current) => ({ ...current, ...partial }));
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      resolvedTheme,
      theme: preferences.theme,
      temperatureUnit: preferences.temperatureUnit,
      windUnit: preferences.windUnit,
      reducedEffects: preferences.reducedEffects,
      stationId: preferences.stationId,
      measurementSystem: preferences.windUnit === "mph" ? "imperial" : "metric",
      setTheme: (theme) => updatePreferences({ theme }),
      setTemperatureUnit: (temperatureUnit) => updatePreferences({ temperatureUnit }),
      setWindUnit: (windUnit) => updatePreferences({ windUnit }),
      setReducedEffects: (reducedEffects) => updatePreferences({ reducedEffects }),
      setStationId: (stationId) => updatePreferences({ stationId }),
    }),
    [preferences, resolvedTheme, updatePreferences],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}
