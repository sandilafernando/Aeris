"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  ImageOff,
  LoaderCircle,
  Pause,
  Play,
  RefreshCw,
  Satellite,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { formatShortDate, formatTime } from "@/lib/format";
import {
  availabilityXmlUrl,
  buildImageUrl,
  frameCandidates,
  frameSequence,
  isPlausibleImageSize,
  markerPosition,
  parseLatestFrameTime,
  viirsFrameTime,
} from "@/lib/satellite";
import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

const TIME_ZONE = "Asia/Colombo";
const LOOP_FRAME_COUNT = 6;

const LAYERS = [
  {
    id: "visible",
    label: "Visible",
    layer: "Himawari_AHI_Band3_Red_Visible_1km",
    size: { width: 800, height: 711 },
    daylightOnly: true,
    cadence: "10 min",
    caption:
      "Himawari-9 AHI red visible band, about 1.85 km detail over Sri Lanka. This solar channel is only meaningful in daylight and is refreshed about every 10 minutes.",
    alt: "Latest daylight Himawari-9 visible-band satellite imagery around Sri Lanka.",
    shortCaption: "Visible daylight",
  },
  {
    id: "infrared",
    label: "Infrared",
    layer: "Himawari_AHI_Band13_Clean_Infrared",
    size: { width: 600, height: 533 },
    daylightOnly: false,
    cadence: "10 min",
    caption:
      "Himawari-9 AHI clean infrared window. False colour highlights cold, high cloud tops and works day and night. Frames arrive about every 10 minutes.",
    alt: "Latest available Himawari-9 infrared satellite imagery around Sri Lanka. Colours indicate cloud-top temperature.",
    shortCaption: "Infrared cloud tops",
  },
  {
    id: "truecolor",
    label: "True colour",
    layer: "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    size: { width: 900, height: 800 },
    daylightOnly: false,
    daily: true,
    cadence: "daily",
    caption:
      "VIIRS Suomi NPP corrected reflectance, a finished daytime pass rather than a live frame. Orbital swaths can leave gaps, so use the forecast for local timing.",
    alt: "Latest completed VIIRS natural-colour satellite pass over Sri Lanka.",
    shortCaption: "Natural colour",
  },
];

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

