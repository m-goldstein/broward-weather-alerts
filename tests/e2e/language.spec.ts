import { test, expect } from '@playwright/test';
import { mockForecast, dashboard } from './fixture';

test.beforeEach(async ({ page }) => { await mockForecast(page); });

test('corner toggle translates all pages, dates, controls and CSV without losing saved settings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'Planning preferences' })).toBeVisible();
  await page.getByRole('slider').first().fill('3.1');
  await page.getByRole('button', { name: 'Switch to Spanish' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { name: 'Preferencias de planificación' })).toBeVisible();
  await expect(page.getByRole('slider').first()).toHaveValue('3.1');
  await expect(page.getByLabel('Avisar antes de un período de coincidencia')).toBeVisible();
  await page.getByLabel('Busca tu panorama local').fill('33139');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.page-eyebrow')).toContainText('33139');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.getByRole('button', { name: 'Volver a Hollywood · 33019' }).click();
  await expect(page.getByRole('slider').first()).toHaveValue('3.1');
  for (const [nav, heading] of [
    ['Resumen', 'Mareas y lluvia'],
    ['Pronóstico de mareas', 'Evolución de las mareas'],
    ['Pronóstico de lluvia', 'Precipitación por hora'],
    ['Coincidencia de marea y lluvia', 'Próximos períodos de coincidencia'],
    ['Calendario de mareas máximas', 'Anota las mareas más altas.'],
    ['Guía de preparación', 'Lista de preparación de tu hogar'],
  ]) {
    await page.getByRole('link', { name: nav, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.getByRole('checkbox').first().check();
  await page.reload();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.getByRole('button', { name: 'Configurar alertas', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Preferencias de alertas' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('slider').first()).toHaveValue('3.1');
  await page.getByRole('button', { name: 'Cerrar diálogo' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar pronóstico' }).click();
  const download = await downloading;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString('utf8')).toContain('Hora (UTC),Hora local');
  await page.getByRole('button', { name: 'Cambiar a inglés' }).click();
  await expect(page.getByRole('heading', { name: 'Your household checklist' })).toBeVisible();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(errors).toEqual([]);
});

test('Spanish toggle fits small phones and mobile forecasts and navigation stay usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to Spanish' }).click();
  await expect(page.getByRole('heading', { name: 'Mareas y lluvia', exact: true })).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Cambiar a inglés' });
  const box = await toggle.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  const date = await page.locator('.date-button').boundingBox();
  const alerts = await page.getByRole('button', { name: 'Configurar alertas', exact: true }).boundingBox();
  expect(date!.x + date!.width <= alerts!.x || date!.y + date!.height <= alerts!.y).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const scrubber = page.getByRole('slider', { name: 'Explorar hora del pronóstico' });
  await expect(scrubber).toHaveAttribute('aria-valuetext', /Marea:.*Lluvia:/);
  await scrubber.focus();
  const previous = await scrubber.getAttribute('aria-valuetext');
  await page.keyboard.press('ArrowRight');
  expect(await scrubber.getAttribute('aria-valuetext')).not.toEqual(previous);
  await page.getByRole('navigation', { name: 'Navegación principal móvil' }).getByRole('link', { name: 'Pronóstico de mareas' }).click();
  await expect(page.locator('.mobile-forecast-list.tide-list')).toBeVisible();
  await expect(page.locator('.tide-row').first()).toContainText(/Pleamar|Bajamar/);
  await page.getByRole('navigation', { name: 'Navegación principal móvil' }).getByRole('link', { name: 'Pronóstico de lluvia' }).click();
  await expect(page.locator('.hour-row').first()).toContainText('Posibilidad de chubascos');
  await page.getByRole('button', { name: 'Más navegación', exact: true }).click();
  await page.getByRole('dialog').getByRole('link', { name: /Ajustes y alertas/ }).click();
  await expect(page.getByRole('heading', { name: 'Preferencias de planificación' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Spanish browser default, validation, API errors and incomplete tides use Spanish', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-PR' });
  const page = await context.newPage();
  await mockForecast(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.getByRole('heading', { name: 'Mareas y lluvia', exact: true })).toBeVisible();
  await page.getByLabel('Busca tu panorama local').fill('123');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText('Introduce un código postal de EE. UU. de cinco dígitos, como 33139.')).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar a inglés' }).click();
  await expect(page.getByText('Enter a five-digit US ZIP code, such as 33139.')).toBeVisible();
  await page.getByRole('button', { name: 'Switch to Spanish' }).click();
  await page.getByLabel('Busca tu panorama local').fill('00000');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText('No se encontró ese código postal.', { exact: false })).toBeVisible();
  await page.getByLabel('Busca tu panorama local').fill('80202');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Faltan algunos datos del pronóstico.' })).toBeVisible();
  await page.getByRole('link', { name: 'Pronóstico de mareas', exact: true }).click();
  await expect(page.locator('.table-panel')).toContainText('No hay una estación de predicción de mareas de NOAA');
  await context.close();
});

test('official advisory text retains its source language with Spanish labels', async ({ page }) => {
  const data = dashboard();
  data.alerts = [{ id: 'test', event: 'Coastal Flood Advisory', headline: 'Coastal flooding is possible.', description: 'Official source description.', instruction: 'Avoid flooded roads.', severity: 'Minor', expires: data.hours[12].time, url: 'https://www.weather.gov/' }];
  await page.route('**/api/dashboard?**', route => route.fulfill({ json: data }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to Spanish' }).click();
  await page.locator('.advisory-banner').click();
  const dialog = page.getByRole('dialog', { name: 'Aviso meteorológico oficial' });
  await expect(dialog).toContainText('El texto del aviso oficial del NWS se proporciona en inglés.');
  await expect(dialog.locator('.advisory-description')).toHaveAttribute('lang', 'en');
  await expect(dialog.locator('.advisory-description')).toHaveText(data.alerts[0].description);
  await expect(dialog.getByRole('heading', { name: 'Acción recomendada' })).toBeVisible();
});
