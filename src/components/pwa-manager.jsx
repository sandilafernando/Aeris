"use client";

import { Download, RefreshCw, Share } from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { useServiceWorker } from "@/hooks/use-service-worker";
import { cn } from "@/lib/utils";

/**
 * Renders a small, dismissible banner when a new service worker is waiting.
 * Nothing is rendered on a first install or when no update exists.
 */
export function PwaManager({ className }) {
  const { updateAvailable, applyUpdate, dismissUpdate } = useServiceWorker();

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      className={cn(
        "fixed left-3 right-3 bottom-[calc(env(safe-area-inset-bottom,0px)_+_0.85rem)] z-40 mx-auto flex max-w-[26rem] items-start gap-3 rounded-2xl border border-outline-variant/80 bg-card/95 p-3.5 text-card-foreground shadow-[var(--shadow-soft)] backdrop-blur-md",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200",
        "sm:left-auto sm:right-5 sm:mx-0 sm:w-[23rem]",
        className,
      )}
    >
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-container">
        <RefreshCw aria-hidden="true" className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5">A new version is ready</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          Refresh Aeris to use the latest update.
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyUpdate}
            className="inline-flex min-h-10 items-center justify-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={dismissUpdate}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-outline-variant/80 bg-transparent px-4 text-xs font-semibold text-foreground transition-colors hover:bg-surface-container-high"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Honest install affordance. It only appears after the browser offers a real
 * install prompt, or on iOS where the Share → Add to Home Screen flow is the
 * only supported path. Standalone windows and unsupported browsers get null.
 */
export function InstallHint({ className }) {
  const { canInstall, isIos, isStandalone, ready, promptInstall } = useInstallPrompt();

  if (!ready || isStandalone) return null;

  if (canInstall) {
    return (
      <div
        className={cn(
          "flex flex-col gap-3 rounded-2xl border border-outline-variant/80 bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-container">
            <Download aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-5">Keep Aeris close</p>
            <p className="mt-0.5 max-w-[38ch] text-xs leading-5 text-muted-foreground">
              Add Aeris to your device for a full-screen forecast, without opening a browser tab.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={promptInstall}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Install Aeris
        </button>
      </div>
    );
  }

  if (isIos) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border border-outline-variant/80 bg-card p-4 text-card-foreground",
          className,
        )}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-container">
          <Share aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5">Add Aeris to your Home Screen</p>
          <p className="mt-1 max-w-[42ch] text-xs leading-5 text-muted-foreground">
            On iPhone or iPad, open the Share menu, then choose{" "}
            <span className="font-semibold text-foreground">Add to Home Screen</span>.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
