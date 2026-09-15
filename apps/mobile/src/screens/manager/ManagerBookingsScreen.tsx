import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { Badge, Button, Card, EmptyState, ErrorBox } from '../../components/Shared';
import ScreenHeader from '../../components/ScreenHeader';
import { SkeletonList } from '../../components/Skeleton';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { colors, font, radius, shadowCard } from '../../theme';

type Props = { onBack: () => void; onNavigate?: (page: { screen: string } & Record<string, any>) => void };
type Tab = 'PENDING' | 'CONFIRMED' | 'ON_PROPERTY' | 'CLOSED';

interface ManagedBooking {
  id: string;
  guestName: string;
  hotelName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalPrice: number;
  payment?: { method?: string; status?: string } | null;
}

const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const TABS: { key: Tab; label: string }[] = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'ON_PROPERTY', label: 'On Property' },
  { key: 'CLOSED', label: 'Closed' },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ManagerBookingsScreen({ onBack, onNavigate }: Props) {
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const toast = useToast();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<Tab>('PENDING');
  const [bookings, setBookings] = useState<ManagedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; bookingId: string; action: string; title: string; body: string }>({
    open: false, bookingId: '', action: '', title: '', body: '',
  });
  const [relocateBooking, setRelocateBooking] = useState<ManagedBooking | null>(null);
  const [relocateDetailId, setRelocateDetailId] = useState('');
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string; type?: string; status?: string }>>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [relocateReason, setRelocateReason] = useState('');
  const [relocateLoading, setRelocateLoading] = useState(false);
  const [relocateError, setRelocateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await request<{ data: ManagedBooking[] }>(`/bookings/manage?status=${tab}`, { token });
      setBookings(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, tab]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  const performAction = async (id: string, action: string) => {
    setActionLoading(id);
    try {
      await request(`/bookings/manage/${id}/${action}`, {
        method: 'POST',
        token,
        ...(action === 'cancel' ? { body: { reason: 'Cancelled by hotel staff' } } : {}),
      });
      toast('success', `${action.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} successful`);
      void load();
    } catch (err) {
      toast('error', 'Action failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setActionLoading(null);
      setConfirmDialog((d) => ({ ...d, open: false }));
    }
  };

  const requestAction = (id: string, action: string, title: string, body: string) => {
    setConfirmDialog({ open: true, bookingId: id, action, title, body });
  };

  const openRelocate = async (booking: ManagedBooking) => {
    setRelocateBooking(booking);
    setSelectedRoomId('');
    setRelocateReason('');
    setRelocateError(null);
    try {
      const detail = await request<any>(`/bookings/${booking.id}`, { token });
      const detailId = detail?.details?.[0]?.id;
      const hotelId = detail?.hotelId ?? detail?.hotel?.id;
      if (!detailId || !hotelId) throw new Error('Booking room details are unavailable.');
      setRelocateDetailId(detailId);
      const roomsResponse = await request<any[]>(
        `/catalog/hotels/${hotelId}/rooms?checkIn=${encodeURIComponent(booking.checkIn)}&checkOut=${encodeURIComponent(booking.checkOut)}`,
        { token },
      );
      const available = (Array.isArray(roomsResponse) ? roomsResponse : (roomsResponse as any)?.data ?? [])
        .filter((room: any) => room.status === 'AVAILABLE');
      setRooms(available);
    } catch (err) {
      setRelocateError(err instanceof Error ? err.message : 'Unable to load available rooms.');
    }
  };

  const submitRelocation = async () => {
    if (!relocateBooking || !relocateDetailId || !selectedRoomId || !relocateReason.trim()) {
      setRelocateError('Select a room and provide a reason.');
      return;
    }
    setRelocateLoading(true);
    try {
      await request(`/bookings/manage/${relocateBooking.id}/relocate`, {
        method: 'POST',
        body: { bookingDetailId: relocateDetailId, newRoomId: selectedRoomId, reason: relocateReason.trim() },
        token,
      });
      toast('success', 'Guest room relocated');
      setRelocateBooking(null);
      void load();
    } catch (err) {
      setRelocateError(err instanceof Error ? err.message : 'Room relocation failed.');
    } finally {
      setRelocateLoading(false);
    }
  };

  const renderActions = (item: ManagedBooking) => {
    const busy = actionLoading === item.id;
    switch (tab) {
      case 'PENDING':
        return (
          <View style={styles.actionRow}>
            <Button title="Confirm" size="sm" loading={busy} onPress={() => requestAction(item.id, 'confirm', 'Confirm Booking', 'Approve this booking request?')} />
            <Button title="Reject" size="sm" variant="danger" loading={busy} onPress={() => requestAction(item.id, 'reject', 'Reject Booking', 'Decline this booking request?')} />
            <Button title="Cancel" size="sm" variant="danger" loading={busy} onPress={() => requestAction(item.id, 'cancel', 'Cancel Booking', 'Cancel this booking on behalf of the guest?')} />
          </View>
        );
      case 'CONFIRMED':
        return (
          <View style={styles.actionRow}>
            <Button title="Check In" size="sm" loading={busy} onPress={() => requestAction(item.id, 'check-in', 'Check In Guest', 'Mark guest as checked in?')} />
            <Button title="Early Check-in" size="sm" loading={busy} onPress={() => navigation.navigate('EarlyCheckinLateCheckout', { bookingId: item.id, mode: 'early-checkin' })} />
            <Button title="Cancel" size="sm" variant="danger" loading={busy} onPress={() => requestAction(item.id, 'cancel', 'Cancel Booking', 'Cancel this booking on behalf of the guest?')} />
            {item.payment?.method === 'CASH_AT_HOTEL' && item.payment.status !== 'SUCCEEDED' && (
              <Button title="Mark Paid" size="sm" variant="gold" loading={busy} onPress={() => requestAction(item.id, 'mark-paid', 'Mark Cash Paid', 'Confirm that cash was received from the guest?')} />
            )}
            <Button title="No-show" size="sm" variant="danger" loading={busy} onPress={() => requestAction(item.id, 'no-show', 'Mark No-show', 'Mark this guest as a no-show?')} />
          </View>
        );
      case 'ON_PROPERTY':
        return (
          <View style={styles.actionRow}>
            <Button title="Check Out" size="sm" variant="gold" loading={busy} onPress={() => requestAction(item.id, 'check-out', 'Check Out Guest', 'Mark guest as checked out?')} />
            <Button title="Late Check-out" size="sm" loading={busy} onPress={() => navigation.navigate('EarlyCheckinLateCheckout', { bookingId: item.id, mode: 'late-checkout' })} />
            <Button title="Relocate" size="sm" variant="secondary" loading={busy} onPress={() => void openRelocate(item)} />
            {item.payment?.method === 'CASH_AT_HOTEL' && item.payment.status !== 'SUCCEEDED' && (
              <Button title="Mark Paid" size="sm" variant="gold" loading={busy} onPress={() => requestAction(item.id, 'mark-paid', 'Mark Cash Paid', 'Confirm that cash was received from the guest?')} />
            )}
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Manage Bookings"
        onBack={onBack}
        subtitle="Confirm, check-in, check-out guests"
        rightElement={
          <Button
            title="+ Walk-in"
            size="sm"
            onPress={() => navigation.navigate('WalkInBooking')}
          />
        }
      />
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && <ErrorBox message={error} onRetry={load} />}

      <FlashList
        data={bookings}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.teal} colors={[colors.teal]} />}
        ListEmptyComponent={loading ? <SkeletonList count={4} /> : <EmptyState title="No bookings" subtitle={`No ${tab.toLowerCase().replace('_', ' ')} bookings found`} />}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.flex}>
                <Text style={styles.guestName}>{item.guestName}</Text>
                <Text style={styles.hotel}>{item.hotelName} · Room {item.roomNumber}</Text>
              </View>
              <Badge status={item.status} />
            </View>
            <Text style={styles.dates}>{fmt(item.checkIn)} → {fmt(item.checkOut)}</Text>
            <Text style={styles.price}>ETB {item.totalPrice}</Text>
            {renderActions(item)}
          </Card>
        )}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((d) => ({ ...d, open: false }))}
        onConfirm={() => performAction(confirmDialog.bookingId, confirmDialog.action)}
        title={confirmDialog.title}
        body={confirmDialog.body}
        confirmLabel={confirmDialog.action === 'reject' || confirmDialog.action === 'check-out' || confirmDialog.action === 'cancel' || confirmDialog.action === 'no-show' ? 'Yes, proceed' : 'Confirm'}
        danger={confirmDialog.action === 'reject' || confirmDialog.action === 'cancel' || confirmDialog.action === 'no-show'}
        busy={actionLoading === confirmDialog.bookingId}
      />

      <Modal visible={!!relocateBooking} transparent animationType="slide" onRequestClose={() => setRelocateBooking(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRelocateBooking(null)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Relocate Guest</Text>
            <Text style={styles.modalSub}>Choose an available room and record the operational reason.</Text>
            {relocateError && <Text style={styles.modalError}>{relocateError}</Text>}
            <Text style={styles.modalLabel}>Available rooms</Text>
            <ScrollView style={styles.roomPicker} nestedScrollEnabled>
              {rooms.map((room) => (
                <Pressable key={room.id} onPress={() => setSelectedRoomId(room.id)} style={[styles.roomOption, selectedRoomId === room.id && styles.roomOptionActive]}>
                  <Text style={styles.roomOptionText}>Room {room.roomNumber}{room.type ? ` · ${room.type}` : ''}</Text>
                  {selectedRoomId === room.id && <Ionicons name="checkmark-circle" size={18} color={colors.teal} />}
                </Pressable>
              ))}
              {rooms.length === 0 && !relocateError && <Text style={styles.modalSub}>No available rooms found.</Text>}
            </ScrollView>
            <TextInput
              value={relocateReason}
              onChangeText={setRelocateReason}
              placeholder="Reason for relocation"
              placeholderTextColor={colors.inkMuted}
              style={styles.reasonInput}
              multiline
            />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setRelocateBooking(null)} />
              <Button title={relocateLoading ? 'Saving…' : 'Relocate'} onPress={() => void submitRelocation()} loading={relocateLoading} disabled={relocateLoading || !selectedRoomId || !relocateReason.trim()} />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* M5 — Walk-in booking FAB (Policy 48) */}
      <Pressable
        onPress={() => navigation.navigate('WalkInBooking')}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Create walk-in booking"
      >
        <Ionicons name="add" size={20} color="#FFFFFF" />
        <Text style={styles.fabLabel}>Walk-in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginVertical: 12 },
  tab: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8, ...shadowCard },
  tabActive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  tabTextActive: { color: colors.tealDeep, fontWeight: '700' },
  list: { padding: 16, paddingTop: 4, gap: 12 },
  card: { gap: 8, padding: 16, borderRadius: radius.card, ...shadowCard },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1 },
  guestName: { fontFamily: font.display, fontSize: 17, fontWeight: '700', color: colors.ink },
  hotel: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  dates: { fontSize: 13, color: colors.inkMuted },
  price: { fontSize: 16, fontWeight: '800', color: colors.tealDeep },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },

  /* ─── FAB ─── */
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: colors.teal,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  fabIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  fabLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  modalSub: { fontSize: 13, color: colors.inkMuted },
  modalError: { color: '#B91C1C', fontSize: 13 },
  modalLabel: { fontSize: 13, fontWeight: '700', color: colors.ink },
  roomPicker: { maxHeight: 190, borderWidth: 1, borderColor: colors.line, borderRadius: 10 },
  roomOption: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, flexDirection: 'row', justifyContent: 'space-between' },
  roomOptionActive: { backgroundColor: colors.tealTint },
  roomOptionText: { color: colors.ink, fontSize: 14 },
  reasonInput: { minHeight: 80, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, color: colors.ink, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10 },
});
