import { useColorScheme } from 'react-native';

export type ColorScheme = 'light' | 'dark';
export type ThemePreference = 'light' | 'dark' | 'system';

export function resolveColorScheme(preference: ThemePreference, systemScheme: ColorScheme | null | undefined): ColorScheme {
  const resolvedSystem = systemScheme ?? 'light';
  if (preference === 'system') return resolvedSystem;
  return preference;
}

export function useAppColorScheme(preference: ThemePreference = 'system'): ColorScheme {
  const scheme = useColorScheme();
  return resolveColorScheme(preference, scheme);
}
