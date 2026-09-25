/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
import { configure } from '@testing-library/react-native';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './src/locales/en.json';

if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

configure({ hostComponentNames: {
  text: 'Text',
  textInput: 'TextInput',
  switch: 'Switch',
  scrollView: 'ScrollView',
  modal: 'Modal',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
} });

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockModal = ({ visible, children, ...rest }: any) => (visible ? React.createElement(View, rest, children) : null);
  MockModal.default = MockModal;
  return MockModal;
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name, ...rest }: any) => React.createElement(Text, rest, name),
    MaterialIcons: ({ name, ...rest }: any) => React.createElement(Text, rest, name),
    FontAwesome: ({ name, ...rest }: any) => React.createElement(Text, rest, name),
    Feather: ({ name, ...rest }: any) => React.createElement(Text, rest, name),
  };
});

// Controllable NetInfo mock — tests drive connectivity via __setNetInfoState.
jest.mock('@react-native-community/netinfo', () => {
  const listeners = new Set();
  let state = { isConnected: true, isInternetReachable: true, type: 'wifi', details: null };
  return {
    __esModule: true,
    default: {
      addEventListener: (cb) => {
        listeners.add(cb);
        cb(state);
        return () => listeners.delete(cb);
      },
      fetch: async () => state,
      __setNetInfoState: (next) => {
        state = next;
        listeners.forEach((l) => l(state));
      },
    },
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
