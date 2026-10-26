"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  ImageOff,
  LoaderCircle,
  RefreshCw,
  Satellite,
} from "lucide-react";
import { formatShortDate, formatTime } from "@/lib/format";
import {
  availabilityXmlUrl,
  buildImageUrl,
  frameCandidates,
  isPlausibleImageSize,
  markerPosition,
  parseLatestFrameTime,
} from "@/lib/satellite";
import { cn } from "@/lib/utils";

const LAYERS = [
  {
    id: "infrared",
    label: "Infrared",
    layer: "Himawari_AHI_Band13_Clean_Infrared",
    caption:
      "Himawari-9 AHI clean infrared window. False colour highlights cold, high cloud tops. Near real time, about every 10 minutes.",
    alt: "Latest available Himawari-9 infrared satellite imagery around Sri Lanka. Colours indicate cloud-top temperature.",
  },
  {
    id: "truecolor",
    label: "True colour",
    layer: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    caption:
      "VIIRS Suomi NPP corrected reflectance. Natural-colour daily imagery, so it is not a real-time view and can contain gaps between orbital swaths.",
    alt: "Latest available VIIRS natural-colour satellite imagery around Sri Lanka.",
  },
];

const TIME_ZONE = "Asia/Colombo";

function requestSignal(controller, timeoutMs = 12_000) {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
    return controller.signal;
  }
  const timeout = AbortSignal.timeout(timeoutMs);
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([controller.signal, timeout]);
  }
  return controller.signal;
}

function frameLabel(frameTime) {
  if (!frameTime) return "Latest available frame";
  return `${formatShortDate(frameTime, TIME_ZONE)} · ${formatTime(
    frameTime,
    TIME_ZONE,
  )} Sri Lanka time`;
}

