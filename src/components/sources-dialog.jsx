"use client";

import { Database, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRESENCE_DISCLOSURE,
  PRESENCE_TOPIC_URL,
} from "@/lib/presence";

const SOURCES = [
  {
    name: "Open-Meteo forecast",
    role: "Live forecast, current conditions, hourly and seven-day outlook",
    url: "https://open-meteo.com/",
    detail:
      "Requested directly from the browser with no API key. Model fields are shown as received; missing values become “Unavailable”, never zero.",
    badge: "Live",
    tone: "live",
  },
  {
    name: "Open-Meteo ensemble",
    role: "GFS member spread for the confidence tool",
    url: "https://open-meteo.com/en/docs/ensemble-api",
    detail:
      "31 GFS members for the same coordinates. Aeris shows the range between members and does not turn it into a probability.",
    badge: "On demand",
    tone: "live",
  },
  {
    name: "Open-Meteo archive",
    role: "Seven-day reanalysis for the time machine",
    url: "https://open-meteo.com/en/docs/historical-weather-api",
    detail:
      "Historical reanalysis, not station observations. It can lag the present and may differ from official readings.",
    badge: "On demand",
    tone: "live",
  },
  {
    name: "GeoNames via Open-Meteo",
    role: "Place search and coordinates",
    url: "https://www.geonames.org/",
    detail:
      "Search results are filtered for usable names and coordinates. Aeris does not store a search history.",
    badge: "Live",
    tone: "live",
  },
  {
    name: "Sri Lanka Department of Meteorology",
    role: "Primary official 3-hourly station observations",
    url: "https://meteo.gov.lk/",
    detail:
      "Parsed server-side from the public station page. The station coordinates are not published there, so model comparisons use approximate city-centre reference points created by Aeris. If this host is unreachable from the deployment region, Aeris labels the fallback below instead of pretending the data came from DoM.",
    badge: "Official",
    tone: "official",
  },
  {
    name: "NOAA Aviation Weather Center",
    role: "Official ICAO airport METAR fallback",
    url: "https://aviationweather.gov/data/api/",
    detail:
      "Official airport weather reports from Sri Lankan ICAO stations. Used only when the DoM page cannot be reached. These are airport stations, not DoM district stations, and METAR does not include a rainfall total.",
    badge: "Fallback",
    tone: "official",
  },
  {
    name: "ntfy.sh public relay",
    role: "Best-effort visitor presence",
    url: PRESENCE_TOPIC_URL,
    detail: `${PRESENCE_DISCLOSURE} The topic is public; payloads contain only a random tab id and timestamp.`,
    badge: "Best effort",
    tone: "limited",
  },
];

const TONE_STYLES = {
  live: "bg-primary-container text-on-primary-container",
  official: "bg-secondary-container text-on-secondary-container",
  warning: "bg-destructive/10 text-destructive",
  limited: "bg-tertiary-container text-on-tertiary-container",
};

export default function SourcesDialog({ open, onOpenChange, onCloseAutoFocus }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus?.();
        }}
        className="dialog-surface flex max-h-[min(90dvh,780px)] w-[calc(100%-1rem)] max-w-[42rem] flex-col gap-0 overflow-hidden rounded-[1.75rem] border-border bg-popover p-0 sm:w-[calc(100%-2rem)] sm:rounded-[2rem]"
      >
        <DialogHeader className="shrink-0 px-5 pb-4 pt-6 sm:px-7 sm:pt-7">
          <p className="flex items-center gap-1.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <Database aria-hidden="true" className="size-3.5" />
            Data sources
          </p>
          <DialogTitle className="mt-1 pr-10 font-display text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
            Where the weather comes from
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            Every dataset Aeris uses, what it is for, and where it stops being authoritative.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-7">
          {SOURCES.map((source) => (
            <article
              key={source.name}
              className="rounded-2xl border border-outline-variant/75 bg-card/55 p-3.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 font-display text-sm font-semibold tracking-[-0.02em]">
                  {source.name}
                </h2>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.58rem] font-bold uppercase tracking-[0.1em]">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 ${TONE_STYLES[source.tone]}`}
                  >
                    {source.badge}
                  </span>
                </span>
              </div>
              <p className="mt-1 text-[0.7rem] font-medium text-muted-foreground">{source.role}</p>
              <p className="mt-1.5 text-[0.68rem] leading-5 text-muted-foreground">
                {source.detail}
              </p>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-flex min-h-8 items-center gap-1 text-[0.68rem] font-semibold text-primary underline decoration-outline-variant underline-offset-4 hover:text-foreground"
              >
                Open source
                <ExternalLink aria-hidden="true" className="size-3" />
                <span className="sr-only"> for {source.name} (opens in a new tab)</span>
              </a>
            </article>
          ))}

          <section className="rounded-2xl border border-outline-variant/75 bg-surface-container/45 p-3.5">
            <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold">
              <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
              What Aeris does not use
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[0.68rem] leading-5 text-muted-foreground">
              <li>
                No radar layer. The public RainViewer API is limited to personal and educational
                use, so it is not enabled in production without a separate licence.
              </li>
              <li>
                No analytics, ads, accounts, or third-party tracking scripts. Preferences and
                saved places stay in this browser.
              </li>
              <li>
                No server database or background push service is configured. Hourly models are
                fetched in the browser; official pages are fetched through the app&apos;s own
                route handlers.
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-outline-variant/75 p-3.5">
            <h2 className="flex items-center gap-1.5 font-display text-sm font-semibold">
              <Sparkles aria-hidden="true" className="size-4 text-primary" />
              Attribution
            </h2>
            <p className="mt-1.5 text-[0.68rem] leading-5 text-muted-foreground">
              Open-Meteo data is used under CC BY 4.0. Place search uses GeoNames data.
              Official station observations remain attributed to the Department of
              Meteorology, Sri Lanka, with a link to the original page. NOAA AWC METAR reports
              are attributed separately when they are used as the fallback. Aeris is an
              independent project, not affiliated with Google, the Department of Meteorology,
              or NOAA.
            </p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.68rem] font-semibold">
              <a
                href="https://open-meteo.com/en/license"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-8 items-center gap-1 text-primary underline decoration-outline-variant underline-offset-4"
              >
                Open-Meteo licence
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
              <a
                href="https://meteo.gov.lk/"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-8 items-center gap-1 text-primary underline decoration-outline-variant underline-offset-4"
              >
                Department of Meteorology
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
              <a
                href="https://aviationweather.gov/data/api/"
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex min-h-8 items-center gap-1 text-primary underline decoration-outline-variant underline-offset-4"
              >
                NOAA AWC
                <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
