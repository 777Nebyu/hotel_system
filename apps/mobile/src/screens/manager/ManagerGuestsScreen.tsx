import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { Card, EmptyState, ErrorBox } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import ScreenHeader from '../../components/ScreenHeader';
import { useThemeColors, radius } from '../../theme';

type Props = { onBack: () => void };
type Guest = { id: string; name: string; email?: string; phone?: string; bookings: number; activeBookings: number };

export default function ManagerGuestsScreen({ onBack }: Props) {
  const c = useThemeColors();
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const [rows, setRows] = useState<Guest[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await request<any>('/bookings/manage?page=1&pageSize=100', { token });
      const bookings = Array.isArray(res) ? res : res?.data ?? [];
      const grouped = new Map<string, Guest>();
      for (const booking of bookings) {
        const user = booking.user ?? {};
        const id = user.id ?? booking.userId ?? booking.guestEmail ?? booking.id;
        const active = ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status);
        const existing = grouped.get(id);
        if (existing) {
          existing.bookings += 1;
          existing.activeBookings += active ? 1 : 0;
        } else {
          grouped.set(id, { id, name: user.fullName ?? booking.guestName ?? 'Guest', email: user.email ?? booking.guestEmail, phone: user.phone ?? booking.guestPhone, bookings: 1, activeBookings: active ? 1 : 0 });
        }
      }
      setRows(Array.from(grouped.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err: any) { setError(err.message || 'Failed to load guests'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return q ? rows.filter((g) => [g.name, g.email, g.phone].some((v) => v?.toLowerCase().includes(q))) : rows; }, [rows, search]);

  return <View style={[styles.root, { backgroundColor: c.paper }]}>
    <ScreenHeader title="Guests" subtitle={`${rows.length} unique guests`} onBack={onBack} />
    {loading ? <SkeletonList count={5} /> : error ? <ErrorBox message={error} onRetry={load} /> : <FlashList
      data={filtered} keyExtractor={(item) => item.id} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={c.teal} />}
      ListHeaderComponent={<View style={[styles.searchWrap, { borderColor: c.line, backgroundColor: c.surface }]}><Ionicons name="search" size={18} color={c.inkMuted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search guests" placeholderTextColor={c.inkMuted} style={[styles.search, { color: c.ink }]} /></View>}
      ListEmptyComponent={<EmptyState title="No guests found" subtitle="Guests appear here after they have a booking at your hotel." />}
      renderItem={({ item }) => <Card style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}><View style={[styles.avatar, { backgroundColor: c.tealTint }]}><Text style={[styles.initial, { color: c.teal }]}>{item.name.charAt(0).toUpperCase()}</Text></View><View style={styles.info}><Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{item.name}</Text><Text style={[styles.secondary, { color: c.inkMuted }]} numberOfLines={1}>{item.email || item.phone || 'No contact information'}</Text><Text style={[styles.meta, { color: c.inkSoft }]}>{item.bookings} booking{item.bookings === 1 ? '' : 's'}{item.activeBookings ? ` · ${item.activeBookings} active` : ''}</Text></View></Card>}
    />}
  </View>;
}

const styles = StyleSheet.create({ root: { flex: 1 }, content: { padding: 16, paddingBottom: 36 }, searchWrap: { height: 44, borderWidth: 1, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 12, gap: 8 }, search: { flex: 1, fontSize: 14 }, card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderRadius: radius.card, marginBottom: 10 }, avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, initial: { fontSize: 18, fontWeight: '800' }, info: { flex: 1 }, name: { fontSize: 15, fontWeight: '700' }, secondary: { fontSize: 12, marginTop: 3 }, meta: { fontSize: 12, marginTop: 5 } });
