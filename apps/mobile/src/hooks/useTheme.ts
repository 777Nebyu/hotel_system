import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { colors, darkColors, theme } from '../theme';

export type ColorScheme = 'light' | 'dark' | 'system';
export type ThemeColors = Record<keyof typeof colors, string>;

export interface ThemeContextValue {
  colorScheme: 'light' | 'dark';
  preference: ColorScheme;
  setPreference: (pref: ColorScheme) => void;
  colors: ThemeColors;
  font: typeof theme.font;
  fontSizes: typeof theme.fontSizes;
  spacing: typeof theme.spacing;
  borderRadius: typeof theme.borderRadius;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() ?? 'light';
  const [preference, setPreference] = useState<ColorScheme>('system');

  useEffect(() => {
    if (preference === 'system') return;
    Appearance.setColorScheme(preference);
  }, [preference]);

  const activeScheme: 'light' | 'dark' = preference === 'system' ? systemScheme : preference;
  const themeColors = activeScheme === 'dark' ? (darkColors as unknown as ThemeColors) : (colors as unknown as ThemeColors);

  const value = useMemo<ThemeContextValue>(() => ({
    colorScheme: activeScheme,
    preference,
    setPreference,
    colors: themeColors,
    font: theme.font,
    fontSizes: theme.fontSizes,
    spacing: theme.spacing,
    borderRadius: theme.borderRadius,
  }), [activeScheme, preference, themeColors]);

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  const systemScheme = useColorScheme() ?? 'light';
  if (ctx) return ctx;

  const activeScheme: 'light' | 'dark' = systemScheme;
  const themeColors = activeScheme === 'dark' ? (darkColors as unknown as ThemeColors) : (colors as unknown as ThemeColors);
  return {
    colorScheme: activeScheme,
    preference: 'system',
    setPreference: () => {},
    colors: themeColors,
    font: theme.font,
    fontSizes: theme.fontSizes,
    spacing: theme.spacing,
    borderRadius: theme.borderRadius,
  };
}

export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}
