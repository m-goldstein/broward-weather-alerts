import { DEFAULT_PREFERENCES, TIME_ZONE } from './model.ts';
import type { FloodCheckData } from './types.ts';

export const HOUR = 3600000;
export const DAY = 24 * HOUR;
export const MAX_LOOKAHEAD_DAYS = 365;
export const RAIN_HOURLY_TRIGGER = 0.25;
export const RAIN_THREE_HOUR_TRIGGER = 1;
export type HazardSignal = 'possible' | 'no-signal' | 'unknown';

// These are screening thresholds, not calibrated flood probabilities.
export function assessFloodCheck(data: FloodCheckData, tideThreshold = DEFAULT_PREFERENCES.tideThreshold) {
  const tide: HazardSignal = data.tide === null ? 'unknown' : data.tide >= tideThreshold ? 'possible' : 'no-signal';
  const rain: HazardSignal = data.sources.weather.status !== 'live' ? 'unknown'
    : (data.rain !== null && data.rain >= RAIN_HOURLY_TRIGGER) || (data.rainThreeHours !== null && data.rainThreeHours >= RAIN_THREE_HOUR_TRIGGER) ? 'possible'
    : data.rain === null || data.rainThreeHours === null ? 'unknown' : 'no-signal';
  const overlap: HazardSignal = tide === 'no-signal' || rain === 'no-signal' ? 'no-signal'
    : tide === 'possible' && rain === 'possible' ? 'possible' : 'unknown';
  const overall: HazardSignal = tide === 'possible' || rain === 'possible' ? 'possible'
    : tide === 'unknown' || rain === 'unknown' ? 'unknown' : 'no-signal';
  return { tide, rain, overlap, overall, incomplete: tide === 'unknown' || rain === 'unknown' };
}

export function easternDateTimeValue(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

// Match wall-clock input in Eastern time, independently of the browser's zone.
// A repeated fall-back hour is rejected so we never silently choose an instant.
export function easternDateTimeToIso(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter a valid date and time.');
  const wall = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== value) throw new Error('Enter a valid date and time.');
  const matches = [4, 5].map(offset => new Date(wall + offset * HOUR)).filter(date => easternDateTimeValue(date) === value);
  if (!matches.length) throw new Error('This time does not exist in Eastern time because the clocks move forward. Choose another time.');
  if (matches.length > 1) throw new Error('This time occurs twice in Eastern time because the clocks move back. Choose a time outside the repeated hour.');
  return matches[0].toISOString();
}
