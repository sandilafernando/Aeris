import { connection } from "next/server";
import { createCachedFetcher } from "@/lib/sources/cache";
import {
  METAR_OBSERVATION_STALE_MINUTES,
  METAR_SOURCE,
  METAR_SOURCE_URL,
  fetchSriLankaMetarObservations,
} from "@/lib/sources/metar";

export const maxDuration = 30;

// METAR reports arrive hourly (sometimes more often at larger airports). A
// short cache is enough and keeps the fallback responsive.
const cache = createCachedFetcher(
  () => fetchSriLankaMetarObservations({ timeoutMs: 12_000 }),
  {
    ttlMs: 2 * 60 * 1000,
    staleTtlMs: 6 * 60 * 60 * 1000,
  },
);

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

export async function GET() {
  await connection();

  try {
    const result = await cache.get();
    const data = result.data;
    const now = Date.now();
    const staleAfterMinutes =
      Number.isFinite(data.staleAfterMinutes) && data.staleAfterMinutes > 0
        ? data.staleAfterMinutes
        : METAR_OBSERVATION_STALE_MINUTES;
    const observationAge = ageMinutes(data.observationTime, now);
    const observationStale =
      observationAge == null || observationAge > staleAfterMinutes;
    const upstreamStale = result.cache === "stale";

    return Response.json(
      {
        ...data,
        status: upstreamStale || observationStale ? "stale" : "ok",
        servedAt: new Date(now).toISOString(),
        cache: result.cache,
        upstreamStale,
        observationAgeMinutes:
          observationAge == null ? null : Math.round(observationAge),
        observationStale,
        staleAfterMinutes,
        notice: upstreamStale
          ? "The METAR feed could not be refreshed. Showing the last successful report, which may be older than its timestamp."
          : null,
      },
      { headers: responseHeaders() },
    );
  } catch (error) {
    console.error(
      "[metar] NOAA AWC unavailable:",
      error?.code || "unknown",
      error?.message,
    );
    return Response.json(
      {
        status: "unavailable",
        source: {
          id: METAR_SOURCE.id,
          name: METAR_SOURCE.name,
          shortName: METAR_SOURCE.shortName,
          url: METAR_SOURCE_URL,
        },
        fetchedAt: new Date().toISOString(),
        error:
          error?.message ||
          "NOAA AWC airport observations are temporarily unavailable.",
        notice:
          "Aeris does not invent airport observations. DoM station data and the Open-Meteo forecast remain separate products.",
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
