import { test, expect } from '@playwright/test';

test('dashboard navigation, saved checklist, alert controls, and CSV export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tides & rainfall', exact: true })).toBeVisible({ timeout: 45000 });
  for (const [nav, heading] of [['Tide forecast', 'Tide timeline'], ['Rainfall forecast', 'Hourly precipitation'], ['Overlap outlook', 'Upcoming overlap windows'], ['King tide calendar', 'Mark the higher tides.']] as const) {
    await page.getByRole('button', { name: nav, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Preparation guide', exact: true }).click();
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
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Tide forecast', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tide timeline', exact: true })).toBeVisible();
});
