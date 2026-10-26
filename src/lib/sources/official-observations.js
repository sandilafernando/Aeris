import {
  SRI_LANKA_DOM_URL,
  SRI_LANKA_DOM_URLS,
  SRI_LANKA_OBSERVATION_STALE_MINUTES,
  fetchSriLankaObservations,
} from "./sri-lanka-dom.js";
import {
  METAR_OBSERVATION_STALE_MINUTES,
  METAR_SOURCE,
  fetchSriLankaMetarObservations,
} from "./metar.js";

export const OFFICIAL_FALLBACK_NOTICE =
  "The Department of Meteorology page could not be reached from this server. Showing official ICAO airport METAR reports from NOAA AWC instead. These are airport stations, not DoM district stations.";

export const OFFICIAL_FALLBACK_DISABLED_NOTICE =
  "The Department of Meteorology source is disabled by configuration. Showing official ICAO airport METAR reports from NOAA AWC instead. These are airport stations, not DoM district stations.";

export const DEFAULT_DOM_TIMEOUT_MS = 4_000;
export const SERVERLESS_DOM_TIMEOUT_MS = 2_500;
export const DEFAULT_METAR_TIMEOUT_MS = 8_000;

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isServerlessEnvironment(env = process.env) {
  return Boolean(
    env.VERCEL ||
      env.NETLIFY ||
      env.NETLIFY_DEV ||
      env.AWS_LAMBDA_FUNCTION_NAME ||
      env.AWS_EXECUTION_ENV ||
      env.CF_PAGES,
  );
}

/**
 * An optional private relay can make the official page reachable from a cloud
 * region that the DoM host blocks. The relay must return the DoM station HTML,
 * not a rewritten or invented payload.
 */
export function resolveDomTargets(env = process.env) {
  const relay = String(env.AERIS_DOM_PROXY_URL || env.AERIS_DOM_URL || "").trim();
  if (relay) return { urls: [relay], viaRelay: true };
  return { urls: SRI_LANKA_DOM_URLS, viaRelay: false };
}

function safeSourceError(error, fallbackCode = "source") {
  return {
    code: error?.code || fallbackCode,
    message:
      typeof error?.message === "string" && error.message.trim()
        ? error.message.trim().slice(0, 240)
        : "The official source is unavailable.",
  };
}

/**
 * Load official Sri Lankan observations with DoM as the primary source and
 * NOAA AWC ICAO METAR reports as a clearly labelled fallback.
 *
 * The two sources are never merged. The fallback is used only when DoM cannot
 * be reached or its page cannot be read, and the response records which source
 * produced the stations so the interface can attribute them correctly.
 */
export async function fetchOfficialObservations({
  env = process.env,
  now = Date.now(),
  domFetcher = fetchSriLankaObservations,
  metarFetcher = fetchSriLankaMetarObservations,
  forceSource = null,
} = {}) {
  const currentTime = typeof now === "function" ? now : () => now;
  const serverless = isServerlessEnvironment(env);
  const mode = String(forceSource || env.AERIS_OFFICIAL_SOURCE || "auto")
    .trim()
    .toLowerCase();
  const domTargets = resolveDomTargets(env);
  const domTimeoutMs = positiveNumber(
    env.AERIS_DOM_TIMEOUT_MS,
    serverless ? SERVERLESS_DOM_TIMEOUT_MS : DEFAULT_DOM_TIMEOUT_MS,
  );
  const metarTimeoutMs = positiveNumber(
    env.AERIS_METAR_TIMEOUT_MS,
    DEFAULT_METAR_TIMEOUT_MS,
  );
  const attempts = [];
  let primaryError = null;
  // The two published DoM hosts resolve to the same site. On a serverless
  // platform, try only the primary host with a short budget so the fallback
  // fits inside a synchronous function timeout. A configured relay is always
  // attempted; local and self-hosted deployments try both hosts.
  const domUrls = domTargets.viaRelay
    ? domTargets.urls
    : serverless
      ? [SRI_LANKA_DOM_URL]
      : domTargets.urls;

  if (mode !== "metar") {
    try {
      const dom = await domFetcher({
        timeoutMs: domTimeoutMs,
        urls: domUrls,
        attemptsPerUrl: domTargets.viaRelay ? 2 : 1,
        now: currentTime,
      });
      const retrievalAttempts = dom.retrieval?.attempts || [];
      return {
        ...dom,
        staleAfterMinutes: SRI_LANKA_OBSERVATION_STALE_MINUTES,
        attempts: retrievalAttempts,
        fallback: null,
        primary: {
          id: "sri-lanka-dom",
          name: "Department of Meteorology, Sri Lanka",
          url: SRI_LANKA_DOM_URL,
          viaRelay: domTargets.viaRelay,
        },
      };
    } catch (error) {
      primaryError = safeSourceError(error, "dom-unavailable");
      attempts.push(...(Array.isArray(error?.details?.attempts) ? error.details.attempts : []));
    }
  } else {
    primaryError = {
      code: "disabled",
      message: "The Department of Meteorology source is disabled by configuration.",
    };
  }

  if (mode === "dom") {
    const error = new Error(
      primaryError?.message ||
        "The Department of Meteorology observations could not be loaded.",
    );
    error.name = "OfficialSourceError";
    error.code = primaryError?.code || "dom-unavailable";
    error.details = { attempts, primaryError };
    throw error;
  }

  try {
    const metar = await metarFetcher({ timeoutMs: metarTimeoutMs, now: currentTime() });
    const fallbackNotice =
      primaryError?.code === "disabled"
        ? OFFICIAL_FALLBACK_DISABLED_NOTICE
        : OFFICIAL_FALLBACK_NOTICE;
    return {
      ...metar,
      source: metar.source || METAR_SOURCE,
      staleAfterMinutes: METAR_OBSERVATION_STALE_MINUTES,
      attempts,
      fallback: {
        active: true,
        from: "sri-lanka-dom",
        to: "sri-lanka-metar",
        reason: primaryError?.code || "dom-unavailable",
        primaryError,
        notice: fallbackNotice,
      },
      notice: fallbackNotice,
    };
  } catch (error) {
    const metarError = safeSourceError(error, "metar-unavailable");
    const combined = new Error(
      "Official Sri Lankan observations are unavailable: the Department of Meteorology page could not be reached and the NOAA AWC fallback did not return usable reports.",
    );
    combined.name = "OfficialSourceError";
    combined.code = "all-sources-failed";
    combined.details = {
      attempts,
      primaryError,
      fallbackError: metarError,
    };
    throw combined;
  }
}
