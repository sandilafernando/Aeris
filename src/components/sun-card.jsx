"use client";

import { Sunrise, Sunset } from "lucide-react";
import {
  formatDaylightDuration,
  formatNumber,
  formatTime,
} from "@/lib/format";
import { uvIndexLabel } from "@/lib/weather";
import { cn } from "@/lib/utils";

const UV_TONES = {
  low: "bg-primary-container text-on-primary-container",
  moderate: "bg-tertiary-container text-on-tertiary-container",
  high: "bg-destructive/10 text-destructive",
  "very-high": "bg-destructive/10 text-destructive",
  extreme: "bg-destructive/15 text-destructive",
  neutral: "bg-surface-container text-muted-foreground",
};

function SunMarker({ progress, hasTimes }) {
  if (!hasTimes) return null;
  const clamped = Math.min(1, Math.max(0, progress));
  const x = 140 - 110 * Math.cos(clamped * Math.PI);
  const y = 110 - 110 * Math.sin(clamped * Math.PI);

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r="13"
        fill="var(--primary)"
        opacity="0.16"
        className="soft-pulse"
      />
      <circle cx={x} cy={y} r="6.5" fill="var(--primary)" />
      <circle cx={x} cy={y} r="2" fill="var(--card)" opacity="0.9" />
    </g>
  );
}

function statusLine({ sunrise, sunset, now, timezone }) {
  if (!sunrise || !sunset || sunset <= sunrise) {
    return "Sunrise and sunset are unavailable for this day.";
  }
  if (now < sunrise) {
    const wait = formatDaylightDuration((sunrise - now) / 1000);
    return `Before sunrise · Sunrise in ${wait}`;
  }
  if (now <= sunset) {
    const remaining = formatDaylightDuration((sunset - now) / 1000);
    return `The sun is up · ${remaining} until sunset`;
  }
  return `After sunset · Daylight ended at ${formatTime(sunset, timezone)}`;
}

export default function SunCard({ current, timezone, now }) {
  const sunrise = current.sunrise;
  const sunset = current.sunset;
  const hasTimes = Number.isFinite(sunrise) && Number.isFinite(sunset) && sunset > sunrise;
  const progress = hasTimes
    ? Math.min(1, Math.max(0, (now - sunrise) / (sunset - sunrise)))
    : 0;
  const uv = uvIndexLabel(current.uvIndex);
  const uvLabel = Number.isFinite(current.uvIndex)
    ? `UV ${formatNumber(current.uvIndex, { maximumFractionDigits: 1 })} · ${uv.label}`
    : "UV unavailable";
  const status = statusLine({ sunrise, sunset, now, timezone });

  return (
    <section
      className="surface-card flex flex-col p-4 sm:p-5"
      aria-labelledby="sun-card-heading"
      data-testid="sun-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Sun &amp; daylight</p>
          <h2
            id="sun-card-heading"
            className="mt-1 font-display text-lg font-semibold tracking-[-0.03em] sm:text-xl"
          >
            The light today
          </h2>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[0.66rem] font-bold tracking-[0.02em]",
            UV_TONES[uv.tone] || UV_TONES.neutral,
          )}
        >
          {uvLabel}
        </span>
      </div>

      <div className="relative mt-1.5">
        <svg
          aria-hidden="true"
          viewBox="0 0 280 122"
          className="h-auto w-full overflow-visible"
        >
          <path
            d="M30 110A110 110 0 0 1 250 110"
            fill="none"
            stroke="var(--outline-variant)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {hasTimes ? (
            <path
              d="M30 110A110 110 0 0 1 250 110"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinecap="round"
              pathLength="1"
              strokeDasharray={`${progress} 1`}
              opacity="0.72"
            />
          ) : null}
          <SunMarker progress={progress} hasTimes={hasTimes} />
          <line
            x1="22"
            y1="110"
            x2="258"
            y2="110"
            stroke="var(--outline-variant)"
            strokeWidth="1"
            strokeDasharray="1 7"
            strokeLinecap="round"
          />
        </svg>

        <div className="pointer-events-none absolute inset-x-0 top-[47%] -translate-y-1/2 text-center">
          <p className="number-tabular font-display text-2xl font-semibold tracking-[-0.04em] sm:text-[1.7rem]">
            {formatDaylightDuration(current.daylightDuration)}
          </p>
          <p className="mt-0.5 text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Total daylight
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-3 border-t border-border/70 pt-3">
        <div>
          <p className="flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            <Sunrise aria-hidden="true" className="size-3.5" />
            Sunrise
          </p>
          <p className="mt-1 text-sm font-semibold">
            {Number.isFinite(sunrise) ? (
              <time dateTime={new Date(sunrise).toISOString()}>
                {formatTime(sunrise, timezone)}
              </time>
            ) : (
              "Unavailable"
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            <Sunset aria-hidden="true" className="size-3.5" />
            Sunset
          </p>
          <p className="mt-1 text-sm font-semibold">
            {Number.isFinite(sunset) ? (
              <time dateTime={new Date(sunset).toISOString()}>
                {formatTime(sunset, timezone)}
              </time>
            ) : (
              "Unavailable"
            )}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">{status}</p>
    </section>
  );
}
