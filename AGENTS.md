<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aeris project guide

This file is for future coding agents. Keep the Next.js block above intact; `next dev` regenerates it.

## What this is

Aeris is a weather dashboard using the Next.js App Router and live Open-Meteo APIs. The visual direction is Material 3 Expressive-inspired, not a Google product or an official Material implementation. Forecast, search, ensemble, and archive requests run in the browser. Three server route handlers read official Sri Lankan observations: `/api/weather/meteo-json` validates the published DoM snapshot in `data/meteo.json` for the At a glance widget, `/api/weather/metar` supplies the labelled NOAA AWC ICAO METAR airport fallback, and `/api/weather/sri-lanka-dom` keeps the original DoM 3-hourly workbook/map-page path available. Optional NASA GIBS satellite imagery, browser-local weather notifications, and PWA installation are independent, separately labelled features. There is no database, authentication, or API key. `AERIS_*` environment variables are optional and only tune the legacy DoM workbook route.

## Current agent brief (updated 2026-10-26)

Read this before changing the official-observation path. These facts were verified from this machine on 2026-10-26 and must be re-verified whenever the parser changes:

- `https://meteo.gov.lk/` is reachable, HTTP 200, and contains 24 `.district-point[data-name][data-weather]` nodes. It is **slow**: three measured requests took 19.3 s, 9.6 s, and 5.9 s. The previous 2.5 s serverless timeout is the proven cause of the production fallback, not a missing endpoint.
- `https://meteo.gov.lk/excels/3hourly.xlsx` is the authoritative 3-hourly feed that powers the page's own `script.js`. It contains `Station_ID`, `Station_Name`, `Report_Time`, `Rainfall (mm)`, `Tot RF since 830am`, `Temperature ( C )`, `RH (%)`, `weathertype`, `Wind Direction`, `Wind Speed(kmh-1)`, `Cloud Cover`, `MSLP`, and `Dew Point`. Measured latency was 6-14 s. Station `43450` is `KATUNAYAKE`; its real 2026-10-26 1430 row was `0.1 mm` rain, `18.5 mm` since 08:30, `29.4 °C`, `79 %`, `cloudy`, wind `W 14.04 km/h`, cloud `8` oktas, MSLP `1008.0`, dew point `25.3 °C`.
- Station `43450` is **KATUNAYAKE / Bandaranaike International Airport (VCBI, CMB)**, WIGOS `0-20000-0-43450`. WMO OSCAR lists **7.166667 N, 79.883333 E, 8 m**; the AIP aerodrome reference point is **7.1803 N, 79.8853 E, 9 m**; NOAA AWC uses **7.181 N, 79.884 E**. The spread is about 3 km. Aeris still labels its city-centre point as approximate and does not claim official station coordinates.
- The workbook has no coordinates or elevation. Do not scrape the DoM Google My Maps KML as a station register: it has duplicate placemarks, ID mismatches, and kilometres of disagreement.
- A second real cycle confirms the feed is a manually re-saved desktop Excel workbook: the 1430 LK row appeared at 15:15 LK (+45 min), and the 1730 LK row appeared at 18:21 LK (+51 min). The real 1730 row for `43450` was `4.3 mm` rain, `22.8 mm` since 08:30, `25.7 °C`, `95 %`, `thundershowers`, wind `SE 5.0 km/h`, cloud `8` oktas, MSLP `1009.2`, dew point `24.8 °C`. Do not treat a 3-hour-old workbook as broken; the product is 3-hourly.
- The workbook response has no `Access-Control-Allow-Origin` and no cache headers. It must be fetched by the server route, never directly by the browser. The DoM site is an SPA catch-all: unknown paths can return HTTP 200 with the homepage HTML. Always check content type or ZIP magic before parsing.
- The DoM footer claims copyright and publishes no open-data licence. Attribute DoM and do not imply redistribution rights beyond displaying the published observation. The public contact for “Online Weather Data” is `computermeteo@gmail.com`.
- `https://weather.meteo.gov.lk/server/rest/services?f=pjson` resolved to `222.165.186.50` but TCP 443 timed out. Do not depend on it unless it is reachable and its layers are verified.
- DoM xlsx times are Sri Lanka Standard Time (UTC+05:30) and use `YYYY-MM-DD HHMM` without a colon. Parse in that offset; never use the browser clock as the observation time.
- Do not merge DoM and NOAA AWC METAR records. METAR is a labelled airport fallback and has no rainfall total (`null`, never `0.0 mm`).
- Network calls to DoM must use a realistic timeout (currently >= 20 s server-side), bounded retries/backoff, and a last-known-good cache. Do not add an open CORS proxy or user-controlled URL fetching.
- OpenWeather is not in this project. Do not replace the existing Open-Meteo integration with it; if it is ever added, keep it a separately labelled source.

