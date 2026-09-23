import { Platform, useColorScheme, useWindowDimensions } from 'react-native';

// ─── 3 Base Colors (matching web) ───────────────────────────────────────────
// Primary — Deep Sapphire Navy #0F2942
// Gold    — Champagne Warm Gold #D4AF37
// Navy    — Body text / dark surfaces #0F172A
const P = '#0F2942';  // Primary (Sapphire)
const G = '#D4AF37';  // Accent (Gold)
const N = '#0F172A';  // Navy (text)

// ─── Light Theme ────────────────────────────────────────────────────────────
export const colors = {
  // Surfaces
  surface:      '#FFFFFF',
  paper:        '#F8FAFC',
  paperDeep:    '#F1F5F9',
  clay:         '#E2E8F0',
  clayLight:    '#F1F5F9',
  line:         '#E2E8F0',
  lineStrong:   '#CBD5E1',

  // Text
  ink:          N,
  inkSoft:      '#475569',
  inkMuted:     '#64748B',

  // Aliases
  umber:        N,
  umberDeep:    '#475569',

  // Brand (primary — sapphire)
  teal:         P,
  tealDeep:     '#163859',
  tealTint:     '#EFF6FF',

  // Brand (gold)
  gold:         G,
  goldDeep:     '#C5A028',
  goldTint:     '#FEF9E7',

  // Brand (red — danger)
  brick:        '#EF4444',
  brickTint:    '#FEF2F2',

  // Semantic
  success:      '#10B981',
  successBg:    '#ECFDF5',
  warning:      '#F59E0B',
  warningBg:    '#FFFBEB',
  danger:       '#EF4444',
  dangerBg:     '#FEF2F2',
  info:         '#3B82F6',
  infoBg:       '#EFF6FF',
} as const;

// ─── Dark Theme ─────────────────────────────────────────────────────────────
export const darkColors = {
  // Surfaces
  surface:      '#0B0F17',
  paper:        '#0B0F17',
  paperDeep:    '#111827',
  clay:         '#1E293B',
  clayLight:    '#111827',
  line:         '#1E293B',
  lineStrong:   '#334155',

  // Text
  ink:          '#F1F5F9',
  inkSoft:      '#94A3B8',
  inkMuted:     '#64748B',

  // Aliases
  umber:        '#F1F5F9',
  umberDeep:    '#94A3B8',

  // Brand (primary — brighter for dark bg)
  teal:         '#3B82F6',
  tealDeep:     '#1E40AF',
  tealTint:     '#0C1E3A',

  // Brand (gold — brighter for dark bg)
  gold:         '#FBBF24',
  goldDeep:     '#D97706',
  goldTint:     '#422006',

  // Brand (red)
  brick:        '#F87171',
  brickTint:    '#3B1111',

  // Semantic
  success:      '#34D399',
  successBg:    '#064E3B',
  warning:      '#FBBF24',
  warningBg:    '#422006',
  danger:       '#F87171',
  dangerBg:     '#3B1111',
  info:         '#60A5FA',
  infoBg:       '#1E3A5F',
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
  const { width: w } = useWindowDimensions();
  if (w < 360) return 16;
  if (w < 390) return 16;
  if (w < 431) return 20;
  return 20;
}

