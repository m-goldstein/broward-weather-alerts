# Tidewatch · Hollywood Beach

A mobile-first tide-and-rainfall planning dashboard. Hollywood Beach, Florida, ZIP **33019**, is the default; search another five-digit US ZIP to generate its outlook.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:5173. The development script runs Vite and the local API together. For a production server, run `npm run build` followed by `npm start` (port 3001).

## Vercel

The checked-in `vercel.json` uses the Vite build and `dist` output. The files in `api/` run as Vercel Node.js functions. NOAA/NWS forecasts do not require API keys. The backend uses temporary scratch storage on Vercel for optional cached snapshots; cache failures do not prevent forecast responses. Caches are best effort and are not durable across instances.

Commit and push all source files, including `src/` (and its `src/locales/es.ts` translation catalog), `api/`, `server/forecast.ts`, and `vercel.json`. Redeploying an older commit does not include new local fixes.

### CARTO basemap

Set **`CARTO_API_KEY`** in Vercel for the environments you deploy (Production and, if needed, Preview), then redeploy. Keep this name without a `VITE_` prefix. The browser requests `/api/basemap?zip=…&z=…&x=…&y=…&retina=…`; the server adds the key to CARTO's authenticated Positron raster URL. Only successful PNG tiles are cached; provider errors never return the key or upstream URL. Coordinates are validated and scoped to the selected ZIP’s map area. CARTO/OpenStreetMap attribution remains visible.

For local development, copy `.env.example` to `.env.local` and set the key. Both `npm run dev` and `npm start` load `.env.local`. It is gitignored. No key is needed for the forecast panels; the map displays a retry notice if tiles fail. If the key has website restrictions, allow your deployed hostname and localhost as appropriate; upstream requests include the platform's own origin as their Referer.

