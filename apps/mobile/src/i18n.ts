import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import am from './locales/am.json';

const defaultLng = Localization.getLocales()[0]?.languageCode ?? 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    am: { translation: am },
  },
  lng: defaultLng === 'am' ? 'am' : 'en',
  supportedLngs: ['en', 'am'],
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

const LANGUAGE_KEY = 'luxsty.language';
void AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
  if (stored === 'en' || stored === 'am') void i18n.changeLanguage(stored);
}).catch(() => {});

export async function setAppLanguage(language: 'en' | 'am') {
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
  await i18n.changeLanguage(language);
}

export default i18n;
