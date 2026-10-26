"use client";

import { useEffect, useRef } from "react";
import { findPrecipitationOnset, notificationKey } from "@/lib/weather-alerts";

/**
 * Optional local notification when precipitation is likely to start. It is
 * generated entirely in the open page from the Open-Meteo forecast; there is
 * no push subscription, service-worker push handler, or server notification.
 */
export function useWeatherNotifications({ enabled, data, location, now }) {
  const lastKeyRef = useRef("");

  useEffect(() => {
    if (!enabled || !data || !location) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (window.Notification.permission !== "granted") return;

    const onset = findPrecipitationOnset(data.hourly, data.current, now);
    if (!onset) return;

    const key = notificationKey(location, onset);
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    const place = location.name || "this place";
    const title =
      onset.kind === "Snow"
        ? `Snow likely soon in ${place}`
        : onset.kind === "Storms"
          ? `Storms likely soon in ${place}`
          : `Rain likely soon in ${place}`;
    const timing =
      onset.minutesAhead <= 30
        ? "within the next half hour"
        : `in about ${Math.round(onset.minutesAhead / 30) * 30} minutes`;
    try {
      new window.Notification(title, {
        body: `${onset.kind} ${timing}. Open Aeris for hourly timing and the official station reading.`,
        tag: `aeris-precipitation-${notificationKey(location, onset)}`,
        icon: "/icons/icon-192.png",
      });
    } catch {
      // A browser can expose Notification while still refusing construction.
      // The in-app outlook remains available, so fail quietly.
    }
  }, [enabled, data, location, now]);
}
