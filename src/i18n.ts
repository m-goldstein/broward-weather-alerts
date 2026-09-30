import spanish from './locales/es';
import { TIME_ZONE } from '../shared/model';

export type Language = 'en' | 'es';
export const LANGUAGE_KEY = 'tidewatch.language.v1';
export const locales: Record<Language, string> = { en: 'en-US', es: 'es-US' };
export type TranslationValues = Record<string, string | number>;

export function translate(language: Language, message: string, values: TranslationValues = {}): string {
  const template = language === 'es' ? spanish[message] ?? message : message;
  return template.replace(/\{(\w+)\}/g, (placeholder: string, key: string) => String(values[key] ?? placeholder));
}
export function preferredLanguage(saved: unknown, browserLanguages: readonly string[]): Language {
  if (saved === 'en' || saved === 'es') return saved;
  for (const language of browserLanguages) {
    const base = language.toLowerCase().split('-')[0];
    if (base === 'en' || base === 'es') return base;
  }
  return 'en';
}
export function localizedTime(language: Language, time: string | Date, minutes = true): string {
  return new Intl.DateTimeFormat(locales[language], { timeZone: TIME_ZONE, hour: 'numeric', ...(minutes ? { minute: '2-digit' } : {}) }).format(new Date(time));
}
export function localizedDay(language: Language, time: string | Date, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }): string {
  return new Intl.DateTimeFormat(locales[language], { timeZone: TIME_ZONE, ...options }).format(new Date(time));
}

// NWS short forecasts use a limited vocabulary. Translate known phrases while
// leaving unfamiliar provider text intact rather than changing its meaning.
export function weatherDescription(language: Language, description: string): string {
  if (language === 'en') return description;
  const terms: Record<string, string> = {
    'showers and thunderstorms': 'chubascos y tormentas eléctricas',
    'rain showers': 'chubascos', 'chance showers': 'posibilidad de chubascos',
    'thunderstorms': 'tormentas eléctricas', 'thunderstorm': 'tormenta eléctrica',
    'mostly sunny': 'mayormente soleado', 'partly sunny': 'parcialmente soleado',
    'mostly clear': 'mayormente despejado', 'partly cloudy': 'parcialmente nublado',
    'mostly cloudy': 'mayormente nublado', 'light rain': 'lluvia ligera',
    'heavy rain': 'lluvia intensa', 'patchy fog': 'niebla dispersa',
    'slight chance': 'ligera posibilidad de', 'chance of': 'posibilidad de',
    'chance': 'posibilidad de',
    'showers': 'chubascos', 'sunny': 'soleado', 'clear': 'despejado',
    'cloudy': 'nublado', 'rain': 'lluvia', 'fog': 'niebla', 'haze': 'bruma',
    'windy': 'ventoso', 'breezy': 'con brisa', 'likely': 'probables',
    'isolated': 'aislados', 'scattered': 'dispersos', 'widespread': 'generalizados',
    'then': 'luego', 'and': 'y',
  };
  const direct = spanish[description];
  if (direct) return direct;
  const pattern = new RegExp(`\\b(${Object.keys(terms).join('|')})\\b`, 'gi');
  const result = description.replace(pattern, word => terms[word.toLowerCase()]);
  return result.charAt(0).toUpperCase() + result.slice(1);
}