Reference: [CARTO basemap API key and tile URL documentation](https://www.carto.com/basemaps/apikey/).

## ZIP search and browser preferences

The search bar appears on every page. Enter a five-digit US ZIP and choose **Search**. A successful search updates tides, precipitation, NWS alerts, map markers, and the CSV export. The URL stores the selected ZIP (`/?zip=33139#overview`) for reloads and sharing. Opening `/` always starts in Hollywood 33019; **Back to Hollywood** returns there. Invalid or failed searches leave the current outlook and preferences in place.

ZIP coordinates come from [Zippopotam.us](https://docs.zippopotam.us/docs/getting-started/). Other ZIPs use the nearest [NOAA tide prediction station](https://api.tidesandcurrents.noaa.gov/mdapi/prod/) within **25 km**, with its name and distance displayed. A nearby station is a reference, not a prediction for a particular property or every waterway. If none is nearby, rainfall remains available and tide/overlap data stays incomplete. All displayed times remain **America/New_York (Eastern)**, clearly labeled, including for ZIPs in other time zones.

Preferences, notification enablement and lead time, checklist progress, and notification deduplication history live exclusively in `localStorage`, keyed by ZIP:

- `tidewatch.preferences.v2:33019`
- `tidewatch.checklist.v2:33019`
- `tidewatch.lastNotification.v2:33019`

No preferences are sent to or stored by the API. Another browser or device starts with its own defaults. People sharing the same browser profile share its local preferences; this is browser isolation, not authenticated accounts. Each ZIP also has independent settings within that browser. Legacy Hollywood-only settings migrate only into 33019. If browser storage is blocked, preferences work for the current visit and the settings panel reports that limitation.

Provider caches are keyed by ZIP/station and provider URL, independently of personal settings. Threshold and notification calculations run in the browser. No login, database, or additional API key is required for ZIP search.

## Flood check by ZIP and date/time

The **Check flooding for a date & time** form appears above the location search. Enter a five-digit US ZIP and a future date/time in **Eastern time (America/New_York)**, then choose **Check flood outlook**. This lookup is independent of the dashboard ZIP. Results show the actual weekday, estimated tide height in feet MLLW, the nearest high tide within 12 hours, rain amount and probability for the containing hour, and rainfall over that hour plus the next two hours. For example, enter **33160** and **October 2, 2026, 4:00 PM** (Friday; Saturday is October 3).

The `/api/flood-check?zip=33160&at=2026-10-02T20%3A00%3A00.000Z` endpoint accepts an explicit UTC instant. Local and Vercel servers share the same handler. Inputs must be in the future and within 365 days. The browser converts Eastern wall-clock inputs with daylight saving awareness; nonexistent spring-forward times and repeated fall-back times are rejected with an explanation.

NOAA high/low astronomical predictions cover the requested date independently of the seven-day weather horizon. Tide heights between high/low events use cosine interpolation. NWS rainfall remains limited to actual forecast coverage. Outside that coverage, tide results can still appear, while rainfall and the full flood assessment remain incomplete. Missing rain is never treated as zero; cached weather values are shown with their source timestamps and do not establish a current rain hazard assessment.

Separate screening indicators flag a tide at or above the ZIP's saved tide threshold (default **2.3 ft MLLW**), rain of at least **0.25 inches in the containing hour** or **1 inch over the three-hour window**, and their combination. Either tide or heavy rain can flag a potential hazard independently. Rain probability alone is not a flood trigger. These are transparent planning heuristics, not official flood thresholds or a calibrated flood prediction. ZIP 33160 covers multiple communities; the ZIP lookup name and nearby station describe reference points, not a property in Golden Beach. Elevation, drainage, groundwater, surge, and flood depth are not modeled. Results link to official NWS forecasts and warnings.

## Mobile interface

A fixed Home / Tides / Rain / Outlook / More bar provides direct phone navigation. More opens the calendar, preparation guide, and settings. Tide and hourly rainfall lists use readable cards on phones and tables on desktop. Charts resize to their container and expose a touch and keyboard hour slider. The blue wave identity, safe-area spacing, visible focus states, and reduced-motion support extend across the interface.

## English and Spanish

Use the language button in the top-right corner to switch between **Español** and **English** (ES / EN on phones). Navigation, forecast controls, preparation guides, settings, notifications, error messages, map labels, and CSV headings follow the selected language. Dates and times use the selected locale while retaining Eastern time and the existing measurement units.

The first visit follows the browser's preferred supported language. The selection is saved in `tidewatch.language.v1`, independently of ZIP-specific settings. Switching languages preserves the selected page, location, thresholds, and checklist. Known short weather descriptions are translated locally. Official NWS advisory text retains its original English wording, marked with a Spanish source-language note in the advisory dialog.

## Data and planning rules

- NOAA Hollywood Beach station **8722979** supplies high/low astronomical tide predictions in feet MLLW. Intermediate tide heights use cosine interpolation, not measured water levels.
- The default National Weather Service forecasts use **26.011° N, 80.118° W**; other ZIPs use their lookup coordinates. Rain probability comes from hourly forecasts; precipitation totals come from gridded forecasts, converted to inches and distributed evenly across their intervals. If NWS does not provide hourly text for the point (including marine areas), probability, temperature, and wind fall back to its gridded forecast intervals, labeled in data status. Precise rain timing within those intervals is unknown.
- Elevated overlap requires estimated tide at or above the configured threshold and either the configured rainfall amount or probability trigger. High overlap additionally requires tide 0.4 ft above the threshold and at least 0.08 in/hour or 60% rain probability (or the user's higher configured trigger).
- Missing coverage remains unknown. Source retrieval and forecast issuance times are displayed. The dashboard refreshes every ten minutes.
- Calendar dates are the City of Hollywood's published **2026** king tide windows. They are labeled as a Hollywood reference for other ZIPs, and those locations do not get forecast overlays on Hollywood’s calendar. They do not provide weather forecasts beyond the available seven-day horizon.
- Preferences and checklist progress stay in the browser, separately for each ZIP. Browser notifications require permission and run only while the app is open; SMS, email, and background notifications are not implemented.

Overlap is an adjustable planning heuristic, not a calibrated flood probability or prediction of flood depth. The app does not model drainage, elevation, groundwater, surge, wind setup, or seawalls. The map shows reference locations, not flood extent or ZIP boundaries. Follow official warnings.

Sources: [NOAA CO-OPS API](https://api.tidesandcurrents.noaa.gov/api/prod/), [NWS API](https://www.weather.gov/documentation/services-web-api), [Hollywood king tides](https://www.hollywoodfl.org/1473/King-Tides-and-High-Tides).

## Verification

```sh
npm run build
npm test
npm run test:e2e
```

Unit tests cover missing data, rain interval accounting, tide interpolation, overlap windows, daylight saving dates, serverless API response assembly, ZIP validation, per-location cache isolation, coastal gridded weather fallback, inland tide availability, language defaults, and translation interpolation. API tests use temporary cache directories and fixture providers. Browser tests use fixture forecasts to verify navigation, CSV export, map retry, phone layout, ZIP search errors, reload persistence, settings isolation, and English/Spanish switching across pages and devices. Install a Playwright browser with `npx playwright install chromium` if needed.

Flood-check tests also cover tide-only/rain-only hazards, long-range target-date tides, cached and partial weather, invalid and past dates, Eastern wall-clock conversion in a Pacific browser, daylight saving gaps and repeated hours, live preference updates, and Spanish results on phones down to 320 px wide.
