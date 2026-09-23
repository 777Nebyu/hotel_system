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
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAppSelector } from '../../store/hooks';
import { request, refundPayment } from '../../api';
import { useToast } from '../../components/Toast';
import { ErrorBox } from '../../components/Shared';
import type { Booking } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'ManagerBookingDetail'>;

const NAVY = '#0F172A';
const EMERALD = '#0F2942';
const GOLD = '#D4AF37';
const WHITE = '#FFFFFF';
const IVORY = '#F8FAFC';
const NAVY_MUTED = '#475569';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const ERROR = '#EF4444';
const BLUE = '#3B82F6';

const EMERALD_LIGHT = '#E6F4F2';
const SUCCESS_BG = '#F0FDF4';
const WARNING_BG = '#FFFBEB';
const ERROR_BG = '#FEF2F2';

const CARD_PADDING = 16;
const SIDE_PADDING = 16;

const STATUS_CONFIG: Record<string, { bg: string; fg: string; label: string; hero: string }> = {
  PENDING:     { bg: WARNING_BG, fg: WARNING, label: 'Pending',     hero: WARNING },
  CONFIRMED:   { bg: EMERALD_LIGHT, fg: EMERALD, label: 'Confirmed', hero: EMERALD },
  CHECKED_IN:  { bg: SUCCESS_BG, fg: SUCCESS, label: 'Checked In',  hero: SUCCESS },
  CHECKED_OUT: { bg: '#F1F5F9', fg: '#64748B', label: 'Checked Out', hero: '#64748B' },
  CANCELLED:   { bg: ERROR_BG, fg: ERROR, label: 'Cancelled',     hero: ERROR },
  NO_SHOW:     { bg: ERROR_BG, fg: ERROR, label: 'No Show',       hero: ERROR },
};

