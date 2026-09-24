/**
 * ScreenHeader — OT.md §7 compliant
 *
 * — Dark mode via useTheme
 * — Safe area: top (notch/DI) + horizontal (curved screens)
 * — Back button exactly 44×44 (OT.md §9)
 * — Responsive horizontal padding (OT.md §5)
 * — Status bar style matches background (OT.md §7)
 */
import React from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { useResponsive } from '../hooks/useResponsive';

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
  /** When true: transparent bg, white icons — for hero-image screens */
  transparent?: boolean;
}

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightElement,
  style,
  transparent = false,
}: ScreenHeaderProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors: c, colorScheme } = useTheme();
  const dark   = colorScheme === 'dark';
  const r      = useResponsive();

  const bgColor   = transparent ? 'transparent' : c.surface;
  const iconColor = transparent ? '#FFFFFF' : c.ink;
  const barStyle  = transparent || dark ? 'light-content' : 'dark-content';

  return (
    <>
      <StatusBar
        barStyle={barStyle}
        backgroundColor={transparent ? 'transparent' : bgColor}
        translucent={transparent}
      />
      <View
        style={[
          {
            paddingTop: insets.top + 8,
            paddingBottom: 12,
            // OT.md §5: responsive + respect horizontal safe area
            paddingHorizontal: Math.max(r.pad, insets.left + 12),
            backgroundColor: bgColor,
            borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
            borderBottomColor: transparent ? 'transparent' : c.line,
            zIndex: 10,
          },
          style,
        ]}
      >
        <View style={s.row}>
          {/* Left: back button — 44×44 guaranteed (OT.md §9) */}
          <View style={s.sideSlot}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('common.go_back_nav')}
                style={({ pressed }) => [
                  s.backBtn,
                  { backgroundColor: transparent
                      ? 'rgba(255,255,255,0.15)'
                      : dark ? c.clay : 'rgba(15,23,42,0.06)' },
                  pressed && s.backBtnPressed,
                ]}
              >
                <Ionicons name="arrow-back" size={22} color={iconColor} />
              </Pressable>
            ) : null}
          </View>

          {/* Center: title */}
          <View style={s.centerSlot}>
            {title ? (
              <Text
                style={[
                  s.title,
                  { color: transparent ? '#FFFFFF' : c.ink },
                  { fontSize: r.cardTitle + 1 },
                ]}
                numberOfLines={1}
              >
                {title}
              </Text>
            ) : null}
          </View>

          {/* Right: action */}
          <View style={[s.sideSlot, s.sideRight]}>
            {rightElement ?? null}
          </View>
        </View>

        {/* Subtitle */}
        {subtitle ? (
          <Text
            style={[
              s.subtitle,
              { color: transparent ? 'rgba(255,255,255,0.75)' : c.inkMuted },
              { fontSize: r.caption },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  sideSlot:     { minWidth: 44, alignItems: 'flex-start', justifyContent: 'center' },
  sideRight:    { alignItems: 'flex-end' },
  centerSlot:   { flex: 1, alignItems: 'center' },
  title:        { fontFamily: font.display, fontWeight: '600', letterSpacing: -0.2, textAlign: 'center' },
  subtitle:     { marginTop: 2, textAlign: 'center' },
  backBtn:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  backBtnPressed:{ opacity: 0.7, transform: [{ scale: 0.93 }] },
});
