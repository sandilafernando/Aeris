<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Aeris project guide

This file is for future coding agents. Keep the Next.js block above intact; `next dev` regenerates it.

## What this is

Aeris is a client-side weather dashboard using the Next.js App Router and live Open-Meteo APIs. The visual direction is Material 3 Expressive-inspired, not a Google product or an official Material implementation. The app has no backend, database, authentication, environment variables, or API keys.

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

- `src/app/page.js` renders the single client entry point. `src/app/layout.js` owns fonts, metadata, the theme initialization script, and providers. There are no route handlers or server actions.
- `src/components/weather-app.jsx` is the client orchestrator. It owns saved places, the active location, dialogs, page title, palette application, auto-refresh, and online/offline refresh behavior.
- `src/hooks/use-weather.js` handles fetching, request deduplication, a 10-minute in-memory cache, a 15-second timeout, stale data on refresh failure, and manual refresh bypass.
- `src/hooks/use-city-search.js` handles debounced geocoding with abort handling and a visible derived state, so stale results never flash.
- `src/lib/weather.js` builds the Open-Meteo URL and normalizes the payload. Keep normalization defensive: optional fields may be missing and must degrade to `null`/“Unavailable”, not throw. The app requires `payload.current` and `hourly.time`.
- `src/lib/storage.js` owns the stable localStorage keys and sanitization. Places are capped at 20, coordinates are rounded to three decimals, and invalid records are discarded.
- `src/lib/palettes.js` defines condition palettes. Do not hardcode condition colors in components; use the CSS variables or Tailwind design tokens.
- `src/components/ui/` contains shadcn/ui primitives. Extend them sparingly and keep the existing Radix accessibility behavior.

## Product invariants

- Use real Open-Meteo data for forecasts and geocoding. Never invent weather values, place names, alerts, or a live deployment URL.
- Do not add a radar layer unless a properly licensed tile provider is selected and attribution is implemented. The absence of radar is intentional and documented.
- Do not add tracking, analytics, ads, accounts, or third-party scripts without an explicit product decision.
- Current-location data is session-only and must not enter the saved-places list. Saved places and preferences belong in localStorage only.
- Keep the localStorage schemas `aeris:preferences:v1` and `aeris:places:v1` compatible, or add a deliberate migration.
- All weather fetches happen in the browser. Do not introduce a server proxy without updating the privacy copy, caching behavior, and tests.
- Preserve honest empty/error/offline states. A stale forecast must be labelled as stale; a missing value must not masquerade as zero.

## Next.js 16 notes

- `cacheComponents` and `partialPrefetching` are enabled in `next.config.mjs`. Do not read `Date.now()`, `window`, or `localStorage` during render. Use effects for time and persistence. `useNow()` intentionally starts at `0` and updates after hydration.
- Read the bundled guides in `node_modules/next/dist/docs/` before changing routing, rendering, caching, metadata, or config. This version differs from older Next.js releases.
- `turbopack.root` is set to `import.meta.dirname` so the parent-directory lockfile is not picked up.
- The app is statically prerendered; live weather is purely client-side.

## Design and accessibility

- Use the project's semantic tokens (`bg-card`, `text-muted-foreground`, `border-outline-variant`, `--hero-*`, `--shadow-soft`, etc.) rather than raw colors.
- Keep the condition palette families (`clear`, `partly`, `cloudy`, `rain`, `snow`, `storm`, `fog`) and day/night hero variants coherent in light and dark themes.
- Preserve the keyboard combobox behavior, skip link, focus styles, dialog focus management, `aria-live` announcements, and reduced-motion handling.
- Ensure accessible names match visible text after whitespace normalization. Several tests depend on token order in accessible names.
- Test responsive layouts from 360 px to 1440 px and watch horizontal overflow from off-screen assistive text or scroll containers.

## Testing

- Unit tests use Node's test runner and live in `tests/unit/weather.test.js`. Add pure logic tests there.
- Playwright tests live in `tests/e2e/`. `helpers.js` intercepts Open-Meteo with deterministic fixtures from `tests/fixtures/weather.js`. When API fields change, update both the normalizer and fixtures.
- The default Playwright command builds and starts production. Make sure port 3000 is free or stop an existing dev server; `reuseExistingServer` is enabled outside CI.
- The accessibility suite runs axe-core against onboarding, both themes of the dashboard, the day-detail dialog, preferences, and the location dialog. Keep these passing.
- Screenshots are written to `test-results/screenshots/` and are not committed. Selected copies under `docs/screenshots/` are used by the README.
- Verify changes with `npm run lint`, `npm run test:unit`, and `npm run test:e2e`. Do not claim checks passed without running them.

## Deployment

The app deploys to Vercel with no environment variables. Deployment is only real if an authenticated Vercel account or token is available; do not fabricate a URL. See `README.md` for dashboard and CLI steps.
