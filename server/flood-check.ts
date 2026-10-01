import { getDashboard, getTideForecast } from './forecast.ts';
import { LocationError, resolveLocation, validateZip } from './location.ts';
import { interpolateTide } from '../shared/model.ts';
import { DAY, HOUR, MAX_LOOKAHEAD_DAYS } from '../shared/flood-check.ts';
import type { FloodCheckData, SourceStatus } from '../shared/types.ts';

export function validateForecastTime(value: unknown, now = Date.now()): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new LocationError('Enter a valid date and time.', 400);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 19) !== value.slice(0, 19)) throw new LocationError('Enter a valid date and time.', 400);
  if (timestamp < now) throw new LocationError('Choose a future date and time. Historical flood forecasts are not available.', 400);
  if (timestamp > now + MAX_LOOKAHEAD_DAYS * DAY) throw new LocationError('Choose a date within the next 365 days.', 400);
  return timestamp;
}

export async function getFloodCheck(zipValue: unknown, atValue: unknown): Promise<FloodCheckData> {
  if (typeof zipValue !== 'string') throw new LocationError('Enter a valid five-digit US ZIP code.', 400);
  const zip = validateZip(zipValue), timestamp = validateForecastTime(atValue);
  const location = await resolveLocation(zip);
  const hourStart = Math.floor(timestamp / HOUR) * HOUR;
  const outsideForecast = hourStart >= Math.floor(Date.now() / HOUR) * HOUR + 168 * HOUR;
  const dashboard = outsideForecast ? null : await getDashboard(zip);
  const tideResult = dashboard && interpolateTide(dashboard.tides, timestamp) !== null
    ? { tides: dashboard.tides, source: dashboard.sources.tides }
    : await getTideForecast(location, timestamp - DAY, timestamp + DAY);
  const weather: SourceStatus = dashboard?.sources.weather ?? { status: 'unavailable', fetchedAt: null };
  const hour = dashboard?.hours.find(h => Date.parse(h.time) === hourStart);
  const nextHours = [0, 1, 2].map(offset => dashboard?.hours.find(h => Date.parse(h.time) === hourStart + offset * HOUR));
  const rainThreeHours = nextHours.every(h => h && h.rain !== null) ? nextHours.reduce((sum, h) => sum + h!.rain!, 0) : null;
  const coveredHours = dashboard?.hours.filter(h => h.rain !== null || h.chance !== null) ?? [];
  const nearbyHighTide = tideResult.tides.filter(t => t.type === 'H' && Math.abs(Date.parse(t.time) - timestamp) <= 12 * HOUR).sort((a, b) => Math.abs(Date.parse(a.time) - timestamp) - Math.abs(Date.parse(b.time) - timestamp))[0] ?? null;
  return {
    generatedAt: new Date().toISOString(), requestedAt: new Date(timestamp).toISOString(), location,
    tide: interpolateTide(tideResult.tides, timestamp), nearbyHighTide,
    rain: hour?.rain ?? null, chance: hour?.chance ?? null, rainThreeHours,
    rainStartsAt: new Date(hourStart).toISOString(),
    weatherCoverageEndsAt: coveredHours.length ? new Date(Date.parse(coveredHours.at(-1)!.time) + HOUR).toISOString() : null,
    weatherAvailability: outsideForecast ? 'outside-forecast' : hour && (hour.rain !== null || hour.chance !== null) ? 'available' : 'unavailable',
    sources: { tides: tideResult.source, weather },
  };
}