async function fetchFrame(layer, time, controller) {
  const response = await fetch(buildImageUrl(layer.layer, { time, ...layer.size }), {
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
  return blob;
}

export default function SatelliteCard({ location, isDay = null }) {
  const { reducedEffects } = usePreferences();
  const [activeLayer, setActiveLayer] = useState(() =>
    isDay === true ? "visible" : "infrared",
  );
  const [attempt, setAttempt] = useState(0);
  const [image, setImage] = useState({
    status: "loading",
    url: "",
    frameTime: null,
  });
  const [loop, setLoop] = useState({
    status: "idle",
    frames: [],
    index: 0,
    error: null,
  });
  const [playing, setPlaying] = useState(false);
  const loopUrlsRef = useRef([]);
  const layer = LAYERS.find((entry) => entry.id === activeLayer) || LAYERS[0];
  const marker = markerPosition(location);
  const daylightUnavailable = layer.daylightOnly && isDay === false;

  const revokeLoopUrls = useCallback(() => {
    for (const frame of loopUrlsRef.current) URL.revokeObjectURL(frame.url);
    loopUrlsRef.current = [];
  }, []);

  useEffect(() => {
    // The visible solar channel is blank after dark. The render path shows an
    // explanatory panel instead, so there is nothing to fetch and no state to
    // rewrite here.
    if (daylightUnavailable) return undefined;

    const controller = new AbortController();
    let createdUrl = "";

    async function candidatesForLayer() {
      if (layer.daily) return [viirsFrameTime()];
      if (layer.id !== "infrared" && layer.id !== "visible") return [null];
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
          const blob = await fetchFrame(layer, time, controller);
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
  }, [activeLayer, attempt, daylightUnavailable, layer]);

  useEffect(() => {
    if (!playing || loop.status !== "ready" || loop.frames.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setLoop((current) =>
        current.status === "ready" && current.frames.length
          ? { ...current, index: (current.index + 1) % current.frames.length }
          : current,
      );
    }, 900);
    return () => window.clearInterval(timer);
  }, [loop.frames.length, loop.status, playing]);

  useEffect(() => () => revokeLoopUrls(), [revokeLoopUrls]);

  const loadLoop = useCallback(async () => {
    if (daylightUnavailable || layer.daily) return;
    const controller = new AbortController();
    setLoop({ status: "loading", frames: [], index: 0, error: null });
    revokeLoopUrls();
    try {
      const response = await fetch(availabilityXmlUrl(layer.layer), {
        signal: requestSignal(controller, 8_000),
        cache: "no-store",
        headers: { Accept: "text/xml" },
      });
      if (!response.ok) throw new Error("The GIBS frame list is unavailable.");
      const latest = parseLatestFrameTime(await response.text());
      const times = frameSequence(latest, LOOP_FRAME_COUNT + 1);
      if (times.length < 2) throw new Error("No timestamped frames are available.");

      const frames = [];
      for (const time of times) {
        try {
          const blob = await fetchFrame(layer, time, controller);
          frames.push({ time, url: URL.createObjectURL(blob) });
        } catch (error) {
          if (error?.name === "AbortError") break;
          // A single incomplete slot is skipped; the run keeps its real times.
        }
      }
      loopUrlsRef.current = frames;
      if (frames.length < 2) {
        throw new Error("NASA GIBS did not return a complete run of frames.");
      }
      setLoop({ status: "ready", frames, index: 0, error: null });
      setPlaying(!reducedEffects);
    } catch (error) {
      revokeLoopUrls();
      if (error?.name !== "AbortError") {
        setLoop({
          status: "error",
          frames: [],
          index: 0,
          error: error?.message || "The frame loop is unavailable.",
        });
      }
    }
  }, [daylightUnavailable, layer, reducedEffects, revokeLoopUrls]);

  const refresh = () => {
    setImage({ status: "loading", url: "", frameTime: null });
    revokeLoopUrls();
    setLoop({ status: "idle", frames: [], index: 0, error: null });
    setPlaying(false);
    setAttempt((current) => current + 1);
  };

  const selectLayer = (id) => {
    setActiveLayer(id);
    setImage({ status: "loading", url: "", frameTime: null });
    revokeLoopUrls();
    setLoop({ status: "idle", frames: [], index: 0, error: null });
    setPlaying(false);
    setAttempt((current) => current + 1);
  };

  const loopReady = loop.status === "ready" && loop.frames.length > 0;
  const display = loopReady
    ? loop.frames[Math.min(loop.index, loop.frames.length - 1)]
    : image;
  const displayTime = loopReady ? display.time : image.frameTime;
  const showImage = display.url && image.status !== "error";

  const stepFrame = (delta) => {
    if (!loopReady) return;
    setPlaying(false);
    setLoop((current) => ({
      ...current,
      index: (current.index + delta + current.frames.length) % current.frames.length,
    }));
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
                "min-h-8 rounded-full px-2 text-[0.62rem] font-semibold transition-colors sm:px-2.5",
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
          aria-busy={image.status === "loading" || loop.status === "loading"}
          className="relative min-h-[17rem] overflow-hidden rounded-[1.15rem] bg-slate-950 md:min-h-[19rem]"
        >
          {showImage ? (
            // The frame is an inspected blob URL, so next/image's optimizer
            // cannot add value and would only move the fetch server-side.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={display.url}
              alt={layer.alt}
              width={layer.size.width}
              height={layer.size.height}
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() =>
                setImage((current) => ({ ...current, status: "error", url: "" }))
              }
              className={cn(
                "absolute inset-0 size-full object-cover transition-opacity duration-500",
                image.status === "ready" || loopReady ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null}

          {image.status === "loading" || loop.status === "loading" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 text-slate-300">
              <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
              <p className="text-[0.68rem] font-medium">
                {loop.status === "loading"
                  ? "Loading a run of real frames…"
                  : "Loading NASA imagery…"}
              </p>
            </div>
          ) : null}

          {daylightUnavailable ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 px-6 text-center text-slate-300">
              <Satellite aria-hidden="true" className="size-6" />
              <p className="text-xs font-semibold">Visible light needs daylight</p>
              <p className="text-[0.66rem] leading-4 text-slate-400">
                It is night at this place, so the solar channel is blank. Switch to Infrared for
                a usable view.
              </p>
              <button
                type="button"
                onClick={() => selectLayer("infrared")}
                className="mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-slate-700 px-2.5 text-[0.66rem] font-semibold text-slate-200 hover:bg-slate-900"
              >
                Show infrared
              </button>
            </div>
          ) : null}

          {image.status === "error" && !loopReady && !daylightUnavailable ? (
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

          {marker && showImage ? (
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
            {showImage ? `${frameLabel(displayTime)} · ` : ""}
            {loopReady ? `Loop ${loop.index + 1}/${loop.frames.length} · ` : ""}
            {layer.shortCaption} · NASA EOSDIS GIBS
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-col">
          <p className="text-[0.72rem] leading-5 text-muted-foreground">{layer.caption}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="satellite-timeline">
            {layer.daily ? (
              <span className="rounded-full bg-surface-container px-2 py-1 text-[0.62rem] font-semibold text-muted-foreground">
                Daily pass · no 10-minute loop
              </span>
            ) : daylightUnavailable ? null : loopReady ? (
              <>
                <button
                  type="button"
                  onClick={() => setPlaying((value) => !value)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-[0.66rem] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {playing ? (
                    <Pause aria-hidden="true" className="size-3" />
                  ) : (
                    <Play aria-hidden="true" className="size-3" />
                  )}
                  {playing ? "Pause loop" : "Play loop"}
                </button>
                <button
                  type="button"
                  onClick={() => stepFrame(-1)}
                  aria-label="Previous satellite frame"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-outline-variant text-foreground hover:bg-surface-container"
                >
                  <SkipBack aria-hidden="true" className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => stepFrame(1)}
                  aria-label="Next satellite frame"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-outline-variant text-foreground hover:bg-surface-container"
                >
                  <SkipForward aria-hidden="true" className="size-3.5" />
                </button>
                <span className="text-[0.62rem] font-medium text-muted-foreground">
                  {loop.frames.length} real frames · {loop.index + 1}/{loop.frames.length}
                </span>
              </>
            ) : (
              <button
                type="button"
                onClick={loadLoop}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-outline-variant px-2.5 text-[0.66rem] font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary-container/40"
              >
                <Play aria-hidden="true" className="size-3" />
                Load 10-minute loop
              </button>
            )}
          </div>

          {loop.status === "error" ? (
            <p className="mt-1.5 text-[0.64rem] leading-4 text-muted-foreground" role="status">
              {loop.error} The latest frame is still shown.
            </p>
          ) : null}

          <ul className="mt-2.5 space-y-1.5 text-[0.68rem] leading-4 text-muted-foreground">
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
              {layer.daily
                ? "True colour is a completed daily pass, not a live view. Its timestamp is shown above the attribution."
                : "Frames arrive about every 10 minutes and can run 30–50 minutes behind. Aeris skips blank or incomplete frames and only loops timestamps NASA actually published."}
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
