import { Platform, useColorScheme, Dimensions } from 'react-native';

// ─── 3 Base Colors ──────────────────────────────────────────────────────────
// Emerald — primary actions, accents
// Navy    — text, borders, dark surfaces
// Gold    — highlights, premium accent
const E = '#0F8A83';  // Emerald
const N = '#1A2332';  // Navy
const G = '#C8983A';  // Gold

// ─── Light Theme ────────────────────────────────────────────────────────────
export const colors = {
  // Surfaces (navy lighter)
  surface:      '#FFFFFF',
  paper:        '#F5F6F8',
  paperDeep:    '#ECEDF1',
  clay:         '#E0E3E8',
  clayLight:    '#F0F2F5',
  line:         '#DEE2E8',
  lineStrong:   '#C4CAD4',

  // Text (navy spectrum)
  ink:          N,
  inkSoft:      '#4A5568',
  inkMuted:     '#8E9BB0',

  // Aliases
  umber:        N,
  umberDeep:    '#4A5568',

  // Brand (emerald)
  teal:         E,
  tealDeep:     '#0B6B66',
  tealTint:     '#E8F5F4',

  // Brand (gold)
  gold:         G,
  goldDeep:     '#A67E2E',
  goldTint:     '#FDF8EC',

  // Brand (red — derived from navy warm)
  brick:        '#DC2626',
  brickTint:    '#FEF2F2',

  // Semantic
  success:      E,
  warning:      G,
  danger:       '#DC2626',
  info:         '#2563EB',
} as const;

// ─── Dark Theme ─────────────────────────────────────────────────────────────
export const darkColors = {
  // Surfaces (navy darker)
  surface:      '#142A42',
  paper:        '#0B1929',
  paperDeep:    '#102035',
  clay:         '#1A3350',
  clayLight:    '#142A42',
  line:         '#1C3552',
  lineStrong:   '#2A4A6A',

  // Text (light navy)
  ink:          '#E4EAF0',
  inkSoft:      '#8DA4BD',
  inkMuted:     '#546A82',

  // Aliases
  umber:        '#E4EAF0',
  umberDeep:    '#8DA4BD',

  // Brand (emerald — brighter for dark bg)
  teal:         '#14B8A6',
  tealDeep:     '#0B6B66',
  tealTint:     '#0D3331',

  // Brand (gold — brighter for dark bg)
  gold:         '#E2B94A',
  goldDeep:     '#A67E2E',
  goldTint:     '#2A2006',

  // Brand (red)
  brick:        '#F87171',
  brickTint:    '#3B1111',

  // Semantic
  success:      '#14B8A6',
  warning:      '#E2B94A',
  danger:       '#F87171',
  info:         '#60A5FA',
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────
export const font = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  sans:    Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }),
  mono:    Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

// ─── Spacing (4px grid) ─────────────────────────────────────────────────────
export const space = (n: number) => n * 4;
export const sp = {
  1: 4,  2: 8,  3: 12, 4: 16, 5: 20,
  6: 24, 7: 28, 8: 32, 10: 40, 12: 48,
} as const;

export const radius = { card: 14, cardLg: 20, pill: 999, sm: 8 } as const;

// ─── Responsive padding ─────────────────────────────────────────────────────
export function useResponsivePadding(): number {
  const w = Dimensions.get('window').width;
  if (w < 360) return 16;
  if (w < 390) return 16;
  if (w < 431) return 20;
  return 20;
}

// ─── Shadows ────────────────────────────────────────────────────────────────
export const shadowCard = Platform.select({
  ios:     { shadowColor: N, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
  android: { elevation: 2 },
  default: {},
}) as object;

export const shadowMd = Platform.select({
  ios:     { shadowColor: N, shadowOpacity: 0.10, shadowRadius: 18, shadowOffset: { width: 0, height: 5 } },
  android: { elevation: 4 },
  default: {},
}) as object;

export const shadowCardDark = Platform.select({
  ios:     { shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } },
  android: { elevation: 3 },
  default: {},
}) as object;

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : colors;
}

