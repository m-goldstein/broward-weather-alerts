import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { assessFloodCheck, DAY, easternDateTimeToIso, easternDateTimeValue, HOUR } from '../shared/flood-check.ts';
import type { FloodCheckData } from '../shared/types.ts';

function sample(overrides: Partial<FloodCheckData> = {}): FloodCheckData {
  const source = { status: 'live' as const, fetchedAt: '2026-09-30T12:00:00Z' };
  return {
    generatedAt: source.fetchedAt, requestedAt: '2026-10-02T20:00:00.000Z',
    location: { zip: '33160', name: 'North Miami Beach, FL', lat: 25.934, lon: -80.132, station: '8723080', stationName: 'Haulover', stationLat: 25.91, stationLon: -80.13, stationDistanceKm: 2.7 },
    tide: 1, nearbyHighTide: null, rain: 0, chance: 0, rainThreeHours: 0,
    rainStartsAt: '2026-10-02T20:00:00.000Z', weatherCoverageEndsAt: '2026-10-07T12:00:00.000Z',
    weatherAvailability: 'available', sources: { tides: source, weather: source }, ...overrides,
  };
}

test('flood screening handles tide-only, rain-only, combined, missing, and cached data', () => {
  assert.equal(assessFloodCheck(sample()).overall, 'no-signal');
  assert.deepEqual(assessFloodCheck(sample({ tide: 2.3 })), { tide: 'possible', rain: 'no-signal', overlap: 'no-signal', overall: 'possible', incomplete: false });
  assert.equal(assessFloodCheck(sample({ rain: 0.25 })).overall, 'possible');
  assert.equal(assessFloodCheck(sample({ rainThreeHours: 1 })).rain, 'possible');
  assert.equal(assessFloodCheck(sample({ tide: 2.3, rain: .25 })).overlap, 'possible');
  assert.equal(assessFloodCheck(sample({ chance: 100 })).overall, 'no-signal', 'rain chance is not a flood probability or trigger');
  assert.equal(assessFloodCheck(sample({ tide: null, rain: .3 })).overall, 'possible', 'inland heavy rain can be flagged without a tide');
  assert.equal(assessFloodCheck(sample({ tide: null })).overall, 'unknown');
  assert.equal(assessFloodCheck(sample({ rain: null, rainThreeHours: null, chance: 0 })).overall, 'unknown');
  const tideOnly = assessFloodCheck(sample({ tide: 3, rain: null, rainThreeHours: null }));
  assert.equal(tideOnly.overall, 'possible'); assert.equal(tideOnly.incomplete, true);
  assert.equal(assessFloodCheck(sample({ rainThreeHours: null })).overall, 'unknown');
  assert.equal(assessFloodCheck(sample({ tide: 2.4 }), 2.5).tide, 'no-signal', 'the ZIP tide preference is respected');
  const cached = sample(); cached.sources.weather.status = 'cached';
  assert.equal(assessFloodCheck(cached).overall, 'unknown', 'cached weather cannot establish a current no-hazard result');
});

test('Eastern wall-clock conversion handles seasons, DST gaps, repeated hours, and invalid dates', () => {
  assert.equal(easternDateTimeToIso('2026-10-02T16:00'), '2026-10-02T20:00:00.000Z');
  assert.equal(easternDateTimeToIso('2026-12-02T16:30'), '2026-12-02T21:30:00.000Z');
  assert.equal(easternDateTimeValue(new Date('2026-10-02T20:00:00Z')), '2026-10-02T16:00');
  assert.equal(easternDateTimeValue(new Date('2026-10-03T04:00:00Z')), '2026-10-03T00:00');
  assert.throws(() => easternDateTimeToIso('2026-03-08T02:30'), /does not exist/);
  assert.throws(() => easternDateTimeToIso('2026-11-01T01:30'), /occurs twice/);
  assert.throws(() => easternDateTimeToIso('2026-02-30T16:00'), /valid date/);
  assert.throws(() => easternDateTimeToIso('2026-10-02T25:00'), /valid date/);
  assert.throws(() => easternDateTimeToIso(''), /valid date/);
});

