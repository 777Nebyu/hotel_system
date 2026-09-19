import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, font, radius, shadowCard, statusStyle } from '../theme';
import { useTheme } from '../hooks/useTheme';
import type { ErrorCategory, ClassifiedError } from '../errors';

// ─── Helpers ────────────────────────────────────────────────────────────────
function useC() {
  return useTheme().colors;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

// OT.md §9: min 44×44, preferred 48
export const Button = React.memo(function Button({
  title, onPress, variant = 'primary', size = 'md',
  disabled, loading, accessibilityLabel, fullWidth = false,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  fullWidth?: boolean;
}) {
  const c = useC();
  const bg: Record<ButtonVariant, string> = {
    primary:   c.teal,
    secondary: 'transparent',
    ghost:     'transparent',
    danger:    c.brick,
    gold:      c.gold,
  };
  const fg: Record<ButtonVariant, string> = {
    primary:   '#FFFFFF',
    secondary: c.ink,
    ghost:     c.inkSoft,
    danger:    '#FFFFFF',
    gold:      '#FFFFFF',
  };
  const bd: Record<ButtonVariant, string | undefined> = {
    primary:   undefined,
    secondary: c.lineStrong,
    ghost:     undefined,
    danger:    undefined,
    gold:      undefined,
  };
  // OT.md §9: sm must still be 44px tall
  const heights = { sm: 44, md: 48, lg: 52 };
  const hPad    = { sm: 16, md: 22, lg: 28 };

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.card,
          minHeight: heights[size],
          paddingHorizontal: hPad[size],
          backgroundColor: bg[variant],
          borderWidth: bd[variant] ? 1.5 : 0,
          borderColor: bd[variant],
          opacity: (disabled || loading) ? 0.5 : pressed ? 0.85 : 1,
          ...(fullWidth ? { width: '100%' } : {}),
        },
        pressed && { transform: [{ scale: 0.98 }] },
      ]}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={fg[variant]}
          style={{ marginRight: 8 }}
        />
      )}
      <Text
        style={{
          color: fg[variant],
          fontWeight: '700',
          fontSize: size === 'sm' ? 14 : size === 'lg' ? 16 : 15,
          letterSpacing: -0.1,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
});

export const Card = React.memo(function Card({
  children, style, accessibilityLabel,
}: { children: React.ReactNode; style?: any; accessibilityLabel?: string }) {
  const c = useC();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: c.line,
          padding: 16,
        },
        shadowCard,
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );
});

export const Badge = React.memo(function Badge({
  label, status,
}: { label?: string; status?: string }) {
  const cfg = statusStyle(status ?? label ?? '');
  const display = (label ?? status ?? '').replace(/_/g, ' ');
  return (
    <View
      style={{
        borderRadius: radius.pill,
        borderWidth: 1,
        paddingHorizontal: 9,
        paddingVertical: 3,
        alignSelf: 'flex-start',
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
      }}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${display}`}
    >
      <Text style={{ color: cfg.fg, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' }}>
        {display}
      </Text>
    </View>
  );
});

export const Stars = React.memo(function Stars({
  value, size = 14,
}: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <Text
      style={{ fontSize: size, color: colors.gold, letterSpacing: 1 }}
      accessibilityLabel={`${clamped} out of 5 stars`}
    >
      {'★'.repeat(clamped)}{'☆'.repeat(5 - clamped)}
    </Text>
  );
});

// OT.md §19 — rich empty state, responsive, accessible
export const EmptyState = React.memo(function EmptyState({
  title, subtitle, icon, actionTitle, onAction,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode | string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  const c = useC();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 }}>
      {icon ? (
        typeof icon === 'string'
          ? <Text style={{ fontSize: 44, marginBottom: 14 }}>{icon}</Text>
          : <View style={{ marginBottom: 14 }}>{icon}</View>
      ) : null}
      <Text style={{
        color: c.ink, fontSize: 18, fontWeight: '700',
        textAlign: 'center', lineHeight: 24, marginBottom: 8,
      }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{
          color: c.inkSoft, fontSize: 14, lineHeight: 20,
          textAlign: 'center',
        }}>
          {subtitle}
        </Text>
      )}
      {actionTitle && onAction && (
        <View style={{ marginTop: 20 }}>
          <Button title={actionTitle} size="md" variant="primary" onPress={onAction} />
        </View>
      )}
    </View>
  );
});

// OT.md §20 — friendly error, no technical language
export const ErrorBox = React.memo(function ErrorBox({
  message, onRetry,
}: { message: string; onRetry?: () => void }) {
  const c = useC();
  return (
    <View style={{
      marginHorizontal: 16, marginVertical: 10,
      backgroundColor: c.brickTint,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.25)',
      padding: 16,
      gap: 10,
    }}>
      <Text style={{ color: c.brick, fontSize: 14, lineHeight: 20 }}>
        {message}
      </Text>
      {onRetry && (
        <Button title="Try again" variant="secondary" size="sm" onPress={onRetry} />
      )}
    </View>
  );
});

// ─── ERR-004: Field-level validation errors ─────────────────────────────────

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text
      style={{ color: colors.brick, fontSize: 12, marginTop: 3, marginLeft: 2 }}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      {message}
    </Text>
  );
}

// ─── ERR-002/011/012: Category-aware error box ──────────────────────────────

export function CategoryErrorBox({ error, onRetry }: { error: ClassifiedError; onRetry?: () => void }) {
  const showRetry = error.retryable && onRetry;
  return (
    <Card style={[styles.errorBox, CATEGORY_BORDER[error.category]]}>
      <Text style={styles.errorText}>{error.title}</Text>
      {showRetry && (
        <Button title={error.action ?? 'Try again'} variant="secondary" size="sm" onPress={onRetry} />
      )}
      {!showRetry && error.action && (
        <Text style={styles.errorActionHint}>{error.action}</Text>
      )}
    </Card>
  );
}

// ─── ERR-003/015: Network-specific error (distinct visual from server) ──────

export function NetworkErrorBox({ onRetry }: { onRetry?: () => void }) {
  return (
    <Card style={styles.networkErrorBox}>
      <Text style={styles.networkErrorIcon}>📡</Text>
      <Text style={styles.networkErrorTitle}>{`You're offline`}</Text>
      <Text style={styles.networkErrorText}>Please check your connection and try again.</Text>
      {onRetry && <Button title="Try again" variant="secondary" size="sm" onPress={onRetry} />}
    </Card>
  );
}

// ─── ERR-014: Maintenance banner ────────────────────────────────────────────

export function MaintenanceBanner({ message }: { message?: string }) {
  return (
    <View style={styles.maintenanceBanner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Text style={styles.maintenanceIcon}>🔧</Text>
      <Text style={styles.maintenanceText}>
        {message ?? 'The platform is temporarily unavailable for maintenance. Please check back later.'}
      </Text>
    </View>
  );
}

// ─── ERR-016: Full-screen error (dead ends only) ────────────────────────────

export function FullScreenError({ error, onRetry }: { error: ClassifiedError; onRetry?: () => void }) {
  return (
    <View style={styles.fullScreenError}>
      <Text style={styles.fullScreenErrorTitle}>{error.title}</Text>
      {error.retryable && onRetry && (
        <Button title={error.action ?? 'Try again'} onPress={onRetry} />
      )}
    </View>
  );
}

const CATEGORY_BORDER: Record<ErrorCategory, object> = {
  validation: { borderColor: 'rgba(255,152,0,0.4)', backgroundColor: '#FFF3E0' },
  auth: { borderColor: 'rgba(156,39,176,0.3)', backgroundColor: '#F3E5F5' },
  permission: { borderColor: 'rgba(156,39,176,0.3)', backgroundColor: '#F3E5F5' },
  conflict: { borderColor: 'rgba(255,152,0,0.4)', backgroundColor: '#FFF3E0' },
  payment: { borderColor: 'rgba(220,38,38,0.3)', backgroundColor: '#FEF2F2' },
  network: { borderColor: 'rgba(33,150,243,0.3)', backgroundColor: '#E3F2FD' },
  server: { borderColor: 'rgba(166,58,43,0.3)', backgroundColor: colors.brickTint },
  maintenance: { borderColor: 'rgba(255,152,0,0.4)', backgroundColor: '#FFF3E0' },
};

export function Loader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color={colors.teal} />
    </View>
  );
}

