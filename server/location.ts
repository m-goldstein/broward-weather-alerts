import type { ForecastLocation } from '../shared/types.ts';

export const DEFAULT_ZIP = '33019';
export const HOLLYWOOD: ForecastLocation = { name: 'Hollywood Beach, FL', zip: DEFAULT_ZIP, lat: 26.011, lon: -80.118, station: '8722979', stationName: 'Hollywood Beach', stationLat: 26.04, stationLon: -80.115, stationDistanceKm: 3.2 };
export class LocationError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function validateZip(value: unknown): string {
  const zip = typeof value === 'string' ? value.trim() : DEFAULT_ZIP;
  if (!/^\d{5}$/.test(zip)) throw new LocationError('Enter a valid five-digit US ZIP code.', 400);
  return zip;
}
type Station = { id: string; name: string; lat: number; lng: number };
const locations = new Map<string, { data: ForecastLocation; at: number }>();
const pending = new Map<string, Promise<ForecastLocation>>();
let stations: { data: Station[]; at: number } | undefined;
let stationRequest: Promise<Station[]> | undefined;
const DAY = 86400000;
export function distanceKm(lat: number, lon: number, otherLat: number, otherLon: number): number {
  const radians = (n: number) => n * Math.PI / 180;
  const a = Math.sin(radians(otherLat - lat) / 2) ** 2 + Math.cos(radians(lat)) * Math.cos(radians(otherLat)) * Math.sin(radians(otherLon - lon) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
async function getStations(): Promise<Station[]> {
  if (stations && Date.now() - stations.at < DAY) return stations.data;
  stationRequest ??= (async () => {
    try {
      const response = await fetch('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions', { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (!Array.isArray(body.stations) || !body.stations.length) throw new Error();
      const data = body.stations.filter((s: Station) => typeof s.id === 'string' && typeof s.name === 'string' && Number.isFinite(s.lat) && Number.isFinite(s.lng));
      if (!data.length) throw new Error();
      stations = { data, at: Date.now() };
      return data;
    } catch { throw new LocationError('NOAA station lookup is unavailable. Please try again shortly.', 503); }
  })().finally(() => { stationRequest = undefined; });
  return stationRequest;
}
async function lookupPoint(zip: string): Promise<ForecastLocation> {
  let body;
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(12000) });
    if (response.status === 404) throw new LocationError('That ZIP code was not found. Check the five digits and try again.', 404);
    if (!response.ok) throw new Error();
    body = await response.json();
  } catch (e) {
    if (e instanceof LocationError) throw e;
    throw new LocationError('ZIP lookup is unavailable. Please try again shortly.', 503);
  }
  const place = body.places?.[0], lat = Number(place?.latitude), lon = Number(place?.longitude);
  if (!place?.['place name'] || !place?.['state abbreviation'] || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) throw new LocationError('No forecast coordinates are available for that ZIP code.', 404);
  return { name: `${place['place name']}, ${place['state abbreviation']}`, zip, lat, lon, station: null, stationName: null, stationLat: null, stationLon: null, stationDistanceKm: null };
}
const points = new Map<string, { data: ForecastLocation; at: number }>();
const pointRequests = new Map<string, Promise<ForecastLocation>>();
export async function resolveZipPoint(value: unknown = DEFAULT_ZIP): Promise<ForecastLocation> {
  const zip = validateZip(value);
  if (zip === DEFAULT_ZIP) return HOLLYWOOD;
  const cached = points.get(zip);
  if (cached && Date.now() - cached.at < DAY) return cached.data;
  if (!pointRequests.has(zip)) pointRequests.set(zip, lookupPoint(zip).then(data => {
    if (points.size >= 250) points.delete(points.keys().next().value!);
    points.set(zip, { data, at: Date.now() });
    return data;
  }).finally(() => pointRequests.delete(zip)));
  return pointRequests.get(zip)!;
}
async function lookup(zip: string): Promise<ForecastLocation> {
  const [point, candidates] = await Promise.all([resolveZipPoint(zip), getStations()]);
  const { lat, lon } = point;
  const nearest = candidates.map(s => ({ s, distance: distanceKm(lat, lon, s.lat, s.lng) })).sort((a, b) => a.distance - b.distance)[0];
  // A nearby prediction point is a coastal reference, never a property flood model.
  const match = nearest && nearest.distance <= 25 ? nearest : null;
  return { ...point, station: match?.s.id ?? null, stationName: match?.s.name ?? null, stationLat: match?.s.lat ?? null, stationLon: match?.s.lng ?? null, stationDistanceKm: match ? Math.round(match.distance * 10) / 10 : null };
}
export async function resolveLocation(value: unknown = DEFAULT_ZIP): Promise<ForecastLocation> {
  const zip = validateZip(value);
  if (zip === DEFAULT_ZIP) return HOLLYWOOD;
  const cached = locations.get(zip);
  if (cached && Date.now() - cached.at < DAY) return cached.data;
  if (!pending.has(zip)) pending.set(zip, lookup(zip).then(data => {
    if (locations.size >= 250) locations.delete(locations.keys().next().value!);
    locations.set(zip, { data, at: Date.now() });
    return data;
  }).finally(() => pending.delete(zip)));
  return pending.get(zip)!;
}
