import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKey, getWindows, highestRisk, hourlyRain, interpolateTide, riskFor, sumRain } from '../shared/model.ts';
import type { Hour } from '../shared/types.ts';
const hour: Hour = { time: '2026-09-29T16:00:00Z', tide: 2.5, rain: 0.03, chance: 50, temperature: 82, wind: 'S 9 mph', description: 'Chance showers' };

test('elevated overlap requires both a higher tide and a rain trigger', () => {
  assert.equal(riskFor(hour), 'moderate');
  assert.equal(riskFor({ ...hour, tide: 1.8 }), 'low');
  assert.equal(riskFor({ ...hour, rain: 0, chance: 10 }), 'low');
  assert.equal(riskFor({ ...hour, tide: 2.8, rain: 0.09, chance: 65 }), 'high');
});
test('missing data is not represented as zero rain or low risk', () => {
  const missing = { ...hour, rain: null, chance: null };
  assert.equal(riskFor(missing), 'unknown');
  assert.equal(highestRisk([hour, missing]), 'unknown');
  assert.equal(sumRain([hour, missing]), null);
});
test('rain probability can indicate overlap even without a rain amount', () => {
  assert.equal(riskFor({ ...hour, rain: null, chance: 50 }), 'moderate');
});
test('interpolated tide preserves extrema and does not extrapolate beyond coverage', () => {
  const tides = [{ time: '2026-09-29T12:00:00Z', height: 0, type: 'L' as const }, { time: '2026-09-29T18:00:00Z', height: 3, type: 'H' as const }];
  assert.equal(interpolateTide(tides, Date.parse(tides[0].time)), 0);
  assert.equal(interpolateTide(tides, Date.parse(tides[1].time)), 3);
  assert.ok(Math.abs(interpolateTide(tides, Date.parse('2026-09-29T15:00:00Z'))! - 1.5) < 1e-10);
  assert.equal(interpolateTide(tides, Date.parse('2026-09-29T19:00:00Z')), null);
});
test('multi-hour precipitation totals are converted and apportioned, not repeated every hour', () => {
  const values = [{ validTime: '2026-09-29T12:00:00Z/PT6H', value: 25.4 }];
  const total = Array.from({ length: 6 }, (_, i) => hourlyRain(values, Date.parse('2026-09-29T12:00:00Z') + i * 3600000)!).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-10);
  assert.equal(hourlyRain(values, Date.parse('2026-09-29T18:00:00Z')), null);
});
test('overlap windows end after the final hour and split at missing data or gaps', () => {
  const hours = [hour, { ...hour, time: '2026-09-29T17:00:00Z' }, { ...hour, time: '2026-09-29T18:00:00Z', tide: null }, { ...hour, time: '2026-09-29T20:00:00Z' }];
  const windows = getWindows(hours);
  assert.equal(windows.length, 2);
  assert.equal(windows[0].hours, 2);
  assert.equal(windows[0].end, '2026-09-29T18:00:00.000Z');
});
test('day grouping follows Eastern local time across daylight saving changes', () => {
  assert.equal(dayKey('2026-09-30T02:00:00Z'), '2026-09-29');
  assert.equal(dayKey('2026-11-01T05:30:00Z'), '2026-11-01');
  assert.equal(dayKey('2026-11-01T06:30:00Z'), '2026-11-01');
});
