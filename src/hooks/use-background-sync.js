"use client";

import { useEffect, useState } from "react";

/**
 * Background weather checks for the installed app.
 *
 * The page hands the notification preference and the active place to the
 * service worker through a dedicated cache (the worker cannot read
 * localStorage) and registers a Periodic Background Sync tag. On a sync, the
 * worker fetches Open-Meteo itself and shows a local notification — there is
 * still no server, no push subscription, and no third-party messaging.
 *
 * Periodic Background Sync is not universally available (Safari and Firefox
 * have no equivalent, and Chrome only wakes installed apps), so every call is
 * feature-detected and failures fall back to page-open alerts only.
 */
export const BACKGROUND_CHECK_TAG = "aeris-precipitation-check";
export const NOTIFY_CONFIG_CACHE = "aeris-notify-config";
export const NOTIFY_CONFIG_URL = "/notify-config";

async function writeNotifyConfig(config) {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(NOTIFY_CONFIG_CACHE);
    await cache.put(
      NOTIFY_CONFIG_URL,
      new Response(JSON.stringify(config), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

async function applyPeriodicRegistration(registration, enabled) {
  if (!registration || !("periodicBackgroundSync" in registration)) return false;
  const periodic = registration.periodicBackgroundSync;

  if (!enabled) {
    try {
      await periodic.unregister(BACKGROUND_CHECK_TAG);
    } catch {
      // Nothing to undo; the page-open alerts still work.
    }
    return false;
  }

  const interval = 6 * 60 * 60 * 1000;
  const day = 24 * 60 * 60 * 1000;
  try {
    await periodic.register(BACKGROUND_CHECK_TAG, { minInterval: interval });
    return true;
  } catch {
    try {
      // Some browsers reject anything below one day.
      await periodic.register(BACKGROUND_CHECK_TAG, { minInterval: day });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Publishes the current notification state to the service worker and keeps the
 * periodic registration in step with it. Returns true only when background
 * checks are actually registered.
 */
export async function syncBackgroundWeatherChecks({ enabled, place }) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;

  await writeNotifyConfig({
    enabled: Boolean(enabled),
    place: enabled ? place : null,
    updatedAt: Date.now(),
  });

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return await applyPeriodicRegistration(registration, Boolean(enabled));
  } catch {
    return false;
  }
}

/**
 * Reports whether this browser exposes Periodic Background Sync for the
 * registered worker, so the Preferences copy never promises background alerts
 * it cannot deliver. False until the check resolves and whenever detection
 * itself is unavailable.
 */
export function useBackgroundSyncSupport(enabled = true) {
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      // The hook reports `false` while disabled instead of writing state from
      // the effect body; capability itself only changes across page loads.
      return undefined;
    }

    let cancelled = false;
    navigator.serviceWorker
      .getRegistration()
      .then((registration) => {
        if (cancelled) return;
        setDetected(Boolean(registration && "periodicBackgroundSync" in registration));
      })
      .catch(() => {
        if (!cancelled) setDetected(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return enabled ? detected : false;
}
