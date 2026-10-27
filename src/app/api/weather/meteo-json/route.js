import { readFile } from "node:fs/promises";
import path from "node:path";
import { connection } from "next/server";
import { createCachedFetcher } from "@/lib/sources/cache";
import {
  METEO_JSON_SOURCE,
  METEO_JSON_STALE_MINUTES,
  METEO_JSON_URL,
  MeteoJsonError,
  fetchMeteoJson,
} from "@/lib/sources/meteo-json";
import { FUTURE_OBSERVATION_TOLERANCE_MINUTES } from "@/lib/station-selection";

// The snapshot is a small file, but GitHub and the local repository fallback
// need a bounded request-time budget.
export const maxDuration = 20;

// The collector runs every 30 minutes. A two-minute server cache prevents a
// burst of dashboard loads from all hitting GitHub, while still following the
// published file closely.
const COLLECTION_STALE_MINUTES = 90;

async function readRepositorySnapshot() {
  try {
    const text = await readFile(
      path.join(process.cwd(), "data", "meteo.json"),
      "utf8",
    );
    return JSON.parse(text);
  } catch (error) {
    throw new MeteoJsonError(
      "The committed DoM snapshot is not available in this deployment.",
      "local-snapshot-unavailable",
      { cause: error?.code || null },
    );
  }
}

async function loadSnapshot() {
  const { data, retrieval } = await fetchMeteoJson({
    url: METEO_JSON_URL,
    localLoader: readRepositorySnapshot,
  });
  return { ...data, retrieval };
}

const cache = createCachedFetcher(loadSnapshot, {
  ttlMs: 2 * 60 * 1000,
  staleTtlMs: 6 * 60 * 60 * 1000,
});

function responseHeaders() {
  return {
    "Cache-Control":
      "public, max-age=0, s-maxage=120, stale-while-revalidate=1800",
    "X-Content-Type-Options": "nosniff",
    Vary: "Accept-Encoding",
  };
}

function ageMinutes(iso, now) {
  const parsed = Date.parse(iso || "");
  if (!Number.isFinite(parsed)) return null;
  return (now - parsed) / 60_000;
}

function safeErrorMessage(error) {
  const message =
    typeof error?.message === "string" && error.message.trim()
      ? error.message.trim()
      : "The DoM snapshot is unavailable.";
  return message.slice(0, 240);
}

export async function GET() {
  // Live snapshot data must be read at request time, not prerendered.
  await connection();

  try {
    const result = await cache.get();
    const data = result.data;
    const now = Date.now();
    const servedAt = new Date(now).toISOString();
    const observationAge = ageMinutes(data.observationTime, now);
    const collectionAge = ageMinutes(data.collectedAt, now);
    const staleAfterMinutes =
      Number.isFinite(data.staleAfterMinutes) && data.staleAfterMinutes > 0
        ? data.staleAfterMinutes
        : METEO_JSON_STALE_MINUTES;
    const observationStale =
      observationAge == null ||
      observationAge > staleAfterMinutes ||
      // A timestamp ahead of the server clock is not fresh. Without this guard
      // a bad source clock would report a negative age and look current.
      observationAge < -FUTURE_OBSERVATION_TOLERANCE_MINUTES;
    const collectionStale =
      collectionAge == null || collectionAge > COLLECTION_STALE_MINUTES;
    const upstreamStale = result.cache === "stale";

    const notices = [];
    if (upstreamStale) {
      notices.push(
        "The published DoM snapshot could not be refreshed. Showing the last successful snapshot, which may be older than its collector timestamp.",
      );
    }
    if (observationStale) {
      notices.push(
        `The latest observation in the DoM snapshot is older than ${Math.round(
          staleAfterMinutes / 60,
        )} hours.`,
      );
    }
    if (collectionStale && !observationStale) {
      notices.push(
        "The DoM collector has not published a fresh snapshot recently, even though the contained observation is still within the five-hour limit.",
      );
    }
    if (data.retrieval?.mode === "local-fallback") {
      notices.push(
        "GitHub was unreachable, so Aeris used the snapshot committed in this deployment.",
      );
    }

    return Response.json(
      {
        ...data,
        status:
          upstreamStale || observationStale || collectionStale ? "stale" : "ok",
        servedAt,
        cache: result.cache,
        upstreamStale,
        observationAgeMinutes:
          observationAge == null ? null : Math.round(observationAge),
        collectionAgeMinutes:
          collectionAge == null ? null : Math.round(collectionAge),
        observationStale,
        collectionStale,
        staleAfterMinutes,
        collectionStaleAfterMinutes: COLLECTION_STALE_MINUTES,
        notice: notices.length ? notices.join(" ") : null,
      },
      { headers: responseHeaders() },
    );
  } catch (error) {
    console.error(
      "[meteo-json] Snapshot unavailable:",
      error?.code || "unknown",
      error?.message,
    );
    return Response.json(
      {
        status: "unavailable",
        source: {
          ...METEO_JSON_SOURCE,
          feedUrl: METEO_JSON_URL,
        },
        fetchedAt: new Date().toISOString(),
        error: safeErrorMessage(error),
        code: error?.code || "meteo-json-unavailable",
        notice:
          "Aeris does not invent station observations. Open-Meteo forecast data remains available, and NOAA AWC METAR may be available as a labelled fallback.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
