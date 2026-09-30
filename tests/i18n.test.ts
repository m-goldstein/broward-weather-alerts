import test from 'node:test';
import assert from 'node:assert/strict';
import { localizedDay, localizedTime, preferredLanguage, translate, weatherDescription } from '../src/i18n';
import spanish from '../src/locales/es';

test('saved language wins over browser preferences; unsupported settings fall back safely', () => {
  assert.equal(preferredLanguage('en', ['es-PR']), 'en');
  assert.equal(preferredLanguage('es', ['en-US']), 'es');
  assert.equal(preferredLanguage('fr', ['fr-CA', 'es-MX', 'en-US']), 'es');
  assert.equal(preferredLanguage(null, ['en-US', 'es-US']), 'en');
  assert.equal(preferredLanguage({ language: 'es' }, ['fr']), 'en');
});

test('Spanish catalog preserves every interpolation and supports zero values', () => {
  for (const [english, translation] of Object.entries(spanish)) {
    assert.ok(translation.trim(), english);
    const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(placeholders(translation), placeholders(english), english);
  }
  assert.equal(translate('es', '{hours} hours', { hours: 0 }), '0 horas');
  assert.equal(translate('en', 'Next {hours} hours', { hours: 24 }), 'Next 24 hours');
  assert.equal(translate('es', 'Unknown provider message'), 'Unknown provider message');
});

test('localized dates retain Eastern time across UTC date boundaries and daylight saving changes', () => {
  assert.equal(localizedDay('es', '2026-10-01T01:00:00Z', { month: 'long' }), 'septiembre');
  for (const time of ['2026-07-01T16:00:00Z', '2026-12-01T17:00:00Z']) {
    assert.equal(localizedTime('en', time), '12:00 PM');
    assert.equal(localizedTime('es', time), new Intl.DateTimeFormat('es-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(new Date(time)));
  }
});

test('known short weather descriptions translate while English and unfamiliar text are retained', () => {
  assert.equal(weatherDescription('es', 'Chance showers'), 'Posibilidad de chubascos');
  assert.equal(weatherDescription('es', 'Partly Cloudy'), 'Parcialmente nublado');
  assert.equal(weatherDescription('es', 'Chance Showers And Thunderstorms'), 'Posibilidad de chubascos y tormentas eléctricas');
  assert.equal(weatherDescription('en', 'Chance showers'), 'Chance showers');
  assert.equal(weatherDescription('es', 'Special provider message'), 'Special provider message');
  assert.match(weatherDescription('es', 'NWS gridded forecast · hourly text unavailable'), /cuadrícula/);
});