export function WovenDivider({ tone = 'teal', height = 8, style }: { tone?: 'teal' | 'gold' | 'umber'; height?: number; style?: any }) {
  const toneColors: Record<string, string[]> = {
    teal: [colors.teal, colors.gold, colors.umber],
    gold: [colors.gold, colors.teal, colors.umber],
    umber: [colors.umber, colors.teal, colors.gold],
  };
  const palette = toneColors[tone] ?? toneColors.teal;
  const unit = height;
  const half = unit / 2;
  const cols = 20;

  return (
    <View style={[{ flexDirection: 'row', height: unit, overflow: 'hidden', alignItems: 'center' }, style]} accessibilityRole="none" accessibilityLabel="">
      {Array.from({ length: cols }).map((_, i) => {
        const color = palette[i % palette.length];
        return (
          <View key={i} style={{ width: unit, height: unit, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderLeftWidth: half, borderRightWidth: half, borderTopWidth: half, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color }} />
            <View style={{ position: 'absolute', bottom: 0, left: 0, width: 0, height: 0, borderLeftWidth: half, borderRightWidth: half, borderBottomWidth: half, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color, opacity: 0.5 }} />
          </View>
        );
      })}
    </View>
  );
}

export function Logo({ size = 30, showWordmark = true }: { size?: number; showWordmark?: boolean }) {
  return (
    <View style={styles.logoRow}>
      <View style={[styles.logoMark, { width: size, height: size, borderRadius: size * 0.22 }]}>
        <Text style={[styles.logoGlyph, { fontSize: size * 0.5 }]}>Y</Text>
      </View>
      {showWordmark && <Text style={styles.logoWord}>LuxSty</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Legacy style references kept for WovenDivider, Logo, NetworkErrorBox, etc.
  errorBox: { marginHorizontal: 16, marginVertical: 10, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: colors.brickTint, gap: 10, alignItems: 'flex-start' },
  errorText: { color: colors.brick, fontSize: 13, lineHeight: 19 },
  errorActionHint: { color: colors.inkMuted, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  networkErrorBox: { marginHorizontal: 16, marginVertical: 10, borderColor: 'rgba(37,99,235,0.3)', backgroundColor: '#EFF6FF', gap: 8, alignItems: 'center' },
  networkErrorIcon: { fontSize: 28 },
  networkErrorTitle: { color: '#1E40AF', fontSize: 15, fontWeight: '700' },
  networkErrorText: { color: '#1D4ED8', fontSize: 13, textAlign: 'center' },
  maintenanceBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', borderBottomWidth: 1, borderBottomColor: '#FDE68A', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  maintenanceIcon: { fontSize: 18 },
  maintenanceText: { color: '#D97706', fontSize: 13, fontWeight: '600', flex: 1 },
  fullScreenError: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  fullScreenErrorTitle: { color: colors.ink, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoMark: { backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  logoGlyph: { color: '#FFFFFF', fontWeight: '800' },
  logoWord: { fontFamily: font.display, fontSize: 22, fontWeight: '600', color: colors.ink, letterSpacing: -0.4 },
});
