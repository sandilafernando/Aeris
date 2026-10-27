/*
 * Aeris service worker
 * --------------------
 * A small, hand-written cache for the app shell. Live weather requests go to
 * Open-Meteo in the page and are never intercepted or cached here.
 *
 * Bump VERSION whenever the precache list or caching rules change. Old Aeris
 * caches are removed on activate.
 */
const VERSION = "v4";
const CACHE_PREFIX = "aeris-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

// Holds { enabled, place } written by the page, plus the last alert key. The
// worker cannot read localStorage, and this cache must survive activation, so
// the activate cleanup below exempts it.
const NOTIFY_CONFIG_CACHE = "aeris-notify-config";
const NOTIFY_CONFIG_URL = "/notify-config";
const LAST_ALERT_URL = "/last-alert";
const BACKGROUND_CHECK_TAG = "aeris-precipitation-check";

// Only stable, unhashed files belong here. Hashed Next.js bundles are cached
// at runtime instead, because their filenames change with every build.
const PRECACHE_URLS = [
  "/",
  OFFLINE_URL,
  "/favicon.ico",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

const STATIC_ASSET_PATTERN =
  /\.(?:css|js|mjs|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif|ico)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell());
});

async function precacheShell() {
  const cache = await caches.open(SHELL_CACHE);

  // Cache entries individually so one missing optional asset cannot make the
  // whole service worker fail to install.
  await Promise.all(
    PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (!isCacheable(response)) return;

        await cache.put(url, response.clone());

        // The document references hashed Next.js CSS, JS, and font files. A
        // first offline launch would otherwise render an unstyled shell,
        // because those requests happen before the worker controls the page
        // and therefore never reach the runtime cache.
        if (url === "/") await precacheDocumentAssets(cache, response);
      } catch {
        // Offline during install, or the asset is unavailable. Try again on
        // the next service worker update.
      }
    }),
  );
}

const DOCUMENT_ASSET_PATTERN = /(?:href|src)="(\/_next\/static\/[^"]+)"/g;

async function precacheDocumentAssets(cache, response) {
  let html;
  try {
    html = await response.text();
  } catch {
    return;
  }

  const urls = new Set();
  for (const match of html.matchAll(DOCUMENT_ASSET_PATTERN)) {
    urls.add(match[1].replaceAll("&amp;", "&"));
  }

  await Promise.all(
    Array.from(urls, async (url) => {
      try {
        if (await cache.match(url)) return;
        const asset = await fetch(new Request(url, { cache: "reload" }));
        if (isCacheable(asset)) await cache.put(url, asset);
      } catch {
        // A missing chunk should not fail the install. The app still falls
        // back to the offline page if the shell cannot boot.
      }
    }),
  );
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) &&
              key !== SHELL_CACHE &&
              key !== STATIC_CACHE &&
              key !== NOTIFY_CONFIG_CACHE,
          )
          .map((key) => caches.delete(key)),
      );

      // Take control of already-open tabs so an update can apply immediately.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Leave non-GET requests (forms, API mutations) to the browser.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept third-party traffic or range requests.
  if (url.origin !== self.location.origin) return;
  if (request.headers.has("range")) return;

  // API routes, Next.js data requests, and the image optimizer always go to
  // the network. They are user- or build-specific and must not be cached.
  if (
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/data") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/sw.js"
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request, url));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

async function networkFirstNavigation(request, url) {
  try {
    const response = await fetch(request);

    // Keep the latest app shell for offline launches. The app has a single
    // route, so only that document is stored.
    if (url.pathname === "/" && isCacheable(response)) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put("/", response.clone());
    }

    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);

    // Prefer the cached shell so saved places can still render offline. If
    // there is no shell yet, show the dedicated offline page.
    const cachedShell = await cache.match(request, { ignoreSearch: true });
    if (cachedShell) return cachedShell;

    return (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

function isStaticAsset(url) {
  return (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    STATIC_ASSET_PATTERN.test(url.pathname)
  );
}

function staleWhileRevalidate(event) {
  const { request } = event;
  const cachePromise = caches.open(STATIC_CACHE);
  const networkPromise = fetch(request).catch(() => null);

  // Update the cached copy in the background, but never let a failed cache
  // write or network request reject the fetch event.
  event.waitUntil(
    networkPromise
      .then(async (response) => {
        if (!isCacheable(response)) return;
        const cache = await cachePromise;
        await cache.put(request, response.clone());
      })
      .catch(() => {}),
  );

  event.respondWith(
    (async () => {
      let cached = null;

      try {
        const cache = await cachePromise;
        cached = await cache.match(request);

        // Icons and the manifest are precached in the shell cache. Fall back
        // to it on the first offline request, before SWR has populated the
        // static cache.
        if (!cached) {
          const shell = await caches.open(SHELL_CACHE);
          cached = await shell.match(request);
        }
      } catch {
        // Fall through to the network if the cache is unavailable.
      }

      if (cached) return cached;

      const response = await networkPromise;
      return response || Response.error();
    })(),
  );
}

function isCacheable(response) {
  // Skip errors, partial responses, and opaque cross-origin responses. Only a
  // complete, same-origin 200 is safe to store.
  return Boolean(
    response &&
      response.status === 200 &&
      response.ok &&
      response.type === "basic",
  );
}

/*
 * Background precipitation check.
 *
 * The page stores { enabled, place } in NOTIFY_CONFIG_CACHE, because this
 * worker has no access to localStorage. On a Periodic Background Sync the
 * worker fetches the Open-Meteo forecast itself and shows a local
 * notification when the next few hours turn wet. Nothing is pushed from a
 * server, no subscription is created, and a repeated forecast hour is
 * alerted only once.
 */
self.addEventListener("periodicsync", (event) => {
  if (event.tag !== BACKGROUND_CHECK_TAG) return;
  event.waitUntil(runBackgroundCheck());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/");
    })(),
  );
});

