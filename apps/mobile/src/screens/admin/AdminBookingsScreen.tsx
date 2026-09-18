/**
 * AdminBookingsScreen
 * Fixes:
 *  - Correct API field names: checkIn, checkOut, user, hotel (nested), reference
 *  - Added admin-cancel button (POST /bookings/manage/:id/admin-cancel)
 *  - Added confirm/reject/check-in/check-out/mark-paid actions (RBAC-002)
 *  - Added status filter tabs
 *  - CSV export button
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';

import { useAppSelector } from '../../store/hooks';
import { request, requestBlob } from '../../api';
import { useThemeColors, shadowCard } from '../../theme';
import { Badge, Button, Card, EmptyState, ErrorBox } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import ScreenHeader from '../../components/ScreenHeader';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface Props {
  onNavigate?: (page: { screen: string } & Record<string, any>) => void;
  onBack: () => void;
}

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'CHECKED_IN', label: 'Checked In' },
  { key: 'CHECKED_OUT', label: 'Checked Out' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

function fmtDate(d?: string) {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminBookingsScreen({ onNavigate, onBack }: Props) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const c = useThemeColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const token = useAppSelector((st) => st.auth.session?.accessToken ?? '');
  const toast = useToast();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [bookings,   setBookings]   = useState<any[]>([]);
  const [tab,        setTab]        = useState('ALL');
  const [search,     setSearch]     = useState('');

  // Cancel modal
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; ref: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling,   setCancelling]   = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    bookingId: string;
    action: string;
    title: string;
    body: string;
    danger?: boolean;
  }>({ open: false, bookingId: '', action: '', title: '', body: '' });

  const fetchBookings = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ pageSize: '100' });
      if (tab !== 'ALL') qs.set('status', tab);
      const res = await request<any>(`/admin/bookings?${qs}`, { method: 'GET', token });
      setBookings(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, tab]);

  useEffect(() => { void fetchBookings(); }, [fetchBookings]);

  const handleExport = async () => {
    try {
      const { File, Paths } = await import('expo-file-system');
      const Sharing = await import('expo-sharing');
      const blob = await requestBlob('/admin/export', {
        method: 'POST',
        body: { type: 'bookings', format: 'csv' },
        token,
      });
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const file = new File(Paths.document, 'bookings_export.csv');
        file.write(base64);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Bookings',
          });
        }
        toast('success', 'Bookings exported');
      };
      reader.readAsDataURL(new Blob([blob], { type: 'text/csv' }));
    } catch (err: any) {
      toast('error', err.message || 'Export failed');
    }
  };

  const openCancel = (booking: any) => {
    setCancelTarget({ id: booking.id, ref: booking.reference ?? booking.id.slice(0, 8) });
    setCancelReason('');
    setCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) { toast('error', 'Provide a cancellation reason'); return; }
    setCancelling(true);
    try {
      await request(`/bookings/${cancelTarget.id}/cancel`, {
        method: 'POST',
        body: { reason: cancelReason.trim() },
        token,
      });
      setBookings((prev) =>
        prev.map((b) => b.id === cancelTarget.id ? { ...b, status: 'CANCELLED' } : b),
      );
      toast('success', 'Booking cancelled');
      setCancelModal(false);
    } catch (err: any) {
      toast('error', err.message || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const performAction = async (id: string, action: string) => {
    setActionLoading(id);
    try {
      const endpoint = action === 'mark-paid' ? `/payments/${id}/cash-paid` : `/bookings/${id}/${action}`;
      await request(endpoint, { method: 'POST', token });
      toast('success', `${action.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())} successful`);
      void fetchBookings();
    } catch (err: any) {
      toast('error', 'Action failed', err?.message || 'Unknown error');
    } finally {
      setActionLoading(null);
      setConfirmDialog((d) => ({ ...d, open: false }));
    }
  };

  const requestAction = (id: string, action: string, title: string, body: string, danger?: boolean) => {
    setConfirmDialog({ open: true, bookingId: id, action, title, body, danger });
  };

  const filtered = useMemo(() => bookings.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.reference?.toLowerCase().includes(q) ||
      b.user?.fullName?.toLowerCase().includes(q) ||
      b.user?.email?.toLowerCase().includes(q) ||
      b.hotel?.name?.toLowerCase().includes(q)
    );
  }), [bookings, search]);

  const tabCounts = useMemo(() => {
    const counts = bookings.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    counts['ALL'] = bookings.length;
    return counts;
  }, [bookings]);

  return (
    <View style={s.root}>
      <ScreenHeader
        title="All Bookings"
        onBack={onBack}
        subtitle={`${filtered.length} bookings`}
        rightElement={
          <Pressable onPress={handleExport} hitSlop={8} style={s.exportBtn}>
            <Ionicons name="download-outline" size={22} color={c.teal} />
          </Pressable>
        }
      />

      {/* Status tabs */}
      <View style={s.tabsWrap}>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {STATUS_TABS.map((tabItem) => {
            const isActive = tab === tabItem.key;
            const count = tabCounts[tabItem.key] ?? 0;
            return (
              <Pressable
                key={tabItem.key}
                onPress={() => setTab(tabItem.key)}
                style={({ pressed }) => [
                  s.tabPill,
                  isActive && s.tabPillActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[s.tabText, isActive && s.tabTextActive]}>
                  {tabItem.label}
                </Text>
                <View style={[s.tabCount, isActive && s.tabCountActive]}>
                  <Text style={[s.tabCountText, isActive && s.tabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color={c.inkMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search guest, hotel, ref…"
          placeholderTextColor={c.inkMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <ErrorBox message={error} onRetry={fetchBookings} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No bookings found" />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item: b }) => (
            <Card style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.flex}>
                  {/* Guest */}
                  <Text style={s.guestName} numberOfLines={1}>
                    {b.user?.fullName ?? b.user?.email ?? 'Guest'}
                  </Text>
                  {/* Hotel */}
                  <Text style={s.hotelName} numberOfLines={1}>
                    {b.hotel?.name ?? b.hotelId}
                  </Text>
                </View>
                <View style={s.rightCol}>
                  <Badge status={b.status} />
                  {b.reference && (
                    <Text style={s.ref}>{b.reference}</Text>
                  )}
                </View>
              </View>

              {/* Dates */}
              <View style={s.datesRow}>
                <View style={s.dateItem}>
                  <Text style={s.dateLabel}>CHECK-IN</Text>
                  <Text style={s.dateVal}>{fmtDate(b.checkIn)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={13} color={c.inkMuted} />
                <View style={s.dateItem}>
                  <Text style={s.dateLabel}>CHECK-OUT</Text>
                  <Text style={s.dateVal}>{fmtDate(b.checkOut)}</Text>
                </View>
              </View>

              {/* Price row */}
              <View style={s.priceRow}>
                <Text style={s.price}>ETB {Number(b.totalPrice ?? 0).toLocaleString()}</Text>
                <Badge status={b.payment?.status ?? 'PENDING'} label={b.payment?.status ?? 'PENDING'} />
              </View>

              {/* Action buttons */}
              <View style={s.actions}>
                {/* PENDING: Confirm / Reject */}
                {b.status === 'PENDING' && (
                  <>
                    <Button
                      title={actionLoading === b.id ? 'Working...' : 'Confirm'}
                      size="sm"
                      loading={actionLoading === b.id}
                      onPress={() => requestAction(b.id, 'confirm', 'Confirm Booking', 'Approve this booking request?')}
                    />
                    <Button
                      title="Reject"
                      size="sm"
                      variant="danger"
                      loading={actionLoading === b.id}
                      onPress={() => requestAction(b.id, 'reject', 'Reject Booking', 'Decline this booking request?')}
                    />
                  </>
                )}
                {/* CONFIRMED: Check-in */}
                {b.status === 'CONFIRMED' && (
                  <Button
                    title={actionLoading === b.id ? 'Working...' : 'Check In'}
                    size="sm"
                    loading={actionLoading === b.id}
                    onPress={() => requestAction(b.id, 'check-in', 'Check In Guest', 'Mark guest as checked in?')}
                  />
                )}
                {/* CHECKED_IN: Check-out */}
                {b.status === 'CHECKED_IN' && (
                  <Button
                    title={actionLoading === b.id ? 'Working...' : 'Check Out'}
                    size="sm"
                    variant="gold"
                    loading={actionLoading === b.id}
                    onPress={() => requestAction(b.id, 'check-out', 'Check Out Guest', 'Mark guest as checked out?')}
                  />
                )}
                {/* Cash-at-Hotel pending: Mark Paid */}
                {b.payment?.status === 'PENDING_AT_HOTEL' && (
                  <Button
                    title={actionLoading === b.id ? 'Working...' : 'Mark Paid'}
                    size="sm"
                    loading={actionLoading === b.id}
                    onPress={() => requestAction(b.id, 'mark-paid', 'Mark Cash at Hotel Paid', 'Confirm payment received from guest?')}
                  />
                )}
                {/* Admin cancel — only if cancellable */}
                {!['CANCELLED', 'CHECKED_OUT', 'NO_SHOW'].includes(b.status) && (
                  <Button
                    title="Cancel"
                    size="sm"
                    variant="danger"
                    onPress={() => openCancel(b)}
                  />
                )}
              </View>
            </Card>
          )}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchBookings(); }} tintColor={c.teal} />
          }
        />
      )}

      {/* Cancel modal */}
      <Modal visible={cancelModal} transparent animationType="slide" onRequestClose={() => setCancelModal(false)}>
        <Pressable style={s.overlay} onPress={() => setCancelModal(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Cancel Booking</Text>
            <Text style={s.sheetSub}>Booking {cancelTarget?.ref}</Text>
            <Text style={s.inputLabel}>Reason (required)</Text>
            <TextInput
              style={s.textarea}
              placeholder="Enter reason for admin cancellation…"
              placeholderTextColor={c.inkMuted}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={s.sheetActions}>
              <Button title="Keep" variant="secondary" onPress={() => setCancelModal(false)} />
              <Button
                title={cancelling ? 'Cancelling…' : 'Cancel Booking'}
                variant="danger"
                onPress={confirmCancel}
                disabled={cancelling}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((d) => ({ ...d, open: false }))}
        onConfirm={() => performAction(confirmDialog.bookingId, confirmDialog.action)}
        title={confirmDialog.title}
        body={confirmDialog.body}
        confirmLabel={confirmDialog.danger ? 'Yes, proceed' : 'Confirm'}
        danger={confirmDialog.danger}
        busy={actionLoading === confirmDialog.bookingId}
      />
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  root:       { flex: 1, backgroundColor: c.paper },
  list:       { padding: 16, gap: 12, paddingBottom: 48 },
  flex:       { flex: 1 },
  exportBtn:  { padding: 4 },
  tabsWrap:   { maxHeight: 48 },
  tabs:       { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  tabPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: c.lineStrong, backgroundColor: c.paperDeep },
  tabPillActive:{ backgroundColor: c.teal, borderColor: c.teal },
  tabText:    { fontSize: 11, fontWeight: '600', color: c.inkMuted },
  tabTextActive:{ color: '#FFFFFF' },
  tabCount:   { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: c.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountActive:{ backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText:{ fontSize: 9, fontWeight: '700', color: c.inkMuted },
  tabCountTextActive:{ color: '#FFFFFF' },
  searchBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, height: 42, backgroundColor: c.surface },
  searchInput:{ flex: 1, fontSize: 14, color: c.ink },
  card:       { padding: 14, ...shadowCard },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  guestName:  { fontSize: 15, fontWeight: '700', color: c.ink },
  hotelName:  { fontSize: 13, color: c.inkMuted, marginTop: 2 },
  rightCol:   { alignItems: 'flex-end', gap: 4 },
  ref:        { fontSize: 10, fontWeight: '700', color: c.inkMuted, letterSpacing: 0.5 },
  datesRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dateItem:   { flex: 1 },
  dateLabel:  { fontSize: 11, fontWeight: '700', color: c.teal, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateVal:    { fontSize: 13, fontWeight: '600', color: c.ink, marginTop: 2 },
  priceRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price:      { fontSize: 16, fontWeight: '800', color: c.ink },
  actions:    { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  sheetHandle:{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.line, alignSelf: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: c.ink },
  sheetSub:   { fontSize: 13, color: c.inkMuted },
  inputLabel: { fontSize: 12, fontWeight: '700', color: c.inkMuted },
  textarea:   { borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 12, fontSize: 14, color: c.ink, backgroundColor: c.paper, minHeight: 80 },
  sheetActions:{ flexDirection: 'row', gap: 10 },
});
