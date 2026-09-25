import React, { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { Button, Card, EmptyState, ErrorBox } from '../components/Shared';
import { SkeletonList } from '../components/Skeleton';
import { useContactThreads } from '../hooks/useQueries';
import { useTheme } from '../hooks/useTheme';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { Ionicons } from '@expo/vector-icons';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const hoursSince = (iso: string) =>
  (Date.now() - new Date(iso).getTime()) / 3_600_000;

export default function ContactInboxScreen() {
  const pad = useResponsivePadding();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';

  const { data, isLoading, error, refetch } = useContactThreads(token);
  const threads = Array.isArray(data) ? data : (data as any)?.data ?? [];
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => { setRefreshing(true); await refetch(); setRefreshing(false); };
  const s = makeStyles(c);

  const header = (
    <>
      <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={s.backBtn}>
        <Ionicons name="arrow-back" size={20} color={c.teal} />
      </Pressable>
      <View style={s.headerRow}>
        <Text style={s.title}>{t('contact.inbox')}</Text>
        <Button title={t('contact.newMessage')} variant="primary" size="sm" onPress={() => navigation.navigate('ContactNew', {})} />
      </View>
    </>
  );

  return (
    <View style={s.container}>
      <FlashList
        data={isLoading || error ? [] : threads}
        keyExtractor={(thread: any) => thread.id}
        contentContainerStyle={[s.content, { paddingHorizontal: pad, paddingTop: insets.top + 12 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={header}
        ListEmptyComponent={isLoading ? <SkeletonList count={5} /> : error ? (
          <ErrorBox message={error instanceof Error ? error.message : t('contact.failed_load')} onRetry={() => refetch()} />
        ) : <EmptyState title={t('contact.noThreads')} subtitle={t('contact.noThreadsSubtitle')} />}
        renderItem={({ item: thread }: { item: any }) => {
          const isClosed = thread.status === 'CLOSED';
          const lastMsg = thread.messages?.[0];
          const lastMsgAt: string | undefined = lastMsg?.createdAt ?? thread.updatedAt ?? thread.createdAt;
          const lastMsgSenderId: string | undefined = lastMsg?.senderId;
          const lastMsgByCustomer: boolean = lastMsgSenderId != null && lastMsgSenderId === session?.user.id;
          const hours = lastMsgAt ? hoursSince(lastMsgAt) : 0;
          const isOverdue = !isClosed && lastMsgByCustomer && hours > 48;
          const isAwaiting = !isClosed && lastMsgByCustomer && hours > 24 && !isOverdue;

          return (
            <Pressable key={thread.id} onPress={() => navigation.navigate('ContactThread', { threadId: thread.id })}>
              <Card style={s.threadCard}>
                <View style={s.threadHeader}>
                  <Text style={s.threadSubject} numberOfLines={1}>{thread.subject}</Text>
                  <View style={s.threadBadges}>
                    {isOverdue && (
                      <View style={[s.slaBadge, s.slaBadgeOverdue]}>
                        <Text style={s.slaBadgeTextOverdue}>{t('contact.overdue')}</Text>
                      </View>
                    )}
                    {isAwaiting && (
                      <View style={[s.slaBadge, s.slaBadgeAwaiting]}>
                        <Text style={s.slaBadgeTextAwaiting}>{t('contact.awaiting_reply')}</Text>
                      </View>
                    )}
                    <View style={[styles.statusDot, isClosed ? { backgroundColor: c.inkMuted } : { backgroundColor: c.teal }]} />
                  </View>
                </View>
                <Text style={s.threadHotel}>{thread.hotel?.name ?? t('contact.hotel')}</Text>
                {lastMsg?.content && <Text style={s.threadPreview} numberOfLines={1}>{lastMsg.content}</Text>}
                <Text style={s.threadDate}>{new Date(thread.createdAt).toLocaleDateString()}</Text>
              </Card>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  content: { paddingBottom: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.paperDeep, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontFamily: 'Georgia', color: c.ink, fontSize: 24, fontWeight: '600' },
  threadCard: { padding: 16, marginBottom: 12 },
  threadHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  threadSubject: { fontFamily: 'Georgia', fontSize: 16, fontWeight: '600', color: c.ink, flex: 1 },
  threadBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  slaBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  slaBadgeAwaiting: { backgroundColor: c.goldTint },
  slaBadgeOverdue: { backgroundColor: c.brickTint },
  slaBadgeTextAwaiting: { fontSize: 10, fontWeight: '700', color: c.goldDeep },
  slaBadgeTextOverdue: { fontSize: 10, fontWeight: '700', color: c.brick },
  threadHotel: { fontSize: 12, color: c.tealDeep, fontWeight: '600', marginBottom: 4 },
  threadPreview: { fontSize: 13, color: c.inkSoft, lineHeight: 18 },
  threadDate: { fontSize: 11, color: c.inkMuted, marginTop: 6 },
});

const styles = StyleSheet.create({
  statusDot: { width: 10, height: 10, borderRadius: 5 },
});
