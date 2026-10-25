/*
 * Aeris service worker
 * --------------------
 * A small, hand-written cache for the app shell. Live weather requests go to
 * Open-Meteo in the page and are never intercepted or cached here.
 *
 * Bump VERSION whenever the precache list or caching rules change. Old Aeris
 * caches are removed on activate.
 */
const VERSION = "v3";
const CACHE_PREFIX = "aeris-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-${VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

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
              key !== STATIC_CACHE,
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
              .filter((key) => key.startsWith(CACHE_PREFIX))
              .map((key) => caches.delete(key)),
          ),
        )
        .catch(() => {}),
    );
  }
});