const fmtCurrency = (n: number | string) =>
  `ETB ${Number(n).toLocaleString('en-ET', { minimumFractionDigits: 0 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const fmtTimeRelative = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
};

function InfoRow({ icon, label, value, dark }: { icon: string; label: string; value: string; dark: boolean }) {
  return (
    <View style={[ir.row, { borderBottomColor: dark ? '#1F3448' : '#F0F4F7' }]}>
      <Ionicons name={icon as any} size={16} color={dark ? '#8FA1B3' : NAVY_MUTED} />
      <Text style={[ir.label, { color: dark ? '#8FA1B3' : NAVY_MUTED }]}>{label}</Text>
      <Text style={[ir.value, { color: dark ? '#F0F4F8' : NAVY }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}
const ir = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 13, fontWeight: '500', width: 100 },
  value: { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'right' },
});

export default function ManagerBookingDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const bookingId = route.params.bookingId;
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const insets = useSafeAreaInsets();
  const toast  = useToast();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statusHistory, setStatusHistory] = useState<
    { status: string; reason?: string; createdAt: string }[]
  >([]);

  const dark = false;

  const load = useCallback(async () => {
    setError(null);
    try {
      const b = await request<Booking>(`/bookings/${bookingId}`, { token });
      setBooking(b);
      if (!b) { setError('Booking not found.'); return; }

      request<{ data: typeof statusHistory }>(
        `/bookings/${bookingId}/status-history`, { token },
      ).then((r) => setStatusHistory(r.data ?? [])).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking.');
    } finally {
      setLoading(false);
    }
  }, [bookingId, token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const nights = booking
    ? Math.max(1, Math.ceil(
        (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000,
      ))
    : 0;

  const details = booking?.details ?? [];
  const firstRoom = details[0]?.room;
  const guestInfo = details[0]?.guestInfo;
  const guestCount = details.reduce((s, d) => s + (d.guestCount ?? 1), 0);
  const bookingRef = booking?.reference ?? `BK-${booking?.id.slice(0, 8).toUpperCase() ?? ''}`;

  const performAction = async (action: string, confirmTitle?: string, confirmMsg?: string) => {
    if (!booking) return;
    if (confirmTitle && confirmMsg) {
      return new Promise<void>((resolve) => {
        Alert.alert(confirmTitle, confirmMsg, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
          {
            text: 'Confirm',
            style: action === 'reject' || action === 'cancel' || action === 'no-show' ? 'destructive' : 'default',
            onPress: async () => {
              await executeAction(action);
              resolve();
            },
          },
        ]);
      });
    }
    await executeAction(action);
  };

  const executeAction = async (action: string) => {
    if (!booking) return;
    setBusy(action);
    try {
      if (action === 'mark-paid') {
        await request(`/payments/${bookingId}/cash-paid`, { method: 'POST', token });
      } else if (action === 'refund') {
        await refundPayment(bookingId, token);
        toast('success', 'Refund Processed', 'Refund has been processed successfully.');
      } else {
        await request(`/bookings/${bookingId}/${action}`, { method: 'POST', token });
      }
      Alert.alert('Success', `Booking ${action.replace(/-/g, ' ')} completed.`);
      void load();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  const getActions = (): { key: string; label: string; icon: string; color: string; destructive?: boolean }[] => {
    switch (booking?.status) {
      case 'PENDING':
        return [
          { key: 'confirm', label: 'Confirm', icon: 'checkmark-circle-outline', color: EMERALD },
          { key: 'reject', label: 'Reject', icon: 'close-circle-outline', color: WARNING, destructive: true },
          { key: 'cancel', label: 'Cancel', icon: 'ban-outline', color: ERROR, destructive: true },
        ];
      case 'CONFIRMED':
        return [
          { key: 'check-in', label: 'Check In', icon: 'log-in-outline', color: EMERALD },
          { key: 'early-checkin', label: 'Early Check-in', icon: 'time-outline', color: BLUE },
          { key: 'mark-paid', label: 'Mark Paid', icon: 'cash-outline', color: SUCCESS },
          { key: 'refund', label: 'Refund', icon: 'wallet-outline', color: GOLD },
          { key: 'no-show', label: 'No Show', icon: 'person-remove-outline', color: WARNING, destructive: true },
          { key: 'cancel', label: 'Cancel', icon: 'ban-outline', color: ERROR, destructive: true },
        ];
      case 'CHECKED_IN':
        return [
          { key: 'check-out', label: 'Check Out', icon: 'log-out-outline', color: EMERALD },
          { key: 'late-checkout', label: 'Late Check-out', icon: 'time-outline', color: BLUE },
          { key: 'relocate', label: 'Relocate', icon: 'swap-horizontal-outline', color: GOLD },
          { key: 'mark-paid', label: 'Mark Paid', icon: 'cash-outline', color: SUCCESS },
          { key: 'refund', label: 'Refund', icon: 'wallet-outline', color: GOLD },
        ];
      default:
        return [];
    }
  };

  const statusCfg = STATUS_CONFIG[booking?.status ?? ''] ?? STATUS_CONFIG.PENDING;

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: IVORY }]}>
        <StatusBar barStyle="dark-content" backgroundColor={IVORY} />
        <View style={[s.header, { paddingTop: insets.top + 8, backgroundColor: WHITE, borderBottomColor: '#EEF2F6' }]}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={NAVY} />
          </Pressable>
          <Text style={s.headerTitle}>Booking Details</Text>
          <View style={s.backBtn} />
        </View>
        <View style={s.center}>
          <Ionicons name="hourglass-outline" size={40} color={NAVY_MUTED} />
          <Text style={s.loadingText}>Loading booking...</Text>
        </View>
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={[s.root, { backgroundColor: IVORY }]}>
        <StatusBar barStyle="dark-content" backgroundColor={IVORY} />
        <View style={[s.header, { paddingTop: insets.top + 8, backgroundColor: WHITE, borderBottomColor: '#EEF2F6' }]}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={NAVY} />
          </Pressable>
          <Text style={s.headerTitle}>Booking Details</Text>
          <View style={s.backBtn} />
        </View>
        <View style={s.center}>
          <ErrorBox message={error ?? 'Booking not found.'} onRetry={load} />
        </View>
      </View>
    );
  }

  const actions = getActions();

  return (
    <View style={[s.root, { backgroundColor: IVORY }]}>
      <StatusBar barStyle="dark-content" backgroundColor={IVORY} />

      <View style={[s.header, { paddingTop: insets.top + 8, backgroundColor: WHITE, borderBottomColor: '#EEF2F6' }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={s.backBtn} hitSlop={8}
          accessibilityRole="button" accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={NAVY} />
        </Pressable>
        <Text style={s.headerTitle}>Booking Details</Text>
        <Pressable onPress={load} style={s.backBtn} hitSlop={8}>
          <Ionicons name="refresh-outline" size={20} color={NAVY} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={[s.heroBanner, { backgroundColor: statusCfg.hero }]}>
          <View style={s.heroTop}>
            <View style={[s.statusBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={s.statusBadgeText}>{statusCfg.label}</Text>
            </View>
            <Text style={s.heroRef}>{bookingRef}</Text>
          </View>
          <Text style={s.heroGuest}>{guestInfo?.fullName ?? 'Guest'}</Text>
          <Text style={s.heroRoom}>{firstRoom?.type ?? 'Room'} {firstRoom?.roomNumber ? `#${firstRoom.roomNumber}` : ''}</Text>
        </View>

        <View style={[s.card, { backgroundColor: WHITE, borderColor: '#F0F4F7' }]}>
          <View style={s.cardHeader}>
            <Ionicons name="person-outline" size={16} color={NAVY} />
            <Text style={s.cardTitle}>Guest Information</Text>
          </View>
          <InfoRow icon="person-outline" label="Full Name" value={guestInfo?.fullName ?? 'N/A'} dark={dark} />
          <InfoRow icon="call-outline" label="Phone" value={guestInfo?.phone ?? 'N/A'} dark={dark} />
          <InfoRow icon="mail-outline" label="Email" value={guestInfo?.email ?? 'N/A'} dark={dark} />
          <InfoRow icon="card-outline" label="ID/Passport" value={guestInfo?.idNumber ?? 'N/A'} dark={dark} />
          <InfoRow icon="people-outline" label="Guests" value={String(guestCount)} dark={dark} />
        </View>

        <View style={[s.card, { backgroundColor: WHITE, borderColor: '#F0F4F7' }]}>
          <View style={s.cardHeader}>
            <Ionicons name="bed-outline" size={16} color={NAVY} />
            <Text style={s.cardTitle}>Room Details</Text>
          </View>
          <InfoRow icon="hash-outline" label="Room Number" value={firstRoom?.roomNumber ?? 'N/A'} dark={dark} />
          <InfoRow icon="layers-outline" label="Type" value={firstRoom?.type ?? 'N/A'} dark={dark} />
          <InfoRow icon="people-outline" label="Capacity" value={`${firstRoom?.capacity ?? 'N/A'} guests`} dark={dark} />
        </View>

        <View style={[s.card, { backgroundColor: WHITE, borderColor: '#F0F4F7' }]}>
          <View style={s.cardHeader}>
            <Ionicons name="calendar-outline" size={16} color={NAVY} />
            <Text style={s.cardTitle}>Stay Dates</Text>
          </View>
          <InfoRow icon="log-in-outline" label="Check-in" value={fmtDate(booking.checkIn)} dark={dark} />
          <InfoRow icon="log-out-outline" label="Check-out" value={fmtDate(booking.checkOut)} dark={dark} />
          <InfoRow icon="moon-outline" label="Nights" value={String(nights)} dark={dark} />
        </View>

        <View style={[s.card, { backgroundColor: WHITE, borderColor: '#F0F4F7' }]}>
          <View style={s.cardHeader}>
            <Ionicons name="cash-outline" size={16} color={NAVY} />
            <Text style={s.cardTitle}>Payment Summary</Text>
          </View>
          <InfoRow icon="wallet-outline" label="Total Price" value={fmtCurrency(booking.totalPrice)} dark={dark} />
          <InfoRow icon="card-outline" label="Method" value={booking.payment?.method?.replace(/_/g, ' ') ?? 'N/A'} dark={dark} />
          <InfoRow
            icon="checkmark-circle-outline"
            label="Payment"
            value={booking.payment?.status ?? 'N/A'}
            dark={dark}
          />
        </View>

        {actions.length > 0 && (
          <View style={s.actionsSection}>
            <Text style={s.actionsLabel}>Actions</Text>
            <View style={s.actionsGrid}>
              {actions.map((action) => (
                <Pressable
                  key={action.key}
                  onPress={() => {
                    if (action.destructive) {
                      performAction(action.key, `${action.label}?`, `Are you sure you want to ${action.label.toLowerCase()} this booking?`);
                    } else {
                      performAction(action.key, `${action.label}?`, `Proceed with ${action.label.toLowerCase()}?`);
                    }
                  }}
                  disabled={busy !== null}
                  style={({ pressed }) => [
                    s.actionBtn,
                    {
                      backgroundColor: pressed ? action.color + '18' : WHITE,
                      borderColor: action.color + '40',
                      opacity: busy !== null && busy !== action.key ? 0.5 : 1,
                    },
                  ]}
                >
                  <View style={[s.actionIcon, { backgroundColor: action.color + '15' }]}>
                    <Ionicons name={action.icon as any} size={20} color={action.color} />
                  </View>
                  <Text style={[s.actionText, { color: action.color }]}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {statusHistory.length > 0 && (
          <View style={[s.card, { backgroundColor: WHITE, borderColor: '#F0F4F7' }]}>
            <Pressable
              onPress={() => setHistoryOpen((v) => !v)}
              style={s.historyToggle}
              accessibilityRole="button"
            >
              <Ionicons name="time-outline" size={16} color={NAVY_MUTED} />
              <Text style={s.historyToggleText}>Status History</Text>
              <Ionicons
                name={historyOpen ? 'chevron-up' : 'chevron-down'}
                size={16} color={NAVY_MUTED}
              />
            </Pressable>
            {historyOpen && (
              <View style={s.historyList}>
                {statusHistory.map((entry, i) => {
                  const cfg = STATUS_CONFIG[entry.status];
                  const isLast = i === statusHistory.length - 1;
                  return (
                    <View key={i} style={s.historyRow}>
                      <View style={s.historyLeft}>
                        <View style={[s.historyDot, { backgroundColor: cfg?.fg ?? NAVY_MUTED }]} />
                        {!isLast && <View style={s.historyLine} />}
                      </View>
                      <View style={s.historyContent}>
                        <View style={s.historyTop}>
                          <View style={[s.historyBadge, { backgroundColor: cfg?.bg ?? '#F1F5F9' }]}>
                            <Text style={[s.historyBadgeText, { color: cfg?.fg ?? '#64748B' }]}>
                              {cfg?.label ?? entry.status}
                            </Text>
                          </View>
                          <Text style={s.historyTime}>{fmtTimeRelative(entry.createdAt)}</Text>
                        </View>
                        {entry.reason && (
                          <Text style={s.historyReason}>{'\u201C'}{entry.reason}{'\u201D'}</Text>
                        )}
                        <Text style={s.historyDate}>{fmtDateTime(entry.createdAt)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { padding: SIDE_PADDING, paddingTop: 12, gap: 12 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: NAVY, textAlign: 'center' },

  loadingText: { fontSize: 14, fontWeight: '600', color: NAVY_MUTED, marginTop: 12 },

  heroBanner: {
    borderRadius: 20, padding: CARD_PADDING, marginBottom: 4,
  },
  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  statusBadge: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusBadgeText: { color: WHITE, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  heroRef: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
  heroGuest: { color: WHITE, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroRoom: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginTop: 2 },

  card: {
    borderRadius: 16, borderWidth: 1, padding: CARD_PADDING, gap: 4,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: NAVY },

  actionsSection: { gap: 10, marginTop: 4 },
  actionsLabel: { fontSize: 15, fontWeight: '700', color: NAVY },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    minWidth: '47%',
  },
  actionIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  actionText: { fontSize: 13, fontWeight: '700' },

  historyToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  historyToggleText: { flex: 1, fontSize: 14, fontWeight: '700', color: NAVY },
  historyList: { marginTop: 12, gap: 0 },
  historyRow: { flexDirection: 'row', gap: 12, minHeight: 52 },
  historyLeft: { alignItems: 'center', width: 14 },
  historyDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  historyLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: '#EEF2F6', marginTop: 2 },
  historyContent: { flex: 1, paddingBottom: 16, gap: 4 },
  historyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  historyBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  historyTime: { fontSize: 11, fontWeight: '500', color: NAVY_MUTED },
  historyReason: { fontSize: 12, fontStyle: 'italic', color: NAVY_MUTED, lineHeight: 16 },
  historyDate: { fontSize: 11, color: '#8FA1B3' },
});
