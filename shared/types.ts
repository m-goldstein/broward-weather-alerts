export type Risk = 'low' | 'moderate' | 'high' | 'unknown';
export interface Tide { time: string; height: number; type: 'H' | 'L' }
export interface Hour {
  time: string; tide: number | null; rain: number | null; chance: number | null;
  temperature: number | null; wind: string; description: string;
}
export interface Advisory {
  id: string; event: string; headline: string; description: string;
  instruction: string; severity: string; expires: string; url: string;
}
export interface SourceStatus { status: 'live' | 'cached' | 'unavailable'; fetchedAt: string | null; issuedAt?: string | null; note?: string; error?: string }
export interface ForecastLocation {
  name: string; zip: string; lat: number; lon: number; station: string | null;
  stationName: string | null; stationLat: number | null; stationLon: number | null; stationDistanceKm: number | null;
}
export interface DashboardData {
  generatedAt: string; hours: Hour[]; tides: Tide[]; alerts: Advisory[];
  sources: { tides: SourceStatus; weather: SourceStatus; alerts: SourceStatus };
  location: ForecastLocation;
}
export interface Preferences { tideThreshold: number; rainThreshold: number; chanceThreshold: number; notifications: boolean; leadHours: number }
export interface RiskWindow { start: string; end: string; risk: Risk; maxTide: number; rain: number | null; chance: number | null; hours: number }
