<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aeris project guide

This file is for future coding agents. Keep the Next.js block above intact; `next dev` regenerates it.

## What this is

Aeris is a weather dashboard using the Next.js App Router and live Open-Meteo APIs. The visual direction is Material 3 Expressive-inspired, not a Google product or an official Material implementation. Forecast, search, ensemble, and archive requests run in the browser. One server route handler reads official Sri Lankan observations: the Department of Meteorology (DoM) page first, then official NOAA AWC ICAO METAR airport reports as a clearly labelled fallback. There is no database, authentication, or API key. `AERIS_*` environment variables are optional and only tune the official-observation route.

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
- `src/hooks/use-official-source.js` loads the official-observation route with a short client cache and abort handling.
- `src/hooks/use-city-search.js` handles debounced geocoding with abort handling and a visible derived state, so stale results never flash.
- `src/lib/weather.js` builds the Open-Meteo URL and normalizes the payload. Keep normalization defensive: optional fields may be missing and must degrade to `null`/“Unavailable”, not throw. The app requires `payload.current` and `hourly.time`.
- `src/lib/sources/official-observations.js` orchestrates DoM first and NOAA AWC METAR second. Never merge the two sources or relabel airport data as DoM district data.
- `src/lib/sources/sri-lanka-dom.js` fetches and parses the public DoM page with bounded attempts and safe diagnostics. Do not scrape a different page without updating attribution, fixtures, and tests.
- `src/lib/sources/metar.js` normalizes ICAO METAR reports into the same station shape and leaves rainfall `null`, because METAR has no rainfall total.
- `src/lib/storage.js` owns the stable localStorage keys and sanitization. Places are capped at 20, coordinates are rounded to three decimals, and invalid records are discarded.
- `src/lib/palettes.js` defines condition palettes. Do not hardcode condition colors in components; use the CSS variables or Tailwind design tokens.
- `src/components/ui/` contains shadcn/ui primitives. Extend them sparingly and keep the existing Radix accessibility behavior.

## Product invariants

- Use real Open-Meteo data for forecasts and geocoding. Never invent weather values, place names, alerts, or a live deployment URL.
- Do not add a radar layer unless a properly licensed tile provider is selected and attribution is implemented. The absence of radar is intentional and documented.
- Do not add tracking, analytics, ads, accounts, or third-party scripts without an explicit product decision.
- Current-location data is session-only and must not enter the saved-places list. Saved places and preferences belong in localStorage only.
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
- Playwright tests live in `tests/e2e/`. `helpers.js` intercepts Open-Meteo with deterministic fixtures from `tests/fixtures/weather.js` and the official-observation route with fixtures from `tests/fixtures/official-sources.js`. Pass `officialSource: "metar"` to exercise the labelled fallback. When API fields change, update the normalizer, fixtures, and unit tests together.
- The default Playwright command builds and starts production. Make sure port 3000 is free or stop an existing dev server; `reuseExistingServer` is enabled outside CI.
- The accessibility suite runs axe-core against onboarding, both themes of the dashboard, the day-detail dialog, preferences, and the location dialog. Keep these passing.
- Screenshots are written to `test-results/screenshots/` and are not committed. Selected copies under `docs/screenshots/` are used by the README.
- Verify changes with `npm run lint`, `npm run test:unit`, and `npm run test:e2e`. Do not claim checks passed without running them.
- For a production smoke test, start the built app and check both `/` (HTML) and `/api/weather/sri-lanka-dom` (JSON). Force the fallback with `AERIS_OFFICIAL_SOURCE=metar` on a second port to confirm the labelled airport path without waiting for a network timeout.

## Deployment

Netlify and Vercel are both supported with no required environment variables. `netlify.toml` uses `npm run build` and publishes `.next`; Netlify's zero-config OpenNext adapter turns that into the site and functions. `vercel.json` selects the Next.js framework and the `sin1` region.

- Do not add a static `/* /index.html 200` redirect or point Netlify at `out`, `dist`, `build`, or the repository root. The page lives at `.next/server/app/index.html` and requires the framework adapter; serving `.next` as static files produces a “Page not found” page.
- Do not install `@netlify/plugin-nextjs` manually. The current Netlify adapter is automatic.
- Deployment is only real if an authenticated Netlify or Vercel account or token is available. Do not fabricate a deployment URL.
- See `README.md` for dashboard, CLI, and redeploy checks.
