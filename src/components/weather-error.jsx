"use client";

import { CloudOff, LocateFixed, RefreshCw, WifiOff } from "lucide-react";

export default function WeatherError({ error, location, online, onRetry, onOpenLocations }) {
  const offline = !online;
  const Icon = offline ? WifiOff : CloudOff;
  const title = offline ? "The sky is out of reach" : "The forecast slipped away";
  const message = offline
    ? "You're offline, so a fresh forecast can't be loaded right now. Check your connection and try again."
    : error?.message || "The weather forecast could not be loaded. Please try again.";

  return (
    <section
      className="surface-card relative overflow-hidden px-5 py-10 text-center sm:px-8 sm:py-14"
      role="alert"
      aria-labelledby="weather-error-heading"
      data-testid="weather-error"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-56 w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-container/70 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-[32rem] flex-col items-center">
        <span className="grid size-16 place-items-center rounded-full bg-primary-container text-on-primary-container">
          <Icon aria-hidden="true" className="size-7" />
        </span>
        <p className="eyebrow mt-5">{offline ? "Offline" : "Something went wrong"}</p>
        <h2
          id="weather-error-heading"
          className="mt-2 font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.04em] sm:text-4xl"
        >
          {title}
        </h2>
        <p className="mt-3 max-w-[42ch] text-sm leading-6 text-muted-foreground sm:text-base">
          {message}
        </p>
        {location?.name ? (
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            Forecast requested for {location.name}
          </p>
        ) : null}

        <div className="mt-6 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            disabled={offline}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Try again
          </button>
          <button
            type="button"
            onClick={onOpenLocations}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-outline-variant bg-card px-5 text-sm font-semibold transition-colors hover:bg-surface-container-high"
          >
            <LocateFixed aria-hidden="true" className="size-4" />
            Change place
          </button>
        </div>

        <p className="mt-5 text-[0.7rem] leading-5 text-muted-foreground">
          Forecasts come from Open-Meteo. If the problem continues, the service may be briefly
          unavailable.
        </p>
      </div>
    </section>
  );
}