export default function SatelliteCard({ location }) {
  const [activeLayer, setActiveLayer] = useState("infrared");
  const [attempt, setAttempt] = useState(0);
  const [image, setImage] = useState({
    status: "loading",
    url: "",
    frameTime: null,
  });
  const layer = LAYERS.find((entry) => entry.id === activeLayer) || LAYERS[0];
  const marker = markerPosition(location);

  useEffect(() => {
    const controller = new AbortController();
    let createdUrl = "";

    async function candidatesForLayer() {
      if (layer.id !== "infrared") return [null];
      try {
        const response = await fetch(availabilityXmlUrl(layer.layer), {
          signal: requestSignal(controller, 8_000),
          cache: "no-store",
          headers: { Accept: "text/xml" },
        });
        if (!response.ok) return [null];
        const latest = parseLatestFrameTime(await response.text());
        return [...frameCandidates(latest, 3), null];
      } catch {
        return [null];
      }
    }

    async function load() {
      setImage({ status: "loading", url: "", frameTime: null });
      const candidates = await candidatesForLayer();
      if (controller.signal.aborted) return;
      let lastError = null;

      for (const time of candidates) {
        if (controller.signal.aborted) return;
        try {
          const response = await fetch(buildImageUrl(layer.layer, { time }), {
            signal: requestSignal(controller),
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error(`NASA GIBS returned HTTP ${response.status}.`);
          }
          const blob = await response.blob();
          if (!isPlausibleImageSize(blob.size)) {
            throw new Error("NASA GIBS returned a blank or incomplete frame.");
          }
          const nextUrl = URL.createObjectURL(blob);
          if (controller.signal.aborted) {
            URL.revokeObjectURL(nextUrl);
            return;
          }
          if (createdUrl) URL.revokeObjectURL(createdUrl);
          createdUrl = nextUrl;
          setImage({ status: "ready", url: nextUrl, frameTime: time });
          return;
        } catch (error) {
          if (controller.signal.aborted || error?.name === "AbortError") return;
          lastError = error;
        }
      }

      if (!controller.signal.aborted) {
        setImage({
          status: "error",
          url: "",
          frameTime: null,
          error: lastError?.message,
        });
      }
    }

    load();

    return () => {
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [activeLayer, attempt, layer.id, layer.layer]);

  const refresh = () => {
    setImage({ status: "loading", url: "", frameTime: null });
    setAttempt((current) => current + 1);
  };

  const selectLayer = (id) => {
    setActiveLayer(id);
    setImage({ status: "loading", url: "", frameTime: null });
    setAttempt((current) => current + 1);
  };

  return (
    <section
      className="surface-card relative min-w-0 overflow-hidden p-4 sm:p-5"
      aria-labelledby="satellite-heading"
      data-testid="satellite-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            <Satellite aria-hidden="true" className="size-3" />
            Earth view · NASA GIBS
          </p>
          <h2
            id="satellite-heading"
            className="mt-1 font-display text-xl font-semibold tracking-[-0.035em]"
          >
            Satellite cloud imagery
          </h2>
        </div>
        <div
          role="group"
          aria-label="Satellite layer"
          className="flex shrink-0 rounded-full border border-outline-variant bg-surface-container/60 p-0.5"
        >
          {LAYERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={entry.id === activeLayer}
              onClick={() => selectLayer(entry.id)}
              className={cn(
                "min-h-8 rounded-full px-2.5 text-[0.64rem] font-semibold transition-colors",
                entry.id === activeLayer
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-4">
        <figure
          aria-busy={image.status === "loading"}
          className="relative min-h-[17rem] overflow-hidden rounded-[1.15rem] bg-slate-950 md:min-h-[19rem]"
        >
          {image.status !== "error" && image.url ? (
            // The frame is an inspected blob URL, so next/image's optimizer
            // cannot add value and would only move the fetch server-side.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.url}
              alt={layer.alt}
              width="900"
              height="800"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() =>
                setImage((current) => ({ ...current, status: "error", url: "" }))
              }
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-500",
                image.status === "ready" ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null}

          {image.status === "loading" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 text-slate-300">
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
              <p className="text-[0.68rem] font-medium">Loading NASA imagery…</p>
            </div>
          ) : null}

          {image.status === "error" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 px-5 text-center text-slate-300">
              <ImageOff aria-hidden="true" className="size-6" />
              <p className="text-xs font-semibold">Satellite imagery unavailable</p>
              <p className="text-[0.66rem] leading-4 text-slate-400">
                NASA GIBS did not return a complete frame. This does not affect the forecast.
              </p>
              <button
                type="button"
                onClick={refresh}
                className="mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-700 px-2.5 text-[0.66rem] font-semibold text-slate-200 hover:bg-slate-900"
              >
                <RefreshCw aria-hidden="true" className="size-3" />
                Try again
              </button>
            </div>
          ) : null}

          {marker && image.status === "ready" ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: marker.left, top: marker.top }}
            >
              <span className="absolute inset-0 size-5 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-white/40 motion-reduce:hidden" />
              <span className="block size-2.5 rounded-full border-2 border-white bg-primary shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" />
            </span>
          ) : null}

          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-3 pb-2.5 pt-8 text-[0.6rem] font-medium leading-4 text-white/85">
            {location?.name ? `${location.name} marked · ` : ""}
            {image.status === "ready" ? `${frameLabel(image.frameTime)} · ` : ""}
            {layer.id === "infrared" ? "Infrared cloud tops" : "Natural colour"} · NASA EOSDIS
            GIBS
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-col">
          <p className="text-[0.72rem] leading-5 text-muted-foreground">{layer.caption}</p>
          <ul className="mt-2 space-y-1.5 text-[0.68rem] leading-4 text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Independent product.</span> This is
              NASA satellite imagery, not a Department of Meteorology observation and not a rain
              radar.
            </li>
            <li>
              <span className="font-semibold text-foreground">Clouds, not rainfall.</span> Bright or
              cold cloud tops do not by themselves prove that rain is reaching the ground.
            </li>
            <li>
              <span className="font-semibold text-foreground">Timing.</span>{" "}
              {layer.id === "infrared"
                ? "Infrared frames arrive about every 10 minutes and can run 30–50 minutes behind. Aeris skips blank or incomplete frames rather than showing them."
                : "Natural colour is a daily composite, not a real-time view. Use the forecast for local timing."}
            </li>
          </ul>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
            <button
              type="button"
              onClick={refresh}
              disabled={image.status === "loading"}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-2.5 text-[0.66rem] font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-container/40 disabled:opacity-60"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn("size-3", image.status === "loading" && "animate-spin")}
              />
              Refresh image
            </button>
            <a
              href="https://gibs.earthdata.nasa.gov/"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[0.66rem] font-semibold text-primary hover:bg-primary-container"
            >
              NASA GIBS
              <ExternalLink aria-hidden="true" className="size-3" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
