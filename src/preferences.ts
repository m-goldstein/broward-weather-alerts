import { DEFAULT_PREFERENCES } from '../shared/model';
import type { Preferences } from '../shared/types';

export const DEFAULT_ZIP = '33019';
export function storageKey(kind: 'preferences' | 'checklist' | 'lastNotification', zip: string): string { return `tidewatch.${kind}.v2:${zip}`; }
export function readStored<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
export function writeStored(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
function readLocationValue<T>(kind: 'preferences' | 'checklist', zip: string, fallback: T): T {
  // Migrate old Hollywood-only preferences exclusively to Hollywood.
  return readStored(storageKey(kind, zip), zip === DEFAULT_ZIP ? readStored(`tidewatch.${kind}.v1`, fallback) : fallback);
}
export function readPreferences(zip: string): Preferences {
  const value = readLocationValue<unknown>('preferences', zip, {});
  const p = value && typeof value === 'object' ? value as Partial<Preferences> : {};
  return { tideThreshold: typeof p.tideThreshold === 'number' && p.tideThreshold >= (zip === DEFAULT_ZIP ? 1.5 : 0) && p.tideThreshold <= (zip === DEFAULT_ZIP ? 4 : 40) ? p.tideThreshold : DEFAULT_PREFERENCES.tideThreshold, rainThreshold: typeof p.rainThreshold === 'number' && p.rainThreshold >= 0.01 && p.rainThreshold <= 0.5 ? p.rainThreshold : DEFAULT_PREFERENCES.rainThreshold, chanceThreshold: typeof p.chanceThreshold === 'number' && p.chanceThreshold >= 10 && p.chanceThreshold <= 90 ? p.chanceThreshold : DEFAULT_PREFERENCES.chanceThreshold, leadHours: [1, 3, 6, 12].includes(p.leadHours ?? 0) ? p.leadHours! : 3, notifications: p.notifications === true };
}
export function readChecklist(zip: string): string[] {
  const value = readLocationValue<unknown>('checklist', zip, []);
  return Array.isArray(value) ? value.filter(x => typeof x === 'string') : [];
}