// ─── Status badges ──────────────────────────────────────────────────────────
export const statusStyle = (status: string, dark?: boolean): { bg: string; fg: string; border: string } => {
  if (dark) {
    switch (status) {
      case 'PENDING':      return { bg: '#2A2006', fg: '#E2B94A', border: '#5C4510' };
      case 'CONFIRMED':    return { bg: '#0D3331', fg: '#14B8A6', border: '#0B6B66' };
      case 'CHECKED_IN':   return { bg: '#0C1E3A', fg: '#60A5FA', border: '#1E40AF' };
      case 'CHECKED_OUT':  return { bg: '#16202C', fg: '#8DA4BD', border: '#2A4A6A' };
      case 'CANCELLED':    return { bg: '#3B1111', fg: '#F87171', border: '#7F1D1D' };
      case 'REJECTED':     return { bg: '#3B1111', fg: '#F87171', border: '#7F1D1D' };
      case 'NO_SHOW':      return { bg: '#16202C', fg: '#8DA4BD', border: '#2A4A6A' };
      case 'SUCCEEDED':    return { bg: '#0D3331', fg: '#14B8A6', border: '#0B6B66' };
      case 'FAILED':       return { bg: '#3B1111', fg: '#F87171', border: '#7F1D1D' };
      case 'REFUNDED':     return { bg: '#0C1E3A', fg: '#60A5FA', border: '#1E40AF' };
      case 'ACTIVE':           return { bg: '#0D3331', fg: '#14B8A6', border: '#0B6B66' };
      case 'PENDING_APPROVAL': return { bg: '#16202C', fg: '#C8983A', border: '#5C4A1E' };
      case 'SUSPENDED':        return { bg: '#3B1111', fg: '#F87171', border: '#7F1D1D' };
      case 'DRAFT':            return { bg: '#16202C', fg: '#8DA4BD', border: '#2A4A6A' };
      case 'OPEN':             return { bg: '#16202C', fg: '#8DA4BD', border: '#2A4A6A' };
      case 'UNDER_REVIEW':     return { bg: '#0C1E3A', fg: '#60A5FA', border: '#1E40AF' };
      case 'RESOLVED':         return { bg: '#0D3331', fg: '#14B8A6', border: '#0B6B66' };
      case 'CLOSED':           return { bg: '#16202C', fg: '#8DA4BD', border: '#2A4A6A' };
      case 'DISMISSED':        return { bg: '#16202C', fg: '#8DA4BD', border: '#2A4A6A' };
      default: return { bg: darkColors.clay, fg: darkColors.inkSoft, border: darkColors.lineStrong };
    }
  }
  switch (status) {
    case 'PENDING':          return { bg: '#FDF8EC', fg: '#A67E2E', border: '#FDE68A' };
    case 'CONFIRMED':        return { bg: '#E8F5F4', fg: '#0B6B66', border: '#B2DFDB' };
    case 'CHECKED_IN':       return { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' };
    case 'CHECKED_OUT':      return { bg: '#F8F9FB', fg: '#6B7280', border: '#E5E7EB' };
    case 'CANCELLED':        return { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' };
    case 'REJECTED':         return { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' };
    case 'NO_SHOW':          return { bg: '#F3F4F6', fg: '#374151', border: '#D1D5DB' };
    case 'SUCCEEDED':        return { bg: '#E8F5F4', fg: '#0B6B66', border: '#B2DFDB' };
    case 'FAILED':           return { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' };
    case 'REFUNDED':         return { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' };
    case 'ACTIVE':           return { bg: '#E8F5F4', fg: '#0B6B66', border: '#B2DFDB' };
    case 'PENDING_APPROVAL': return { bg: '#FDF8EC', fg: '#A67E2E', border: '#FDE68A' };
    case 'SUSPENDED':        return { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' };
    case 'DRAFT':            return { bg: '#F8FAFC', fg: '#64748B', border: '#E2E8F0' };
    case 'OPEN':             return { bg: '#F8F9FB', fg: '#6B7280', border: '#E5E7EB' };
    case 'UNDER_REVIEW':     return { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' };
    case 'RESOLVED':         return { bg: '#E8F5F4', fg: '#0B6B66', border: '#B2DFDB' };
    case 'CLOSED':           return { bg: '#F8F9FB', fg: '#6B7280', border: '#E5E7EB' };
    case 'DISMISSED':        return { bg: '#F8F9FB', fg: '#6B7280', border: '#E5E7EB' };
    default: return { bg: colors.paperDeep, fg: colors.inkSoft, border: colors.lineStrong };
  }
};

export const theme = {
  colors: {
    ...colors,
    text:         colors.ink,
    textSecondary: colors.inkMuted,
    background:   colors.paper,
    primary:      colors.teal,
    primaryLight: colors.tealTint,
    secondary:    colors.umber,
    success:      colors.success,
    warning:      colors.warning,
    error:        colors.brick,
    info:         colors.info,
    border:       colors.line,
  },
  darkColors: {
    ...darkColors,
    text:         darkColors.ink,
    textSecondary: darkColors.inkMuted,
    background:   darkColors.paper,
    primary:      darkColors.teal,
    primaryLight: darkColors.tealTint,
    secondary:    darkColors.umber,
    success:      darkColors.success,
    warning:      darkColors.warning,
    error:        darkColors.brick,
    info:         darkColors.info,
    border:       darkColors.line,
  },
  font,
  fontSizes: {
    screenTitle:  { min: 24, max: 30 },
    sectionTitle: { min: 20, max: 24 },
    cardTitle:    { min: 15, max: 18 },
    body:         { min: 14, max: 16 },
    bodySmall:    { min: 13, max: 14 },
    caption:      { min: 11, max: 12 },
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  borderRadius: { sm: 8, md: 14, lg: 20 },
};