## Snapshot brief (verified 2026-10-26)

- `data/meteo.json` is a collector snapshot, not a live feed. Its top level is `source`, `fetchedAt`, `fetchedAtSriLanka`, `fetchedAtSriLankaDisplay`, `timezone`, `meteoLatestObservationUpdatedAt`, `meteoLatestObservationUpdatedAtSriLanka`, `stationCount`, and `stations`. Each station is `{ name, weather: { lastUpdated, rainfall, totalRainfall, temp, rh, forecast } }`. It contains **no coordinates, wind, pressure, cloud cover, or dew point**.
- The verified snapshot was `fetchedAt` `2026-10-26T17:14:11Z`, newest observation `2026-10-26 2030`, 24 stations. Katunayake `2030` read `2.8 mm` in the cycle, `25.6 mm` since 08:30, `25.1 °C`, `97 %`, `fairnight`. Pottuvil rainfall was the literal string `"Trace"`; keep it distinct from `0` and unavailable.
- Per-station cycles can lag the file. In that snapshot 4 of 24 stations (BANDARAWELA, JAFFNA, MAHA ILLUPPALLAMA, POTTUVIL) were still on `1730` at 314 minutes old. Apply the five-hour rule per station from `weather.lastUpdated`, never from `fetchedAt`.
- `lastUpdated` is `YYYY-MM-DD HHMM` in `Asia/Colombo` (UTC+05:30). Missing, malformed, ambiguous, or future-dated timestamps (more than ten minutes ahead) are unusable and must trigger the fallback, not be treated as fresh.
- DoM readings older than **five hours** are stale. METAR observations are stale after **three hours**. A stale DoM reading is replaced by a clearly labelled recent airport report; the groups are never merged.
- The collector workflow (`.github/workflows/fetch-weather.yml`) has been unreliable: its schedule has not fired reliably, it has used a self-hosted runner, and it can commit frequently. Never assume the snapshot is current because the file exists or because `fetchedAt` is recent.

## Commands

```bash
npm install
npm run dev          # Turbopack dev server on http://localhost:3000
npm run lint
npm run test:unit
npm run test:e2e     # production build + start + Playwright
PW_DEV=1 npm run test:e2e
npm run build
npm run start
```

In PowerShell, set `PW_DEV = "1"` with `$env:PW_DEV = "1"` before running Playwright against an already-running dev server. Playwright uses installed Chrome by default; set `PW_BUNDLED=1` only after installing the bundled Chromium.

## Architecture

