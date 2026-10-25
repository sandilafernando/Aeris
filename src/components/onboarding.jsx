"use client";

import { useState } from "react";
import { LoaderCircle, LocateFixed, ShieldCheck, Sparkles } from "lucide-react";
import { CitySearch } from "@/components/city-search";
import { requestCurrentPlace } from "@/lib/geolocation";
import { placeFromSearchResult } from "@/lib/storage";

const FEATURES = [
  { index: "01", label: "24-hour detail" },
  { index: "02", label: "Seven-day outlook" },
  { index: "03", label: "No account, ever" },
];

export default function Onboarding({ onSelectPlace, onSelectCurrentPlace }) {
  const [geoStatus, setGeoStatus] = useState("idle");
  const [geoError, setGeoError] = useState("");

  function handleSearchResult(result) {
    const place = placeFromSearchResult(result);
    if (place) onSelectPlace(place);
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
      setGeoError(error?.message || "We couldn't determine your position. Search for a city instead.");
    }
  }

  return (
    <section
      className="hero-surface relative overflow-hidden rounded-[1.8rem] shadow-[var(--shadow-soft)] sm:rounded-[2.4rem]"
      aria-labelledby="onboarding-heading"
      data-testid="onboarding"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 size-[26rem] rounded-full opacity-60 blur-2xl"
        style={{ backgroundColor: "var(--hero-glow)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[42%] top-10 hidden size-36 rounded-full border lg:block"
        style={{ borderColor: "var(--hero-line)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-[42%_58%_51%_49%/52%_43%_57%_48%] border opacity-50"
        style={{ borderColor: "var(--hero-line)" }}
      />

      <div className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-12 lg:p-12 xl:p-14">
        <div className="min-w-0">
          <p
            className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--hero-muted)" }}
          >
            <Sparkles aria-hidden="true" className="size-3.5" />
            Real forecasts from Open-Meteo
          </p>

          <h1
            id="onboarding-heading"
            className="mt-4 max-w-[12ch] font-display text-[clamp(2.85rem,7.4vw,5.35rem)] font-medium leading-[0.9] tracking-[-0.065em]"
          >
            Weather,
            <br />
            in colour.
          </h1>

          <p
            className="mt-5 max-w-[47ch] text-[0.98rem] font-medium leading-6 sm:text-base sm:leading-7"
            style={{ color: "var(--hero-muted)" }}
          >
            A clear, expressive forecast for wherever you are going. Search a city to see the
            current sky, the next 24 hours, and the week ahead.
          </p>

          <ul className="mt-7 grid gap-x-5 gap-y-3 sm:grid-cols-3 lg:max-w-[30rem]">
            {FEATURES.map((feature) => (
              <li
                key={feature.index}
                className="flex items-baseline gap-2 border-t pt-2.5 text-sm font-semibold"
                style={{ borderColor: "var(--hero-line)" }}
              >
                <span
                  className="number-tabular text-[0.62rem] font-bold tracking-[0.12em]"
                  style={{ color: "var(--hero-muted)" }}
                >
                  {feature.index}
                </span>
                {feature.label}
              </li>
            ))}
          </ul>

          <p
            className="mt-6 hidden items-start gap-2 text-xs leading-5 lg:flex"
            style={{ color: "var(--hero-muted)" }}
          >
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            No account, no ads, no tracking scripts. Your places and units stay in this browser.
          </p>
        </div>

        <div className="relative rounded-[1.6rem] border border-border bg-card/95 p-4 text-card-foreground shadow-[0_24px_60px_-32px_rgba(15,30,25,0.55)] backdrop-blur-sm sm:rounded-[1.8rem] sm:p-6">
          <p className="eyebrow">Start here</p>
          <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.045em] sm:text-[1.8rem]">
            Which sky are you under?
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Search for a city, town, or island. You can save up to 20 places once you&apos;re in.
          </p>

          <div className="mt-5">
            <CitySearch onSelect={handleSearchResult} compact />
          </div>

          <div className="my-4 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[0.64rem] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={handleLocate}
            disabled={geoStatus === "locating"}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-outline-variant bg-surface-container/60 px-4 py-3 text-sm font-semibold transition-[background-color,border-color] hover:border-primary/35 hover:bg-surface-container-high disabled:cursor-wait disabled:opacity-70"
          >
            {geoStatus === "locating" ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <LocateFixed aria-hidden="true" className="size-4" />
            )}
            {geoStatus === "locating" ? "Finding your position…" : "Use my location"}
          </button>

          {geoError ? (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-destructive/10 px-3 py-2.5 text-xs leading-5 text-destructive"
            >
              {geoError}
            </p>
          ) : null}

          <p className="mt-4 flex items-start gap-1.5 text-[0.7rem] leading-5 text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Your browser asks before sharing a location. Current coordinates are never saved to
            this device.
          </p>
        </div>
      </div>
    </section>
  );
}
