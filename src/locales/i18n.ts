import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationEn from './en/translation.json';
import translationZh from './zh-CN/translation.json';

export const defaultNS = 'translation';

export const resources = {
  en: { translation: translationEn },
  'zh-CN': { translation: translationZh },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: {
      default: ['zh-CN', 'en'],
    },
    fallbackNS: 'translation',
    ns: ['translation'],
    debug: false,
    defaultNS,
    resources,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'admin-panel:language',
      caches: ['localStorage'],
    },
  });

export default i18n;
