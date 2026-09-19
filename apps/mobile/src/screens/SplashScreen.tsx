import React, { useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { colors, font } from '../theme';
import { Logo } from '../components/Shared';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SplashScreen() {
  const navigation = useNavigation<Nav>();
  const isRestoring = useAppSelector((s) => s.auth.isRestoring);

  useEffect(() => {
    if (!isRestoring) {
      const timer = setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isRestoring, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Logo size={56} showWordmark={false} />
        <Text style={styles.title}>LuxSty</Text>
        <Text style={styles.subtitle}>HOTEL & RESORT COLLECTION</Text>
      </View>
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.teal} />
        <Text style={styles.loadingText}>Loading luxury stays...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: font.display,
    fontSize: 34,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  subtitle: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  footer: {
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: colors.inkMuted,
    fontWeight: '500',
  },
});
