import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, TextStyle } from 'react-native';
import { colors, shadowCard } from '../theme';
import { hapticMedium } from '../hooks/useHaptics';

export interface FABProps {
  icon?: React.ReactNode | string;
  label?: string;
  onPress: () => void;
  style?: ViewStyle;
  labelStyle?: TextStyle;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  variant?: 'primary' | 'gold' | 'secondary';
  accessibilityLabel?: string;
}

export function FAB({
  icon,
  label,
  onPress,
  style,
  labelStyle,
  position = 'bottom-right',
  variant = 'primary',
  accessibilityLabel,
}: FABProps) {
  const handlePress = () => {
    hapticMedium();
    onPress();
  };

  const posStyle = position === 'bottom-left'
    ? styles.posLeft
    : position === 'bottom-center'
      ? styles.posCenter
      : styles.posRight;

  const bgStyle = variant === 'gold'
    ? styles.bgGold
    : variant === 'secondary'
      ? styles.bgSecondary
      : styles.bgPrimary;

  const isExtended = Boolean(label);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label ?? 'Action button'}
      style={({ pressed }) => [
        styles.fab,
        posStyle,
        bgStyle,
        isExtended ? styles.extended : styles.round,
        shadowCard,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon && (
        typeof icon === 'string' ? (
          <Text style={styles.iconText}>{icon}</Text>
        ) : (
          icon
        )
      )}
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
  posRight: { right: 20 },
  posLeft: { left: 20 },
  posCenter: { alignSelf: 'center' },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  extended: {
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  bgPrimary: { backgroundColor: colors.teal },
  bgGold: { backgroundColor: colors.gold },
  bgSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong },
  pressed: { transform: [{ scale: 0.95 }], opacity: 0.9 },
  iconText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  label: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
});

export default FAB;