- `src/app/page.js` renders the single client entry point. `src/app/layout.js` owns fonts, metadata, the theme initialization script, and providers. There are three route handlers under `src/app/api/weather/`: `meteo-json` (primary DoM snapshot), `metar` (lazy airport fallback), and `sri-lanka-dom` (legacy workbook/map path).
- `src/components/weather-app.jsx` is the client orchestrator. It owns saved places, the active location, dialogs, page title, palette application, auto-refresh, and online/offline refresh behavior. Official-observation requests belong to the At a glance widget, not this component.
- `src/hooks/use-weather.js` handles fetching, request deduplication, a 10-minute in-memory cache, a 15-second timeout, stale data on refresh failure, manual refresh bypass, and a bounded localStorage copy of the last successful forecast for offline display.
- `src/hooks/use-official-source.js` loads the official-observation routes with per-route in-memory caches (5 minutes for the legacy DoM route, 2 minutes for the snapshot and METAR routes), a 6-hour localStorage last-known-good record, abort handling, exponential retry backoff (30/60/120/240/300 s), and an explicit `status: "stale"` state. It must never label cached data as live.
- `src/hooks/use-city-search.js` handles debounced geocoding with abort handling and a visible derived state, so stale results never flash.
- `src/lib/weather.js` builds the Open-Meteo URL and normalizes the payload. Keep normalization defensive: optional fields may be missing and must degrade to `null`/“Unavailable”, not throw. The app requires `payload.current` and `hourly.time`.
- `src/lib/sources/meteo-json.js` is the primary DoM adapter. It validates the snapshot schema, parses `YYYY-MM-DD HHMM` in `Asia/Colombo`, preserves `Trace`, de-duplicates by freshest station observation, applies the five-hour rule and future guard, and exposes approximate Aeris reference points.
- `src/lib/sources/official-observations.js` orchestrates DoM first and NOAA AWC METAR second for the legacy `/api/weather/sri-lanka-dom` route. Never merge the two sources or relabel airport data as DoM district data.
- `src/lib/glance.js` builds the At a glance view: it normalizes `glanceSource`/`glanceMetrics`, chooses a labelled default outside Sri Lanka, keeps DoM and METAR groups separate, and substitutes a METAR fallback only when the DoM reading is stale or missing.
- `src/components/at-a-glance.jsx` renders the source selector, station preference, metric customization, explicit **Near me** geolocation, trace rainfall, the Open-Meteo model block, and stale/cached/fallback notices. Keep its station-help copy conditional so a default station is never called “nearest”.
- `src/lib/sources/dom-workbook.js` is a small, bounded XLSX/ZIP reader. It handles the workbook's shared strings, first worksheet, typed numeric cells, and archive limits without a general spreadsheet dependency. Keep it read-only and fail closed.
- `src/lib/sources/sri-lanka-dom.js` fetches the workbook first and the public map page second, normalizes both into the same station shape, and labels the representation. The map page omits station IDs, wind, pressure, cloud cover, and dew point; say so in the UI. Do not scrape a different page without updating attribution, fixtures, and tests.
- `src/lib/sources/metar.js` normalizes ICAO METAR reports into the same station shape and leaves rainfall `null`, because METAR has no rainfall total.
- `src/components/satellite-card.jsx` and `src/lib/satellite.js` render three genuine NASA GIBS products: Himawari-9 red visible (daylight), Himawari-9 clean infrared (night), and a finished VIIRS true-colour pass. GIBS can advertise a frame before ingestion completes, so the card fetches the availability XML, starts behind the newest advertised slot, probes the image byte length, skips blank frames, and right-sizes each request. The six-frame loop runs only on request and shows each real timestamp. It is not radar and not a DoM observation.
- `src/lib/weather-alerts.js` and `src/hooks/use-weather-notifications.js` implement opt-in, page-open-only precipitation notifications from the Open-Meteo forecast. No push subscription, service worker push handler, server, or third-party messaging service is involved.
- `src/components/settings-dialog.jsx` hosts the install section near the top and the At a glance source/metric settings. `src/hooks/use-install-prompt.js` and `src/components/pwa-manager.jsx` handle the real `beforeinstallprompt` lifecycle, iOS Safari instructions, and standalone detection; never show a fake install prompt.
- `src/lib/storage.js` owns the stable localStorage keys and sanitization. Places are capped at 20, coordinates are rounded to three decimals, invalid records are discarded, and the last-known forecast is capped at three places and 24 hours.
- `src/lib/palettes.js` defines condition palettes. Do not hardcode condition colors in components; use the CSS variables or Tailwind design tokens.
- `src/components/ui/` contains shadcn/ui primitives. Extend them sparingly and keep the existing Radix accessibility behavior.