// ─── Shadows ────────────────────────────────────────────────────────────────
export const shadowCard = Platform.select({
  ios:     { shadowColor: N, shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: {},
}) as object;

export const shadowMd = Platform.select({
  ios:     { shadowColor: N, shadowOpacity: 0.08, shadowRadius: 30, shadowOffset: { width: 0, height: 10 } },
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
      case 'PENDING':          return { bg: '#422006', fg: '#FBBF24', border: '#92400E' };
      case 'CONFIRMED':        return { bg: '#064E3B', fg: '#34D399', border: '#065F46' };
      case 'CHECKED_IN':       return { bg: '#1E3A5F', fg: '#60A5FA', border: '#1E40AF' };
      case 'CHECKED_OUT':      return { bg: '#1E293B', fg: '#94A3B8', border: '#334155' };
      case 'CANCELLED':        return { bg: '#3B1111', fg: '#F87171', border: '#7F1D1D' };
      case 'REJECTED':         return { bg: '#3B1111', fg: '#F87171', border: '#7F1D1D' };
      case 'NO_SHOW':          return { bg: '#1E293B', fg: '#94A3B8', border: '#334155' };
      case 'SUCCEEDED':        return { bg: '#064E3B', fg: '#34D399', border: '#065F46' };
      case 'FAILED':           return { bg: '#3B1111', fg: '#F87171', border: '#7F1D1D' };
      case 'REFUNDED':         return { bg: '#1E3A5F', fg: '#60A5FA', border: '#1E40AF' };
      case 'ACTIVE':           return { bg: '#064E3B', fg: '#34D399', border: '#065F46' };
      case 'PENDING_APPROVAL': return { bg: '#422006', fg: '#FBBF24', border: '#92400E' };
      case 'SUSPENDED':        return { bg: '#3B1111', fg: '#F87171', border: '#7F1D1D' };
      case 'DRAFT':            return { bg: '#1E293B', fg: '#94A3B8', border: '#334155' };
      case 'OPEN':             return { bg: '#1E293B', fg: '#94A3B8', border: '#334155' };
      case 'UNDER_REVIEW':     return { bg: '#1E3A5F', fg: '#60A5FA', border: '#1E40AF' };
      case 'RESOLVED':         return { bg: '#064E3B', fg: '#34D399', border: '#065F46' };
      case 'CLOSED':           return { bg: '#1E293B', fg: '#94A3B8', border: '#334155' };
      case 'DISMISSED':        return { bg: '#1E293B', fg: '#94A3B8', border: '#334155' };
      default: return { bg: darkColors.clay, fg: darkColors.inkSoft, border: darkColors.lineStrong };
    }
  }
  switch (status) {
    case 'PENDING':          return { bg: '#FEF9E7', fg: '#92400E', border: '#FDE68A' };
    case 'CONFIRMED':        return { bg: '#ECFDF5', fg: '#065F46', border: '#A7F3D0' };
    case 'CHECKED_IN':       return { bg: '#EFF6FF', fg: '#1E40AF', border: '#BFDBFE' };
    case 'CHECKED_OUT':      return { bg: '#F8FAFC', fg: '#64748B', border: '#E2E8F0' };
    case 'CANCELLED':        return { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' };
    case 'REJECTED':         return { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' };
    case 'NO_SHOW':          return { bg: '#F8FAFC', fg: '#64748B', border: '#E2E8F0' };
    case 'SUCCEEDED':        return { bg: '#ECFDF5', fg: '#065F46', border: '#A7F3D0' };
    case 'FAILED':           return { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' };
    case 'REFUNDED':         return { bg: '#EFF6FF', fg: '#1E40AF', border: '#BFDBFE' };
    case 'ACTIVE':           return { bg: '#ECFDF5', fg: '#065F46', border: '#A7F3D0' };
    case 'PENDING_APPROVAL': return { bg: '#FEF9E7', fg: '#92400E', border: '#FDE68A' };
    case 'SUSPENDED':        return { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' };
    case 'DRAFT':            return { bg: '#F8FAFC', fg: '#64748B', border: '#E2E8F0' };
    case 'OPEN':             return { bg: '#F8FAFC', fg: '#64748B', border: '#E2E8F0' };
    case 'UNDER_REVIEW':     return { bg: '#EFF6FF', fg: '#1E40AF', border: '#BFDBFE' };
    case 'RESOLVED':         return { bg: '#ECFDF5', fg: '#065F46', border: '#A7F3D0' };
    case 'CLOSED':           return { bg: '#F8FAFC', fg: '#64748B', border: '#E2E8F0' };
    case 'DISMISSED':        return { bg: '#F8FAFC', fg: '#64748B', border: '#E2E8F0' };
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
