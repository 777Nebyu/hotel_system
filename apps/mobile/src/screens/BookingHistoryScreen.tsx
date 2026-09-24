/**
 * BookingHistoryScreen — Premium "My Bookings" list
 *
 * 3 tabs: Upcoming · Past · Cancelled
 * Each booking rendered as a rich BookingCard with hotel image,
 * status badge, dates, price, and state-appropriate actions.
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { useBookingHistory, useCancelBooking } from '../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorBox } from '../components/Shared';
import { textProps } from '../components/ScaledText';
import {
  BK,
  BookingCard,
  CancellationDialog,
  QRCodeModal,
  SkeletonBookingCard,
} from '../components/BookingComponents';
import { classifyAndAnnounce, classifyError } from '../errors';
import { hapticMedium, hapticSuccess, hapticError } from '../hooks/useHaptics';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { useTheme } from '../hooks/useTheme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'upcoming' | 'past' | 'cancelled';

const TAB_CONFIG: { key: Tab; labelKey: string; emptyTitleKey: string; emptySubKey: string; icon: string }[] = [
  {
    key:          'upcoming',
    labelKey:     'bookingHistory.upcoming',
    emptyTitleKey: 'bookingHistory.empty_upcoming',
    emptySubKey:   'bookingHistory.empty_upcoming_sub',
    icon:         'calendar-outline',
  },
  {
    key:          'past',
    labelKey:     'bookingHistory.past',
    emptyTitleKey: 'bookingHistory.empty_past',
    emptySubKey:   'bookingHistory.empty_past_sub',
    icon:         'checkmark-done-outline',
  },
  {
    key:          'cancelled',
    labelKey:     'bookingHistory.cancelled',
    emptyTitleKey: 'bookingHistory.empty_cancelled',
    emptySubKey:   'bookingHistory.empty_cancelled_sub',
    icon:         'close-circle-outline',
  },
];

export default function BookingHistoryScreen() {
  const { t } = useTranslation();
  const navigation   = useNavigation<Nav>();
  const insets       = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const dark         = colorScheme === 'dark';
  const session      = useAppSelector((s) => s.auth.session);
  const queryClient  = useQueryClient();
  const pad = useResponsivePadding();

  const [tab, setTab] = useState<Tab>('upcoming');
  const activeTab = TAB_CONFIG.find((t) => t.key === tab)!;
  const activeTabLabel = t(activeTab.labelKey);

  // For cancelled tab, map to 'past' scope and filter client-side
  const scope = tab === 'cancelled' ? 'past' : tab;
  const { data, isLoading, error, refetch, isRefetching } = useBookingHistory(
    session?.accessToken ?? '',
    scope as 'upcoming' | 'past',
  );
  const cancelMutation = useCancelBooking(session?.accessToken ?? '');

  const allBookings = data?.data ?? [];
  const bookings = tab === 'cancelled'
    ? allBookings.filter((b) => b.status === 'CANCELLED' || b.status === 'NO_SHOW')
    : allBookings.filter((b) => b.status !== 'CANCELLED' && b.status !== 'NO_SHOW');

  const [cancellingBooking, setCancellingBooking] = useState<any | null>(null);
  const [qrBooking, setQrBooking] = useState<any | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const confirmCancel = async () => {
    if (!cancellingBooking) return;
    setIsCancelling(true);
    const target = cancellingBooking;
    const previous = queryClient.getQueryData<any>(['bookings', scope]);
    queryClient.setQueryData(['bookings', scope], (old: any) => ({
      ...old,
      data: (old?.data ?? []).filter((b: any) => b.id !== target.id),
    }));
    try {
      await cancelMutation.mutateAsync(target.id);
      hapticSuccess();
      setCancellingBooking(null);
      Alert.alert(t('bookingHistory.cancelled'), t('bookingHistory.bookingCancelled'));
      void refetch();
    } catch (err) {
      hapticError();
      queryClient.setQueryData(['bookings', scope], previous);
      const c = classifyAndAnnounce(err);
      Alert.alert(t('bookingHistory.could_not_cancel'), c.title);
    } finally {
      setIsCancelling(false);
    }
  };

  // ── Colors ──────────────────────────────────────────────────────────────
  const bg      = dark ? '#0D1B2A' : BK.bg;
  const surface = dark ? '#152233' : BK.white;
  const textPri = dark ? '#F0F4F8' : BK.navy;
  const textSec = dark ? '#8FA1B3' : BK.textSec;
  const borderC = dark ? '#1F3448' : BK.border;

  const renderItem = useCallback(({ item }: { item: any; index: number }) => {
    if (!item) return <View style={s.skeletonWrap}><SkeletonBookingCard /></View>;
    const cancellable = (item.status === 'CONFIRMED' || item.status === 'PENDING') && tab === 'upcoming';
    return (
      <View style={s.cardWrap}>
        <BookingCard
            booking={item}
            onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
            showCancelButton={cancellable}
            onCancel={() => {
              hapticMedium();
              setCancellingBooking(item);
            }}
            onShowQR={() => setQrBooking(item)}
            onCompletePayment={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
            onContactReception={() => navigation.navigate('ContactNew' as any)}
            onLeaveReview={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
          />
      </View>
    );
  }, [tab, navigation]);

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={[s.header, { paddingTop: insets.top + 10, backgroundColor: surface, borderBottomColor: borderC }]}>
        <View style={s.headerRow}>
          <View>
            <Text {...textProps} style={[s.title, { color: textPri }]}>{t('bookingHistory.title')}</Text>
            <Text style={[s.subtitle, { color: textSec }]}>
              {bookings.length > 0 ? `${bookings.length} ${activeTabLabel.toLowerCase()}` : 'Manage your stays'}
            </Text>
          </View>
          <View style={s.headerActions}>
            <Pressable
              onPress={() => navigation.navigate('PaymentHistory')}
              style={[s.headerBtn, { backgroundColor: dark ? '#1F3448' : BK.bg, borderColor: borderC }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.payment_history')}
            >
              <Ionicons name="wallet-outline" size={20} color={textPri} />
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('Search')}
              style={[s.headerBtn, { backgroundColor: dark ? '#1F3448' : BK.bg, borderColor: borderC }]}
              accessibilityRole="button"
              accessibilityLabel={t('common.find_hotels')}
            >
              <Ionicons name="search-outline" size={20} color={textPri} />
            </Pressable>
          </View>
        </View>

        {/* Tab pills */}
        <View style={s.tabs}>
          {TAB_CONFIG.map((cfg) => {
            const isActive = cfg.key === tab;
            return (
              <Pressable
                key={cfg.key}
                onPress={() => setTab(cfg.key)}
                style={[
                  s.tab,
                  isActive && { backgroundColor: BK.navy },
                  !isActive && { backgroundColor: dark ? '#1F3448' : BK.bg, borderColor: borderC },
                ]}
                accessibilityRole="tab"
                accessibilityLabel={t(cfg.labelKey)}
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[s.tabText, { color: isActive ? BK.white : textSec }]}>
                  {t(cfg.labelKey)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {error && (
        <View style={s.errorWrap}>
          <ErrorBox message={classifyError(error).title} onRetry={refetch} />
        </View>
      )}

      {/* ── List ────────────────────────────────────────────────────────── */}
      <FlashList
        data={isLoading ? (Array(3).fill(null) as null[]) : bookings}
        keyExtractor={(item, i) => (item ? item.id : `sk-${i}`)}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24, paddingHorizontal: pad }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={BK.navy}
            colors={[BK.navy]}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: dark ? '#1F3448' : BK.bgDeep }]}>
                <Ionicons name={activeTab.icon as any} size={32} color={dark ? '#8FA1B3' : BK.navySubtle} />
              </View>
              <Text style={[s.emptyTitle, { color: textPri }]}>{t(activeTab.emptyTitleKey)}</Text>
              <Text style={[s.emptySub, { color: textSec }]}>{t(activeTab.emptySubKey)}</Text>
              {tab === 'upcoming' && (
                <Pressable
                  style={s.searchHotels}
                  onPress={() => navigation.navigate('Search')}
                  accessibilityRole="button"
                >
                  <Text style={s.searchHotelsText}>{t('common.find_hotels')}</Text>
                </Pressable>
              )}
            </View>
          )
        }
        renderItem={renderItem}
      />

      {/* Cancellation Dialog Modal (§28, §29) */}
      {cancellingBooking && (
        <CancellationDialog
          visible={!!cancellingBooking}
          hotelName={cancellingBooking.hotel?.name ?? t('common.hotel')}
          roomType={cancellingBooking.details?.[0]?.room?.type}
          bookingRef={cancellingBooking.reference ?? `#${cancellingBooking.id.slice(0, 8).toUpperCase()}`}
          checkIn={cancellingBooking.checkIn ? cancellingBooking.checkIn.slice(0, 10) : ''}
          checkOut={cancellingBooking.checkOut ? cancellingBooking.checkOut.slice(0, 10) : ''}
          totalPrice={cancellingBooking.totalPrice}
          cancellationHours={cancellingBooking.cancellationHours ?? 24}
          isCashAtHotel={cancellingBooking.payment?.method === 'CASH_AT_HOTEL'}
          loading={isCancelling}
          onConfirmCancel={confirmCancel}
          onKeepBooking={() => setCancellingBooking(null)}
        />
      )}

      {/* Dedicated QR Code Modal (§40) */}
      {qrBooking && (
        <QRCodeModal
          visible={!!qrBooking}
          bookingRef={qrBooking.reference ?? `#${qrBooking.id.slice(0, 8).toUpperCase()}`}
          guestName={qrBooking.details?.[0]?.guestInfo?.fullName ?? session?.user?.fullName}
          hotelName={qrBooking.hotel?.name ?? t('common.hotel')}
          checkIn={qrBooking.checkIn ? qrBooking.checkIn.slice(0, 10) : ''}
          checkOut={qrBooking.checkOut ? qrBooking.checkOut.slice(0, 10) : ''}
          onClose={() => setQrBooking(null)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // ── Header
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
  },
  title:    { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, lineHeight: 34 },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },

  // ── Tabs
  tabs:    { flexDirection: 'row', gap: 8, paddingBottom: 14, paddingTop: 4 },
  tab:     { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1 },
  tabText: { fontSize: 13, fontWeight: '700' },

  // ── List
  list:        { padding: 16, gap: 0 },
  cardWrap:    { marginBottom: 14 },
  skeletonWrap:{ marginBottom: 14 },

  // ── Error
  errorWrap: { paddingTop: 8 },

  // ── Empty
  empty:        { alignItems: 'center', paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyIcon:    { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', textAlign: 'center', letterSpacing: -0.2 },
  emptySub:     { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  searchHotels: { marginTop: 8, backgroundColor: BK.navy, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  searchHotelsText: { color: BK.white, fontWeight: '700', fontSize: 15 },
});
