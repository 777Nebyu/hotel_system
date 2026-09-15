import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { colors } from '../theme';

export default function OfflineBanner() {
  const { isOffline } = useNetworkStatus();
  if (!isOffline) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{'You\'re offline.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.goldDeep, paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' },
  text: { color: colors.surface, fontSize: 12, fontWeight: '600' },
});
