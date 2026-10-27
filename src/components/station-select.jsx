"use client";

import { ChevronDown } from "lucide-react";
import { AUTOMATIC_STATION_ID } from "@/lib/station-selection";
import { cn } from "@/lib/utils";

/**
 * Shared selector so the dashboard and Preferences always expose the same
 * real source stations and the same saved value. A missing manually selected
 * station remains visible as a disabled option instead of silently falling
 * back to another station.
 */
export default function StationSelect({
  id,
  value,
  stations = [],
  onChange,
  disabled = false,
  describedBy,
  className,
}) {
  const available = Array.isArray(stations) ? stations : [];
  const hasSourceList = available.length > 0;
  const manualValue = value && value !== AUTOMATIC_STATION_ID ? value : null;
  const sourceHasManual = manualValue
    ? available.some((station) => station.id === manualValue)
    : false;
  const showPendingManual = Boolean(manualValue) && !hasSourceList;
  const showMissingManual = Boolean(manualValue) && hasSourceList && !sourceHasManual;

  return (
    <div className={cn("relative", className)}>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-describedby={describedBy}
        className="min-h-11 w-full appearance-none rounded-xl border border-outline-variant bg-card py-2 pl-3 pr-9 text-base font-semibold text-foreground outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
      >
        <option value={AUTOMATIC_STATION_ID}>Automatic</option>
        {showPendingManual ? (
          <option value={manualValue} disabled>
            Saved station selection
          </option>
        ) : null}
        {showMissingManual ? (
          <option value={manualValue} disabled>
            Saved station unavailable
          </option>
        ) : null}
        {available.map((station) => (
          <option key={station.id} value={station.id}>
            {station.name}
            {station.stationId ? ` · ${station.stationId}` : ""}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
