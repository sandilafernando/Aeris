"use client";

import { useCallback, useSyncExternalStore } from "react";

const STANDALONE_QUERY = "(display-mode: standalone)";
const installPromptListeners = new Set();
let deferredPrompt = null;

const subscribeToStaticValue = () => () => {};
const getClientReady = () => true;
const getServerFalse = () => false;

function notifyInstallPromptListeners() {
  for (const listener of installPromptListeners) listener();
}

function subscribeToInstallPrompt(listener) {
  installPromptListeners.add(listener);
  return () => {
    installPromptListeners.delete(listener);
  };
}

function getCanInstall() {
  return Boolean(deferredPrompt);
}

function subscribeToDisplayMode(listener) {
  const media = window.matchMedia(STANDALONE_QUERY);

  window.addEventListener("appinstalled", listener);

  if (typeof media.addEventListener === "function") {
    media.addEventListener("change", listener);
  } else if (typeof media.addListener === "function") {
    media.addListener(listener);
  }

  return () => {
    window.removeEventListener("appinstalled", listener);

    if (typeof media.removeEventListener === "function") {
      media.removeEventListener("change", listener);
    } else if (typeof media.removeListener === "function") {
      media.removeListener(listener);
    }
  };
}

// Capture the prompt as early as the client bundle loads. The event can fire
// before React mounts, and it can only be used once.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notifyInstallPromptListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notifyInstallPromptListeners();
  });
}

function isIosDevice() {
  const navigatorLike = window.navigator;
  const userAgent = navigatorLike.userAgent || "";

  if (/iPad|iPhone|iPod/.test(userAgent)) return true;

  // iPadOS 13+ reports itself as a Mac. Multi-touch separates it from a Mac.
  return navigatorLike.platform === "MacIntel" && navigatorLike.maxTouchPoints > 1;
}

function isStandaloneDisplay() {
  if (window.navigator.standalone === true) return true;
  return window.matchMedia(STANDALONE_QUERY).matches;
}

/**
 * Exposes the browser's install prompt without guessing at availability.
 * `canInstall` is only true after a real `beforeinstallprompt` event; iOS gets
 * share-sheet guidance instead, and unsupported browsers get nothing.
 *
 * Client-only values use useSyncExternalStore with a false server snapshot, so
 * hydration stays consistent and detection happens after mount.
 */
export function useInstallPrompt() {
  const ready = useSyncExternalStore(subscribeToStaticValue, getClientReady, getServerFalse);
  const isIos = useSyncExternalStore(subscribeToStaticValue, isIosDevice, getServerFalse);
  const isStandalone = useSyncExternalStore(
    subscribeToDisplayMode,
    isStandaloneDisplay,
    getServerFalse,
  );
  const canInstall = useSyncExternalStore(
    subscribeToInstallPrompt,
    getCanInstall,
    getServerFalse,
  );

  const promptInstall = useCallback(async () => {
    const prompt = deferredPrompt;

    // A beforeinstallprompt event is single-use. Consume it so stale UI never
    // offers an install action that the browser will reject.
    if (!prompt) return "unavailable";

    deferredPrompt = null;
    notifyInstallPromptListeners();

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      return choice?.outcome === "accepted" ? "accepted" : "dismissed";
    } catch {
      return "unavailable";
    }
  }, []);

  return { canInstall, isIos, isStandalone, ready, promptInstall };
}
