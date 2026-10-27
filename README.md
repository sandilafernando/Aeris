# Aeris

Aeris is a responsive, Material 3 Expressive-inspired weather dashboard built with Next.js, React, Tailwind CSS, live forecasts from [Open-Meteo](https://open-meteo.com/), and current station observations from the Sri Lanka Department of Meteorology (DoM). Official district readings come from the repository's published `data/meteo.json` snapshot, with the Department's live 3-hourly workbook and map page kept as a separate server route and clearly labelled NOAA AWC airport METAR reports as the fallback. A single configurable **At a glance** widget combines those official readings with the Open-Meteo model estimate without merging their identities. Aeris also shows timestamped NASA GIBS satellite imagery with a real six-frame loop, offers opt-in browser-local rain notifications, and can be installed as a PWA. Saved places, preferences, and the last successful forecast stay on your device. No account, API key, database, or analytics are involved.

![Aeris dashboard in light mode](docs/screenshots/dashboard-light.png)

## Highlights

- **Current conditions** — temperature, feels-like temperature, daily high/low, condition, precipitation, wind, humidity, pressure, visibility, cloud cover, and UV, with an animated condition illustration.
- **At a glance** — one configurable observation widget for the active place. It combines DoM district readings from `data/meteo.json`, NOAA AWC airport METAR reports, and the Open-Meteo model estimate while keeping each source separate. Choose **DoM**, **Airports**, or **Both**, pick up to six metrics, and keep a manual station or ask for the nearest fresh station with an explicit **Near me** action. Every reading shows its source, station, observation time, and age.
- **Sri Lankan station observations** — validated DoM snapshot records with a five-hour freshness rule measured from the published observation time in `Asia/Colombo`. A missing, malformed, future-dated, or stale DoM reading is replaced by a clearly labelled recent airport METAR report; the two are never merged. DoM `Trace` rainfall stays distinct from zero and unavailable.
- **Station selection** — automatic selection prefers a fresh usable observation over a nearer stale one. Outside Sri Lanka it uses a labelled default instead of pretending a station is nearest. A manual choice is saved, shared between the dashboard and Preferences, and never silently replaced.
- **Satellite imagery** — timestamped NASA GIBS imagery centred on Sri Lanka with three switchable products: Himawari-9 red-visible (daylight, about 1.85 km), Himawari-9 clean infrared (day and night), and a finished VIIRS true-colour pass. The card reads NASA's availability window, skips blank or incomplete frames, and offers an on-demand six-frame loop with per-frame timestamps. It is a separate NASA product, not radar, not a forecast, and not a DoM observation.
- **Rain notifications** — optional browser notifications when the Open-Meteo forecast expects rain, snow, or storms within the next few hours. They are local to the open tab, off by default, and require browser permission. No push server or webhook is involved.
- **Hourly forecast** — 24 hourly steps with condition, temperature, and precipitation probability.
- **Seven-day outlook** — daily high/low ranges, conditions, rain chance, and a detail dialog with sunrise, sunset, UV, wind, and precipitation.
- **Weather Desk** — a weather-responsive header brief (rain peak, best outdoor window, expected rain) plus Plan, Rain, Spread, Compare, and History tools for the active place, with model spread labelled as a model rather than an observation.
- **Place search** — debounced Open-Meteo geocoding with keyboard navigation, empty states, and retry handling.
- **Browser geolocation** — optional current-position forecast that stays session-only.
- **Saved places** — up to 20 locations, persisted in `localStorage`, with switching and removal.
- **Preferences** — Celsius/Fahrenheit, km/h, mph, or m/s, light, dark, and system themes, reduced effects, rain notifications, the At a glance source and metrics, and the saved station.
- **Resilient states** — loading skeletons, retryable errors, stale-forecast notices, offline messaging with the saved forecast, automatic refresh, and refresh-on-reconnect.
- **Installable PWA** — a production service worker caches the app shell for offline launches, serves a dedicated offline page, and never caches weather API responses. Settings offers a real install action where the browser exposes one, Safari-specific Add to Home Screen steps on iPhone and iPad, and hides installation guidance when Aeris is already running standalone.
- **Responsive and accessible** — layouts verified from 360 px through 1440 px, keyboard-friendly controls, reduced-motion support, and automated WCAG 2.2 AA checks.

### Desktop, dark, and mobile

| Dark | Mobile |
| --- | --- |
| ![Aeris dashboard in dark mode](docs/screenshots/dashboard-dark.png) | ![Aeris dashboard at 360 pixels wide](docs/screenshots/dashboard-mobile.png) |

The onboarding screen is shown before a first place is chosen:

![Aeris onboarding screen](docs/screenshots/onboarding-light.png)

Screenshots are captured from a production build against the real Open-Meteo forecast and the live DoM snapshot at the time of capture, so the values are illustrative of that moment rather than a live reading.

## Stack

- **Framework:** Next.js 16.4 (App Router, Cache Components, three request-time weather route handlers)
- **UI:** React 19, Tailwind CSS 4, shadcn/ui primitives built on Radix UI, Lucide icons
- **Motion:** Motion for React and CSS animations, with reduced-motion handling
- **Data:** Open-Meteo Forecast, Ensemble, Archive, and Geocoding APIs; the repository's DoM `data/meteo.json` snapshot; DoM 3-hourly workbook and map page; NOAA Aviation Weather Center ICAO METAR fallback; NASA GIBS satellite imagery
- **Offline:** Hand-written service worker and web app manifest
- **Testing:** Node's built-in test runner, Playwright, axe-core
- **Language:** JavaScript (JSX), no TypeScript
- **Deployment target:** Vercel (no environment variables required)

## Getting started

Requires Node.js 20.9 or newer and npm 10 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Forecast, ensemble, archive, and search requests go directly from the browser to Open-Meteo. Official observations use same-origin route handlers because `meteo.gov.lk` does not allow cross-origin browser requests:

- `/api/weather/meteo-json` is the At a glance widget's primary DoM source. It validates the published `data/meteo.json` snapshot from [the repository](https://raw.githubusercontent.com/sandilafernando/Aeris/main/data/meteo.json), falls back to the local file when GitHub is unreachable, rejects future or malformed observation times, and caches for two minutes with a six-hour stale allowance.
- `/api/weather/metar` supplies the labelled NOAA AWC airport fallback and is requested lazily, only when the selected source needs it or the DoM reading is stale.
- `/api/weather/sri-lanka-dom` keeps the original Department workbook/map-page path available as a separate official source.

There is no `.env` file and no key to configure.

Optional server environment variables for the legacy `/api/weather/sri-lanka-dom` route (the snapshot and METAR routes need none):

| Variable | Purpose |
| --- | --- |
| `AERIS_OFFICIAL_SOURCE` | `auto` (default), `dom` to require DoM, or `metar` to skip DoM |
| `AERIS_DOM_PROXY_URL` | Private relay that returns the DoM map page HTML when the public host blocks cloud egress; the workbook is still requested from the public host first |
| `AERIS_DOM_TIMEOUT_MS` | DoM request budget; defaults to 22 s on serverless platforms and 25 s elsewhere, matching measured 6–19 s responses |
| `AERIS_METAR_TIMEOUT_MS` | NOAA AWC fallback budget; defaults to 8 s |

None of these are required for a normal deployment. The relay is optional and must not rewrite or invent observations.

The service worker is registered only in a production build. Use `npm run build && npm run start` to exercise install and offline behavior; the dev server intentionally runs without it so stale caches cannot mask local changes.

## Install Aeris

Aeris is installable in a production build. Open **Preferences → Install Aeris** for the state that applies to your browser.

- **Android or Chromium desktop:** if the browser offers an install prompt, use the **Install Aeris** button. If it does not, open the browser menu and choose **Install app** / **Add to Home screen**.
- **iPhone or iPad:** installation is only available from Safari. Open the Share menu, then choose **Add to Home Screen** and confirm.
- **Already installed:** Aeris detects a standalone window and shows that installation is complete instead of offering it again.

The installed app caches its shell and can show the last successful forecast for up to 24 hours with its original timestamp. Live forecasts, satellite frames, and station observations still require a connection.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Turbopack development server |
| `npm run build` | Create an optimized production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint across the project |
| `npm run test:unit` | Run Node unit tests for weather, storage, formatting, palettes, station selection, the DoM snapshot and workbook parsers, the At a glance orchestrator, cache behavior, last-forecast persistence, satellite frames, and presence parsing |
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

- **Unit tests** for condition mapping, forecast normalization, URL construction, unit conversion, time formatting, storage sanitization, last-forecast persistence and expiry, palette resolution, DoM snapshot validation and the five-hour rule, DoM workbook parsing, DoM map-page parsing, station selection and freshness ranking, cached-fetch fallback, METAR normalization (including `null` rainfall), the At a glance source/fallback orchestration, precipitation-onset notifications, NASA GIBS frame parsing and loop sequencing, and presence parsing.
- **Playwright tests** for onboarding, keyboard search, forecast rendering, At a glance source switching and metric persistence, manual and automatic station selection, permission-denied fallback, the labelled default outside Sri Lanka, trace rainfall, stale and unavailable observation states, the labelled NOAA AWC fallback, satellite layer switching, notification preference persistence, Weather Desk tools, refresh success and failure, saved-place management, preference persistence, initial errors, offline recovery with the saved forecast, geolocation, empty search, responsive overflow, dialog sizing and touch targets, and production service-worker caching, offline boot, install prompts, iOS instructions, and standalone detection.
- **Accessibility scans** with axe-core on the onboarding screen, light and dark dashboards, day-detail dialog, preferences dialog, and location dialog. No automated WCAG 2.2 A/AA violations were found in the tested surfaces.

Playwright intercepts Open-Meteo, the meteo snapshot route, the METAR route, and NASA GIBS with deterministic fixtures so runs do not depend on live conditions. The observation fixtures are copied from a recorded real `data/meteo.json` snapshot (`tests/fixtures/meteo-snapshot-2026-10-26.json`) with timestamps shifted relative to the browser clock, so freshness and stale behavior can be tested at any time while the live collector keeps changing its readings. The GIBS fixture is padded past the card's blank-frame threshold. Screenshots saved during the responsive run are written to `test-results/screenshots/`; selected production screenshots are checked in under `docs/screenshots/`.

These are automated checks, not a substitute for a manual screen-reader and assistive-technology audit.

## Architecture

```text
src/
  app/                 Next.js app shell, metadata, global styles, icon
  app/api/weather/     Snapshot, METAR, and DoM workbook/map route handlers
  components/          Dashboard, At a glance, satellite card, Weather Desk,
                       dialogs, UI primitives
  hooks/               Weather loading, official sources, city search,
                       notifications, presence, PWA
  lib/                 API normalization, storage, station selection, glance
                       orchestration, formatting, palettes, satellite helpers,
                       DoM snapshot/workbook/METAR adapters, cache helpers
public/
  sw.js                App-shell service worker (production only)
  offline.html         Offline fallback page
  icons/               PWA and platform icons
data/meteo.json        Published DoM snapshot used by the At a glance widget
vercel.json            Vercel framework and function region
tests/
  unit/                Node test runner suites
  e2e/                 Playwright functional, station, feature, axe, PWA, and
                       responsive suites
  fixtures/            Deterministic Open-Meteo, DoM, meteo snapshot, METAR,
                       and NASA GIBS payloads
docs/screenshots/      Production screenshots used in this README
```

Key implementation details:

- `src/lib/weather.js` builds the Open-Meteo request and normalizes the response into a small, defensive view model. Missing optional fields become `null` and render as unavailable instead of breaking the page.
- `src/hooks/use-weather.js` deduplicates in-flight requests, keeps a 10-minute in-memory cache, enforces a 15-second request timeout, and preserves the previous forecast when a refresh fails. It also writes the normalized forecast to a bounded offline cache so an offline reload can show a saved copy.
- `src/components/weather-app.jsx` owns saved places, the active location, dialogs, refresh scheduling, reconnect refresh, and the page-level loading/error/offline states. The At a glance widget owns its own official-observation requests.
- `src/app/api/weather/meteo-json/route.js` is the widget's primary DoM source. It fetches and validates the published `data/meteo.json` snapshot, wraps a stale server response explicitly, falls back to the repository copy, rejects observation times beyond a ten-minute future tolerance, caches for two minutes and may serve stale data for six hours.
- `src/app/api/weather/metar/route.js` is the lazy NOAA AWC airport fallback. It caches for two minutes, serves stale data for up to six hours with an explicit status, and returns JSON in every branch.
- `src/app/api/weather/sri-lanka-dom/route.js` keeps the original Department workbook/map-page orchestrator available. It calls `await connection()` for request-time rendering, uses a measured 22–25 s DoM budget, and never returns HTML.
- `src/lib/sources/meteo-json.js` validates the snapshot schema, parses `YYYY-MM-DD HHMM` in `Asia/Colombo`, preserves `Trace` rainfall, de-duplicates by freshest observation, applies the five-hour freshness rule, and exposes Aeris reference points rather than claiming official coordinates.
- `src/lib/sources/official-observations.js` remains the DoM-first orchestrator for the legacy route and falls back to NOAA AWC METAR only when DoM cannot be reached or parsed. The two datasets are never merged.
- `src/lib/sources/dom-workbook.js` is a small read-only XLSX/ZIP reader for the Department's 3-hourly workbook. It bounds archive size, validates station IDs, parses Sri Lanka time explicitly, and rejects impossible dates instead of guessing.
- `src/lib/sources/sri-lanka-dom.js` labels whether the workbook or the map page answered. The map page omits station IDs, wind, pressure, cloud cover, and dew point, so those fields become unavailable rather than zero.
- `src/lib/sources/metar.js` normalizes ICAO METAR reports from Sri Lankan airport stations, maps them to the same station model, and deliberately leaves rainfall unavailable because METAR does not carry a rainfall total.
- `src/lib/station-selection.js` contains the automatic and manual station rules: Sri Lanka detection, approximate distance, freshness and usability checks, and the unavailable-manual fallback.
- `src/lib/glance.js` orchestrates the widget. It normalizes the saved source and metrics, chooses the default station outside Sri Lanka, keeps DoM and METAR groups separate, and only substitutes a fallback when the selected DoM reading is stale or missing.
- `src/components/at-a-glance.jsx` renders the source selector, station preference, editable metrics, explicit **Near me** geolocation, trace rainfall, the Open-Meteo model block, and honest loading, stale, cached, fallback, and unavailable notices.
- `src/lib/satellite.js` and `src/components/satellite-card.jsx` fetch the NASA GIBS availability window, start behind the newest advertised frame, and probe the decoded image size so a blank 200 response is skipped. Visible, infrared, and finished true-colour products are right-sized rather than upscaled, and the six-frame loop runs only on request.
- `src/lib/weather-alerts.js` finds the first upcoming wet hour in the Open-Meteo forecast. `src/hooks/use-weather-notifications.js` turns that into an opt-in browser notification only while the page is open. There is no push subscription or server.
- Preferences and places persist under `aeris:preferences:v1` and `aeris:places:v1`; the offline forecast uses `aeris:last-forecast:v1`. Coordinates are rounded to three decimal places before storage and API use. `stationId` defaults to `"auto"`, `weatherNotifications` to `false`, and the At a glance source to DoM.
- Each weather condition family has a light and dark palette. Palette values are exposed as CSS variables on the document root, including separate day and night hero treatments.
- The theme and reduced-effects flag are initialized by a small inline script before hydration to avoid a flash. `useNow()` intentionally starts at zero so Cache Components can prerender without reading the current time.
- Dialogs use Radix primitives for focus trapping, Escape handling, and restoration. Motion animations are disabled when the user prefers reduced motion or enables **Reduce effects**, and ambient CSS animations pause while the tab is hidden.
- `public/sw.js` caches only stable same-origin shell assets plus the hashed CSS, JS, and fonts referenced by the cached document. It bypasses `/api/*`, Next.js data and image routes, third-party origins, and non-GET requests, and is versioned so an update replaces the previous cache.

## Data and privacy

- Forecasts, hourly data, and current conditions come from the Open-Meteo Forecast API. Place search uses the Open-Meteo Geocoding API, which is based on GeoNames data. Weather Desk's spread and history tools use Open-Meteo's ensemble and archive APIs.
- Current station observations come first from the [Sri Lanka Department of Meteorology](https://meteo.gov.lk/). The At a glance widget reads the repository's published [DoM snapshot](https://raw.githubusercontent.com/sandilafernando/Aeris/main/data/meteo.json) through Aeris's own `/api/weather/meteo-json` route; that route takes no parameters, so no place name, coordinates, saved place, or preference is sent with it. The Department's live 3-hourly workbook and public map page remain available through `/api/weather/sri-lanka-dom`. If DoM is stale or unreachable, the widget requests official ICAO METAR reports from the [NOAA Aviation Weather Center](https://aviationweather.gov/data/api/) through `/api/weather/metar` and marks them as airport observations, not DoM district stations.
- Satellite imagery is requested directly from [NASA EOSDIS GIBS](https://gibs.earthdata.nasa.gov/) by the browser, which exposes the user's IP address and request time to NASA. The imagery is rendered from JMA Himawari and NASA/NOAA VIIRS data. It is not radar and not a DoM observation.
- Forecast, search, ensemble, and archive requests go directly from the browser to Open-Meteo. Optional weather notifications are generated in the open page and never sent to a server. Aeris has no database, accounts, analytics, advertising, or tracking scripts.
- The footer's best-effort “here now” count exchanges a random per-tab ID and a timestamp through the public [ntfy.sh](https://ntfy.sh/) relay. The topic is public: never treat the count as authenticated or private. No account, location, or personal data is sent. If the relay is blocked or rate-limited, the chip reports that the count is unavailable instead of guessing.
- Saved places, preferences, and up to three recent forecasts remain in this browser's `localStorage` under `aeris:places:v1`, `aeris:preferences:v1`, and `aeris:last-forecast:v1`. A saved forecast is shown only after a failed load or while offline, is labelled with its original fetch time, and is discarded after 24 hours. The current-location forecast is held in memory for the session and is not saved. Current coordinates are rounded before use.
- A production service worker caches the app shell and stable static assets. It does not cache `/api` routes or weather responses, so a fresh reload still needs the network for live data; the browser-local saved forecast supplies the offline dashboard instead.
- Open-Meteo data is provided under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). NASA GIBS imagery is subject to NASA EOSDIS and underlying JMA/NASA data policies; attribution is shown in the app. The DoM site claims copyright and publishes no open-data licence, so Aeris displays the published observation with attribution and does not claim redistribution rights. Aeris is not affiliated with Google, Open-Meteo, the Department of Meteorology, NOAA, NASA, or JMA.
- Weather data is informational. Aeris does not display official warnings, and nothing here is a substitute for government-issued severe-weather guidance or emergency instructions.

## Known limitations

- **No radar.** Consumer radar tile services have restrictive licensing and attribution requirements, so a radar layer was deliberately left out rather than simulated. NASA GIBS satellite imagery is not a substitute for radar.
- **Satellite timing and resolution.** Himawari frames arrive about every 10 minutes but can run 30–50 minutes behind, GIBS can advertise a frame before ingestion completes, and the six-frame loop excludes the newest advertised slot for that reason. The visible product is about 1.85 km per pixel. The true-colour product is a finished daytime VIIRS pass rather than a live frame, and orbital swaths can leave gaps. Aeris right-sizes each request instead of upscaling a tiny preview, but the imagery is still not suitable for street-level zoom.
- **Notifications need an open tab.** Alerts are generated locally from the forecast while Aeris is open. They are not push notifications, do not survive a closed tab or sleeping device, and cannot be delivered in the background.
- **No official bulletins or advisories.** The app shows forecast conditions, DoM station observations, and satellite imagery, not government-issued warnings. Check the Department of Meteorology directly for official alerts.
- **Approximate station locations.** DoM does not publish station coordinates in the snapshot. Distance and automatic selection for DoM therefore use documented approximate city-centre reference points, labelled in the interface as Aeris reference points rather than official station coordinates. NOAA AWC fallback stations do publish airport coordinates.
- **Snapshot fields are limited.** `data/meteo.json` carries station name, observation time, temperature, relative humidity, 3-hour and since-08:30 rainfall, and a condition label. It does not carry coordinates, wind, pressure, cloud cover, or dew point, so the DoM group cannot show them. The separate workbook route can supply those fields when it is reachable.
- **Default station outside Sri Lanka.** Automatic selection matches a station only inside Sri Lanka. For any other place the widget uses a labelled default (Colombo for DoM, Katunayake for METAR) and says so instead of calling it the nearest station. A manual station can still be chosen.
- **DoM snapshot collection is best-effort.** The snapshot is produced by a scheduled collector and can lag or stop; Aeris enforces the five-hour rule on the observation timestamp and falls back to METAR when the snapshot is stale. A missing, malformed, or future-dated timestamp is treated as unusable, never as fresh.
- **DoM parsing can break.** Observations are read from an undocumented 3-hourly XLSX workbook and a public HTML map page. The workbook is manually re-saved and uploaded roughly 45–51 minutes after each synoptic hour, so a 3-hour-old reading is normal. If the format changes, Aeris shows the fallback or an unavailable state rather than inventing a reading.
- **DoM network reachability varies by region.** `meteo.gov.lk` succeeds from some local and Sri Lankan networks but can take 6–19 s, and times out from many public cloud regions. This is an upstream network restriction, not a parser or CORS failure. Aeris uses a measured 22–25 s budget, optionally supports a private DoM HTML relay, and otherwise shows the labelled NOAA AWC fallback.
- **The NOAA fallback is not DoM district data.** It contains official ICAO airport reports, not Department of Meteorology district stations, and METAR does not include a rainfall total. Depending on reporting, only a subset of the six configured airports may appear. The interface always names the active source.
- **Offline shows a saved copy, not live weather.** The installed app can launch from cache and render the last successful forecast for up to 24 hours, clearly labelled with its age. Live forecasts, satellite imagery, and station observations still require a network connection.
- **No reverse geocoding.** Browser coordinates are labelled “Current location” rather than resolved to a street address or city name.
- **Live-service dependency.** Search, forecasts, and station observations require Open-Meteo, GitHub's raw file host (for the snapshot), DoM, and/or NOAA AWC to be reachable and are subject to their availability, CORS policy, and rate limits. The presence count additionally depends on ntfy.sh.
- **Local-only personal data.** Clearing browser storage removes saved places, preferences, and the saved forecast. Saved places do not sync across devices.
- **Automated accessibility only.** Automated axe scans pass, but a manual screen-reader audit has not been performed.

## Deployment

Aeris is a Next.js application with three request-time route handlers. It needs a platform that runs the Next.js server output, not a static file host. Vercel detects the framework automatically and needs no environment variables.

The existing public deployment is [aeris-weather-sf.netlify.app](https://aeris-weather-sf.netlify.app/). The repository still contains a legacy `netlify.toml`; Netlify is not the primary or exercised target for this work, and a successful Git push does not by itself prove a Netlify deploy succeeded. Check the deployment log or the live page after publishing.

### Vercel

`vercel.json` sets the framework to `nextjs` and the function region to Singapore (`sin1`), which is closer to Sri Lanka than the default US region.

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. Import the repository at [vercel.com/new](https://vercel.com/new) and keep the detected framework preset as **Next.js**.
3. Use the default build command and output settings, then deploy.
4. After authenticating with `npx vercel login`, the CLI equivalent is:

```bash
npx vercel --prod
```

Do not set a static output directory. The page is written to `.next/server/app/index.html` and needs the framework adapter; a static host pointed at `.next` without that adapter will show a not-found page.

A production URL is only real after the project is connected to an authenticated Vercel account. This repository does not contain a deployment URL, and none is invented here.
