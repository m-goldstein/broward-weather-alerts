import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import type { DashboardData } from '../shared/types.ts';

test('Vercel handlers serve forecast JSON without starting a server', async () => {
  process.env.VERCEL = '1';
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'tidewatch-test-'));
  process.env.TIDEWATCH_CACHE_DIR = cacheDir;
  const originalFetch = globalThis.fetch;
  const start = Math.floor(Date.now() / 3600000) * 3600000;
  const iso = (n: number) => new Date(start + n * 3600000).toISOString();
  let requests = 0;
  globalThis.fetch = async input => {
    requests++;
    const url = String(input);
    if (url.includes('/points/')) return Response.json({ properties: { forecastHourly: 'https://fixture.example/hourly', forecastGridData: 'https://fixture.example/grid' } });
    if (url.includes('tidesandcurrents')) return Response.json({ predictions: Array.from({ length: 34 }, (_, i) => ({ t: iso(-6 + i * 6).slice(0, 16).replace('T', ' '), v: i % 2 ? '2.8' : '0.2', type: i % 2 ? 'H' : 'L' })) });
    if (url.includes('/alerts/')) return Response.json({ features: [] });
    if (url.endsWith('/hourly')) return Response.json({ properties: { periods: Array.from({ length: 168 }, (_, i) => ({ startTime: iso(i), endTime: iso(i + 1), temperature: 80, probabilityOfPrecipitation: { value: 60 }, windDirection: 'E', windSpeed: '10 mph', shortForecast: 'Chance showers' })) } });
    if (url.endsWith('/grid')) return Response.json({ properties: { updateTime: iso(0), quantitativePrecipitation: { values: [{ validTime: iso(0) + '/P7D', value: 25.4 }] } } });
    throw new Error('Unexpected provider URL');
  };
  try {
    const { GET } = await import('../api/dashboard.ts');
    const { GET: health } = await import('../api/health.ts');
    assert.deepEqual(await health().json(), { status: 'ok' });
    const [a, b] = await Promise.all([GET(), GET()]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(a.headers.get('Cache-Control'), 'no-store');
    const data = await a.json() as DashboardData;
    assert.equal(data.hours.length, 168);
    assert.equal(data.location.zip, '33019');
    assert.equal(data.sources.weather.status, 'live');
    assert.equal(data.sources.tides.status, 'live');
    assert.equal(data.hours[0].chance, 60);
    assert.ok(Math.abs(data.hours.reduce((n, h) => n + h.rain!, 0) - 1) < 1e-10);
    assert.equal(requests, 5, 'concurrent requests should share one provider refresh');
  } finally { globalThis.fetch = originalFetch; await rm(cacheDir, { recursive: true, force: true }); }
});
