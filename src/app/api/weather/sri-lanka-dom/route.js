import { connection } from "next/server";
import { createCachedFetcher } from "@/lib/sources/cache";
import {
  OFFICIAL_FALLBACK_NOTICE,
  fetchOfficialObservations,
} from "@/lib/sources/official-observations";
import { SRI_LANKA_DOM_URL } from "@/lib/sources/sri-lanka-dom";

// Vercel/Netlify functions may need more than the default budget when the
// primary official host is unreachable and the fallback is being fetched.
export const maxDuration = 60;

const cache = createCachedFetcher(fetchOfficialObservations, {
  ttlMs: 5 * 60 * 1000,
  staleTtlMs: 6 * 60 * 60 * 1000,
});

function safeAttempts(attempts) {
  if (!Array.isArray(attempts)) return [];
  return attempts.slice(0, 8).map((attempt) => ({
    attempt: attempt?.attempt ?? null,
    status: attempt?.status ?? null,
    code: attempt?.code || "unknown",
    durationMs: Number.isFinite(attempt?.durationMs) ? attempt.durationMs : null,
  }));
}

function responseHeaders() {
  return {
    // The route reads a public page and has no request parameters. Five
    // minutes matches the official page cadence; the browser never sends
    // place names or saved coordinates with this request.
    "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=1800",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET() {
  // With Cache Components enabled, a GET handler that performs no request-time
  // work is prerendered at build time. Official observations are live data:
  // opt into request-time rendering before touching the cache or clock.
  await connection();

  try {
    const result = await cache.get();
    const data = result.data;
    const servedAt = new Date().toISOString();
    const observationMs = Date.parse(data.observationTime || "");
    const staleAfterMinutes =
      Number.isFinite(data.staleAfterMinutes) && data.staleAfterMinutes > 0
        ? data.staleAfterMinutes
        : 6 * 60;
    const observationAgeMinutes = Number.isFinite(observationMs)
      ? Math.max(0, Math.round((Date.now() - observationMs) / 60_000))
      : null;
    const observationStale =
      observationAgeMinutes == null || observationAgeMinutes > staleAfterMinutes;
    const upstreamStale = result.cache === "stale";

    const notices = [];
    if (upstreamStale) {
      notices.push(
        "The official source could not be refreshed. Showing the last successful response, which may be older than its timestamp.",
      );
    }
    if (data.notice) notices.push(data.notice);
    if (observationStale && !data.notice) {
      notices.push(
        `The latest observation on the official source is older than ${Math.round(
          staleAfterMinutes / 60,
        )} hours.`,
      );
    }

    if (data.fallback?.active) {
      console.warn(
        `[official-observations] DoM unavailable (${data.fallback.reason}); serving NOAA AWC METAR fallback.`,
      );
    }

    return Response.json(
      {
        ...data,
        attempts: safeAttempts(data.attempts),
        status: upstreamStale || observationStale ? "stale" : "ok",
        servedAt,
        cache: result.cache,
        upstreamStale,
        observationAgeMinutes,
        observationStale,
        staleAfterMinutes,
        notice: notices.length ? notices.join(" ") : null,
        fallback: data.fallback
          ? {
              ...data.fallback,
              notice: data.fallback.notice || OFFICIAL_FALLBACK_NOTICE,
            }
          : null,
      },
      { headers: responseHeaders() },
    );
  } catch (error) {
    console.error(
      "[official-observations] Both official sources failed:",
      error?.code || "unknown",
      error?.message,
    );

    return Response.json(
      {
        status: "unavailable",
        source: {
          id: "sri-lanka-dom",
          name: "Department of Meteorology, Sri Lanka",
          url: SRI_LANKA_DOM_URL,
        },
        fallbackSource: {
          id: "sri-lanka-metar",
          name: "NOAA Aviation Weather Center — ICAO METAR",
          url: "https://aviationweather.gov/data/api/",
        },
        fetchedAt: new Date().toISOString(),
        error:
          error?.message ||
          "Official Sri Lankan station observations could not be loaded.",
        attempts: safeAttempts(error?.details?.attempts),
        primaryError: error?.details?.primaryError?.code || null,
        fallbackError: error?.details?.fallbackError?.code || null,
        notice:
          "Aeris does not invent observations. Open-Meteo forecast data remains available while official station sources are unreachable.",
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
