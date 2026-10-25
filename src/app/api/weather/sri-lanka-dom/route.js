import { connection } from "next/server";
import { createCachedFetcher } from "@/lib/sources/cache";
import {
  SRI_LANKA_DOM_URL,
  SRI_LANKA_OBSERVATION_STALE_MINUTES,
  fetchSriLankaObservations,
} from "@/lib/sources/sri-lanka-dom";

const cache = createCachedFetcher(fetchSriLankaObservations, {
  ttlMs: 5 * 60 * 1000,
  staleTtlMs: 6 * 60 * 60 * 1000,
});

export async function GET() {
  await connection();

  try {
    const result = await cache.get();
    const observationMs = Date.parse(result.data.observationTime || "");
    const observationAgeMinutes = Number.isFinite(observationMs)
      ? Math.max(0, Math.round((Date.now() - observationMs) / 60_000))
      : null;
    const observationStale =
      observationAgeMinutes == null ||
      observationAgeMinutes > SRI_LANKA_OBSERVATION_STALE_MINUTES;

    return Response.json(
      {
        ...result.data,
        status: observationStale ? "stale" : "ok",
        servedAt: new Date().toISOString(),
        cache: result.cache,
        upstreamStale: result.cache === "stale",
        observationAgeMinutes,
        observationStale,
        staleAfterMinutes: SRI_LANKA_OBSERVATION_STALE_MINUTES,
        notice:
          result.cache === "stale"
            ? "The official page could not be refreshed. Showing the last successful fetch."
            : observationStale
              ? "The latest observation on the official page is older than six hours."
              : null,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  } catch (error) {
    return Response.json(
      {
        status: "unavailable",
        source: {
          id: "sri-lanka-dom",
          name: "Department of Meteorology, Sri Lanka",
          url: SRI_LANKA_DOM_URL,
        },
        fetchedAt: new Date().toISOString(),
        error:
          error?.message ||
          "The Department of Meteorology observations could not be loaded.",
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
