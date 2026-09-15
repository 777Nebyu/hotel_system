import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { Button, Card, ErrorBox, Stars } from '../../components/Shared';
import ScreenHeader from '../../components/ScreenHeader';
import { SkeletonKPI } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { colors, radius, shadowCard } from '../../theme';

type Props = { onBack: () => void; onNavigate?: (page: { screen: string } & Record<string, any>) => void };

interface HotelProfile {
  id: string;
  name: string;
  description: string;
  starRating: number;
  address: string;
  city?: string;
  averageRating?: number;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ManagerHotelScreen({ onBack, onNavigate }: Props) {
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const toast = useToast();
  const [hotel, setHotel] = useState<HotelProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [starRating, setStarRating] = useState(3);
  const [address, setAddress] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await request<{ data: HotelProfile[] }>('/catalog/manager/hotels', { token });
      const h = res.data?.[0] ?? null;
      setHotel(h);
      if (h) {
        setName(h.name);
        setDescription(h.description ?? '');
        setStarRating(h.starRating ?? 3);
        setAddress(h.address ?? '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hotel');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!hotel) return;
    setSaving(true);
    try {
      await request(`/catalog/hotels/${hotel.id}`, {
        method: 'PATCH',
        body: { name, description, starRating, address },
        token,
      });
      toast('success', 'Hotel updated');
      void load();
    } catch (err) {
      toast('error', 'Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <View style={styles.container}>
      <ScreenHeader title="Hotel Profile" onBack={onBack} />
      <View style={styles.center}><SkeletonKPI /></View>
    </View>
  );

  if (error) return (
    <View style={styles.container}>
      <ScreenHeader title="Hotel Profile" onBack={onBack} />
      <View style={styles.center}><ErrorBox message={error} onRetry={load} /></View>
    </View>
  );

  if (!hotel) return (
    <View style={styles.container}>
      <ScreenHeader title="Hotel Profile" onBack={onBack} />
      <View style={styles.center}><ErrorBox message="No hotel found. Create one first." /></View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Hotel Profile" onBack={onBack} subtitle="Manage your hotel information & rating" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Card style={styles.card}>
        <Text style={styles.label}>Hotel Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Hotel name" placeholderTextColor={colors.inkMuted} />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholder="Describe your hotel..." placeholderTextColor={colors.inkMuted} />

        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Full address" placeholderTextColor={colors.inkMuted} />

        <Text style={styles.label}>Star Rating</Text>
        <View style={styles.starRow}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Pressable
              key={s}
              onPress={() => setStarRating(s)}
              accessibilityRole="button"
              accessibilityLabel={`${s} stars`}
              style={({ pressed }) => [
                styles.starBtn,
                s <= starRating && styles.starBtnActive,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons
                name={s <= starRating ? 'star' : 'star-outline'}
                size={22}
                color={s <= starRating ? colors.gold : colors.inkMuted}
              />
            </Pressable>
          ))}
        </View>
        <Text style={styles.starHint}>{starRating} of 5 Stars</Text>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>Current Rating</Text>
        <Stars value={hotel.averageRating ?? 0} size={16} />
        <Text style={styles.ratingValue}>{(hotel.averageRating ?? 0).toFixed(1)} / 5.0</Text>
      </Card>

      <Button title={saving ? 'Saving...' : 'Save Changes'} loading={saving} onPress={save} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, padding: 20 },
  card: { marginBottom: 16, gap: 8, padding: 16, borderRadius: radius.card, ...shadowCard },
  label: { fontSize: 12, fontWeight: '700', color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  starRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  starBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  starBtnActive: { borderColor: colors.gold, backgroundColor: colors.goldTint },
  starText: { fontSize: 20, color: colors.inkMuted },
  starTextActive: { color: colors.gold },
  starHint: { fontSize: 13, fontWeight: '600', color: colors.goldDeep, marginTop: 4 },
  ratingValue: { fontSize: 14, color: colors.inkMuted, marginTop: 4 },
});
