import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { hourlyRain, interpolateTide } from '../shared/model.ts';
import type { Advisory, DashboardData, Hour, SourceStatus, Tide } from '../shared/types.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = process.env.VERCEL ? path.join(tmpdir(), 'hollywood-tidewatch') : path.join(root, '.cache');
const location = { name: 'Hollywood Beach, FL', zip: '33019', lat: 26.011, lon: -80.118, station: '8722979' };
const TTL = 10 * 60 * 1000;
let dashboardCache: { at: number; data: DashboardData } | null = null;
let inFlight: Promise<DashboardData> | null = null;
const sourceCache = new Map<string, { data: any; at: string }>();

async function loadCache() {
  try { const saved = JSON.parse(await readFile(path.join(cacheDir, 'sources.json'), 'utf8')); for (const [key, value] of Object.entries(saved)) sourceCache.set(key, value as any); } catch { /* A cold start may not have a cached snapshot. */ }
}
async function fetchSource(key: string, url: string, validate: (data: any) => boolean): Promise<{ data: any; source: SourceStatus }> {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'HollywoodTidewatch/1.0 (coastal planning dashboard)', Accept: 'application/geo+json, application/json' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const data = await response.json();
    if (!validate(data)) throw new Error('Provider returned incomplete data');
    const at = new Date().toISOString();
    sourceCache.set(key, { data, at });
    return { data, source: { status: 'live', fetchedAt: at, issuedAt: data.properties?.updateTime ?? data.properties?.updated ?? null } };
  } catch (error) {
    const cached = sourceCache.get(key);
    const message = error instanceof Error ? error.message : 'Data temporarily unavailable';
    return { data: cached?.data ?? null, source: { status: cached ? 'cached' : 'unavailable', fetchedAt: cached?.at ?? null, error: message, issuedAt: cached?.data?.properties?.updateTime ?? null } };
  }
}
async function makeDashboard(): Promise<DashboardData> {
  const now = Date.now(), start = Math.floor(now / 3600000) * 3600000;
  const date = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10).replaceAll('-', '');
  const tideParams = new URLSearchParams({ product: 'predictions', application: 'HollywoodTidewatch', begin_date: date(start - 86400000), end_date: date(start + 8 * 86400000), datum: 'MLLW', station: location.station, time_zone: 'gmt', units: 'english', interval: 'hilo', format: 'json' });
  const pointPromise = fetchSource('point', `https://api.weather.gov/points/${location.lat},${location.lon}`, d => !!d.properties?.forecastHourly && !!d.properties?.forecastGridData);
  const tidesPromise = fetchSource('tides', `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${tideParams}`, d => Array.isArray(d.predictions) && d.predictions.length > 0);
  const alertsPromise = fetchSource('alerts', `https://api.weather.gov/alerts/active?point=${location.lat},${location.lon}`, d => Array.isArray(d.features));
  const point = await pointPromise;
  const unavailable: { data: null; source: SourceStatus } = { data: null, source: { status: 'unavailable', fetchedAt: null, error: 'NWS location lookup unavailable' } };
  const [tideResult, hourlyResult, gridResult, alertsResult] = await Promise.all([
    tidesPromise,
    point.data ? fetchSource('hourly', point.data.properties.forecastHourly, d => Array.isArray(d.properties?.periods) && d.properties.periods.length > 0) : Promise.resolve(unavailable),
    point.data ? fetchSource('grid', point.data.properties.forecastGridData, d => Array.isArray(d.properties?.quantitativePrecipitation?.values)) : Promise.resolve(unavailable),
    alertsPromise,
  ]);
  const tides: Tide[] = (tideResult.data?.predictions ?? []).filter((t: any) => ['H', 'L'].includes(t.type) && Number.isFinite(Number(t.v))).map((t: any) => ({ time: t.t.replace(' ', 'T') + ':00Z', height: Number(t.v), type: t.type }));
  const periods = hourlyResult.data?.properties?.periods ?? [];
  const precipitation = gridResult.data?.properties?.quantitativePrecipitation?.values ?? [];
  const hours: Hour[] = Array.from({ length: 168 }, (_, i) => {
    const timestamp = start + i * 3600000;
    const period = periods.find((p: any) => Date.parse(p.startTime) <= timestamp && Date.parse(p.endTime) > timestamp);
    return { time: new Date(timestamp).toISOString(), tide: interpolateTide(tides, timestamp), rain: hourlyRain(precipitation, timestamp), chance: period?.probabilityOfPrecipitation?.value ?? null, temperature: period?.temperature ?? null, wind: period ? `${period.windDirection} ${period.windSpeed}` : 'Unavailable', description: period?.shortForecast ?? 'Forecast unavailable' };
  });
  const alerts: Advisory[] = (alertsResult.data?.features ?? []).filter((a: any) => !a.properties.expires || Date.parse(a.properties.expires) > now).map((a: any) => ({ id: a.id, event: a.properties.event, headline: a.properties.headline, description: a.properties.description, instruction: a.properties.instruction ?? '', severity: a.properties.severity, expires: a.properties.expires, url: `https://alerts.weather.gov/search?id=${encodeURIComponent(a.properties.id ?? a.id.split('/').at(-1))}` }));
  const weatherStatus: SourceStatus = { ...hourlyResult.source, status: hourlyResult.source.status === 'unavailable' || gridResult.source.status === 'unavailable' ? 'unavailable' : hourlyResult.source.status === 'cached' || gridResult.source.status === 'cached' ? 'cached' : 'live', issuedAt: gridResult.source.issuedAt ?? hourlyResult.source.issuedAt, error: hourlyResult.source.error ?? gridResult.source.error };
  try {
    await mkdir(cacheDir, { recursive: true });
    await writeFile(path.join(cacheDir, 'sources.json'), JSON.stringify(Object.fromEntries(sourceCache)));
  } catch { /* A cache write must never prevent a successful forecast response. */ }
  return { generatedAt: new Date().toISOString(), hours, tides, alerts, sources: { tides: tideResult.source, weather: weatherStatus, alerts: alertsResult.source }, location };
}
let cacheLoaded: Promise<void> | null = null;
export async function getDashboard(): Promise<DashboardData> {
  cacheLoaded ??= loadCache();
  await cacheLoaded;
  if (dashboardCache && Date.now() - dashboardCache.at < TTL) return dashboardCache.data;
  if (!inFlight) inFlight = makeDashboard().then(data => { dashboardCache = { at: Date.now(), data }; return data; }).finally(() => { inFlight = null; });
  return inFlight;
}
