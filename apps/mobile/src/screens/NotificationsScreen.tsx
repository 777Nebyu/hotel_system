import React, { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/useQueries';
import { EmptyState, ErrorBox } from '../components/Shared';
import { SkeletonList } from '../components/Skeleton';
import { colors, font, radius, shadowCard } from '../theme';
import { useTheme } from '../hooks/useTheme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_META: Record<string, { icon: string; color: string }> = {
  BOOKING_CREATED:    { icon: '🏨', color: colors.teal },
  BOOKING_CONFIRMED:  { icon: '✅', color: '#16A34A' },
  BOOKING_CANCELLED:  { icon: '❌', color: '#EF4444' },
  BOOKING_MODIFIED:   { icon: '✏️', color: '#F59E0B' },
  BOOKING_CHECKED_IN: { icon: '🔑', color: '#16A34A' },
  BOOKING_CHECKED_OUT:{ icon: '👋', color: colors.inkMuted },
  BOOKING_NO_SHOW:    { icon: '⚠️', color: '#F59E0B' },
  PAYMENT_COMPLETED:  { icon: '💳', color: '#16A34A' },
  PAYMENT_REFUNDED:   { icon: '↩️', color: '#F59E0B' },
  PAYMENT_FAILED:     { icon: '🚫', color: '#EF4444' },
  CHECK_IN_REMINDER:  { icon: '⏰', color: colors.teal },
};

function formatMessage(type: string, payload: Record<string, any> = {}) {
  const hotel = payload.hotelName || payload.hotel || '';
  const amount = payload.amount ? `ETB ${payload.amount}` : '';
  switch (type) {
    case 'BOOKING_CREATED':    return { title: 'Booking Created', body: hotel ? `Your booking at ${hotel} is confirmed.` : 'Your booking has been created.' };
    case 'BOOKING_CONFIRMED':  return { title: 'Booking Confirmed', body: hotel ? `Booking at ${hotel} confirmed.` : 'Your booking is confirmed.' };
    case 'BOOKING_CANCELLED':  return { title: 'Booking Cancelled', body: hotel ? `Your booking at ${hotel} was cancelled.` : 'Booking cancelled.' };
    case 'BOOKING_MODIFIED':   return { title: 'Booking Modified', body: 'Your booking has been updated.' };
    case 'BOOKING_CHECKED_IN': return { title: 'Checked In', body: hotel ? `Welcome to ${hotel}!` : 'You are checked in. Enjoy your stay!' };
    case 'BOOKING_CHECKED_OUT':return { title: 'Checked Out', body: 'We hope you enjoyed your stay.' };
    case 'PAYMENT_COMPLETED':  return { title: 'Payment Confirmed', body: amount ? `${amount} received successfully.` : 'Your payment was confirmed.' };
    case 'PAYMENT_REFUNDED':   return { title: 'Refund Processed', body: amount ? `${amount} refund is on its way.` : 'Your refund has been processed.' };
    case 'PAYMENT_FAILED':     return { title: 'Payment Failed', body: 'Please retry your payment.' };
    case 'CHECK_IN_REMINDER':  return { title: 'Check-in Tomorrow', body: hotel ? `Your stay at ${hotel} starts tomorrow.` : 'Your check-in is tomorrow.' };
    default:
      return {
        title: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        body: (payload as any).message ?? 'Tap to view details.',
      };
  }
}

const makeStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },

  /* ─── Header ─── */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    backgroundColor: c.surface,
    borderBottomColor: c.line,
  },
  title: {
    fontFamily: font.display,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.4,
    color: c.ink,
  },
  subtitle: { fontSize: 13, marginTop: 2, color: c.inkMuted },
  markAllBtn: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 4,
    backgroundColor: c.tealTint,
  },
  markAllText: { fontSize: 12, fontWeight: '700', color: c.teal },

  /* ─── List ─── */
  list: { padding: 16, gap: 10 },

  /* ─── Card ─── */
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    backgroundColor: c.surface,
    borderColor: c.line,
  },
  cardUnread: {
    borderColor: c.teal + '50',
    backgroundColor: c.tealTint,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconText: { fontSize: 20 },
  cardBody: { flex: 1, gap: 3 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  notifTitle: {
    fontFamily: font.display,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    color: c.ink,
  },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.teal },
  dateText: { fontSize: 11, color: c.inkMuted },
  notifBody: { fontSize: 13, lineHeight: 18, color: c.inkMuted },
  viewLink: { fontSize: 12, fontWeight: '700', marginTop: 2, color: c.teal },
});

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const navigation = useNavigation<Nav>();
  const session = useAppSelector((s) => s.auth.session);
  const { data, isLoading, error, refetch, isRefetching } = useNotifications(session?.accessToken ?? '');
  const markRead = useMarkNotificationRead(session?.accessToken ?? '');
  const markAllRead = useMarkAllNotificationsRead(session?.accessToken ?? '');
  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((n: any) => !n.readAt).length;

  const styles = useMemo(() => makeStyles(c), [c]);

  const handlePress = useCallback(async (item: any) => {
    try {
      if (!item.readAt) await markRead.mutateAsync(item.id);
      if (item.payload?.bookingId) {
        navigation.navigate('BookingDetail', { bookingId: item.payload.bookingId as string });
      }
    } catch { /* ignore */ }
  }, [markRead, navigation]);

  return (
    <View style={styles.container}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('notifications.title', 'Notifications')}</Text>
          {unreadCount > 0 && (
            <Text style={styles.subtitle}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable
            onPress={() => markAllRead.mutate()}
            style={({ pressed }) => [styles.markAllBtn, pressed && { opacity: 0.7 }]}
            hitSlop={6}
          >
            <Text style={styles.markAllText}>
              {t('notifications.markAllRead', 'Mark all read')}
            </Text>
          </Pressable>
        )}
      </View>

      {error && <ErrorBox message={error.message} onRetry={refetch} />}

      <FlashList
        data={notifications}
        keyExtractor={(n: any) => n.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={c.teal}
            colors={[c.teal]}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={4} />
          ) : (
            <EmptyState
              title={t('notifications.noNotifications', 'All caught up')}
              subtitle={t('notifications.allCaughtUp', "You don't have any notifications yet.")}
            />
          )
        }
        renderItem={({ item }) => {
          const meta = TYPE_META[item.type] ?? { icon: '🔔', color: c.teal };
          const msg = formatMessage(item.type, (item.payload as Record<string, any>) ?? {});
          const isUnread = !item.readAt;
          return (
            <Pressable
              onPress={() => handlePress(item)}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <View style={[styles.card, shadowCard, isUnread && styles.cardUnread]}>
                {/* Icon circle */}
                <View style={[styles.iconCircle, { backgroundColor: meta.color + '18' }]}>
                  <Text style={styles.iconText}>{meta.icon}</Text>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.notifTitle} numberOfLines={1}>{msg.title}</Text>
                    <View style={styles.cardRight}>
                      {isUnread && <View style={styles.unreadDot} />}
                      <Text style={styles.dateText}>
                        {new Date(item.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.notifBody} numberOfLines={2}>{msg.body}</Text>
                  {item.payload?.bookingId && (
                    <Text style={styles.viewLink}>View booking →</Text>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
