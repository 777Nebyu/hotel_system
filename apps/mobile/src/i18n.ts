import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './locales/en.json';

const defaultLng = Localization.getLocales()[0]?.languageCode ?? 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: defaultLng,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

if (defaultLng !== 'en') {
  import('./locales/am.json').then((am) => {
    i18n.addResourceBundle('am', 'translation', am.default);
  });
}

export default i18n;
