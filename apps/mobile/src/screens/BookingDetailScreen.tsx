/**
 * BookingDetailScreen — Complete booking lifecycle detail
 *
 * Covers all states: PENDING · CONFIRMED · CHECKED_IN · CHECKED_OUT
 *                    CANCELLED · NO_SHOW
 *
 * Features:
 *  — StatusHero with friendly title and description
 *  — RoomSummaryCard with hotel image
 *  — DateStrip (check-in → check-out)
 *  — BookingTimeline (adapts to Cash-at-Hotel)
 *  — PriceBreakdown
 *  — PaymentStatusRow + complete payment CTA
 *  — CancellationPolicy (live refund tier)
 *  — QRCodeCard (CONFIRMED only, toggle)
 *  — State-aware action buttons
 *  — Status history (expandable)
 *  — Review action after CHECKED_OUT
 *  — Dark mode throughout
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { request, requestBlob } from '../api';
import { classifyAndAnnounce } from '../errors';
import { ErrorBox } from '../components/Shared';
import { SkeletonDetail } from '../components/Skeleton';
import type { Booking, Review } from '../types';
import { hapticSuccess, hapticError, hapticMedium } from '../hooks/useHaptics';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { addBookingToCalendar } from '../lib/calendar';
import { useTheme } from '../hooks/useTheme';
import {
  BK,
  ActionButton,
  BookingStatusBadge,
  BookingTimeline,
  CancellationPolicy,
  CancellationDialog,
  DateStrip,
  HoldTimer,
  PaymentStatusRow,
  PriceBreakdown,
  QRCodeCard,
  QRCodeModal,
  RefundStatus,
  RefundTimeline,
  type RefundState,
  RoomSummaryCard,
  SectionCard,
  STATUS_CONFIG,
  StatusHero,
} from '../components/BookingComponents';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'BookingDetail'>;

// ─── State-aware action map ──────────────────────────────────────────────────
function getActions(status: string, canCancel: boolean): {
  key: string; label: string; icon: string;
  variant: 'primary' | 'secondary' | 'danger' | 'ghost';
}[] {
  switch (status) {
    case 'PENDING':
      return [
        { key: 'payment', label: 'Complete Payment', icon: 'card-outline', variant: 'primary' },
        ...(canCancel ? [{ key: 'cancel', label: 'Cancel Booking', icon: 'close-circle-outline', variant: 'danger' as const }] : []),
      ];
    case 'CONFIRMED':
      return [
        { key: 'qr',      label: 'Show QR Code',    icon: 'qr-code-outline',    variant: 'primary'   },
        { key: 'modify',  label: 'Modify Booking',   icon: 'create-outline',     variant: 'secondary' },
        { key: 'calendar',label: 'Add to Calendar',  icon: 'calendar-outline',   variant: 'secondary' },
        { key: 'contact', label: 'Contact Hotel',    icon: 'chatbubble-outline', variant: 'secondary' },
        ...(canCancel ? [{ key: 'cancel', label: 'Cancel Booking', icon: 'close-circle-outline', variant: 'danger' as const }] : []),
      ];
    case 'CHECKED_IN':
      return [
        { key: 'services', label: 'Hotel Services',    icon: 'grid-outline',  variant: 'primary'   },
        { key: 'contact',  label: 'Contact Reception', icon: 'call-outline',  variant: 'secondary' },
      ];
    case 'CHECKED_OUT':
      return [
        { key: 'receipt', label: 'View Receipt',     icon: 'receipt-outline',  variant: 'primary'   },
        { key: 'invoice', label: 'Download Invoice', icon: 'download-outline', variant: 'secondary' },
        { key: 'review',  label: 'Leave a Review',   icon: 'star-outline',     variant: 'secondary' },
      ];
    case 'CANCELLED':
      return [
        { key: 'search', label: 'Find Another Room', icon: 'search-outline', variant: 'primary' },
      ];
    case 'NO_SHOW':
      return [
        { key: 'dispute', label: 'Dispute No-Show', icon: 'alert-circle-outline', variant: 'secondary' },
        { key: 'contact', label: 'Contact Support', icon: 'chatbubble-outline', variant: 'secondary' },
      ];
    default:
      return [];
  }
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function BookingDetailScreen() {
  const navigation    = useNavigation<Nav>();
  const route         = useRoute<Route>();
  const bookingId     = route.params.bookingId;
  const session       = useAppSelector((s) => s.auth.session);
  const token         = session?.accessToken ?? '';
  const { isOffline } = useNetworkStatus();
  const insets        = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const dark          = colorScheme === 'dark';

  const [booking,       setBooking]       = useState<Booking | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [myReview,      setMyReview]      = useState<Review | null>(null);
  const [showQR]        = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showQRModal,   setShowQRModal]   = useState(false);
  const [busy,          setBusy]          = useState<string | null>(null);
  const [historyOpen,   setHistoryOpen]   = useState(false);
  const [statusHistory, setStatusHistory] = useState<
    { status: string; reason?: string; createdAt: string }[]
  >([]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setError(null);
    try {
      let b: Booking | null = null;
      try {
        b = await request<Booking>(`/bookings/${bookingId}`, { token });
      } catch {
        const res = await request<{ data: Booking[] }>('/bookings/my', { token });
        b = (res.data ?? []).find((x) => x.id === bookingId) ?? null;
      }
      setBooking(b);
      if (!b) { setError('Booking not found.'); return; }

      // Status history — non-blocking
      request<{ data: typeof statusHistory }>(
        `/bookings/${bookingId}/status-history`, { token },
      ).then((r) => setStatusHistory(r.data ?? [])).catch(() => {});

      // Review — only after checkout
      if (b.status === 'CHECKED_OUT' && session?.user) {
        request<{ data: Review[] }>(`/hotels/${b.hotelId}/reviews`, { token })
          .then((r) => setMyReview(
            (r.data ?? []).find((rv) => rv.userId === session.user.id) ?? null,
          ))
          .catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, token, session]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // ── Derived values ────────────────────────────────────────────────────────
  const nights = booking
    ? Math.max(1, Math.ceil(
        (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000,
      ))
    : 0;

  const details     = booking?.details ?? [];
  const firstRoom   = details[0]?.room;
  const guestCount  = details.reduce((s, d) => s + (d.guestCount ?? 1), 0);
  const guestInfo   = details[0]?.guestInfo;
  const isCash      = String(booking?.payment?.method ?? '') === 'CASH_AT_HOTEL';
  const canCancel   = booking?.status === 'CONFIRMED' || booking?.status === 'PENDING';
  const bookingRef  = booking?.reference
    ?? `YTH-${booking?.id.slice(0, 8).toUpperCase() ?? ''}`;
  const hotelImage  = booking?.hotel?.images?.[0]?.url;

  // ── Theme ─────────────────────────────────────────────────────────────────
  const bg      = dark ? '#0D1B2A' : BK.bg;
  const surface = dark ? '#152233' : BK.white;
  const cardBg  = dark ? '#1A2D40' : BK.white;
  const borderC = dark ? '#1F3448' : BK.border;

  const refundState: RefundState | null = booking?.status !== 'CANCELLED'
    ? null
    : isCash
    ? 'NOT_APPLICABLE'
    : booking.payment?.status === 'REFUNDED'
    ? 'COMPLETED'
    : booking.payment?.status === 'FAILED'
    ? 'FAILED'
    : booking.payment?.status === 'SUCCEEDED'
    ? 'PROCESSING'
    : 'NO_REFUND';
  const textPri = dark ? '#F0F4F8' : BK.navy;
  const textSec = dark ? '#8FA1B3' : BK.textSec;

  const handleConfirmCancel = async () => {
    if (!booking) return;
    setBusy('cancel');
    try {
      await request(`/bookings/${bookingId}/cancel`, { method: 'POST', token });
      hapticSuccess();
      setShowCancelDialog(false);
      void load();
    } catch (err) {
      hapticError();
      Alert.alert('Could not cancel', classifyAndAnnounce(err).title);
    } finally {
      setBusy(null);
    }
  };

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleAction = async (key: string) => {
    if (!booking) return;

    if (key === 'cancel') {
      hapticMedium();
      if (isOffline) {
        Alert.alert('Offline', 'Cannot cancel while offline. Please connect and try again.');
        return;
      }
      setShowCancelDialog(true);
      return;
    }

    if (key === 'qr') {
      setShowQRModal(true);
      return;
    }

    if (key === 'calendar') {
      hapticSuccess();
      const start = new Date(booking.checkIn);
      const end = new Date(booking.checkOut);
      end.setDate(end.getDate() + 1);
      const ok = await addBookingToCalendar({
        title: `LuxSty: ${booking.hotel?.name ?? 'Hotel'}`,
        startDate: start,
        endDate: end,
        location: booking.hotel?.name,
        notes: `Booking: ${bookingRef}\nRoom: ${firstRoom?.type ?? ''}`,
      });
      if (ok) {
        Alert.alert('Added to Calendar', 'Reservation has been added to your calendar.');
      } else {
        Alert.alert(
          'Added to Calendar',
          `Reservation added:\nHotel: ${booking.hotel?.name ?? 'Hotel'}\nCheck-in: ${booking.checkIn.slice(0, 10)}\nCheck-out: ${booking.checkOut.slice(0, 10)}`,
        );
      }
      return;
    }
    if (key === 'payment') { await completePayment(); return; }
    if (key === 'contact') { navigation.navigate('ContactNew' as any); return; }
    if (key === 'modify')  { navigation.navigate('BookingModify', { bookingId }); return; }
    if (key === 'search')  { navigation.navigate('Search'); return; }

    if (key === 'receipt') {
      setBusy('receipt');
      try {
        const blob  = await requestBlob(`/bookings/${bookingId}/invoice`, { token });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const { File, Paths } = await import('expo-file-system');
          const file   = new File(Paths.document, `receipt-${bookingId.slice(0, 8)}.pdf`);
          file.write(base64);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(file.uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'View Receipt',
              UTI: 'com.adobe.pdf',
            });
          }
        };
        reader.readAsDataURL(new Blob([blob], { type: 'application/pdf' }));
        hapticSuccess();
      } catch (err) {
        hapticError();
        Alert.alert('Download Failed', classifyAndAnnounce(err).title);
      } finally {
        setBusy(null);
      }
      return;
    }

    if (key === 'review') {
      navigation.navigate('Review', {
        hotelId:   booking.hotelId,
        hotelName: booking.hotel?.name ?? 'Hotel',
        ...(myReview ? { mode: 'edit', existingReview: myReview } : {}),
      });
      return;
    }

    if (key === 'invoice') {
      setBusy('invoice');
      try {
        const blob  = await requestBlob(`/bookings/${bookingId}/invoice`, { token });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const { File, Paths } = await import('expo-file-system');
          const file   = new File(Paths.document, `invoice-${bookingId.slice(0, 8)}.pdf`);
          file.write(base64);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(file.uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Download Invoice',
            });
          } else {
            Alert.alert('Downloaded', `Saved to ${file.uri}`);
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to download.');
      } finally { setBusy(null); }
      return;
    }

    Alert.alert('Coming Soon', 'This feature is coming in a future update.');
  };

  const completePayment = async (overrideMethod?: string) => {
    if (!booking) return;
    const method = overrideMethod ?? booking.payment?.method ?? 'CREDIT_CARD';
    setBusy('payment');
    try {
      await request(`/payments/${bookingId}/intent`, {
        method: 'POST',
        body: { method },
        token,
      });
      navigation.navigate('MockAuth', {
        bookingId,
        method,
        amount: Number(booking.totalPrice) || 0,
        currency: 'ETB',
        hotelName: booking.hotel?.name || 'Hotel',
        reference: booking.reference || bookingId.slice(0, 8),
      });
    } catch (err) {
      hapticError();
      Alert.alert('Payment Failed', classifyAndAnnounce(err).title);
    } finally { setBusy(null); }
  };

  const handleRetryWithMethodChange = () => {
    Alert.alert('Select Payment Method', 'Choose a payment method to complete this booking:', [
      { text: 'Credit / Debit Card', onPress: () => void completePayment('CREDIT_CARD') },
      { text: 'Telebirr', onPress: () => void completePayment('TELEBIRR') },
      { text: 'CBE Birr', onPress: () => void completePayment('CBE_BIRR') },
      { text: 'PayPal', onPress: () => void completePayment('PAYPAL') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={[s.navBar, { paddingTop: insets.top + 8, backgroundColor: surface, borderBottomColor: borderC }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={textPri} />
        </Pressable>
        <Text style={[s.navTitle, { color: textPri }]}>Booking Details</Text>
        <View style={s.backBtn} />
      </View>
      <View style={s.center}><SkeletonDetail /></View>
    </View>
  );

  // ── Error / not found ─────────────────────────────────────────────────────
  if (error || !booking) return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <View style={[s.navBar, { paddingTop: insets.top + 8, backgroundColor: surface, borderBottomColor: borderC }]}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={textPri} />
        </Pressable>
        <Text style={[s.navTitle, { color: textPri }]}>Booking Details</Text>
        <View style={s.backBtn} />
      </View>
      <View style={s.center}>
        <ErrorBox message={error ?? 'Booking not found.'} onRetry={load} />
      </View>
    </View>
  );

  const actions = getActions(booking.status, canCancel);

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* ── Nav bar ──────────────────────────────────────────────────────── */}
      <View style={[s.navBar, {
        paddingTop: insets.top + 8,
        backgroundColor: surface,
        borderBottomColor: borderC,
      }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={s.backBtn} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={textPri} />
        </Pressable>
        <View style={s.navCenter}>
          <Text style={[s.navTitle, { color: textPri }]}>Booking Details</Text>
          <BookingStatusBadge status={booking.status} size="sm" />
        </View>
        <Pressable
          onPress={load}
          style={s.backBtn} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="Refresh"
        >
          <Ionicons name="refresh-outline" size={20} color={textPri} />
        </Pressable>
      </View>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* 1. Status hero ──────────────────────────────────────────────── */}
        <View style={[s.heroCard, { backgroundColor: cardBg, borderColor: borderC }]}>
          <StatusHero status={booking.status} bookingRef={bookingRef} />
        </View>

        {/* 2. Cash-at-hotel confirmation banner ───────────────────────── */}
        {isCash && booking.status === 'CONFIRMED' && (
          <View style={[s.infoBanner, { backgroundColor: BK.confirmedBg, borderColor: BK.confirmedBd }]}>
            <Ionicons name="cash-outline" size={18} color={BK.confirmed} />
            <View style={s.flex}>
              <Text style={[s.bannerTitle, { color: BK.confirmed }]}>Pay at Hotel</Text>
              <Text style={[s.bannerSub, { color: textSec }]}>
                Your booking is confirmed. Pay at the reception during your stay.
              </Text>
            </View>
          </View>
        )}

        {/* 3. Pending payment warning ─────────────────────────────────── */}
        {booking.status === 'PENDING' && booking.payment?.status === 'PENDING' && !isCash && (
          <View style={[s.infoBanner, { backgroundColor: BK.pendingBg, borderColor: BK.pendingBd }]}>
            <Ionicons name="time-outline" size={18} color={BK.pending} />
            <View style={s.flex}>
              <Text style={[s.bannerTitle, { color: BK.pending }]}>Payment Required</Text>
              <Text style={[s.bannerSub, { color: textSec }]}>
                Complete your payment to confirm this booking. Your room is being held temporarily.
              </Text>
              {booking.createdAt && (
                <HoldTimer
                  expiresAt={new Date(booking.createdAt).getTime() + 30 * 60 * 1000}
                  style={{ marginTop: 8 }}
                />
              )}
            </View>
          </View>
        )}

        {/* 3b. Room maintenance alert (§42) ─────────────────────────────── */}
        {(firstRoom?.status === 'MAINTENANCE' || (booking as any).roomStatus === 'MAINTENANCE') && (
          <View style={[s.infoBanner, { backgroundColor: BK.pendingBg, borderColor: BK.pendingBd }]}>
            <Ionicons name="build-outline" size={18} color={BK.pending} />
            <View style={s.flex}>
              <Text style={[s.bannerTitle, { color: BK.pending }]}>Your reserved room requires maintenance.</Text>
              <Text style={[s.bannerSub, { color: textSec }]}>
                Our team is arranging a complimentary upgrade or room reassignment. Please contact reception upon arrival.
              </Text>
            </View>
          </View>
        )}

        {/* 3c. Cancelled booking availability release notice (§30) ──────── */}
        {booking.status === 'CANCELLED' && (
          <View style={[s.infoBanner, { backgroundColor: BK.cancelledBg, borderColor: BK.cancelledBd }]}>
            <Ionicons name="close-circle-outline" size={18} color={BK.cancelled} />
            <View style={s.flex}>
              <Text style={[s.bannerTitle, { color: BK.cancelled }]}>Reservation Cancelled</Text>
              <Text style={[s.bannerSub, { color: textSec }]}>
                Your reservation has been cancelled and room availability has been released.
              </Text>
            </View>
          </View>
        )}

        {/* 4. Room summary ─────────────────────────────────────────────── */}
        <SectionCard title="Your Room" style={{ backgroundColor: cardBg, borderColor: borderC }}>
          <RoomSummaryCard
            imageUrl={hotelImage}
            roomType={firstRoom?.type}
            roomNumber={firstRoom?.roomNumber}
            hotelName={booking.hotel?.name}
            guests={guestCount}
          />
          {guestInfo?.fullName && (
            <View style={[s.guestRow, { borderTopColor: borderC }]}>
              <Ionicons name="person-outline" size={14} color={BK.navyMuted} />
              <Text style={[s.guestLabel, { color: textSec }]}>Lead guest</Text>
              <Text style={[s.guestName, { color: textPri }]}>{guestInfo.fullName}</Text>
            </View>
          )}
        </SectionCard>

        {/* 5. Stay dates ───────────────────────────────────────────────── */}
        <SectionCard title="Stay Dates" style={{ backgroundColor: cardBg, borderColor: borderC }}>
          <DateStrip checkIn={booking.checkIn} checkOut={booking.checkOut} nights={nights} />
          <View style={s.timesRow}>
            <View style={s.timeItem}>
              <Ionicons name="log-in-outline" size={13} color={BK.navyMuted} />
              <Text style={[s.timeText, { color: textSec }]}>
                {booking.actualCheckIn
                  ? `Checked in ${new Date(booking.actualCheckIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}${booking.earlyCheckIn ? ' (early)' : ''}`
                  : 'Check-in from 2:00 PM'}
              </Text>
            </View>
            <View style={s.timeItem}>
              <Ionicons name="log-out-outline" size={13} color={BK.navyMuted} />
              <Text style={[s.timeText, { color: textSec }]}>
                {booking.actualCheckOut
                  ? `Checked out ${new Date(booking.actualCheckOut).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}${booking.lateCheckOut ? ' (late)' : ''}`
                  : 'Check-out by 12:00 PM'}
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* 6. Booking timeline ─────────────────────────────────────────── */}
        <SectionCard title="Booking Journey" style={{ backgroundColor: cardBg, borderColor: borderC }}>
          <BookingTimeline
            status={booking.status}
            isCashAtHotel={isCash}
          />
        </SectionCard>

        {/* 7. QR code — CONFIRMED only, toggled by action button ──────── */}
        {booking.status === 'CONFIRMED' && showQR && (
          <SectionCard title="Check-in QR Code" style={{ backgroundColor: cardBg, borderColor: borderC }}>
            <View style={s.qrWrap}>
              <QRCodeCard
                bookingRef={bookingRef}
                guestName={guestInfo?.fullName ?? session?.user?.fullName}
              />
            </View>
            <Text style={[s.qrHint, { color: textSec }]}>
              Show this QR code at hotel reception to check in.
            </Text>
          </SectionCard>
        )}

        {/* 8. Price breakdown ──────────────────────────────────────────── */}
        <SectionCard title="Price Breakdown" style={{ backgroundColor: cardBg, borderColor: borderC }}>
          <PriceBreakdown
            basePrice={booking.totalPrice ? Math.round(Number(booking.totalPrice) / nights) : undefined}
            nights={nights}
            total={booking.totalPrice}
            priceLocked
            currentRoomPrice={firstRoom?.basePrice ? Number(firstRoom.basePrice) : undefined}
          />
        </SectionCard>

        {/* 9. Payment ──────────────────────────────────────────────────── */}
        {booking.payment && (
          <SectionCard title="Payment" style={{ backgroundColor: cardBg, borderColor: borderC }}>
            <PaymentStatusRow
              method={booking.payment.method}
              status={booking.payment.status}
              amount={booking.payment.amount}
            />
            {/* Payment date & transaction ref */}
            {booking.payment.createdAt && (
              <View style={[s.paymentMeta, { borderBottomColor: borderC }]}>
                <Text style={[s.paymentMetaLabel, { color: textSec }]}>Paid on</Text>
                <Text style={[s.paymentMetaValue, { color: textPri }]}>
                  {new Date(booking.payment.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            {booking.payment.providerRef && (
              <View style={[s.paymentMeta, { borderBottomColor: borderC }]}>
                <Text style={[s.paymentMetaLabel, { color: textSec }]}>Transaction Ref</Text>
                <Text style={[s.paymentMetaValue, { color: textPri, fontFamily: 'Menlo' }]}>{booking.payment.providerRef}</Text>
              </View>
            )}
            {booking.payment.status === 'REFUNDED' && (
              <View style={[s.refundNote, { backgroundColor: BK.checkedInBg }]}>
                <Ionicons name="information-circle-outline" size={15} color={BK.checkedIn} />
                <Text style={[s.refundNoteText, { color: BK.checkedIn }]}>
                  Refund processed. Allow 5–10 business days to appear on your account.
                </Text>
              </View>
            )}
            {booking.payment.status === 'PENDING' && !isCash && (
              <ActionButton
                label={busy === 'payment' ? 'Processing' : 'Complete Payment'}
                icon="card-outline"
                variant="primary"
                onPress={() => void completePayment()}
                loading={busy === 'payment'}
                disabled={!!busy || isOffline}
              />
            )}
            {booking.payment.status === 'FAILED' && !isCash && (
              <View style={{ gap: 8 }}>
                <ActionButton
                  label={busy === 'payment' ? 'Retrying...' : 'Retry Payment'}
                  icon="refresh-outline"
                  variant="primary"
                  onPress={() => void completePayment()}
                  loading={busy === 'payment'}
                  disabled={!!busy || isOffline}
                />
                <ActionButton
                  label="Change Payment Method"
                  icon="swap-horizontal-outline"
                  variant="secondary"
                  onPress={handleRetryWithMethodChange}
                  disabled={!!busy || isOffline}
                />
              </View>
            )}
          </SectionCard>
        )}

        {refundState && (
          <SectionCard title="Refund" style={{ backgroundColor: cardBg, borderColor: borderC }}>
            <RefundStatus
              state={refundState}
              amount={
                refundState === 'COMPLETED' || refundState === 'PROCESSING' || refundState === 'FAILED'
                  ? booking.payment?.amount
                  : refundState === 'NO_REFUND' || refundState === 'NOT_APPLICABLE'
                  ? 0
                  : undefined
              }
              method={booking.payment?.method}
              reference={booking.payment?.providerRef}
              onContactSupport={() => navigation.navigate('ContactNew' as any)}
            />
            <RefundTimeline state={refundState} />
          </SectionCard>
        )}

        {/* 10. Cancellation policy ─────────────────────────────────────── */}
        {canCancel && (
          <SectionCard title="Cancellation Policy" style={{ backgroundColor: cardBg, borderColor: borderC }}>
            <CancellationPolicy
              cancellationHours={booking.cancellationHours ?? 48}
              checkIn={booking.checkIn}
            />
          </SectionCard>
        )}

        {/* 11. Review (CHECKED_OUT) ────────────────────────────────────── */}
        {booking.status === 'CHECKED_OUT' && (
          <SectionCard
            title={myReview ? 'Your Review' : 'How Was Your Stay?'}
            style={{ backgroundColor: cardBg, borderColor: borderC }}
          >
            {myReview ? (
              <View style={s.reviewWrap}>
                <View style={s.reviewStars}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Ionicons
                      key={i}
                      name={i < myReview.rating ? 'star' : 'star-outline'}
                      size={20} color={BK.gold}
                    />
                  ))}
                </View>
                <Text style={[s.reviewComment, { color: textSec }]} numberOfLines={3}>
                  {myReview.comment}
                </Text>
                <ActionButton
                  label="Edit Review"
                  icon="pencil-outline"
                  variant="secondary"
                  onPress={() => navigation.navigate('Review', {
                    hotelId:        booking.hotelId,
                    hotelName:      booking.hotel?.name ?? 'Hotel',
                    mode:           'edit',
                    existingReview: myReview,
                  })}
                />
              </View>
            ) : (
              <View style={s.reviewCTA}>
                <Text style={[s.reviewCtaText, { color: textSec }]}>
                  Share your experience and help other travellers choose wisely.
                </Text>
                <ActionButton
                  label="Write a Review"
                  icon="star-outline"
                  variant="primary"
                  onPress={() => navigation.navigate('Review', {
                    hotelId:   booking.hotelId,
                    hotelName: booking.hotel?.name ?? 'Hotel',
                  })}
                />
              </View>
            )}
          </SectionCard>
        )}

        {/* 12. Status history (expandable) ────────────────────────────── */}
        {statusHistory.length > 0 && (
          <SectionCard style={{ backgroundColor: cardBg, borderColor: borderC }}>
            <Pressable
              onPress={() => setHistoryOpen((v) => !v)}
              style={s.historyToggle}
              accessibilityRole="button"
              accessibilityLabel={historyOpen ? 'Hide status history' : 'Show status history'}
            >
              <Ionicons name="time-outline" size={16} color={BK.navyMuted} />
              <Text style={[s.historyToggleText, { color: textPri }]}>Status History</Text>
              <Ionicons
                name={historyOpen ? 'chevron-up' : 'chevron-down'}
                size={16} color={BK.navyMuted}
                style={s.historyChevron}
              />
            </Pressable>
            {historyOpen && (
              <View style={s.historyList}>
                {statusHistory.map((entry, i) => {
                  const diff = Date.now() - new Date(entry.createdAt).getTime();
                  const mins = Math.floor(diff / 60000);
                  const hrs  = Math.floor(mins / 60);
                  const days = Math.floor(hrs  / 24);
                  const rel  = days > 0 ? `${days}d ago`
                             : hrs  > 0 ? `${hrs}h ago`
                             : mins > 0 ? `${mins}m ago`
                             : 'just now';
                  const cfg  = STATUS_CONFIG[entry.status];
                  const isLast = i === statusHistory.length - 1;
                  return (
                    <View key={i} style={s.historyRow}>
                      <View style={s.historyLeft}>
                        <View style={[s.historyDot, { backgroundColor: cfg?.color ?? BK.border }]} />
                        {!isLast && <View style={[s.historyLine, { backgroundColor: borderC }]} />}
                      </View>
                      <View style={s.historyContent}>
                        <View style={s.historyTop}>
                          <BookingStatusBadge status={entry.status} size="sm" />
                          <Text style={[s.historyTime, { color: textSec }]}>{rel}</Text>
                        </View>
                        {entry.reason && (
                          <Text style={[s.historyReason, { color: textSec }]}>
                            {`"${entry.reason}"`}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </SectionCard>
        )}

        {/* 13. State-aware action buttons ──────────────────────────────── */}
        {actions.length > 0 && (
          <View style={s.actionsWrap}>
            {actions.map((action) => (
              <ActionButton
                key={action.key}
                label={busy === action.key ? `${action.label}…` : action.label}
                icon={action.icon}
                variant={action.variant}
                onPress={() => void handleAction(action.key)}
                loading={busy === action.key}
                disabled={!!busy && busy !== action.key}
              />
            ))}
          </View>
        )}

      </ScrollView>

      {/* Cancellation Dialog Modal (§28, §29) */}
      <CancellationDialog
        visible={showCancelDialog}
        hotelName={booking.hotel?.name ?? 'Hotel'}
        roomType={firstRoom?.type}
        bookingRef={bookingRef}
        checkIn={booking.checkIn ? booking.checkIn.slice(0, 10) : ''}
        checkOut={booking.checkOut ? booking.checkOut.slice(0, 10) : ''}
        totalPrice={booking.totalPrice}
        cancellationHours={booking.cancellationHours ?? 48}
        isCashAtHotel={isCash}
        loading={busy === 'cancel'}
        onConfirmCancel={handleConfirmCancel}
        onKeepBooking={() => setShowCancelDialog(false)}
      />

      {/* Dedicated QR Code Modal (§40) */}
      <QRCodeModal
        visible={showQRModal}
        bookingRef={bookingRef}
        guestName={guestInfo?.fullName ?? session?.user?.fullName}
        hotelName={booking.hotel?.name ?? 'Hotel'}
        checkIn={booking.checkIn ? booking.checkIn.slice(0, 10) : ''}
        checkOut={booking.checkOut ? booking.checkOut.slice(0, 10) : ''}
        onClose={() => setShowQRModal(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flex: 1 },
  body:   { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  flex:   { flex: 1 },

  // ── Nav bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  navCenter: {
    flex: 1, alignItems: 'center', gap: 4,
  },
  navTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },

  // ── Hero card wrapper
  heroCard: {
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },

  // ── Info banner (cash / pending)
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 14,
  },
  bannerTitle: { fontSize: 13, fontWeight: '700' },
  bannerSub:   { fontSize: 12, marginTop: 3, lineHeight: 17 },

  // ── Guest row inside room card
  guestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  guestLabel: { fontSize: 13 },
  guestName:  { fontSize: 13, fontWeight: '700' },

  // ── Stay times row
  timesRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 4,
  },
  timeItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: { fontSize: 12, fontWeight: '500' },

  // ── QR
  qrWrap:  { alignItems: 'center' },
  qrHint:  { fontSize: 13, textAlign: 'center', lineHeight: 18, marginTop: 4 },

  // ── Payment meta
  paymentMeta:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  paymentMetaLabel: { fontSize: 13 },
  paymentMetaValue: { fontSize: 13, fontWeight: '600' },

  // ── Refund note
  refundNote:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, padding: 10 },
  refundNoteText: { fontSize: 12, flex: 1, lineHeight: 17, fontWeight: '500' },

  // ── Review
  reviewWrap:    { gap: 10 },
  reviewStars:   { flexDirection: 'row', gap: 3 },
  reviewComment: { fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  reviewCTA:     { gap: 10 },
  reviewCtaText: { fontSize: 14, lineHeight: 20 },

  // ── Status history
  historyToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  historyToggleText: { flex: 1, fontSize: 14, fontWeight: '700' },
  historyChevron:    { marginLeft: 'auto' },
  historyList:       { marginTop: 12, gap: 0 },
  historyRow:        { flexDirection: 'row', gap: 12, minHeight: 52 },
  historyLeft:       { alignItems: 'center', width: 14 },
  historyDot:        { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  historyLine:       { flex: 1, width: 2, borderRadius: 1, marginTop: 2 },
  historyContent:    { flex: 1, paddingBottom: 16, gap: 4 },
  historyTop:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyTime:       { fontSize: 11, fontWeight: '500' },
  historyReason:     { fontSize: 12, fontStyle: 'italic', lineHeight: 16 },

  // ── Actions
  actionsWrap: { gap: 10, marginTop: 4 },
});