## Product invariants

- Use real Open-Meteo data for forecasts and geocoding. Never invent weather values, place names, alerts, or a live deployment URL.
- Do not add a radar layer unless a properly licensed tile provider is selected and attribution is implemented. The absence of radar is intentional and documented. NASA GIBS satellite imagery is not radar.
- NASA GIBS imagery is an independent product, not a DoM observation, not a forecast, and not rainfall. Keep the timestamp, the blank-frame probe, and the “clouds, not rainfall” copy honest.
- Do not add tracking, analytics, ads, accounts, or third-party scripts without an explicit product decision.
- Current-location data is session-only and must not enter the saved-places list. Saved places and preferences belong in localStorage only.
- Weather notifications are opt-in and browser-local. They are generated only while the page is open, never through a server, Discord/webhook, or third-party push service. Keep the preference default `false` and keep the permission/blocked copy truthful.
- Keep the localStorage schemas `aeris:preferences:v1`, `aeris:places:v1`, and `aeris:last-forecast:v1` compatible, or add a deliberate migration. The saved forecast must stay clearly labelled with its fetch time and be discarded after 24 hours.
- Keep official sources honest. DoM is primary and is read from the validated `data/meteo.json` snapshot for the At a glance widget. Enforce the five-hour rule from each station's `lastUpdated` in `Asia/Colombo`; a missing, malformed, or future-dated timestamp is unusable. NOAA AWC METAR is a labelled airport fallback for recent reports, used only when DoM is stale, unavailable, or unparsable. Never present fallback data as DoM district data, and never invent a station or observation.
- METAR does not carry a rainfall total. Keep rainfall `null`/“Unavailable” for METAR stations; never render it as `0.0 mm`. DoM `"Trace"` is its own state, not zero.
- Automatic station selection for DoM uses documented approximate city-centre reference points because the snapshot publishes no coordinates. Label them as Aeris reference points, not official station coordinates. Outside Sri Lanka, use a labelled default (Colombo for DoM, Katunayake for METAR) and never call it the nearest station.
- All Open-Meteo weather fetches happen in the browser. The only server-side fetches are the three official-observation routes (`meteo-json`, `metar`, `sri-lanka-dom`). Do not add another proxy without updating privacy copy, caching behavior, and tests.
- Preserve honest empty/error/offline states. A stale forecast must be labelled as stale; a missing value must not masquerade as zero. An offline reload may show the saved forecast only with its original timestamp and a clear “not live” label.
- The routes must return JSON in every branch, including failure. They must never return the app HTML or a platform not-found page for `/api/weather/meteo-json`, `/api/weather/metar`, or `/api/weather/sri-lanka-dom`.
- Keep PWA installation truthful. Offer the real `beforeinstallprompt` action only when the browser provides it, use Safari’s Share → Add to Home Screen wording on iOS, and never imply that a JavaScript install prompt exists there. The service worker must not cache `/api` responses or label cached satellite imagery as live.

## Next.js 16 notes

- `cacheComponents` and `partialPrefetching` are enabled in `next.config.mjs`. Do not read `Date.now()`, `window`, or `localStorage` during render. Use effects for time and persistence. `useNow()` intentionally starts at `0` and updates after hydration.
- Read the bundled guides in `node_modules/next/dist/docs/` before changing routing, rendering, caching, metadata, or config. This version differs from older Next.js releases.
- `turbopack.root` is set to `import.meta.dirname` so the parent-directory lockfile is not picked up.
- `/` is statically prerendered and live weather is purely client-side. All three route handlers are request-time rendered and call `await connection()` before reading the clock or upstream data. `cacheComponents` rejects route segment config such as `runtime` and `dynamic`; do not re-add them.
- `export const maxDuration` is the only route segment export each handler needs (60 s for the legacy DoM workbook route, 30 s for METAR, 20 s for the snapshot). `/api/weather/meteo-json` and `/api/weather/metar` cache successful upstream data for two minutes and serve stale data for up to six hours with an explicit stale status; `/api/weather/sri-lanka-dom` caches for five minutes with the same six-hour stale allowance.

