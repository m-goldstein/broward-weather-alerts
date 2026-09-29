import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { resolveLocation, validateZip } from '../server/location.ts';
import { riskFor } from '../shared/model.ts';
import type { DashboardData } from '../shared/types.ts';

test('ZIP forecasts isolate weather, tides and cache entries; inland forecasts retain unknown overlap', async () => {
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'tidewatch-test-'));
  process.env.TIDEWATCH_CACHE_DIR = cacheDir;
  const { GET } = await import('../api/dashboard.ts');
  const originalFetch = globalThis.fetch;
  const start = Math.floor(Date.now() / 3600000) * 3600000;
  const iso = (hour: number) => new Date(start + hour * 3600000).toISOString();
  const calls: string[] = [];
  globalThis.fetch = async input => {
    const url = String(input); calls.push(url);
    if (url.includes('zippopotam')) {
      const zip = url.split('/').at(-1);
      if (zip === '00000') return new Response('', { status: 404 });
      if (zip === '33139') return Response.json({ places: [{ 'place name': 'Miami Beach', 'state abbreviation': 'FL', latitude: '25.7873', longitude: '-80.1564' }] });
      return Response.json({ places: [{ 'place name': 'Denver', 'state abbreviation': 'CO', latitude: '39.75', longitude: '-104.99' }] });
    }
    if (url.includes('/mdapi/')) return Response.json({ stations: [{ id: '8723156', name: 'San Marino Island', lat: 25.7933, lng: -80.1633 }] });
    if (url.includes('/points/')) {
      const point = url.split('/').at(-1);
      return Response.json({ properties: { forecastHourly: `https://fixture.example/${point}/hourly`, forecastGridData: `https://fixture.example/${point}/grid` } });
    }
    if (url.includes('/datagetter')) {
      const station = new URL(url).searchParams.get('station');
      return Response.json({ predictions: Array.from({ length: 34 }, (_, i) => ({ t: iso(-6 + i * 6).slice(0, 16).replace('T', ' '), v: i % 2 ? station === '8723156' ? '3.2' : '2.8' : '0.2', type: i % 2 ? 'H' : 'L' })) });
    }
    if (url.includes('/alerts/')) return Response.json({ features: [] });
    if (url.endsWith('/hourly') && url.includes('25.7873')) return new Response('', { status: 404 });
    if (url.endsWith('/hourly')) return Response.json({ properties: { periods: Array.from({ length: 168 }, (_, i) => ({ startTime: iso(i), endTime: iso(i + 1), temperature: 80, probabilityOfPrecipitation: { value: url.includes('25.7873') ? 75 : 20 }, windDirection: 'E', windSpeed: '10 mph', shortForecast: 'Showers' })) } });
    if (url.endsWith('/grid')) return Response.json({ properties: { probabilityOfPrecipitation: { uom: 'wmoUnit:percent', values: [{ validTime: iso(0) + '/P7D', value: 75 }] }, temperature: { uom: 'wmoUnit:degC', values: [{ validTime: iso(0) + '/P7D', value: 26.6667 }] }, quantitativePrecipitation: { values: [{ validTime: iso(0) + '/P7D', value: 25.4 }] } } });
    throw new Error('Unexpected URL');
  };
  try {
    const [a, b, c] = await Promise.all([GET(new Request('http://fixture/api/dashboard?zip=33019')), GET(new Request('http://fixture/api/dashboard?zip=33139')), GET(new Request('http://fixture/api/dashboard?zip=80202'))]);
    const hollywood = await a.json() as DashboardData, miami = await b.json() as DashboardData, denver = await c.json() as DashboardData;
    assert.equal(hollywood.location.station, '8722979');
    assert.equal(miami.location.station, '8723156');
    assert.equal(miami.location.name, 'Miami Beach, FL');
    assert.equal(miami.sources.weather.status, 'live');
    assert.ok(miami.sources.weather.note?.includes('gridded'));
    assert.equal(miami.hours[0].temperature, 80);
    assert.equal(hollywood.hours[0].chance, 20); assert.equal(miami.hours[0].chance, 75);
    assert.equal(denver.location.station, null); assert.equal(denver.tides.length, 0);
    assert.equal(denver.hours[0].tide, null); assert.equal(riskFor(denver.hours[0]), 'unknown');
    assert.equal(denver.sources.weather.status, 'live');
    assert.equal(calls.filter(url => url.includes('/mdapi/')).length, 1, 'concurrent ZIP lookups share station metadata');
    const count = calls.length;
    await GET(new Request('http://fixture/api/dashboard?zip=33139'));
    assert.equal(calls.length, count, 'cached forecasts stay keyed by ZIP');
    assert.equal((await GET(new Request('http://fixture/api/dashboard?zip=123'))).status, 400);
    assert.equal((await GET(new Request('http://fixture/api/dashboard?zip=00000'))).status, 404);
    assert.equal((await resolveLocation()).zip, '33019');
    assert.equal(validateZip(' 02110 '), '02110');
    assert.throws(() => validateZip('33139&other=true'));
  } finally { globalThis.fetch = originalFetch; await rm(cacheDir, { recursive: true, force: true }); }
});