async function readNotifyConfig() {
  try {
    const cache = await caches.open(NOTIFY_CONFIG_CACHE);
    const response = await cache.match(NOTIFY_CONFIG_URL);
    if (!response) return null;
    const config = await response.json();
    if (!config || config.enabled !== true) return null;
    const place = config.place;
    if (!place || !Number.isFinite(Number(place.latitude))) return null;
    if (!Number.isFinite(Number(place.longitude))) return null;
    return config;
  } catch {
    return null;
  }
}

async function readLastAlert() {
  try {
    const cache = await caches.open(NOTIFY_CONFIG_CACHE);
    const response = await cache.match(LAST_ALERT_URL);
    return response ? await response.json() : null;
  } catch {
    return null;
  }
}

async function writeLastAlert(record) {
  try {
    const cache = await caches.open(NOTIFY_CONFIG_CACHE);
    await cache.put(LAST_ALERT_URL, new Response(JSON.stringify(record)));
  } catch {
    // A failed dedupe write can only risk a repeated alert, never a wrong one.
  }
}

const WINTER_CODES = new Set([56, 57, 66, 67, 71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 97, 99]);

function backgroundForecastUrl(place) {
  const params = new URLSearchParams({
    latitude: String(Number(place.latitude)),
    longitude: String(Number(place.longitude)),
    current: "precipitation,weather_code",
    hourly: "precipitation_probability,precipitation,weather_code",
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: "2",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

/**
 * First wet hour in the next four hours, using the same thresholds as the
 * in-page alert: a chance of 50% or more, or 0.1 mm or more. Already-wet
 * conditions are not an alert, because they are already on screen.
 */
function findOnset(payload, nowMs) {
  const hourly = payload?.hourly;
  if (!Array.isArray(hourly?.time)) return null;

  const currentPrecipitation = Number(payload?.current?.precipitation);
  if (Number.isFinite(currentPrecipitation) && currentPrecipitation > 0.05) return null;

  for (let index = 0; index < hourly.time.length; index += 1) {
    const timeMs = Number(hourly.time[index]) * 1000;
    if (!Number.isFinite(timeMs)) continue;
    if (timeMs < nowMs - 30 * 60_000) continue;
    if (timeMs > nowMs + 4 * 3_600_000) break;

    const probability = Number(hourly.precipitation_probability?.[index]);
    const amount = Number(hourly.precipitation?.[index]);
    const code = Number(hourly.weather_code?.[index]);
    const wet =
      (Number.isFinite(probability) && probability >= 50) ||
      (Number.isFinite(amount) && amount >= 0.1);
    if (!wet) continue;

    return {
      timeMs,
      minutesAhead: Math.max(0, Math.round((timeMs - nowMs) / 60_000)),
      kind: WINTER_CODES.has(code) ? "Snow" : STORM_CODES.has(code) ? "Storms" : "Rain",
    };
  }

  return null;
}

async function runBackgroundCheck() {
  const config = await readNotifyConfig();
  if (!config) return;

  let payload;
  try {
    const response = await fetch(backgroundForecastUrl(config.place), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return;
    payload = await response.json();
  } catch {
    // Offline or blocked: stay quiet rather than guess at the weather.
    return;
  }

  const nowMs = Date.now();
  const onset = findOnset(payload, nowMs);
  if (!onset) return;

  const alertKey = `${Number(config.place.latitude)},${Number(config.place.longitude)}:${new Date(
    onset.timeMs,
  ).toISOString().slice(0, 13)}`;
  const last = await readLastAlert();
  if (last?.key === alertKey) return;

  const name = config.place.name || "";
  const place = !name || name === "Current location" ? "your location" : name;
  const title =
    onset.kind === "Snow"
      ? `Snow likely soon in ${place}`
      : onset.kind === "Storms"
        ? `Storms likely soon in ${place}`
        : `Rain likely soon in ${place}`;
  const timing =
    onset.minutesAhead <= 30
      ? "within the next half hour"
      : `in about ${Math.round(onset.minutesAhead / 30) * 30} minutes`;

  try {
    await self.registration.showNotification(title, {
      body: `${onset.kind} ${timing}. Open Aeris for hourly timing and the official station reading.`,
      tag: `aeris-precipitation-${alertKey}`,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: "/" },
    });
    await writeLastAlert({ key: alertKey, at: nowMs });
  } catch {
    // Permission may have been revoked; the page reports that instead.
  }
}

self.addEventListener("message", (event) => {
  const data = event.data;

  if (!data || typeof data !== "object") return;

  if (data.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith(CACHE_PREFIX) && key !== NOTIFY_CONFIG_CACHE)
              .map((key) => caches.delete(key)),
          ),
        )
        .catch(() => {}),
    );
  }
});
