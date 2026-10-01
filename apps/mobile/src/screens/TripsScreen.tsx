import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../store/hooks';
import { request } from '../api';
import { colors, darkColors } from '../theme';
import { useTheme } from '../hooks/useTheme';
import ScreenHeader from '../components/ScreenHeader';

type TripItem = {
  id: string;
  title: string;
  dayDate: string;
  startTime?: string | null;
  status: 'PLANNED' | 'DONE' | 'SKIPPED';
};

type Trip = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  items: TripItem[];
  hotel?: { name: string } | null;
};

export default function TripsScreen() {
  const token = useAppSelector((state) => state.auth.session?.accessToken);
  const { colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const c = dark ? darkColors : colors;
  const insets = useSafeAreaInsets();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await request<{ data: Trip[] }>('/trips', { token });
      setTrips(response.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load trips.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  return (
    <View style={[styles.container, { backgroundColor: c.paper }]}>
      <ScreenHeader title="My trips" subtitle="Private itinerary planner" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
        <View style={[styles.intro, { backgroundColor: c.teal }]}>
          <Ionicons name="calendar-outline" size={24} color={c.gold} />
          <Text style={styles.introTitle}>Plan your stay</Text>
          <Text style={styles.introBody}>Combine reservations, verified places, and custom activities in one timeline.</Text>
        </View>
        {loading && <ActivityIndicator color={c.teal} style={styles.loader} />}
        {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
        {!loading && !error && trips.length === 0 && (
          <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Ionicons name="map-outline" size={42} color={c.inkMuted} />
            <Text style={[styles.emptyTitle, { color: c.ink }]}>No trips yet</Text>
            <Text style={[styles.emptyBody, { color: c.inkMuted }]}>Create your first itinerary from the web portal, then manage it here.</Text>
          </View>
        )}
        {trips.map((trip) => (
          <View key={trip.id} style={[styles.tripCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={styles.tripHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tripTitle, { color: c.ink }]}>{trip.title}</Text>
                <Text style={[styles.tripDates, { color: c.inkMuted }]}>{trip.startDate.slice(0, 10)} — {trip.endDate.slice(0, 10)}</Text>
                {trip.hotel && <Text style={[styles.tripHotel, { color: c.inkMuted }]}>{trip.hotel.name}</Text>}
              </View>
              <Text style={[styles.itemCount, { color: c.teal }]}>{trip.items.length} items</Text>
            </View>
            {trip.items.map((item) => (
              <View key={item.id} style={[styles.itemRow, { borderTopColor: c.line }]}>
                <Ionicons name={item.status === 'DONE' ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={item.status === 'DONE' ? c.teal : c.inkMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitle, { color: c.ink }]}>{item.title}</Text>
                  <Text style={[styles.itemMeta, { color: c.inkMuted }]}>{item.dayDate.slice(0, 10)}{item.startTime ? ' · ' + item.startTime : ''}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}
        {!loading && <Pressable onPress={() => void load()} style={[styles.refresh, { borderColor: c.line }]}><Ionicons name="refresh-outline" size={16} color={c.teal} /><Text style={[styles.refreshText, { color: c.teal }]}>Refresh itinerary</Text></Pressable>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14 },
  intro: { borderRadius: 20, padding: 18 },
  introTitle: { color: '#FFF', fontSize: 22, fontWeight: '800', marginTop: 10 },
  introBody: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 18, marginTop: 5 },
  loader: { marginTop: 32 },
  error: { textAlign: 'center', fontSize: 13, padding: 16 },
  empty: { alignItems: 'center', borderRadius: 20, borderWidth: 1, padding: 30 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 10 },
  emptyBody: { textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 5 },
  tripCard: { borderRadius: 20, borderWidth: 1, padding: 15 },
  tripHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  tripTitle: { fontSize: 18, fontWeight: '800' },
  tripDates: { fontSize: 12, marginTop: 5 },
  tripHotel: { fontSize: 11, marginTop: 3 },
  itemCount: { fontSize: 11, fontWeight: '800' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12 },
  itemTitle: { fontSize: 13, fontWeight: '700' },
  itemMeta: { fontSize: 11, marginTop: 2 },
  refresh: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  refreshText: { fontSize: 12, fontWeight: '700' },
});
