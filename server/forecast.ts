import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { resolveLocation, DEFAULT_ZIP } from './location.ts';
import { hourlyRain, interpolateTide, parseDuration } from '../shared/model.ts';
import type { Advisory, DashboardData, Hour, SourceStatus, Tide, ForecastLocation } from '../shared/types.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = process.env.TIDEWATCH_CACHE_DIR ?? (process.env.VERCEL ? path.join(tmpdir(), 'hollywood-tidewatch') : path.join(root, '.cache'));

const TTL = 10 * 60 * 1000;
const dashboardCache = new Map<string, { at: number; data: DashboardData }>();
const inFlight = new Map<string, Promise<DashboardData>>();
const sourceCache = new Map<string, { data: any; at: string }>();

async function loadCache() {
  try { const saved = JSON.parse(await readFile(path.join(cacheDir, 'sources.json'), 'utf8')); for (const [key, value] of Object.entries(saved)) sourceCache.set(key, value as any); } catch { /* A cold start may not have a cached snapshot. */ }
}
async function fetchSource(key: string, url: string, validate: (data: any) => boolean): Promise<{ data: any; source: SourceStatus }> {
  key = `${key}:${url}`;
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'HollywoodTidewatch/1.0 (coastal planning dashboard)', Accept: 'application/geo+json, application/json' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const data = await response.json();
    if (!validate(data)) throw new Error('Provider returned incomplete data');
    const at = new Date().toISOString();
    if (sourceCache.size >= 1250 && !sourceCache.has(key)) sourceCache.delete(sourceCache.keys().next().value!);
    sourceCache.set(key, { data, at });
    return { data, source: { status: 'live', fetchedAt: at, issuedAt: data.properties?.updateTime ?? data.properties?.updated ?? null } };
  } catch (error) {
    const cached = sourceCache.get(key);
    const message = error instanceof Error ? error.message : 'Data temporarily unavailable';
    return { data: cached?.data ?? null, source: { status: cached ? 'cached' : 'unavailable', fetchedAt: cached?.at ?? null, error: message, issuedAt: cached?.data?.properties?.updateTime ?? null } };
  }
}
export async function getTideForecast(location: ForecastLocation, start: number, end: number): Promise<{ tides: Tide[]; source: SourceStatus }> {
  if (!location.station) return { tides: [], source: { status: 'unavailable', fetchedAt: null, error: 'No NOAA tide prediction station within 25 km of this ZIP.' } };
  cacheLoaded ??= loadCache();
  await cacheLoaded;
  const date = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10).replaceAll('-', '');
  const params = new URLSearchParams({ product: 'predictions', application: 'HollywoodTidewatch', begin_date: date(start), end_date: date(end), datum: 'MLLW', station: location.station, time_zone: 'gmt', units: 'english', interval: 'hilo', format: 'json' });
  const result = await fetchSource(`tides:${location.station}`, `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params}`, d => Array.isArray(d.predictions) && d.predictions.length > 0);
  const tides: Tide[] = (result.data?.predictions ?? []).filter((t: any) => ['H', 'L'].includes(t.type) && t.v !== null && t.v !== '' && Number.isFinite(Number(t.v)) && Number.isFinite(Date.parse(t.t.replace(' ', 'T') + ':00Z'))).map((t: any) => ({ time: t.t.replace(' ', 'T') + ':00Z', height: Number(t.v), type: t.type })).sort((a: Tide, b: Tide) => Date.parse(a.time) - Date.parse(b.time));
  return { tides, source: result.source };
}
function gridValue(field: any, timestamp: number): number | null {
  const item = field?.values?.find((value: any) => {
    const [start, duration] = String(value.validTime).split('/');
    return Date.parse(start) <= timestamp && Date.parse(start) + parseDuration(duration) >= timestamp + 3600000;
  });
  return typeof item?.value === 'number' && Number.isFinite(item.value) ? item.value : null;
}
async function makeDashboard(location: ForecastLocation): Promise<DashboardData> {
  const now = Date.now(), start = Math.floor(now / 3600000) * 3600000;
  const pointPromise = fetchSource(`point:${location.zip}`, `https://api.weather.gov/points/${location.lat},${location.lon}`, d => !!d.properties?.forecastGridData);
  const tidesPromise = getTideForecast(location, start - 86400000, start + 8 * 86400000);
  const alertsPromise = fetchSource(`alerts:${location.zip}`, `https://api.weather.gov/alerts/active?point=${location.lat},${location.lon}`, d => Array.isArray(d.features));
  const point = await pointPromise;
  const unavailable: { data: null; source: SourceStatus } = { data: null, source: { status: 'unavailable', fetchedAt: null, error: 'NWS location lookup unavailable' } };
  const [tideResult, hourlyResult, gridResult, alertsResult] = await Promise.all([
    tidesPromise,
    point.data?.properties?.forecastHourly ? fetchSource(`hourly:${location.zip}`, point.data.properties.forecastHourly, d => Array.isArray(d.properties?.periods) && d.properties.periods.length > 0) : Promise.resolve(unavailable),
    point.data ? fetchSource(`grid:${location.zip}`, point.data.properties.forecastGridData, d => Array.isArray(d.properties?.quantitativePrecipitation?.values)) : Promise.resolve(unavailable),
    alertsPromise,
  ]);
  const tides = tideResult.tides;
  const periods = hourlyResult.data?.properties?.periods ?? [];
  const precipitation = gridResult.data?.properties?.quantitativePrecipitation?.values ?? [];
  const grid = gridResult.data?.properties;
  const usingGrid = !periods.length && Array.isArray(grid?.probabilityOfPrecipitation?.values);
  const hours: Hour[] = Array.from({ length: 168 }, (_, i) => {
    const timestamp = start + i * 3600000;
    const period = periods.find((p: any) => Date.parse(p.startTime) <= timestamp && Date.parse(p.endTime) > timestamp);
    const chance = grid?.probabilityOfPrecipitation?.uom === 'wmoUnit:percent' ? gridValue(grid.probabilityOfPrecipitation, timestamp) : null;
    const rawTemperature = gridValue(grid?.temperature, timestamp);
    const temperature = rawTemperature === null ? null : grid.temperature.uom === 'wmoUnit:degC' ? rawTemperature * 9 / 5 + 32 : grid.temperature.uom === 'wmoUnit:degF' ? rawTemperature : null;
    const speed = grid?.windSpeed?.uom === 'wmoUnit:km_h-1' ? gridValue(grid.windSpeed, timestamp) : null;
    const direction = grid?.windDirection?.uom === 'wmoUnit:degree_(angle)' ? gridValue(grid.windDirection, timestamp) : null;
    const wind = speed === null || direction === null ? 'Unavailable' : `${['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(direction / 22.5) % 16]} ${Math.round(speed / 1.609344)} mph`;
    return { time: new Date(timestamp).toISOString(), tide: interpolateTide(tides, timestamp), rain: hourlyRain(precipitation, timestamp), chance: period?.probabilityOfPrecipitation?.value ?? chance, temperature: period?.temperature ?? (temperature === null ? null : Math.round(temperature)), wind: period ? `${period.windDirection} ${period.windSpeed}` : wind, description: period?.shortForecast ?? (usingGrid ? 'NWS gridded forecast · hourly text unavailable' : 'Forecast unavailable') };
  });
  const alerts: Advisory[] = (alertsResult.data?.features ?? []).filter((a: any) => !a.properties.expires || Date.parse(a.properties.expires) > now).map((a: any) => ({ id: a.id, event: a.properties.event, headline: a.properties.headline, description: a.properties.description, instruction: a.properties.instruction ?? '', severity: a.properties.severity, expires: a.properties.expires, url: `https://alerts.weather.gov/search?id=${encodeURIComponent(a.properties.id ?? a.id.split('/').at(-1))}` }));
  const weatherStatus: SourceStatus = usingGrid ? { ...gridResult.source, note: 'Using NWS gridded weather; hourly text unavailable for this forecast point.' } : { ...hourlyResult.source, status: hourlyResult.source.status === 'unavailable' || gridResult.source.status === 'unavailable' ? 'unavailable' : hourlyResult.source.status === 'cached' || gridResult.source.status === 'cached' ? 'cached' : 'live', issuedAt: gridResult.source.issuedAt ?? hourlyResult.source.issuedAt, error: hourlyResult.source.error ?? gridResult.source.error };
  try {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(path.join(cacheDir, 'sources.json'), JSON.stringify(Object.fromEntries(sourceCache)));
  } catch { /* A cache write must never prevent a successful forecast response. */ }
  return { generatedAt: new Date().toISOString(), hours, tides, alerts, sources: { tides: tideResult.source, weather: weatherStatus, alerts: alertsResult.source }, location };
}
let cacheLoaded: Promise<void> | null = null;
export async function getDashboard(zip = DEFAULT_ZIP): Promise<DashboardData> {
  const location = await resolveLocation(zip);
  cacheLoaded ??= loadCache();
  await cacheLoaded;
  const cached = dashboardCache.get(location.zip);
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  if (!inFlight.has(location.zip)) inFlight.set(location.zip, makeDashboard(location).then(data => {
    if (dashboardCache.size >= 250) dashboardCache.delete(dashboardCache.keys().next().value!);
    dashboardCache.set(location.zip, { at: Date.now(), data });
    return data;
  }).finally(() => { inFlight.delete(location.zip); }));
  return inFlight.get(location.zip)!;
}