## Design and accessibility

- Use the project's semantic tokens (`bg-card`, `text-muted-foreground`, `border-outline-variant`, `--hero-*`, `--shadow-soft`, etc.) rather than raw colors.
- Keep the condition palette families (`clear`, `partly`, `cloudy`, `rain`, `snow`, `storm`, `fog`) and day/night hero variants coherent in light and dark themes.
- Preserve the keyboard combobox behavior, skip link, focus styles, dialog focus management, `aria-live` announcements, and reduced-motion handling.
- Ensure accessible names match visible text after whitespace normalization. Several tests depend on token order in accessible names.
- Test responsive layouts from 360 px to 1440 px and watch horizontal overflow from off-screen assistive text or scroll containers.

## Testing

- Unit tests use Node's test runner and live in `tests/unit/*.test.js`. Add pure logic tests alongside the existing weather, storage, station-selection, cache, and official-source suites.
- Playwright tests live in `tests/e2e/`. `helpers.js` intercepts Open-Meteo with deterministic fixtures from `tests/fixtures/weather.js`, `/api/weather/meteo-json` and `/api/weather/metar` with fixtures copied from the recorded real snapshot `tests/fixtures/meteo-snapshot-2026-10-26.json` (timestamps shifted relative to the browser clock), and NASA GIBS with a padded PNG that clears the blank-frame probe. Pass `officialSource: "metar"` to exercise the labelled fallback. Never read live readings from `data/meteo.json` in a test helper; the collector changes them several times a day. When API fields change, update the normalizer, fixtures, and unit tests together.
- `tests/unit/dom-workbook.test.js` uses the recorded `tests/fixtures/dom-3hourly-2026-10-26.xlsx` fixture and must stay byte-for-byte real DoM data. Do not regenerate it from invented values. Likewise, `tests/fixtures/meteo-snapshot-2026-10-26.json` is a recorded real snapshot used for value-level meteo assertions; the live `data/meteo.json` is only checked for schema drift. Never replace either fixture with invented readings.
- The default Playwright command builds and starts production. Make sure port 3000 is free or stop an existing dev server; `reuseExistingServer` is enabled outside CI.
- The accessibility suite runs axe-core against onboarding, both themes of the dashboard, the day-detail dialog, preferences, and the location dialog. Keep these passing.
- Screenshots are written to `test-results/screenshots/` and are not committed. Selected copies under `docs/screenshots/` are used by the README.
- Verify changes with `npm run lint`, `npm run test:unit`, and `npm run test:e2e`. Do not claim checks passed without running them.
- For a production smoke test, start the built app and check `/` (HTML), `/api/weather/meteo-json` (JSON with the real snapshot), `/api/weather/metar` (JSON or a structured 503), and `/api/weather/sri-lanka-dom` (JSON). Force the legacy fallback with `AERIS_OFFICIAL_SOURCE=metar` on a second port to confirm the labelled airport path without waiting for a DoM timeout.

## Deployment

Vercel is the deployment target for this workstream and needs no required environment variables. `vercel.json` selects the Next.js framework and the `sin1` region. The repository still contains a legacy `netlify.toml`; do not treat Netlify as a supported or exercised target for this work.

- Do not add a static `/* /index.html 200` redirect or point a static host at `out`, `dist`, `build`, or the repository root. The page lives at `.next/server/app/index.html` and requires the framework adapter; serving `.next` as static files produces a “Page not found” page.
- Deployment is only real if an authenticated Vercel account or token is available. Do not fabricate a deployment URL.
- See `README.md` for dashboard, CLI, and redeploy checks.
