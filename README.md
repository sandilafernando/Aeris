# Aeris

Aeris is a responsive, Material 3 Expressive-inspired weather dashboard built with Next.js, React, Tailwind CSS, and real forecast data from [Open-Meteo](https://open-meteo.com/). Search for a city or use browser geolocation to see current conditions, the next 24 hours, and a seven-day outlook. No account, API key, or backend is required.

![Aeris dashboard in light mode](docs/screenshots/dashboard-light.png)

## Highlights

- **Current conditions** — temperature, feels-like temperature, daily high/low, condition, precipitation, wind, humidity, pressure, visibility, cloud cover, and UV.
- **Hourly forecast** — 24 hourly steps with condition, temperature, and precipitation probability.
- **Seven-day outlook** — daily high/low ranges, conditions, rain chance, and a detail dialog with sunrise, sunset, UV, wind, and precipitation.
- **Place search** — debounced Open-Meteo geocoding with keyboard navigation, empty states, and retry handling.
- **Browser geolocation** — optional current-position forecast that stays session-only.
- **Saved places** — up to 20 locations, persisted in `localStorage`, with switching and removal.
- **Preferences** — Celsius/Fahrenheit, km/h, mph, or m/s, plus light, dark, and system themes.
- **Resilient states** — loading skeletons, retryable errors, stale-forecast notices, offline messaging, automatic 15-minute refresh, and refresh-on-reconnect.
- **Responsive and accessible** — layouts verified from 360 px through 1440 px, keyboard-friendly controls, reduced-motion support, and automated WCAG 2.2 AA checks.

### Desktop, dark, and mobile

| Dark | Mobile |
| --- | --- |
| ![Aeris dashboard in dark mode](docs/screenshots/dashboard-dark.png) | ![Aeris dashboard at 360 pixels wide](docs/screenshots/dashboard-mobile.png) |

The onboarding screen is shown before a first place is chosen:

![Aeris onboarding screen](docs/screenshots/onboarding-light.png)

## Stack

- **Framework:** Next.js 16.4 (App Router, Cache Components)
- **UI:** React 19, Tailwind CSS 4, shadcn/ui primitives built on Radix UI, Lucide icons
- **Motion:** Motion for React, with reduced-motion handling
- **Data:** Open-Meteo Forecast API and Geocoding API
- **Testing:** Node's built-in test runner, Playwright, axe-core
- **Language:** JavaScript (JSX), no TypeScript
- **Deployment target:** Vercel (no environment variables required)

## Getting started

Requires Node.js 20.9 or newer and npm 10 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Forecast and search requests go directly from the browser to Open-Meteo. There is no `.env` file and no key to configure.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Turbopack development server |
| `npm run build` | Create an optimized production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint across the project |
| `npm run test:unit` | Run Node unit tests for weather, storage, formatting, and palettes |
| `npm run test:e2e` | Build, start the production server, and run all Playwright tests |
| `PW_DEV=1 npm run test:e2e` | Run Playwright against an existing dev server |

In PowerShell, set the development-server flag for the current shell with:

```powershell
$env:PW_DEV = "1"
npm run test:e2e
```

Playwright uses the installed Chrome channel by default. If Chrome is unavailable, install Playwright's bundled browser and set `PW_BUNDLED=1`:

```bash
npx playwright install chromium
PW_BUNDLED=1 npm run test:e2e
```

## Testing

The suite covers:

- **13 unit tests** for condition mapping, forecast normalization, URL construction, unit conversion, time formatting, storage sanitization, and palette resolution.
- **18 Playwright tests** for onboarding, keyboard search, forecast rendering, refresh success and failure, saved-place management, preference persistence, initial errors, offline recovery, geolocation, empty search, responsive overflow, and daily-card reflow.
- **Accessibility scans** with axe-core on the onboarding screen, light and dark dashboards, day-detail dialog, preferences dialog, and location dialog. No automated WCAG 2.2 A/AA violations were found in the tested surfaces.

Playwright intercepts Open-Meteo requests with deterministic fixtures so runs do not depend on live conditions. Screenshots saved during the responsive run are written to `test-results/screenshots/`; selected production screenshots are checked in under `docs/screenshots/`.

These are automated checks, not a substitute for a manual screen-reader and assistive-technology audit.

## Architecture

```text
src/
  app/                 Next.js app shell, metadata, global styles
  components/          Dashboard, dialogs, cards, charts, UI primitives
  hooks/               Weather loading, city search, online status, clock
  lib/                 API normalization, storage, formatting, palettes
tests/
  unit/                Node test runner suites
  e2e/                 Playwright functional, axe, and responsive suites
  fixtures/            Deterministic Open-Meteo payloads
docs/screenshots/      Production screenshots used in this README
```

Key implementation details:

- `src/lib/weather.js` builds the Open-Meteo request and normalizes the response into a small, defensive view model. Missing optional fields become `null` and render as unavailable instead of breaking the page.
- `src/hooks/use-weather.js` deduplicates in-flight requests, keeps a 10-minute in-memory cache, enforces a 15-second request timeout, and preserves the previous forecast when a refresh fails.
- `src/components/weather-app.jsx` owns saved places, the active location, refresh scheduling, reconnect refresh, and the page-level loading/error/offline states.
- Preferences and places persist under `aeris:preferences:v1` and `aeris:places:v1`. Coordinates are rounded to three decimal places before storage and API use.
- Each weather condition family has a light and dark palette. Palette values are exposed as CSS variables on the document root, including separate day and night hero treatments.
- The theme is initialized by a small inline script before hydration to avoid a light-mode flash. `useNow()` intentionally starts at zero so Cache Components can prerender without reading the current time.
- Dialogs use Radix primitives for focus trapping, Escape handling, and restoration. Motion animations are disabled when the user prefers reduced motion.

## Data and privacy

- Forecasts come from the Open-Meteo Forecast API. Place search uses the Open-Meteo Geocoding API, which is based on GeoNames data.
- Requests are made directly from the browser. Aeris has no server-side weather proxy, analytics, advertising, or tracking scripts.
- Saved places and preferences remain in this browser's `localStorage`. The current-location forecast is held in memory for the session and is not saved. The current coordinates are rounded before being used.
- Open-Meteo data is provided under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution is shown in the app footer. Aeris is not affiliated with Google.
- Weather data is informational and is not a substitute for official severe-weather warnings or emergency guidance.

## Known limitations

- **No radar.** Consumer radar tile services have restrictive licensing and attribution requirements, so a radar layer was deliberately left out rather than simulated.
- **No official alerts layer.** The app shows forecast conditions, not government-issued warnings.
- **No offline persistence.** The last forecast remains visible while the tab is open and offline, but a reload without a connection requires the network again. There is no service worker.
- **No reverse geocoding.** Browser coordinates are labelled “Current location” rather than resolved to a street address or city name.
- **Live-service dependency.** Search and forecasts require access to Open-Meteo and are subject to its availability, CORS policy, and rate limits.
- **Local-only personal data.** Clearing browser storage removes saved places and preferences. Saved places do not sync across devices.
- **Automated accessibility only.** Automated axe scans pass, but a manual screen-reader audit has not been performed.

## Deploying to Vercel

The project is ready for a standard Vercel deployment and needs no environment variables.

### Dashboard import

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. Import the repository at [vercel.com/new](https://vercel.com/new).
3. Keep the detected framework preset as **Next.js**.
4. Use the default build command (`npm run build`) and output settings.
5. Deploy.

### Vercel CLI

After authenticating with `npx vercel login`:

```bash
npx vercel --prod
```

The app is statically prerendered where possible and uses client-side requests for live weather data. A production URL is only available after the project is connected to a Vercel account.
