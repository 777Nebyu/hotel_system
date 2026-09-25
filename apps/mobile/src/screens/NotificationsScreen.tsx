import React, { useCallback, useMemo } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
import { classifyError } from '../errors';
import { SkeletonList } from '../components/Skeleton';
import { colors, font, radius, shadowCard } from '../theme';
import { useTheme } from '../hooks/useTheme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const TYPE_META: Record<string, { icon: string; color: string }> = {
  BOOKING_CREATED:    { icon: '🏨', color: colors.teal },
  booking_created:    { icon: '🏨', color: colors.teal },
  new_booking:        { icon: '📥', color: colors.teal },
  NEW_BOOKING:        { icon: '📥', color: colors.teal },
  booking_confirmation: { icon: '✅', color: '#10B981' },
  booking_cancellation: { icon: '❌', color: '#EF4444' },
  payment_received:   { icon: '💳', color: '#10B981' },
  payment_refunded:   { icon: '↩️', color: '#F59E0B' },
  check_in_reminder:  { icon: '⏰', color: colors.teal },
  manager_assigned:   { icon: '👤', color: colors.teal },
  manager_removed:    { icon: '👤', color: '#EF4444' },
  BOOKING_CONFIRMED:  { icon: '✅', color: '#10B981' },
  BOOKING_CANCELLED:  { icon: '❌', color: '#EF4444' },
  BOOKING_MODIFIED:   { icon: '✏️', color: '#F59E0B' },
  BOOKING_CHECKED_IN: { icon: '🔑', color: '#10B981' },
  BOOKING_CHECKED_OUT:{ icon: '👋', color: colors.inkMuted },
  BOOKING_NO_SHOW:    { icon: '⚠️', color: '#F59E0B' },
  PAYMENT_COMPLETED:  { icon: '💳', color: '#10B981' },
  PAYMENT_RECEIVED:   { icon: '💳', color: '#10B981' },
  PAYMENT_REFUNDED:   { icon: '↩️', color: '#F59E0B' },
  PAYMENT_FAILED:     { icon: '🚫', color: '#EF4444' },
  CHECK_IN_REMINDER:  { icon: '⏰', color: colors.teal },
  CHECKIN_REMINDER:   { icon: '⏰', color: colors.teal },
  WELCOME:            { icon: '👋', color: colors.teal },
  EMAIL_VERIFICATION: { icon: '📧', color: '#3B82F6' },
  PASSWORD_RESET:     { icon: '🔒', color: '#F59E0B' },
  REVIEW_RESPONSE:    { icon: '💬', color: '#8B5CF6' },
  COUPON_EXPIRY:      { icon: '🎫', color: '#EF4444' },
  HOTEL_APPROVED:     { icon: '🏨', color: '#10B981' },
  HOTEL_SUSPENDED:    { icon: '🚫', color: '#EF4444' },
};

type TFn = ReturnType<typeof useTranslation>['t'];

