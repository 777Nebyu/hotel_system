import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useServingCachedData } from '../hooks/useCacheStatus';
import { colors } from '../theme';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const { isOffline } = useNetworkStatus();
  const showingCached = useServingCachedData();

  if (!isOffline && !showingCached) return null;

  if (isOffline) {
    return (
      <View style={styles.banner}>
        <Text style={styles.text}>{t('errors.youre_offline')}</Text>
        {showingCached && (
          <Text style={styles.subtext}>
            {t('errors.showing_saved_data', 'Showing saved data — it may be out of date.')}
          </Text>
        )}
      </View>
    );
  }

  // Online, but the last read was served from the offline cache (e.g. the
  // server was briefly unreachable). Make that visible so stale booking
  // statuses aren't mistaken for fresh ones.
  return (
    <View style={styles.staleBanner}>
      <Text style={styles.staleText}>
        {t('errors.showing_saved_data', 'Showing saved data — it may be out of date.')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.goldDeep, paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' },
  text: { color: colors.surface, fontSize: 12, fontWeight: '600' },
  subtext: { color: colors.surface, fontSize: 11, fontWeight: '500', opacity: 0.9, marginTop: 1 },
  staleBanner: { backgroundColor: '#EFF6FF', paddingVertical: 5, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(37,99,235,0.3)' },
  staleText: { color: '#1D4ED8', fontSize: 11, fontWeight: '600' },
});
