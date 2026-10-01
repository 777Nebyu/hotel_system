import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { colors, darkColors } from '../theme';
import { request } from '../api';
import ScreenHeader from '../components/ScreenHeader';

type Place = {
  id: string; name: string; lat?: number; lng?: number; amharicName?: string; description: string; category: string; address: string;
  phone?: string; website?: string; openingHours?: string; hoursVerified: boolean; rating?: number; images?: string[];
  source?: { name: string; license?: string };
};

export default function DiscoverPlaceDetailsScreen({ placeId, onBack }: { placeId: string; onBack: () => void }) {
  const { colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const c = dark ? darkColors : colors;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const token = useAppSelector((state) => state.auth.session?.accessToken);
  const [saving, setSaving] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    request<Place>(`/discover/places/${encodeURIComponent(placeId)}`)
      .then((data) => { if (active) setPlace(data); })
      .catch((err) => { if (active) setError(err?.message || 'Unable to load this place.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [placeId]);

  if (loading) return <View style={[styles.center, { backgroundColor: c.paper }]}><ActivityIndicator size="large" color={c.teal} /><Text style={[styles.muted, { color: c.inkMuted }]}>Loading verified place details…</Text></View>;
  if (error || !place) return <View style={[styles.center, { backgroundColor: c.paper, padding: 24 }]}><Ionicons name="alert-circle-outline" size={42} color={c.danger || '#DC2626'} /><Text style={[styles.errorTitle, { color: c.ink }]}>Place unavailable</Text><Text style={[styles.muted, { color: c.inkMuted }]}>{error || 'This place is no longer published.'}</Text><Pressable onPress={onBack} style={[styles.backButton, { backgroundColor: c.teal }]}><Text style={styles.backText}>Back to Discover</Text></Pressable></View>;

  const image = place.images?.[0] || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1000';
  const navigateToPlace = () => {
    if (place.lat == null || place.lng == null) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`).catch(() => {});
  };
  const saveToTrip = async () => {
    if (!token || saving) return;
    setSaving(true);
    try {
      const trips = await request<{ data: Array<{ id: string; startDate: string }> }>('/trips', { token });
      const trip = trips.data?.[0];
      if (!trip) return;
      await request(`/trips/${trip.id}/items`, { method: 'POST', token, body: { itemType: 'PLACE', placeId: place.id, title: `Visit ${place.name}`, dayDate: trip.startDate.slice(0, 10), startTime: '10:00', durationMin: 90, currency: 'ETB' } });
    } finally {
      setSaving(false);
    }
  };
  return <View style={[styles.container, { backgroundColor: c.paper }]}><ScreenHeader title="Place Details" onBack={onBack} /><ScrollView contentContainerStyle={styles.content}><Image source={{ uri: image }} style={styles.hero} contentFit="cover" /><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}><View style={styles.badgeRow}><Text style={[styles.badge, { backgroundColor: c.teal }]}>{place.category}</Text>{place.hoursVerified && <Text style={styles.verified}>Verified hours</Text>}</View><Text style={[styles.title, { color: c.ink }]}>{place.name}</Text>{place.amharicName && <Text style={[styles.amharic, { color: c.teal }]}>{place.amharicName}</Text>}<Text style={[styles.description, { color: c.inkMuted }]}>{place.description}</Text><View style={styles.infoRow}><Ionicons name="location-outline" size={17} color={c.teal} /><Text style={[styles.info, { color: c.ink }]}>{place.address}</Text></View>{place.openingHours && <View style={styles.infoRow}><Ionicons name="time-outline" size={17} color={c.teal} /><Text style={[styles.info, { color: c.ink }]}>{place.openingHours}</Text></View>}{place.rating != null && <View style={styles.infoRow}><Ionicons name="star" size={17} color="#D4AF37" /><Text style={[styles.info, { color: c.ink }]}>{place.rating.toFixed(1)} rating</Text></View>}<View style={[styles.attribution, { borderTopColor: c.line }]}><Text style={[styles.source, { color: c.inkMuted }]}>Source: {place.source?.name || 'Verified records'}{place.source?.license ? ` · ${place.source.license}` : ''}</Text></View><View style={styles.actionRow}><Pressable onPress={navigateToPlace} style={[styles.actionButton, { backgroundColor: c.teal }]}><Ionicons name="navigate" size={15} color="#FFF" /><Text style={styles.actionText}>Navigate</Text></Pressable><Pressable onPress={() => void saveToTrip()} disabled={saving || !token} style={[styles.actionButton, { backgroundColor: c.gold, opacity: saving || !token ? 0.55 : 1 }]}><Ionicons name="bookmark" size={15} color="#0F2942" /><Text style={styles.saveActionText}>{saving ? 'Saving…' : 'Save'}</Text></Pressable><Pressable onPress={() => navigation.navigate('AIChat')} style={[styles.actionButton, { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1 }]}><Ionicons name="sparkles" size={15} color={c.teal} /><Text style={[styles.askActionText, { color: c.ink }]}>Ask AI</Text></Pressable></View>{place.phone && <Pressable onPress={() => Linking.openURL(`tel:${place.phone}`).catch(() => {})} style={[styles.callButton, { backgroundColor: c.teal }]}><Ionicons name="call" size={16} color="#FFF" /><Text style={styles.callText}>Call {place.phone}</Text></Pressable>}</View></ScrollView></View>;
}

const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, paddingBottom: 32 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, muted: { fontSize: 13, textAlign: 'center' }, errorTitle: { fontSize: 20, fontWeight: '700', marginTop: 8 }, backButton: { marginTop: 18, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 }, backText: { color: '#FFF', fontWeight: '700', fontSize: 13 }, hero: { width: '100%', height: 230, borderRadius: 20, backgroundColor: '#E2E8F0' }, card: { marginTop: 14, borderWidth: 1, borderRadius: 20, padding: 16 }, badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, badge: { color: '#FFF', fontSize: 10, fontWeight: '800', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 }, verified: { color: '#047857', backgroundColor: '#D1FAE5', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }, title: { fontSize: 25, fontWeight: '800', lineHeight: 31, marginTop: 14 }, amharic: { fontSize: 13, fontWeight: '700', marginTop: 3 }, description: { fontSize: 14, lineHeight: 21, marginTop: 12 }, infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12 }, info: { flex: 1, fontSize: 13, lineHeight: 18 }, attribution: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 12 }, source: { fontSize: 11, lineHeight: 16 }, callButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 16, borderRadius: 12, paddingVertical: 11 }, callText: { color: '#FFF', fontSize: 13, fontWeight: '700' }, actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 }, actionButton: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 }, actionText: { color: '#FFF', fontSize: 12, fontWeight: '800' }, saveActionText: { color: '#0F2942', fontSize: 12, fontWeight: '800' }, askActionText: { fontSize: 12, fontWeight: '800' } });
