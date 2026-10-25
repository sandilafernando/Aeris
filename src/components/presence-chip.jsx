"use client";

import { useId } from "react";
import { usePresence } from "@/hooks/use-presence";
import { PRESENCE_DISCLOSURE } from "@/lib/presence";
import { cn } from "@/lib/utils";

export default function PresenceChip({ className }) {
  const descriptionId = useId();
  const { count, status } = usePresence();
  const live = status === "live" && Number.isFinite(count);
  const connecting = !live && (status === "connecting" || status === "live");
  const label = live
    ? `${count} here now`
    : connecting
      ? "Connecting…"
      : "Live count unavailable";
  const title =
    status === "offline"
      ? `${PRESENCE_DISCLOSURE} You appear to be offline.`
      : PRESENCE_DISCLOSURE;

  return (
    <>
      <span id={descriptionId} className="sr-only">
        {title}
      </span>
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-describedby={descriptionId}
        title={title}
        className={cn(
          "inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-outline-variant/80 bg-surface-container/70 px-2.5 py-1 text-[0.7rem] font-medium leading-5 text-muted-foreground",
          className,
        )}
      >
        <span aria-hidden="true" className="relative flex size-2.5 shrink-0">
          {live ? (
            <span className="absolute inline-flex size-full rounded-full bg-primary/45 motion-safe:animate-ping" />
          ) : null}
          <span
            className={cn(
              "relative inline-flex size-2.5 rounded-full border",
              live && "border-primary/40 bg-primary",
              connecting && "border-outline-variant bg-outline-variant motion-safe:animate-pulse",
              !live && !connecting && "border-outline-variant bg-outline-variant",
            )}
          />
        </span>
        <span>{label}</span>
      </span>
    </>
  );
}
