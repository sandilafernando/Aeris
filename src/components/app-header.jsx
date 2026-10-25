"use client";

import { ChevronDown, LoaderCircle, MapPin, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Brand } from "@/components/brand";
import { IconButton } from "@/components/icon-button";
import { cn } from "@/lib/utils";

export default function AppHeader({
  activeLocation,
  loading = false,
  refreshing = false,
  online = true,
  onOpenLocations,
  onRefresh,
  onOpenSettings,
}) {
  const locationSecondary = [activeLocation?.admin1, activeLocation?.country]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(" · ");

  return (
    <header className="safe-top sticky top-0 z-40 border-b border-border/60 bg-background/82 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1320px] items-center gap-2 px-4 md:h-[4.75rem] md:gap-4 md:px-8">
        <Brand />

        {activeLocation ? (
          <div className="flex min-w-0 flex-1 items-center justify-end sm:justify-start">
            <button
              type="button"
              onClick={onOpenLocations}
              aria-haspopup="dialog"
              aria-label={`${[activeLocation.name, locationSecondary]
                .filter(Boolean)
                .join(", ")}. Change location.`}
              className="group flex min-h-11 min-w-0 max-w-[13rem] items-center gap-2.5 rounded-full border border-border/80 bg-card/75 px-2.5 py-1.5 text-left transition-[background-color,border-color] hover:border-outline-variant hover:bg-surface-container md:max-w-[22rem] md:px-3.5"
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-container">
                <MapPin aria-hidden="true" className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-tight">
                  {activeLocation.name}
                </span>{" "}
                {locationSecondary ? (
                  <span className="mt-0.5 hidden truncate text-[0.68rem] leading-tight text-muted-foreground sm:block">
                    {locationSecondary}
                  </span>
                ) : null}
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-y-0.5"
              />
            </button>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-1">
          {activeLocation ? (
            <IconButton
              label={!online ? "Refresh unavailable offline" : refreshing ? "Refreshing weather" : "Refresh weather"}
              onClick={onRefresh}
              disabled={loading || refreshing || !online}
              className="relative"
            >
              {refreshing ? (
                <LoaderCircle aria-hidden="true" className="size-[1.15rem] animate-spin" />
              ) : (
                <RefreshCw aria-hidden="true" className="size-[1.15rem]" />
              )}
            </IconButton>
          ) : null}
          <IconButton label="Preferences" onClick={onOpenSettings}>
            <SlidersHorizontal aria-hidden="true" className="size-[1.15rem]" />
          </IconButton>
        </div>
      </div>
      <p className={cn("sr-only")} aria-live="polite">
        {refreshing ? "Refreshing weather data" : ""}
      </p>
    </header>
  );
}
