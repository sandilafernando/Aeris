"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const SW_PATH = "/sw.js";
const SW_SCOPE = "/";

const subscribeToCapability = () => () => {};

function getServiceWorkerSupport() {
  return "serviceWorker" in navigator;
}

/**
 * Registers the Aeris service worker in production and exposes its lifecycle.
 *
 * The service worker is intentionally not registered during development, so a
 * stale cache can never mask local changes. All state starts false so the
 * server-rendered markup and the first client render agree.
 */
export function useServiceWorker() {
  // The server snapshot is false, so hydration cannot disagree; React switches
  // to the browser snapshot once mounted.
  const supported = useSyncExternalStore(
    subscribeToCapability,
    getServiceWorkerSupport,
    () => false,
  );
  const [ready, setReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  const registrationRef = useRef(null);
  const reloadOnControllerChangeRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      return;
    }

    let cancelled = false;
    const cleanups = [];
    const watchedWorkers = new WeakSet();

    const handleControllerChange = () => {
      if (cancelled) return;

      setReady(true);
      setOfflineReady(true);

      if (reloadOnControllerChangeRef.current) {
        reloadOnControllerChangeRef.current = false;
        window.location.reload();
      }
    };

    const watchInstallingWorker = (worker) => {
      if (!worker || watchedWorkers.has(worker)) return;
      watchedWorkers.add(worker);

      const handleStateChange = () => {
        if (cancelled || worker.state !== "installed") return;

        if (navigator.serviceWorker.controller) {
          // An existing worker is controlling this page, so this is an update
          // that can be applied deliberately.
          setUpdateAvailable(true);
        } else {
          // First install: the worker is ready but this tab is not controlled
          // until clients.claim() runs.
          setOfflineReady(true);
        }
      };

      worker.addEventListener("statechange", handleStateChange);
      cleanups.push(() => worker.removeEventListener("statechange", handleStateChange));

      // The worker may have reached "installed" before the listener attached.
      if (worker.state === "installed") handleStateChange();
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    cleanups.push(() =>
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange),
    );

    navigator.serviceWorker
      .register(SW_PATH, { scope: SW_SCOPE })
      .then((registration) => {
        if (cancelled) return;
        registrationRef.current = registration;

        if (registration.active) {
          setReady(true);
          setOfflineReady(Boolean(navigator.serviceWorker.controller));
        }

        if (registration.waiting && navigator.serviceWorker.controller) {
          setUpdateAvailable(true);
        }

        const handleUpdateFound = () => {
          watchInstallingWorker(registration.installing);
        };

        registration.addEventListener("updatefound", handleUpdateFound);
        cleanups.push(() => registration.removeEventListener("updatefound", handleUpdateFound));

        watchInstallingWorker(registration.installing);
      })
      .catch(() => {
        // Offline support is an enhancement. A failed registration must not
        // affect the forecast.
      });

    navigator.serviceWorker.ready
      .then(() => {
        if (cancelled) return;
        setReady(true);
        setOfflineReady(Boolean(navigator.serviceWorker.controller));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  const applyUpdate = useCallback(() => {
    const waiting = registrationRef.current?.waiting;

    if (!waiting) {
      setUpdateAvailable(false);
      return false;
    }

    reloadOnControllerChangeRef.current = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
    return true;
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  return { supported, ready, updateAvailable, applyUpdate, dismissUpdate, offlineReady };
}
