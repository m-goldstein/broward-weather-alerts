import type { Page } from '@playwright/test';
import type { DashboardData } from '../../shared/types';

export function dashboard(zip = '33019'): DashboardData {
  const start = Math.floor(Date.now() / 3600000) * 3600000;
  const iso = (hour: number) => new Date(start + hour * 3600000).toISOString();
  const hollywood = zip === '33019', inland = zip === '80202';
  const source = { status: 'live' as const, fetchedAt: iso(0) };
  return {
    generatedAt: new Date().toISOString(),
    location: { zip, name: hollywood ? 'Hollywood Beach, FL' : inland ? 'Denver, CO' : 'Miami Beach, FL', lat: hollywood ? 26.011 : inland ? 39.75 : 25.7873, lon: hollywood ? -80.118 : inland ? -104.99 : -80.1564, station: inland ? null : hollywood ? '8722979' : '8723156', stationName: inland ? null : hollywood ? 'Hollywood Beach' : 'San Marino Island', stationLat: inland ? null : hollywood ? 26.04 : 25.7933, stationLon: inland ? null : hollywood ? -80.115 : -80.1633, stationDistanceKm: inland ? null : hollywood ? 3.2 : 0.9 },
    hours: Array.from({ length: 168 }, (_, i) => ({ time: iso(i), tide: inland ? null : 1.6 + Math.cos(i / 6 * Math.PI) * 1.3, rain: .03, chance: hollywood ? 45 : 75, temperature: 82, wind: 'E 10 mph', description: 'Chance showers' })),
    tides: inland ? [] : Array.from({ length: 30 }, (_, i) => ({ time: iso(i * 6 + 2), height: i % 2 ? .2 : 2.9, type: i % 2 ? 'L' : 'H' })),
    alerts: [], sources: { weather: source, alerts: source, tides: inland ? { status: 'unavailable', fetchedAt: null, error: 'No NOAA tide prediction station within 25 km of this ZIP.' } : source },
  };
}
export async function mockForecast(page: Page) {
  await page.route('**/api/dashboard?**', async route => {
    const zip = new URL(route.request().url()).searchParams.get('zip') ?? '33019';
    if (zip === '00000') await route.fulfill({ status: 404, json: { error: 'That ZIP code was not found. Check the five digits and try again.' } });
    else await route.fulfill({ json: dashboard(zip) });
  });
}
