import type { Hour, Preferences, Risk, RiskWindow, Tide } from './types';
export const TIME_ZONE = 'America/New_York';
export const DEFAULT_PREFERENCES: Preferences = { tideThreshold: 2.3, rainThreshold: 0.02, chanceThreshold: 40, notifications: false, leadHours: 3 };
export const riskRank: Record<Risk, number> = { unknown: -1, low: 0, moderate: 1, high: 2 };
export function riskFor(hour: Hour, prefs = DEFAULT_PREFERENCES): Risk {
  if (hour.tide === null || (hour.rain === null && hour.chance === null)) return 'unknown';
  const rain = (hour.rain !== null && hour.rain >= prefs.rainThreshold) || (hour.chance !== null && hour.chance >= prefs.chanceThreshold);
  if (hour.tide >= prefs.tideThreshold && rain) {
    return hour.tide >= prefs.tideThreshold + 0.4 && ((hour.rain ?? 0) >= Math.max(prefs.rainThreshold, 0.08) || (hour.chance ?? 0) >= Math.max(prefs.chanceThreshold, 60)) ? 'high' : 'moderate';
  }
  return 'low';
}
export function highestRisk(hours: Hour[], prefs = DEFAULT_PREFERENCES): Risk {
  if (!hours.length || hours.some(h => riskFor(h, prefs) === 'unknown')) return 'unknown';
  return hours.reduce<Risk>((r, h) => riskRank[riskFor(h, prefs)] > riskRank[r] ? riskFor(h, prefs) : r, 'low');
}
export function interpolateTide(tides: Tide[], timestamp: number): number | null {
  const next = tides.findIndex(t => Date.parse(t.time) >= timestamp);
  if (next < 0) return null;
  if (Date.parse(tides[next].time) === timestamp) return tides[next].height;
  if (next === 0) return null;
  const a = tides[next - 1], b = tides[next];
  const fraction = (timestamp - Date.parse(a.time)) / (Date.parse(b.time) - Date.parse(a.time));
  return a.height + (b.height - a.height) * (1 - Math.cos(fraction * Math.PI)) / 2;
}
export function getWindows(hours: Hour[], prefs = DEFAULT_PREFERENCES): RiskWindow[] {
  const windows: RiskWindow[] = [];
  let active: Hour[] = [];
  function flush() {
    if (!active.length) return;
    windows.push({ start: active[0].time, end: new Date(Date.parse(active.at(-1)!.time) + 3600000).toISOString(), risk: highestRisk(active, prefs), maxTide: Math.max(...active.map(h => h.tide ?? 0)), rain: active.every(h => h.rain !== null) ? active.reduce((n, h) => n + h.rain!, 0) : null, chance: active.some(h => h.chance !== null) ? Math.max(...active.map(h => h.chance ?? 0)) : null, hours: active.length });
    active = [];
  }
  hours.forEach(h => {
    const risk = riskFor(h, prefs);
    if (risk === 'moderate' || risk === 'high') {
      if (active.length && Date.parse(h.time) - Date.parse(active.at(-1)!.time) !== 3600000) flush();
      active.push(h);
    } else flush();
  });
  flush(); return windows;
}
export function dayKey(time: string | Date): string { return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time)); }
export function formatTime(time: string | Date, minutes = true): string { return new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', ...(minutes ? { minute: '2-digit' } : {}) }).format(new Date(time)); }
export function formatDay(time: string | Date, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string { return new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, ...options }).format(new Date(time)); }
export function sumRain(hours: Hour[]): number | null { return hours.length && hours.every(h => h.rain !== null) ? hours.reduce((n, h) => n + h.rain!, 0) : null; }
export function parseDuration(text: string): number {
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(text);
  if (!m) return 0;
  return ((Number(m[1] || 0) * 24 + Number(m[2] || 0)) * 3600 + Number(m[3] || 0) * 60 + Number(m[4] || 0)) * 1000;
}
export function hourlyRain(values: { validTime: string; value: number | null }[], timestamp: number): number | null {
  let total = 0, covered = 0;
  for (const item of values) {
    const [startText, durationText] = item.validTime.split('/');
    const start = Date.parse(startText), duration = parseDuration(durationText);
    const overlap = Math.max(0, Math.min(timestamp + 3600000, start + duration) - Math.max(timestamp, start));
    if (!overlap || item.value === null || duration <= 0) continue;
    total += item.value / 25.4 * overlap / duration; covered += overlap;
  }
  return covered >= 3600000 ? total : null;
}
