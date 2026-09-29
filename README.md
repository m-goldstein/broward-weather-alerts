# Tidewatch · Hollywood Beach

A tide-and-rainfall planning dashboard for Hollywood, Florida, ZIP 33019.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:5173. The development script runs Vite and the local API together. For a production server, run `npm run build` followed by `npm start` (port 3001).

## Vercel

The checked-in `vercel.json` uses the Vite build and `dist` output. The files in `api/` run as Vercel Node.js functions. NOAA/NWS forecasts do not require API keys. The backend uses temporary scratch storage on Vercel for optional cached snapshots; cache failures do not prevent forecast responses. Caches are best effort and are not durable across instances.

Commit and push all source files, including `src/styles.css`, `api/`, `server/forecast.ts`, and `vercel.json`. Redeploying an older commit does not include new local fixes.

### CARTO basemap

Set **`CARTO_API_KEY`** in Vercel for the environments you deploy (Production and, if needed, Preview), then redeploy. Keep this name without a `VITE_` prefix. The browser requests `/api/basemap?z=…&x=…&y=…&retina=…`; the server adds the key to CARTO's authenticated Positron raster URL. Only successful PNG tiles are cached; provider errors never return the key or upstream URL. Coordinates are validated and scoped to the Hollywood coastal area. CARTO/OpenStreetMap attribution remains visible.

For local development, copy `.env.example` to `.env.local` and set the key. Both `npm run dev` and `npm start` load `.env.local`. It is gitignored. No key is needed for the forecast panels; the map displays a retry notice if tiles fail. If the key has website restrictions, allow your deployed hostname and localhost as appropriate; upstream requests include the platform's own origin as their Referer.

Reference: [CARTO basemap API key and tile URL documentation](https://www.carto.com/basemaps/apikey/).

## Data and planning rules

- NOAA Hollywood Beach station **8722979** supplies high/low astronomical tide predictions in feet MLLW. Intermediate tide heights use cosine interpolation, not measured water levels.
- National Weather Service forecasts use **26.011° N, 80.118° W**. Rain probability comes from hourly forecasts; precipitation totals come from gridded forecasts, converted to inches and distributed evenly across their intervals. Precise rain timing within those intervals is unknown.
- Elevated overlap requires estimated tide at or above the configured threshold and either the configured rainfall amount or probability trigger. High overlap additionally requires tide 0.4 ft above the threshold and at least 0.08 in/hour or 60% rain probability (or the user's higher configured trigger).
- Missing coverage remains unknown. Source retrieval and forecast issuance times are displayed. The dashboard refreshes every ten minutes.
- Calendar dates are the City of Hollywood's published **2026** king tide windows. They do not provide weather forecasts beyond the available seven-day horizon.
- Preferences and checklist progress stay in the browser. Browser notifications require permission and run only while the app is open; SMS, email, and background notifications are not implemented.

Overlap is an adjustable planning heuristic, not a calibrated flood probability or prediction of flood depth. The app does not model drainage, elevation, groundwater, surge, wind setup, or seawalls. The map shows reference locations, not flood extent or ZIP boundaries. Follow official warnings.

Sources: [NOAA CO-OPS API](https://api.tidesandcurrents.noaa.gov/api/prod/), [NWS API](https://www.weather.gov/documentation/services-web-api), [Hollywood king tides](https://www.hollywoodfl.org/1473/King-Tides-and-High-Tides).

## Verification

```sh
npm run build
npm test
npm run test:e2e
```

Unit tests cover missing data, rain interval accounting, tide interpolation, overlap windows, daylight saving dates, and serverless API response assembly with fixture providers. Browser tests use the running API and require network access to NOAA/NWS. Install a Playwright browser with `npx playwright install chromium` if needed.
