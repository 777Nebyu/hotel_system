/**
 * booking/BookingStatusBadge.tsx
 * Small status badge used everywhere a booking status is displayed.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getConfig } from './_shared';

export function BookingStatusBadge({
  status, size = 'md',
}: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const c   = getConfig(status);
  const pad = size === 'sm' ? { px: 8, py: 3 } : size === 'lg' ? { px: 14, py: 7 } : { px: 10, py: 5 };
  const fs  = size === 'sm' ? 10 : size === 'lg' ? 14 : 12;
  const is  = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;
  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: c.bg, borderColor: c.border, paddingHorizontal: pad.px, paddingVertical: pad.py },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Booking status: ${c.label}`}
    >
      <Ionicons name={c.icon as any} size={is} color={c.color} />
      <Text style={[styles.text, { color: c.color, fontSize: fs }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  text: { fontWeight: '700', letterSpacing: 0.3 },
});