function formatMessage(type: string, payload: Record<string, any> = {}, t?: TFn) {
  const hotel = payload.hotelName || payload.hotel || '';
  const amount = payload.amount ? `ETB ${payload.amount}` : '';
  const tr = (key: string, fallback: string) => (t ? (t(key) || fallback) : fallback);
  const tri = (key: string, fallback: string, opts: Record<string, any>) => (t ? (t(key, opts) || fallback.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? ''))) : fallback.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts[k] ?? '')));
  switch (type) {
    case 'BOOKING_CREATED':
    case 'booking_created':    return { title: tr('notifications.booking_created', 'Booking Created'), body: hotel ? (t ? t('notifications.booking_with_hotel', { hotel }) : `Your booking at ${hotel} has been received.`) : tr('notifications.booking_created_body', 'Your booking has been created.') };
    case 'new_booking':
    case 'NEW_BOOKING':         return { title: tr('notifications.new_booking', 'New Booking'), body: payload.message ?? tr('notifications.booking_created_body', `A new booking was received for ${hotel || 'your hotel'}.`) };
    case 'BOOKING_CONFIRMED':  return { title: tr('notifications.lifecycle.bookingConfirmed.title', 'Booking Confirmed'), body: hotel ? (t ? t('notifications.booking_confirmed_hotel', { hotel }) : `Booking at ${hotel} confirmed.`) : tr('notifications.booking_confirmed_body', 'Your booking is confirmed.') };
    case 'BOOKING_CANCELLED':  return { title: tr('notifications.lifecycle.bookingCancelled.title', 'Booking Cancelled'), body: hotel ? (t ? t('notifications.booking_cancelled_hotel', { hotel }) : `Your booking at ${hotel} was cancelled.`) : tr('notifications.booking_cancelled_body', 'Booking cancelled.') };
    case 'BOOKING_MODIFIED':   return { title: tr('notifications.booking_modified', 'Booking Modified'), body: tr('notifications.booking_modified_body', 'Your booking has been updated.') };
    case 'BOOKING_CHECKED_IN': return { title: tr('notifications.checked_in', 'Checked In'), body: hotel ? (t ? t('notifications.welcome_hotel', { hotel }) : `Welcome to ${hotel}!`) : tr('notifications.checked_in_body', 'You are checked in. Enjoy your stay!') };
    case 'BOOKING_CHECKED_OUT':return { title: tr('notifications.checked_out', 'Checked Out'), body: tr('notifications.checked_out_body', 'We hope you enjoyed your stay.') };
    case 'PAYMENT_COMPLETED':  return { title: tr('notifications.payment_confirmed', 'Payment Confirmed'), body: amount ? tri('notifications.payment_success_body', '{{amount}} received successfully.', { amount }) : tr('notifications.payment_confirmed_body', 'Your payment was confirmed.') };
    case 'PAYMENT_RECEIVED':   return { title: tr('notifications.payment_received', 'Payment Received'), body: amount ? tri('notifications.payment_success_body', '{{amount}} received successfully.', { amount }) : tr('notifications.payment_received_body', 'Your payment was received.') };
    case 'PAYMENT_REFUNDED':   return { title: tr('notifications.payment_refunded', 'Refund Processed'), body: amount ? (t ? t('notifications.refund_on_way', { amount }) : `${amount} refund is on its way.`) : tr('notifications.refund_processed_body', 'Your refund has been processed.') };
    case 'PAYMENT_FAILED':     return { title: tr('notifications.payment_failed', 'Payment Failed'), body: tr('notifications.payment_failed_body', 'Please retry your payment.') };
    case 'CHECK_IN_REMINDER':  return { title: tr('notifications.check_in_tomorrow', 'Check-in Tomorrow'), body: hotel ? (t ? t('notifications.stay_starts_tomorrow', { hotel }) : `Your stay at ${hotel} starts tomorrow.`) : tr('notifications.check_in_tomorrow_body', 'Your check-in is tomorrow.') };
    case 'CHECKIN_REMINDER':   return { title: tr('notifications.lifecycle.checkInReminder.title', 'Check-in Reminder'), body: hotel ? (t ? t('notifications.stay_starts_soon', { hotel }) : `Your stay at ${hotel} starts soon.`) : tr('notifications.check_in_coming', 'Your check-in is coming up.') };
    case 'WELCOME':            return { title: tr('notifications.welcome', 'Welcome!'), body: tr('notifications.welcome_body', 'Welcome to Yayetech Hotel. Start exploring!') };
    case 'EMAIL_VERIFICATION': return { title: tr('notifications.verify_email', 'Verify Your Email'), body: tr('notifications.verify_email_body', 'Please verify your email address to access all features.') };
    case 'PASSWORD_RESET':     return { title: tr('notifications.password_reset', 'Password Reset'), body: tr('notifications.password_reset_body', 'Your password has been reset successfully.') };
    case 'REVIEW_RESPONSE':    return { title: tr('notifications.review_response', 'Review Response'), body: tr('notifications.review_response_body', 'A hotel has responded to your review.') };
    case 'COUPON_EXPIRY':      return { title: tr('notifications.coupon_expiry', 'Coupon Expiring'), body: tr('notifications.coupon_expiry_body', 'Your coupon is about to expire. Use it soon!') };
    case 'HOTEL_APPROVED':     return { title: tr('notifications.hotel_approved', 'Hotel Approved'), body: tr('notifications.hotel_approved_body', 'Your hotel listing has been approved.') };
    case 'HOTEL_SUSPENDED':    return { title: tr('notifications.hotel_suspended', 'Hotel Suspended'), body: tr('notifications.hotel_suspended_body', 'Your hotel listing has been suspended. Please contact support.') };
    default:
      return {
        title: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        body: (payload as any).message ?? tr('notifications.tap_details', 'Tap to view details.'),
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
    // Mark-read is best-effort: an offline user must still be able to open
    // the notification instead of having the tap swallowed by the catch below.
    if (!item.readAt) {
      try {
        await markRead.mutateAsync(item.id);
      } catch { /* offline/failed — item stays unread */ }
    }
    try {
      if (item.payload?.bookingId) {
        const notificationType = String(item.type ?? '').toLowerCase();
        const isBookingNotification = notificationType.startsWith('booking_') || notificationType === 'new_booking';
        const role = session?.user?.role;
        if (isBookingNotification && role === 'ADMIN') {
          navigation.navigate('AdminBookings');
        } else if (isBookingNotification && (role === 'MANAGER' || role === 'STAFF')) {
          navigation.navigate('ManagerBookings');
        } else {
          navigation.navigate('BookingDetail', { bookingId: item.payload.bookingId as string });
        }
      } else {
        const message = item.payload?.message ?? 'There are no additional details for this notification.';
        Alert.alert(t('notifications.notification'), message);
      }
    } catch { /* ignore */ }
  }, [markRead, navigation, session?.user?.role, t]);

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

      {error && <ErrorBox message={classifyError(error).title} onRetry={refetch} />}

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
          const msg = formatMessage(item.type, (item.payload as Record<string, any>) ?? {}, t);
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
                    <Text style={styles.viewLink}>{t('buttons.view_booking_arrow')}</Text>
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
