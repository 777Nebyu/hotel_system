import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { Button, Card, EmptyState, ErrorBox } from '../components/Shared';
import { SkeletonList } from '../components/Skeleton';
import { useContactThreads } from '../hooks/useQueries';
import { colors, font } from '../theme';
import { useResponsivePadding } from '../hooks/useResponsivePadding';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Returns hours since the given ISO timestamp */
const hoursSince = (iso: string) =>
  (Date.now() - new Date(iso).getTime()) / 3_600_000;

export default function ContactInboxScreen() {
  const pad = useResponsivePadding();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';

  const { data, isLoading, error, refetch } = useContactThreads(token);
  const threads = data?.data ?? [];
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingHorizontal: pad }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.backText}>{'< Back'}</Text></Pressable>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('contact.inbox')}</Text>
        <Button title={t('contact.newMessage')} variant="primary" size="sm" onPress={() => navigation.navigate('ContactNew', {})} />
      </View>

      {isLoading ? (
        <SkeletonList count={5} />
      ) : error ? (
        <ErrorBox message="Failed to load messages" onRetry={() => refetch()} />
      ) : threads.length === 0 ? (
        <EmptyState title={t('contact.noThreads')} subtitle={t('contact.noThreadsSubtitle')} />
      ) : (
        threads.map((thread: any) => {
          const isClosed = thread.status === 'CLOSED';
          // L4 — 24h SLA badge: show if open, last message is from customer, and >24h with no reply
          const lastMsgAt: string | undefined = thread.lastMessageAt ?? thread.updatedAt ?? thread.createdAt;
          const lastMsgByCustomer: boolean = thread.lastMessageRole === 'CUSTOMER' || thread.lastMessageBy === session?.user.id;
          const hours = lastMsgAt ? hoursSince(lastMsgAt) : 0;
          const isOverdue = !isClosed && lastMsgByCustomer && hours > 48;
          const isAwaiting = !isClosed && lastMsgByCustomer && hours > 24 && !isOverdue;

          return (
            <Pressable key={thread.id} onPress={() => navigation.navigate('ContactThread', { threadId: thread.id })}>
              <Card style={styles.threadCard}>
                <View style={styles.threadHeader}>
                  <Text style={styles.threadSubject} numberOfLines={1}>{thread.subject}</Text>
                  <View style={styles.threadBadges}>
                    {isOverdue && (
                      <View style={[styles.slaBadge, styles.slaBadgeOverdue]}>
                        <Text style={styles.slaBadgeText}>Overdue</Text>
                      </View>
                    )}
                    {isAwaiting && (
                      <View style={[styles.slaBadge, styles.slaBadgeAwaiting]}>
                        <Text style={styles.slaBadgeText}>Awaiting reply</Text>
                      </View>
                    )}
                    <View style={[styles.statusDot, isClosed ? styles.statusClosed : styles.statusOpen]} />
                  </View>
                </View>
                <Text style={styles.threadHotel}>{thread.hotelName ?? 'Hotel'}</Text>
                {thread.lastMessage && <Text style={styles.threadPreview} numberOfLines={1}>{thread.lastMessage}</Text>}
                <Text style={styles.threadDate}>{new Date(thread.createdAt).toLocaleDateString()}</Text>
              </Card>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 40 },
  backText: { color: colors.teal, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontFamily: font.display, color: colors.ink, fontSize: 24, fontWeight: '600' },
  threadCard: { padding: 16, marginBottom: 12 },
  threadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  threadSubject: { fontFamily: font.display, fontSize: 16, fontWeight: '600', color: colors.ink, flex: 1 },
  threadBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusOpen: { backgroundColor: colors.teal },
  statusClosed: { backgroundColor: colors.inkMuted },
  slaBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  slaBadgeAwaiting: { backgroundColor: '#FEF3C7' },
  slaBadgeOverdue: { backgroundColor: '#FEE2E2' },
  slaBadgeText: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  threadHotel: { fontSize: 12, color: colors.tealDeep, fontWeight: '600', marginBottom: 4 },
  threadPreview: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  threadDate: { fontSize: 11, color: colors.inkMuted, marginTop: 6 },
});
