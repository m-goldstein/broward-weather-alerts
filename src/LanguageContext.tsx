import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGE_KEY, locales, localizedDay, localizedTime, preferredLanguage, translate, weatherDescription } from './i18n';
import type { Language, TranslationValues } from './i18n';
import { readStored, writeStored } from './preferences';

type LanguageContextValue = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (message: string, values?: TranslationValues) => string;
  formatDay: typeof import('../shared/model').formatDay;
  formatTime: typeof import('../shared/model').formatTime;
  describeWeather: (description: string) => string;
};
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => preferredLanguage(readStored(LANGUAGE_KEY, null), navigator.languages));
  useEffect(() => {
    document.documentElement.lang = language;
    writeStored(LANGUAGE_KEY, language);
  }, [language]);
  const value = useMemo<LanguageContextValue>(() => ({
    language, locale: locales[language], setLanguage,
    t: (message, values) => translate(language, message, values),
    formatDay: (time, options) => localizedDay(language, time, options),
    formatTime: (time, minutes) => localizedTime(language, time, minutes),
    describeWeather: description => weatherDescription(language, description),
  }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage requires LanguageProvider');
  return value;
}