test('flood API validates inputs, selects target times and ZIPs, extends tides, and preserves provider gaps', async context => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-30T12:00:00Z') });
  const cacheDir = await mkdtemp(path.join(tmpdir(), 'tidewatch-flood-test-'));
  process.env.TIDEWATCH_CACHE_DIR = cacheDir;
  const { GET } = await import('../api/flood-check.ts');
  const originalFetch = globalThis.fetch;
  const start = Date.now(), iso = (hour: number) => new Date(start + hour * HOUR).toISOString();
  const calls: string[] = [];
  let failWeather = false, failTides = false;
  globalThis.fetch = async input => {
    const url = String(input); calls.push(url);
    if (url.includes('zippopotam')) {
      if (url.endsWith('00000')) return new Response('', { status: 404 });
      const inland = url.endsWith('80202');
      return Response.json({ places: [{ 'place name': inland ? 'Denver' : 'North Miami Beach', 'state abbreviation': inland ? 'CO' : 'FL', latitude: inland ? '39.75' : '25.934', longitude: inland ? '-104.99' : '-80.132' }] });
    }
    if (url.includes('/mdapi/')) return Response.json({ stations: [{ id: '8723080', name: 'Haulover', lat: 25.91, lng: -80.13 }] });
    if (url.includes('/datagetter')) {
      if (failTides) throw new Error('NOAA offline');
      const params = new URL(url).searchParams, date = params.get('begin_date')!;
      const begin = Date.parse(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`);
      assert.equal(params.get('datum'), 'MLLW'); assert.equal(params.get('time_zone'), 'gmt');
      return Response.json({ predictions: Array.from({ length: 40 }, (_, i) => ({ t: new Date(begin + i * 6 * HOUR).toISOString().slice(0, 16).replace('T', ' '), v: i % 2 ? '3.2' : '0.2', type: i % 2 ? 'H' : 'L' })) });
    }
    if (url.includes('/points/')) return Response.json({ properties: { forecastHourly: 'https://fixture.example/hourly', forecastGridData: 'https://fixture.example/grid' } });
    if (url.includes('/alerts/')) return Response.json({ features: [] });
    if (failWeather) throw new Error('NWS offline');
    if (url.endsWith('/hourly')) return Response.json({ properties: { updateTime: iso(0), periods: Array.from({ length: 168 }, (_, i) => ({ startTime: iso(i), endTime: iso(i + 1), probabilityOfPrecipitation: { value: 80 }, temperature: 80, windDirection: 'E', windSpeed: '10 mph', shortForecast: 'Rain' })) } });
    if (url.endsWith('/grid')) return Response.json({ properties: { updateTime: iso(0), quantitativePrecipitation: { values: [{ validTime: iso(0) + '/PT60H', value: 457.2 }] } } });
    throw new Error(`Unexpected fixture URL: ${url}`);
  };
  const request = (zip: string, at: string) => GET(new Request(`http://fixture/api/flood-check?${new URLSearchParams({ zip, at })}`));
  try {
    for (const at of ['', '2026-10-02T16:00', '2026-02-30T16:00:00Z', '2026-10-02T25:00:00Z', iso(-1), iso(366 * 24)]) assert.equal((await request('33160', at)).status, 400, at);
    assert.equal((await request('123', iso(4))).status, 400);
    assert.equal((await GET(new Request(`http://fixture/api/flood-check?at=${encodeURIComponent(iso(4))}`))).status, 400);
    assert.equal(calls.length, 0, 'invalid input never reaches providers');
    assert.equal((await request('00000', iso(4))).status, 404);
    const at = '2026-10-02T20:30:00.000Z';
    const response = await request('33160', at);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json() as FloodCheckData;
    assert.equal(result.location.zip, '33160'); assert.equal(result.location.station, '8723080');
    assert.equal(result.requestedAt, at); assert.equal(result.rainStartsAt, '2026-10-02T20:00:00.000Z');
    assert.equal(result.chance, 80); assert.ok(Math.abs(result.rain! - .3) < 1e-10); assert.ok(Math.abs(result.rainThreeHours! - .9) < 1e-10);
    assert.ok(result.tide !== null && result.tide > .2 && result.tide < 3.2); assert.ok(result.nearbyHighTide);
    assert.equal(result.weatherAvailability, 'available');
    assert.equal(result.weatherCoverageEndsAt, iso(168), 'chance coverage can extend beyond quantity coverage');
    const inland = await (await request('80202', at)).json() as FloodCheckData;
    assert.equal(inland.location.station, null); assert.equal(inland.tide, null);
    assert.equal(assessFloodCheck(inland).rain, 'possible');
    const lateRain = await (await request('33160', iso(70))).json() as FloodCheckData;
    assert.equal(lateRain.rain, null); assert.equal(lateRain.chance, 80); assert.equal(assessFloodCheck(lateRain).rain, 'unknown');
    const callsBefore = calls.length;
    const futureAt = iso(30 * 24 + .5);
    const future = await (await request('33160', futureAt)).json() as FloodCheckData;
    assert.equal(future.weatherAvailability, 'outside-forecast'); assert.equal(future.rain, null); assert.equal(future.chance, null); assert.equal(future.rainThreeHours, null);
    assert.ok(future.tide !== null); assert.ok(future.nearbyHighTide); assert.equal(assessFloodCheck(future).incomplete, true);
    const futureCalls = calls.slice(callsBefore);
    assert.equal(futureCalls.length, 1); assert.ok(futureCalls[0].includes('/datagetter'), 'long-range checks fetch only target-date tides');
    assert.ok(futureCalls[0].includes('begin_date=20261029'));
    context.mock.timers.tick(11 * 60 * 1000); failWeather = true;
    const cached = await (await request('33160', at)).json() as FloodCheckData;
    assert.equal(cached.sources.weather.status, 'cached'); assert.equal(cached.chance, 80); assert.equal(assessFloodCheck(cached).rain, 'unknown');
    failTides = true;
    const unavailable = await (await request('33160', iso(60 * 24))).json() as FloodCheckData;
    assert.equal(unavailable.tide, null); assert.equal(unavailable.sources.tides.status, 'unavailable'); assert.equal(assessFloodCheck(unavailable).overall, 'unknown');
  } finally { globalThis.fetch = originalFetch; await rm(cacheDir, { recursive: true, force: true }); }
});
