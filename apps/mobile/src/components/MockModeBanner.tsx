import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import Constants from 'expo-constants';

const DISMISSED_KEY = 'mock_mode_banner_dismissed';

export function useMockMode(): boolean {
  const extra = Constants.expoConfig?.extra ?? (Constants as any).manifest?.extra;
  const env = extra?.eas?.projectId ? 'production' : 'development';
  return env !== 'production';
}

export default function MockModeBanner() {
  useTheme();
  const isDev = useMockMode();
  const [dismissed, setDismissed] = useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY).then((v) => {
      if (v === 'true') setDismissed(true);
    });
  }, []);

  if (!isDev || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem(DISMISSED_KEY, 'true');
  };

  return (
    <View style={[styles.banner, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
      <Text style={styles.icon}>{'\u26A0\uFE0F'}</Text>
      <Text style={[styles.text, { color: '#92400E' }]}>
        MOCK MODE {'\u2014'} NO REAL MONEY IS BEING CHARGED
      </Text>
      <Pressable onPress={dismiss} hitSlop={8} style={styles.closeBtn}>
        <Ionicons name="close" size={14} color="#92400E" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  icon: { fontSize: 12 },
  text: { flex: 1, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  closeBtn: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
