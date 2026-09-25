import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { useDisputes } from '../hooks/useQueries';
import { ErrorBox } from '../components/Shared';
import { useTheme } from '../hooks/useTheme';

type Nav = NativeStackNavigationProp<RootStackParamList, 'DisputeDetail'>;
type Route = RouteProp<RootStackParamList, 'DisputeDetail'>;

export default function DisputeDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { disputeId } = route.params;
  const insets = useSafeAreaInsets();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';
  const { colors: c } = useTheme();

  // Reuse the disputes list query and find the matching dispute by ID.
  // A dedicated /disputes/:id endpoint should be added to useQueries when the
  // backend exposes it — this is a safe interim implementation.
  const { data, isLoading, error, refetch } = useDisputes(token);
  const role = session?.user?.role;
  const currentUserId = session?.user?.id;
  const allDisputes = (data?.data ?? []) as any[];
  // DISPUTE-001: Customers can only view their own disputes; Admins can view all
  const dispute = role === 'ADMIN'
    ? allDisputes.find((d: any) => d.id === disputeId)
    : allDisputes.find((d: any) => d.id === disputeId && d.customerId === currentUserId);

  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: c.paper },
    content: { paddingHorizontal: 20 },

    backBtn: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, marginBottom: 20,
      backgroundColor: c.surface, borderColor: c.line,
    },

    heading: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginBottom: 20, color: c.ink },

    card: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16, gap: 12,
      backgroundColor: c.surface, borderColor: c.line,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    descRow: { gap: 4 },
    label: { fontSize: 13, fontWeight: '600', flexShrink: 0, color: c.inkMuted },
    value: { fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right', color: c.ink },
    status: { fontWeight: '700', color: c.teal },
    desc: { fontSize: 14, lineHeight: 20, color: c.inkSoft },

    empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 15, color: c.inkMuted },
  });

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
    >
      {/* Back button */}
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={8}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel={t('common.go_back_nav')}
      >
        <Ionicons name="arrow-back" size={22} color={c.ink} />
      </Pressable>

      <Text style={styles.heading}>{t('disputes.detail')}</Text>

      {isLoading && (
        <ActivityIndicator size="large" color={c.teal} style={{ marginTop: 40 }} />
      )}

      {error && (
        <ErrorBox
          message={error instanceof Error ? error.message : t('errors.failed_load_disputes')}
          onRetry={refetch}
        />
      )}

      {!isLoading && !error && !dispute && (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={40} color={c.line} />
          <Text style={styles.emptyText}>{t('disputes.not_found')}</Text>
        </View>
      )}

      {dispute && (
        <View style={styles.card}>
          {/* ID */}
          <View style={styles.row}>
            <Text style={styles.label}>{t('disputes.dispute_id')}</Text>
            <Text style={styles.value} numberOfLines={1}>{dispute.id}</Text>
          </View>

          {/* Type */}
          {dispute.type && (
            <View style={styles.row}>
              <Text style={styles.label}>{t('common.type')}</Text>
              <Text style={styles.value}>{dispute.type}</Text>
            </View>
          )}

          {/* Subject */}
          {dispute.subject && (
            <View style={styles.row}>
              <Text style={styles.label}>{t('common.subject')}</Text>
              <Text style={styles.value}>{dispute.subject}</Text>
            </View>
          )}

          {/* Status */}
          {dispute.status && (
            <View style={styles.row}>
              <Text style={styles.label}>{t('common.status')}</Text>
              <Text style={[styles.value, styles.status]}>{dispute.status}</Text>
            </View>
          )}

          {/* Description */}
          {dispute.description && (
            <View style={styles.descRow}>
              <Text style={styles.label}>{t('common.description')}</Text>
              <Text style={styles.desc}>{dispute.description}</Text>
            </View>
          )}

          {/* Resolution */}
          {dispute.resolution && (
            <View style={styles.descRow}>
              <Text style={styles.label}>{t('disputes.resolution')}</Text>
              <Text style={styles.desc}>{dispute.resolution}</Text>
            </View>
          )}

          {/* Dates */}
          {dispute.createdAt && (
            <View style={styles.row}>
              <Text style={styles.label}>{t('disputes.created')}</Text>
              <Text style={styles.value}>
                {new Date(dispute.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'short', day: 'numeric',
                })}
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
