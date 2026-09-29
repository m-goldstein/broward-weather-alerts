import { test, expect } from '@playwright/test';
import { mockForecast } from './fixture';

test.beforeEach(async ({ page }) => { await mockForecast(page); });

test('dashboard navigation, saved checklist, alert controls, and CSV export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tides & rainfall', exact: true })).toBeVisible({ timeout: 45000 });
  for (const [nav, heading] of [['Tide forecast', 'Tide timeline'], ['Rainfall forecast', 'Hourly precipitation'], ['Overlap outlook', 'Upcoming overlap windows'], ['King tide calendar', 'Mark the higher tides.']] as const) {
    await page.getByRole('link', { name: nav, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.getByRole('link', { name: 'Preparation guide', exact: true }).click();
  const firstTask = page.getByRole('checkbox').first();
  await firstTask.check();
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toBeChecked({ timeout: 45000 });
  await page.getByRole('button', { name: 'Set up alerts', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('slider').first().fill('2.8');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export forecast', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^tidewatch-33019-.*\.csv$/);
  expect(errors).toEqual([]);
});
test('mobile layout stays within the viewport and navigation is usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tides & rainfall', exact: true })).toBeVisible({ timeout: 45000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation', { name: 'Mobile primary navigation' }).getByRole('link', { name: 'Tide forecast', exact: true }).click();
  await expect(page.locator('.mobile-forecast-list.tide-list')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tide timeline', exact: true })).toBeVisible();
});

test('map tiles use the platform endpoint and a failed map can be retried', async ({ page }) => {
  let unavailable = true;
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
  await page.route('**/api/basemap?**', async route => {
    expect(new URL(route.request().url()).searchParams.has('key')).toBe(false);
    if (unavailable) await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"The basemap is not configured."}' });
    else await route.fulfill({ status: 200, contentType: 'image/png', body: pixel });
  });
  await page.goto('/');
  await expect(page.getByText('Some map tiles couldn’t load')).toBeVisible({ timeout: 45000 });
  unavailable = false;
  await page.getByRole('button', { name: 'Retry loading map tiles' }).click();
  await expect(page.locator('.leaflet-tile-loaded').first()).toBeVisible();
  await expect(page.getByText('Some map tiles couldn’t load')).not.toBeVisible();
  await expect(page.getByText('NOAA tide station', { exact: true })).toBeVisible();
});


test('ZIP search keeps settings, alert preferences and checklist isolated by ZIP and browser', async ({ page, browser }) => {
  await page.context().grantPermissions(['notifications']);
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'Planning preferences' })).toBeVisible();
  await page.getByRole('slider').first().fill('3.1');
  await page.getByLabel('Notify ahead of an overlap window').selectOption('12');
  await page.getByRole('switch', { name: 'Browser notifications' }).click();
  await expect(page.getByRole('switch', { name: 'Browser notifications' })).toBeChecked();
  await page.getByRole('link', { name: 'Preparation guide', exact: true }).click();
  await page.getByRole('checkbox').first().check();
  await page.getByLabel('Find your local outlook').fill('33139');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.page-eyebrow')).toContainText('Miami Beach, FL · 33139');
  await expect(page.getByRole('checkbox').first()).not.toBeChecked();
  await page.getByRole('link', { name: 'Settings & alerts', exact: true }).click();
  await expect(page.getByRole('slider').first()).toHaveValue('2.3');
  await expect(page.getByLabel('Notify ahead of an overlap window')).toHaveValue('3');
  await expect(page.getByRole('switch', { name: 'Browser notifications' })).not.toBeChecked();
  await page.getByRole('slider').first().fill('2.7');
  await page.reload();
  await expect(page.getByRole('slider').first()).toHaveValue('2.7');
  await page.getByRole('button', { name: 'Back to Hollywood · 33019' }).click();
  await expect(page.getByRole('slider').first()).toHaveValue('3.1');
  await expect(page.getByLabel('Notify ahead of an overlap window')).toHaveValue('12');
  await expect(page.getByRole('switch', { name: 'Browser notifications' })).toBeChecked();
  await page.getByRole('link', { name: 'Preparation guide', exact: true }).click();
  await expect(page.getByRole('checkbox').first()).toBeChecked();

  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await mockForecast(other);
  await other.goto('/?zip=33139#settings');
  await expect(other.getByRole('slider').first()).toHaveValue('2.3');
  await expect(other.getByLabel('Notify ahead of an overlap window')).toHaveValue('3');
  await expect(other.getByRole('switch', { name: 'Browser notifications' })).not.toBeChecked();
  await other.getByRole('slider').first().fill('1.9');
  await page.getByLabel('Find your local outlook').fill('33139');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.page-eyebrow')).toContainText('33139');
  await page.getByRole('link', { name: 'Settings & alerts', exact: true }).click();
  await expect(page.getByRole('slider').first()).toHaveValue('2.7');
  await otherContext.close();
});

test('invalid and unknown ZIPs preserve the current outlook; inland ZIPs show incomplete tides', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tides & rainfall', exact: true })).toBeVisible();
  await page.getByLabel('Find your local outlook').fill('123');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('Enter a five-digit US ZIP code, such as 33139.')).toBeVisible();
  await page.getByLabel('Find your local outlook').fill('00000');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByText('That ZIP code was not found.', { exact: false })).toBeVisible();
  await expect(page.locator('.page-eyebrow')).toContainText('33019');
  await page.getByLabel('Find your local outlook').fill('80202');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.page-eyebrow')).toContainText('Denver, CO');
  await expect(page.getByRole('heading', { name: 'A few gaps in the forecast.' })).toBeVisible();
  await page.getByRole('link', { name: 'Tide forecast', exact: true }).click();
  await expect(page.locator('.table-panel').getByText('No NOAA tide prediction station within 25 km', { exact: false })).toBeVisible();
});

test('small phones support bottom navigation, More menu and chart keyboard exploration', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tides & rainfall', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const scrubber = page.getByRole('slider', { name: 'Explore forecast hour' });
  const before = await scrubber.getAttribute('aria-valuetext');
  await scrubber.focus(); await page.keyboard.press('ArrowRight');
  expect(await scrubber.getAttribute('aria-valuetext')).not.toEqual(before);
  await page.getByRole('button', { name: 'More navigation', exact: true }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Settings & alerts', exact: false }).click();
  await expect(page.getByRole('heading', { name: 'Planning preferences' })).toBeVisible();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
