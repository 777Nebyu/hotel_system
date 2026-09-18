/**
 * AdminPaymentsScreen
 * Fixes:
 *  - Added refund button (POST /payments/:bookingId/refund)
 *  - Added export button (GET /admin/payments/export)
 *  - Correct field names from API: bookingId, method, amount, status, createdAt, booking.hotel, booking.user
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
import { Button, Card, EmptyState, ErrorBox } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import ScreenHeader from '../../components/ScreenHeader';

interface Props { onBack: () => void; }

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'SUCCEEDED', label: 'Paid' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'FAILED', label: 'Failed' },
  { key: 'REFUNDED', label: 'Refunded' },
];

function fmtDate(d?: string) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function AdminPaymentsScreen({ onBack }: Props) {
  const c = useThemeColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const STATUS_COLOR: Record<string, string> = {
    SUCCEEDED: c.success,
    PENDING:   c.warning,
    FAILED:    c.danger,
    REFUNDED:  c.info,
  };

  const token = useAppSelector((st) => st.auth.session?.accessToken ?? '');
  const toast = useToast();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [payments,   setPayments]   = useState<any[]>([]);
  const [statusTab,  setStatusTab]  = useState('ALL');

  // Refund modal
  const [refundModal,  setRefundModal]  = useState(false);
  const [refundTarget, setRefundTarget] = useState<{ paymentId: string; bookingId: string; amount: number } | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refunding,    setRefunding]    = useState(false);

  const fetchPayments = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ pageSize: '100' });
      if (statusTab !== 'ALL') qs.set('status', statusTab);
      const res = await request<any>(`/admin/payments?${qs}`, { method: 'GET', token });
      setPayments(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, statusTab]);

  useEffect(() => { void fetchPayments(); }, [fetchPayments]);

  const handleExport = async () => {
    try {
      const { File, Paths } = await import('expo-file-system');
      const Sharing = await import('expo-sharing');
      const blob = await requestBlob('/admin/export', {
        method: 'POST',
        body: { type: 'payments', format: 'csv' },
        token,
      });
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const file = new File(Paths.document, 'payments_export.csv');
        file.write(base64);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'text/csv',
            dialogTitle: 'Export Payments',
          });
        }
        toast('success', 'Payments exported');
      };
      reader.readAsDataURL(new Blob([blob], { type: 'text/csv' }));
    } catch (err: any) {
      toast('error', err.message || 'Export failed');
    }
  };

  const openRefund = (p: any) => {
    setRefundTarget({ paymentId: p.id, bookingId: p.bookingId, amount: Number(p.amount) });
    setRefundReason('');
    setRefundModal(true);
  };

  const confirmRefund = async () => {
    if (!refundTarget) return;
    if (!refundReason.trim()) { toast('error', 'Provide a refund reason'); return; }
    setRefunding(true);
    try {
      await request(`/payments/${refundTarget.bookingId}/refund`, {
        method: 'POST',
        body: { reason: refundReason.trim() },
        token,
      });
      setPayments((prev) =>
        prev.map((p) => p.id === refundTarget.paymentId ? { ...p, status: 'REFUNDED' } : p),
      );
      toast('success', 'Refund initiated');
      setRefundModal(false);
    } catch (err: any) {
      toast('error', err.message || 'Refund failed');
    } finally {
      setRefunding(false);
    }
  };

  const filtered = useMemo(() => payments.filter((p) => statusTab === 'ALL' || p.status === statusTab), [payments, statusTab]);

  const totalRevenue = useMemo(() => filtered
    .filter((p) => p.status === 'SUCCEEDED')
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0), [filtered]);

  const tabCounts = useMemo(() => {
    const counts = payments.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    counts['ALL'] = payments.length;
    return counts;
  }, [payments]);

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Payments"
        onBack={onBack}
        subtitle={`ETB ${totalRevenue.toLocaleString()} collected`}
        rightElement={
          <Pressable onPress={handleExport} hitSlop={8} style={s.exportBtn}>
            <Ionicons name="download-outline" size={22} color={c.teal} />
          </Pressable>
        }
      />

      {/* Status tabs */}
      <View style={s.tabsWrap}>
        <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {STATUS_TABS.map((tab) => {
            const isActive = statusTab === tab.key;
            const count = tabCounts[tab.key] ?? 0;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setStatusTab(tab.key)}
                style={({ pressed }) => [
                  s.tabPill,
                  isActive && s.tabPillActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[s.tabText, isActive && s.tabTextActive]}>
                  {tab.label}
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

      {loading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <ErrorBox message={error} onRetry={fetchPayments} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No payments found" />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item: p }) => {
            const sc = STATUS_COLOR[p.status] ?? c.inkMuted;
            return (
              <Card style={s.card}>
                <View style={s.cardHeader}>
                  <View style={s.flex}>
                    {/* Guest / Hotel names from nested booking */}
                    <Text style={s.guestName} numberOfLines={1}>
                      {p.booking?.user?.fullName ?? p.booking?.user?.email ?? 'Guest'}
                    </Text>
                    <Text style={s.hotelName} numberOfLines={1}>
                      {p.booking?.hotel?.name ?? '—'}
                    </Text>
                  </View>
                  <View style={s.rightCol}>
                    <Text style={[s.amount, { color: sc }]}>
                      ETB {Number(p.amount ?? 0).toLocaleString()}
                    </Text>
                    <View style={[s.statusBadge, { backgroundColor: sc + '18' }]}>
                      <Text style={[s.statusText, { color: sc }]}>{p.status}</Text>
                    </View>
                  </View>
                </View>

                <View style={s.detailsRow}>
                  <View style={s.detailItem}>
                    <Ionicons name="card-outline" size={12} color={c.inkMuted} />
                    <Text style={s.detailText}>
                      {p.method?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </Text>
                  </View>
                  <View style={s.detailItem}>
                    <Ionicons name="calendar-outline" size={12} color={c.inkMuted} />
                    <Text style={s.detailText}>{fmtDate(p.createdAt)}</Text>
                  </View>
                </View>

                {p.providerRef && (
                  <View style={s.detailItem}>
                    <Ionicons name="pricetag-outline" size={12} color={c.inkMuted} />
                    <Text style={s.detailText} numberOfLines={1}>Ref: {p.providerRef}</Text>
                  </View>
                )}

                <View style={s.detailItem}>
                  <Ionicons name="finger-print-outline" size={12} color={c.inkMuted} />
                  <Text style={s.detailText}>Payment {p.id.slice(0, 8)}</Text>
                  {p.bookingId && (
                    <Text style={s.detailText}> · Booking {p.bookingId.slice(0, 8)}</Text>
                  )}
                </View>

                {/* Refund button — only for SUCCEEDED payments */}
                {p.status === 'SUCCEEDED' && (
                  <View style={s.actions}>
                    <Button
                      title="Issue Refund"
                      variant="danger"
                      size="sm"
                      onPress={() => openRefund(p)}
                    />
                  </View>
                )}
              </Card>
            );
          }}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchPayments(); }} tintColor={c.teal} colors={[c.teal]} />
          }
        />
      )}

      {/* Refund modal */}
      <Modal visible={refundModal} transparent animationType="slide" onRequestClose={() => setRefundModal(false)}>
        <Pressable style={s.overlay} onPress={() => setRefundModal(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Issue Refund</Text>
            <Text style={s.sheetSub}>
              ETB {refundTarget?.amount.toLocaleString()} will be refunded to the customer.
            </Text>
            <Text style={s.inputLabel}>Reason (required)</Text>
            <TextInput
              style={s.textarea}
              placeholder="Enter refund reason…"
              placeholderTextColor={c.inkMuted}
              value={refundReason}
              onChangeText={setRefundReason}
              multiline numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={s.sheetActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setRefundModal(false)} />
              <Button
                title={refunding ? 'Processing…' : 'Confirm Refund'}
                variant="danger"
                onPress={confirmRefund}
                disabled={refunding}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
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
  card:       { padding: 14, gap: 6, ...shadowCard },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  guestName:  { fontSize: 14, fontWeight: '700', color: c.ink },
  hotelName:  { fontSize: 12, color: c.inkMuted, marginTop: 2 },
  rightCol:   { alignItems: 'flex-end', gap: 4 },
  amount:     { fontSize: 18, fontWeight: '800' },
  statusBadge:{ borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  detailsRow: { flexDirection: 'row', gap: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 11, color: c.inkMuted },
  actions:    { marginTop: 6 },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  sheetHandle:{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.line, alignSelf: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: c.ink },
  sheetSub:   { fontSize: 13, color: c.inkMuted },
  inputLabel: { fontSize: 12, fontWeight: '700', color: c.inkMuted },
  textarea:   { borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 12, fontSize: 14, color: c.ink, backgroundColor: c.paper, minHeight: 80 },
  sheetActions:{ flexDirection: 'row', gap: 10 },
});
