"use client";

import { useState } from "react";
import {
  Check,
  LoaderCircle,
  MapPin,
  Navigation,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CitySearch } from "@/components/city-search";
import { requestCurrentPlace } from "@/lib/geolocation";
import { placeFromSearchResult, placeLabel } from "@/lib/storage";
import { cn } from "@/lib/utils";

export default function LocationDialog({
  open,
  onOpenChange,
  savedLocations,
  activeLocation,
  currentLocation,
  notice,
  onSelectPlace,
  onSelectCurrentPlace,
  onRemovePlace,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [geoStatus, setGeoStatus] = useState("idle");
  const [geoError, setGeoError] = useState("");
  const isSearching = searchQuery.trim().length > 0;

  function handleSearchResult(result) {
    const place = placeFromSearchResult(result);
    if (!place) return;
    onSelectPlace(place);
    setSearchQuery("");
  }

  async function handleLocate() {
    setGeoError("");
    setGeoStatus("locating");
    try {
      const place = await requestCurrentPlace();
      setGeoStatus("idle");
      onSelectCurrentPlace(place);
    } catch (error) {
      setGeoStatus("error");
      setGeoError(
        error?.message || "We couldn't determine your position. Search for a city instead.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="dialog-surface flex max-h-[min(90dvh,780px)] w-[calc(100%-1rem)] max-w-[40rem] flex-col gap-0 overflow-hidden rounded-[1.75rem] border-border bg-popover p-0 sm:w-[calc(100%-2rem)] sm:rounded-[2rem]"
      >
        <DialogHeader className="shrink-0 px-5 pb-4 pt-6 sm:px-7 sm:pt-7">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Places
          </p>
          <DialogTitle className="mt-1 pr-10 font-display text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Find your sky
          </DialogTitle>
          <DialogDescription className="max-w-[50ch] text-sm leading-6">
            Search anywhere in the world, or use your location for the place you&apos;re in right
            now.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-7">
          <CitySearch
            onSelect={handleSearchResult}
            onQueryChange={setSearchQuery}
            autoFocus
            compact
          />

          {notice ? (
            <p
              role="status"
              className="mt-3 rounded-xl bg-tertiary-container/70 px-3 py-2.5 text-xs leading-5 text-on-tertiary-container"
            >
              {notice}
            </p>
          ) : null}

          {!isSearching ? (
            <>
              <section className="mt-5" aria-labelledby="use-location-heading">
                <h2
                  id="use-location-heading"
                  className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Nearby
                </h2>
                <button
                  type="button"
                  onClick={handleLocate}
                  disabled={geoStatus === "locating"}
                  className="flex min-h-[4.25rem] w-full items-center gap-3 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3 text-left transition-[background-color,border-color] hover:border-primary/35 hover:bg-surface-container-high disabled:cursor-wait disabled:opacity-70"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-container">
                    {geoStatus === "locating" ? (
                      <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
                    ) : (
                      <Navigation aria-hidden="true" className="size-5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {geoStatus === "locating" ? "Finding your position…" : "Use my location"}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      Your browser asks for permission first. Not saved to this device.
                    </span>
                  </span>
                </button>
                {geoError ? (
                  <p
                    role="alert"
                    className="mt-2 rounded-xl bg-destructive/8 px-3 py-2.5 text-xs leading-5 text-destructive"
                  >
                    {geoError}
                  </p>
                ) : null}
                <p className="mt-2 flex items-start gap-1.5 px-1 text-[0.7rem] leading-5 text-muted-foreground">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  Coordinates are rounded and sent only to Open-Meteo for this forecast.
                </p>
              </section>

              <section className="mt-6" aria-labelledby="saved-places-heading">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h2
                    id="saved-places-heading"
                    className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    Saved places
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {savedLocations.length} / 20
                  </span>
                </div>

                {currentLocation ? (
                  <div
                    className={cn(
                      "mb-2 flex min-h-14 items-center gap-1 rounded-2xl border px-1 transition-colors",
                      activeLocation?.id === currentLocation.id
                        ? "border-primary/25 bg-primary-container/55 text-on-primary-container"
                        : "border-transparent hover:border-outline-variant hover:bg-surface-container",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectCurrentPlace(currentLocation)}
                      aria-current={
                        activeLocation?.id === currentLocation.id ? "true" : undefined
                      }
                      className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left"
                    >
                      <Navigation aria-hidden="true" className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          Your location
                        </span>
                        <span className="text-xs opacity-75">This session only</span>
                      </span>
                      {activeLocation?.id === currentLocation.id ? (
                        <Check aria-hidden="true" className="size-4 shrink-0" />
                      ) : null}
                    </button>
                  </div>
                ) : null}

                {savedLocations.length ? (
                  <ul className="space-y-1.5">
                    {savedLocations.map((place) => {
                      const isActive = activeLocation?.id === place.id;
                      return (
                        <li
                          key={`${place.id}-${place.latitude}-${place.longitude}`}
                          className={cn(
                            "flex items-center gap-1 rounded-2xl border px-1 transition-colors",
                            isActive
                              ? "border-primary/25 bg-primary-container/55 text-on-primary-container"
                              : "border-transparent hover:border-outline-variant hover:bg-surface-container",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectPlace(place)}
                            aria-current={isActive ? "true" : undefined}
                            className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left"
                          >
                            <MapPin aria-hidden="true" className="size-4 shrink-0 opacity-75" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">
                                {place.name}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {[place.admin1, place.country].filter(Boolean).join(" · ") ||
                                  placeLabel(place)}
                              </span>
                            </span>
                            {isActive ? (
                              <span className="rounded-full bg-card/55 p-1.5">
                                <Check aria-hidden="true" className="size-3.5" />
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemovePlace(place.id)}
                            aria-label={`Remove ${place.name} from saved places`}
                            className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-outline-variant px-4 py-5 text-sm">
                    <p className="font-semibold">No saved places yet</p>
                    <p className="mt-1 text-muted-foreground">
                      Search above and choose a place to keep it close.
                    </p>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
