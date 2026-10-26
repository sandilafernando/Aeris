<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aeris project guide

This file is for future coding agents. Keep the Next.js block above intact; `next dev` regenerates it.

## What this is

Aeris is a weather dashboard using the Next.js App Router and live Open-Meteo APIs. The visual direction is Material 3 Expressive-inspired, not a Google product or an official Material implementation. Forecast, search, ensemble, and archive requests run in the browser. One server route handler reads official Sri Lankan observations: the Department of Meteorology (DoM) 3-hourly station workbook first, the DoM map page second, then official NOAA AWC ICAO METAR airport reports as a clearly labelled fallback. Optional NASA GIBS satellite imagery and browser-local weather notifications are independent, separately labelled features. There is no database, authentication, or API key. `AERIS_*` environment variables are optional and only tune the official-observation route.

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

- `src/app/page.js` renders the single client entry point. `src/app/layout.js` owns fonts, metadata, the theme initialization script, and providers. `src/app/api/weather/sri-lanka-dom/route.js` is the only route handler.
- `src/components/weather-app.jsx` is the client orchestrator. It owns saved places, the active location, dialogs, page title, palette application, auto-refresh, and online/offline refresh behavior.
- `src/hooks/use-weather.js` handles fetching, request deduplication, a 10-minute in-memory cache, a 15-second timeout, stale data on refresh failure, and manual refresh bypass.
- `src/hooks/use-official-source.js` loads the official-observation route with a 5-minute in-memory cache, a 6-hour localStorage last-known-good record, abort handling, exponential retry backoff (30/60/120/240/300 s), and an explicit `status: "stale"` state. It must never label cached data as live.
- `src/hooks/use-city-search.js` handles debounced geocoding with abort handling and a visible derived state, so stale results never flash.
- `src/lib/weather.js` builds the Open-Meteo URL and normalizes the payload. Keep normalization defensive: optional fields may be missing and must degrade to `null`/“Unavailable”, not throw. The app requires `payload.current` and `hourly.time`.
- `src/lib/sources/official-observations.js` orchestrates DoM first and NOAA AWC METAR second. Never merge the two sources or relabel airport data as DoM district data.
- `src/lib/sources/dom-workbook.js` is a small, bounded XLSX/ZIP reader. It handles the workbook's shared strings, first worksheet, typed numeric cells, and archive limits without a general spreadsheet dependency. Keep it read-only and fail closed.
- `src/lib/sources/sri-lanka-dom.js` fetches the workbook first and the public map page second, normalizes both into the same station shape, and labels the representation. The map page omits station IDs, wind, pressure, cloud cover, and dew point; say so in the UI. Do not scrape a different page without updating attribution, fixtures, and tests.
- `src/lib/sources/metar.js` normalizes ICAO METAR reports into the same station shape and leaves rainfall `null`, because METAR has no rainfall total.
- `src/components/satellite-card.jsx` and `src/lib/satellite.js` render NASA GIBS Himawari infrared and VIIRS true-colour imagery. GIBS can advertise a frame before ingestion completes, so the card fetches the availability XML, starts one 10-minute step back, probes the image byte length, and skips blank frames. It is not radar and not a DoM observation.
- `src/lib/weather-alerts.js` and `src/hooks/use-weather-notifications.js` implement opt-in, page-open-only precipitation notifications from the Open-Meteo forecast. No push subscription, service worker push handler, server, or third-party messaging service is involved.
- `src/lib/storage.js` owns the stable localStorage keys and sanitization. Places are capped at 20, coordinates are rounded to three decimals, and invalid records are discarded.
- `src/lib/palettes.js` defines condition palettes. Do not hardcode condition colors in components; use the CSS variables or Tailwind design tokens.
- `src/components/ui/` contains shadcn/ui primitives. Extend them sparingly and keep the existing Radix accessibility behavior.

## Product invariants

- Use real Open-Meteo data for forecasts and geocoding. Never invent weather values, place names, alerts, or a live deployment URL.
- Do not add a radar layer unless a properly licensed tile provider is selected and attribution is implemented. The absence of radar is intentional and documented. NASA GIBS satellite imagery is not radar.
- NASA GIBS imagery is an independent product, not a DoM observation, not a forecast, and not rainfall. Keep the timestamp, the blank-frame probe, and the “clouds, not rainfall” copy honest.
- Do not add tracking, analytics, ads, accounts, or third-party scripts without an explicit product decision.
- Current-location data is session-only and must not enter the saved-places list. Saved places and preferences belong in localStorage only.
- Weather notifications are opt-in and browser-local. They are generated only while the page is open, never through a server, Discord/webhook, or third-party push service. Keep the preference default `false` and keep the permission/blocked copy truthful.
- Keep the localStorage schemas `aeris:preferences:v1` and `aeris:places:v1` compatible, or add a deliberate migration.
- Keep both official sources honest. DoM is primary. NOAA AWC METAR is a labelled fallback for airport stations, used only when DoM cannot be reached or parsed. Never present fallback data as DoM district data, and never invent a station or observation.
- METAR does not carry a rainfall total. Keep rainfall `null`/“Unavailable” for METAR stations; never render it as `0.0 mm`.
- Automatic station selection for DoM uses documented approximate city-centre reference points because the DoM page does not publish coordinates. Label them as Aeris reference points, not official station coordinates.
- All Open-Meteo weather fetches happen in the browser. The only server-side fetch is the official-observation route. Do not add another proxy without updating privacy copy, caching behavior, and tests.
- Preserve honest empty/error/offline states. A stale forecast must be labelled as stale; a missing value must not masquerade as zero.
- The route must return JSON in every branch, including failure. It must never return the app HTML or a platform not-found page for `/api/weather/sri-lanka-dom`.

