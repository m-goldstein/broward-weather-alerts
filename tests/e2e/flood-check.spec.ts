import { test, expect } from '@playwright/test';
import { dashboard, mockForecast } from './fixture';
import { easternDateTimeValue, HOUR } from '../../shared/flood-check';
import type { FloodCheckData } from '../../shared/types';

const now = new Date('2026-09-30T12:00:00Z');
function result(zip: string, at: string, overrides: Partial<FloodCheckData> = {}): FloodCheckData {
  const base = dashboard(zip);
  return { generatedAt: now.toISOString(), requestedAt: at, location: { ...base.location, name: 'North Miami Beach, FL' }, tide: 2.8, nearbyHighTide: { time: '2026-10-02T21:00:00Z', height: 3.1, type: 'H' }, rain: .3, chance: 80, rainThreeHours: .9, rainStartsAt: new Date(Math.floor(Date.parse(at) / HOUR) * HOUR).toISOString(), weatherCoverageEndsAt: '2026-10-07T12:00:00Z', weatherAvailability: 'available', sources: base.sources, ...overrides };
}
async function setup(page: import('@playwright/test').Page) {
  await page.clock.install({ time: now });
  await mockForecast(page);
}

test('ZIP and Eastern date/time show tide, rain, and hazard even from a Pacific browser', async ({ browser }) => {
  const context = await browser.newContext({ timezoneId: 'America/Los_Angeles', locale: 'en-US' });
  const page = await context.newPage(); await setup(page);
  let requestedZip = '', requestedAt = '';
  await page.route('**/api/flood-check?**', route => {
    const params = new URL(route.request().url()).searchParams;
    requestedZip = params.get('zip')!; requestedAt = params.get('at')!;
    return route.fulfill({ json: result(requestedZip, requestedAt) });
  });
  await page.goto('/');
  await page.getByLabel('ZIP code', { exact: true }).fill('33160');
  await page.getByLabel('Date & time (Eastern)').fill('2026-10-02T16:30');
  await page.getByRole('button', { name: 'Check flood outlook', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Check flooding for a date & time' });
  await expect(panel.getByRole('heading', { name: 'Flooding may be possible' })).toBeVisible();
  expect(requestedZip).toBe('33160'); expect(requestedAt).toBe('2026-10-02T20:30:00.000Z');
  await expect(panel).toContainText('Friday, October 2, 2026 · 4:30 PM Eastern');
  await expect(panel).toContainText('2.80 ft MLLW'); await expect(panel).toContainText('0.30 in'); await expect(panel).toContainText('80%'); await expect(panel).toContainText('0.90 in');
  await expect(panel.locator('.flood-signals')).toContainText('Rain & tide togetherPotential hazard');
  await expect(page.locator('#zip-search'), 'a check does not replace the dashboard ZIP').toHaveValue('33019');
  await page.getByLabel('Date & time (Eastern)').fill('2026-10-03T16:00');
  await expect(panel.locator('.flood-check-result'), 'editing clears the prior result').toHaveCount(0);
  await context.close();
});

test('far-future and cached rain leave the assessment incomplete', async ({ page }) => {
  await setup(page);
  await page.route('**/api/flood-check?**', route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: result(params.get('zip')!, params.get('at')!, { tide: 1.2, rain: null, chance: null, rainThreeHours: null, weatherCoverageEndsAt: null, weatherAvailability: 'outside-forecast', sources: { tides: { status: 'live', fetchedAt: now.toISOString() }, weather: { status: 'unavailable', fetchedAt: null } } }) });
  });
  await page.goto('/'); await page.getByLabel('Date & time (Eastern)').fill('2026-10-30T16:00');
  await page.getByRole('button', { name: 'Check flood outlook', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Check flooding for a date & time' });
  await expect(panel).toContainText('Not enough data to assess flooding');
  await expect(panel).toContainText('This time is beyond the rain forecast'); await expect(panel).toContainText('1.20 ft MLLW');
  await expect(panel.locator('.flood-values')).not.toContainText('0.00 in');
  await page.route('**/api/flood-check?**', route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: result(params.get('zip')!, params.get('at')!, { tide: 1.2, sources: { tides: { status: 'live', fetchedAt: now.toISOString() }, weather: { status: 'cached', fetchedAt: now.toISOString() } } }) });
  });
  await page.getByLabel('Date & time (Eastern)').fill('2026-10-02T16:00'); await page.getByRole('button', { name: 'Check flood outlook', exact: true }).click();
  await expect(panel).toContainText('Not enough data to assess flooding'); await expect(panel).toContainText('Rain data is cached');
});

test('changing the current ZIP tide threshold updates a displayed check immediately', async ({ page }) => {
  await setup(page);
  await page.route('**/api/flood-check?**', route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: result(params.get('zip')!, params.get('at')!, { rain: 0, chance: 0, rainThreeHours: 0 }) });
  });
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'Planning preferences' })).toBeVisible();
  await page.locator('#flood-time').fill('2026-10-02T16:00');
  await page.getByRole('button', { name: 'Check flood outlook', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Check flooding for a date & time' });
  await expect(panel).toContainText('Flooding may be possible');
  await page.getByRole('slider').first().fill('3.1');
  await expect(panel).toContainText('No flood signal in the available forecast');
  await expect(panel).toContainText('tide ≥ 3.10 ft MLLW');
});

test('invalid ZIP, past dates, DST ambiguity, and provider errors are actionable', async ({ page }) => {
  await setup(page); let requests = 0;
  await page.route('**/api/flood-check?**', route => { requests++; return route.fulfill({ status: 503, json: { error: 'ZIP lookup is unavailable. Please try again shortly.' } }); });
  await page.goto('/');
  const submit = page.getByRole('button', { name: 'Check flood outlook', exact: true });
  await page.getByLabel('ZIP code', { exact: true }).fill('123'); await submit.click();
  await expect(page.getByRole('alert')).toContainText('Enter a valid five-digit');
  await page.getByLabel('ZIP code', { exact: true }).fill('33160'); await page.getByLabel('Date & time (Eastern)').fill('2026-09-29T16:00'); await submit.click();
  await expect(page.getByRole('alert')).toContainText('Choose a future date');
  await page.getByLabel('Date & time (Eastern)').fill('2026-11-01T01:30'); await submit.click();
  await expect(page.getByRole('alert')).toContainText('occurs twice'); expect(requests).toBe(0);
  await page.getByLabel('Date & time (Eastern)').fill('2026-10-02T16:00'); await submit.click();
  await expect(page.getByRole('alert')).toContainText('ZIP lookup is unavailable'); expect(requests).toBe(1); await expect(submit).toBeEnabled();
});

test('mobile flood check stays within the viewport and translates results into Spanish', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, locale: 'es-US' });
  const page = await context.newPage(); await setup(page);
  await page.route('**/api/flood-check?**', route => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: result(params.get('zip')!, params.get('at')!) });
  });
  await page.goto('/');
  await page.locator('#flood-zip').fill('33160'); await page.locator('#flood-time').fill(easternDateTimeValue(new Date('2026-10-02T20:00:00Z')));
  await page.getByRole('button', { name: 'Consultar inundaciones', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Consulta inundaciones para una fecha y hora' });
  await expect(panel).toContainText('Podrían producirse inundaciones'); await expect(panel).toContainText('Peligro por lluvia intensa');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/flood-check-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});
