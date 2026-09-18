import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { Card, EmptyState, ErrorBox } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import ScreenHeader from '../../components/ScreenHeader';
import { font, radius, useThemeColors } from '../../theme';

export default function ManagerBillingScreen({ onBack }: { onBack: () => void }) {
  const c = useThemeColors();
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await request<{ data?: any[] }>('/bookings/manage?pageSize=100', { token });
      setRows(result.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing');
    } finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  const pending = rows.filter((b) => b.payment?.status !== 'SUCCEEDED' && b.payment?.status !== 'REFUNDED');
  const collected = rows.filter((b) => b.payment?.status === 'SUCCEEDED')
    .reduce((sum, b) => sum + Number(b.payment?.amount ?? b.totalPrice ?? 0), 0);

  return <View style={[styles.root, { backgroundColor: c.paper }]}>
    <ScreenHeader title="Billing" subtitle={`ETB ${collected.toLocaleString()} collected`} onBack={onBack} />
    {loading ? <SkeletonList count={5} /> : error ? <ErrorBox message={error} onRetry={load} /> : rows.length === 0 ? <EmptyState title="No billing records" /> :
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={c.teal} />} contentContainerStyle={styles.content}>
        <Text style={{ color: c.inkMuted, fontSize: 13, marginBottom: 4 }}>{pending.length} outstanding payment{pending.length === 1 ? '' : 's'}</Text>
        {rows.map((b) => <Card key={b.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={styles.row}><View style={styles.flex}><Text style={[styles.guest, { color: c.ink }]}>{b.user?.fullName ?? b.guestName ?? 'Guest'}</Text><Text style={[styles.ref, { color: c.inkMuted }]}>Booking #{(b.bookingRef ?? b.id).slice(0, 8).toUpperCase()}</Text></View><Text style={[styles.amount, { color: c.teal }]}>ETB {Number(b.payment?.amount ?? b.totalPrice ?? 0).toLocaleString()}</Text></View>
          <View style={styles.row}><Text style={[styles.method, { color: c.inkSoft }]}>{b.payment?.method ?? 'Payment pending'}</Text><Text style={[styles.status, { color: b.payment?.status === 'SUCCEEDED' ? c.success : c.warning }]}>{b.payment?.status ?? 'PENDING'}</Text></View>
        </Card>)}
      </ScrollView>}
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: 16, gap: 10, paddingBottom: 40 }, card: { padding: 14, gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, overflow: 'hidden' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, flex: { flex: 1 }, guest: { fontFamily: font.display, fontSize: 15, fontWeight: '700' }, ref: { fontSize: 11, marginTop: 3 }, amount: { fontWeight: '800', fontSize: 15 }, method: { fontSize: 12 }, status: { fontSize: 11, fontWeight: '800' } });