## Next.js 16 notes

- `cacheComponents` and `partialPrefetching` are enabled in `next.config.mjs`. Do not read `Date.now()`, `window`, or `localStorage` during render. Use effects for time and persistence. `useNow()` intentionally starts at `0` and updates after hydration.
- Read the bundled guides in `node_modules/next/dist/docs/` before changing routing, rendering, caching, metadata, or config. This version differs from older Next.js releases.
- `turbopack.root` is set to `import.meta.dirname` so the parent-directory lockfile is not picked up.
- `/` is statically prerendered and live weather is purely client-side. `/api/weather/sri-lanka-dom` is request-time rendered and calls `await connection()` before reading the clock or upstream data. `cacheComponents` rejects route segment config such as `runtime` and `dynamic`; do not re-add them.
- `export const maxDuration = 60` is the only route segment export the observation handler needs. The route caches successful upstream data for five minutes and serves stale data for up to six hours with an explicit stale status.

## Design and accessibility

- Use the project's semantic tokens (`bg-card`, `text-muted-foreground`, `border-outline-variant`, `--hero-*`, `--shadow-soft`, etc.) rather than raw colors.
- Keep the condition palette families (`clear`, `partly`, `cloudy`, `rain`, `snow`, `storm`, `fog`) and day/night hero variants coherent in light and dark themes.
- Preserve the keyboard combobox behavior, skip link, focus styles, dialog focus management, `aria-live` announcements, and reduced-motion handling.
- Ensure accessible names match visible text after whitespace normalization. Several tests depend on token order in accessible names.
- Test responsive layouts from 360 px to 1440 px and watch horizontal overflow from off-screen assistive text or scroll containers.

## Testing

- Unit tests use Node's test runner and live in `tests/unit/*.test.js`. Add pure logic tests alongside the existing weather, storage, station-selection, cache, and official-source suites.
- Playwright tests live in `tests/e2e/`. `helpers.js` intercepts Open-Meteo with deterministic fixtures from `tests/fixtures/weather.js`, the official-observation route with fixtures from `tests/fixtures/official-sources.js`, and NASA GIBS with a padded PNG that clears the blank-frame probe. Pass `officialSource: "metar"` to exercise the labelled fallback. When API fields change, update the normalizer, fixtures, and unit tests together.
- `tests/unit/dom-workbook.test.js` uses the recorded `tests/fixtures/dom-3hourly-2026-10-26.xlsx` fixture and must stay byte-for-byte real DoM data. Do not regenerate it from invented values.
- The default Playwright command builds and starts production. Make sure port 3000 is free or stop an existing dev server; `reuseExistingServer` is enabled outside CI.
- The accessibility suite runs axe-core against onboarding, both themes of the dashboard, the day-detail dialog, preferences, and the location dialog. Keep these passing.
- Screenshots are written to `test-results/screenshots/` and are not committed. Selected copies under `docs/screenshots/` are used by the README.
- Verify changes with `npm run lint`, `npm run test:unit`, and `npm run test:e2e`. Do not claim checks passed without running them.
- For a production smoke test, start the built app and check both `/` (HTML) and `/api/weather/sri-lanka-dom` (JSON). Force the fallback with `AERIS_OFFICIAL_SOURCE=metar` on a second port to confirm the labelled airport path without waiting for a network timeout.

## Deployment

Vercel is the deployment target for this workstream and needs no required environment variables. `vercel.json` selects the Next.js framework and the `sin1` region. The repository still contains a legacy `netlify.toml`; do not treat Netlify as a supported or exercised target for this work.

- Do not add a static `/* /index.html 200` redirect or point a static host at `out`, `dist`, `build`, or the repository root. The page lives at `.next/server/app/index.html` and requires the framework adapter; serving `.next` as static files produces a “Page not found” page.
- Deployment is only real if an authenticated Vercel account or token is available. Do not fabricate a deployment URL.
- See `README.md` for dashboard, CLI, and redeploy checks.
