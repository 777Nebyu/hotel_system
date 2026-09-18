import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { Card, ErrorBox, Stars } from '../../components/Shared';
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

  // ─── Toggle Save/Unsave — mirrors customer heart button ───────────────────
  //
  //  • isSaved = false  →  teal "Save Changes" button
  //  • Click            →  optimistic flip to green "Saved ✓", commit to API
  //  • isSaved = true   →  green "Saved ✓ — Tap to revert" button
  //  • Click again      →  reset form to last saved snapshot, flip back to teal
  //  • Edit any field   →  auto-flip back to teal (unsaved)
  //  • API error        →  rollback snapshot + state
  // ─────────────────────────────────────────────────────────────────────────

  const [isSaved, setIsSaved] = useState(false);
  const savedSnapshot = useRef({ name: '', description: '', starRating: 3, address: '' });
  const scaleAnim = useRef(new Animated.Value(1)).current;

  /** Auto-mark unsaved when user edits a field after a successful save */
  const markUnsaved = () => { if (isSaved) setIsSaved(false); };

  /** Heart-pop spring animation */
  const popAnimation = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.12, useNativeDriver: true, speed: 40, bounciness: 8 }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 4 }),
    ]).start();
  };

  const handleToggleSave = async () => {
    if (saving) return;

    if (isSaved) {
      // ── Unsave: revert form to last committed snapshot ──────────────────
      popAnimation();
      setName(savedSnapshot.current.name);
      setDescription(savedSnapshot.current.description);
      setStarRating(savedSnapshot.current.starRating);
      setAddress(savedSnapshot.current.address);
      setIsSaved(false);
      toast('info', 'Changes reset', 'Form reverted to last saved state.');
      return;
    }

    // ── Save: commit to server ────────────────────────────────────────────
    if (!hotel) return;
    setSaving(true);

    // Keep a rollback copy of the previous snapshot
    const prevSnapshot = { ...savedSnapshot.current };
    const prevName = name;
    const prevDesc = description;
    const prevStar = starRating;
    const prevAddr = address;

    // Optimistic update — flip state immediately (like hearting a hotel)
    savedSnapshot.current = { name, description, starRating, address };
    setIsSaved(true);
    popAnimation();

    try {
      await request(`/catalog/hotels/${hotel.id}`, {
        method: 'PATCH',
        body: { name, description, starRating, address },
        token,
      });
      toast('success', 'Hotel updated', 'Your changes have been saved.');
      void load();
    } catch (err) {
      // Rollback on failure — same as customer heart rollback
      savedSnapshot.current = prevSnapshot;
      setName(prevName);
      setDescription(prevDesc);
      setStarRating(prevStar);
      setAddress(prevAddr);
      setIsSaved(false);
      toast('error', 'Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading / Error / Empty guards ───────────────────────────────────────

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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Hotel Profile"
        onBack={onBack}
        subtitle="Manage your hotel information & rating"
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        <Card style={styles.card}>
          <Text style={styles.label}>Hotel Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(v) => { setName(v); markUnsaved(); }}
            placeholder="Hotel name"
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={(v) => { setDescription(v); markUnsaved(); }}
            multiline
            numberOfLines={4}
            placeholder="Describe your hotel..."
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={styles.label}>Address</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={(v) => { setAddress(v); markUnsaved(); }}
            placeholder="Full address"
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={styles.label}>Star Rating</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Pressable
                key={s}
                onPress={() => { setStarRating(s); markUnsaved(); }}
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

        {/* ── Toggle Save Button ─────────────────────────────────────────────
            Teal  = unsaved  → "Save Changes"
            Green = saved    → "Saved ✓ — Tap to revert"
            Mirrors the customer heart-button toggle exactly.
        ────────────────────────────────────────────────────────────────── */}
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable
            onPress={handleToggleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={isSaved ? 'Revert changes' : 'Save hotel profile'}
            accessibilityState={{ busy: saving, selected: isSaved }}
            style={({ pressed }) => [
              styles.saveBtn,
              isSaved ? styles.saveBtnSaved : styles.saveBtnDefault,
              (saving || pressed) && { opacity: 0.8 },
            ]}
          >
            {saving ? (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFF" style={styles.btnIcon} />
                <Text style={styles.saveBtnText}>Saving…</Text>
              </>
            ) : isSaved ? (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" style={styles.btnIcon} />
                <Text style={styles.saveBtnText}>Saved ✓  —  Tap to revert</Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFF" style={styles.btnIcon} />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </>
            )}
          </Pressable>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    padding: 20,
  },
  card: { marginBottom: 16, gap: 8, padding: 16, borderRadius: radius.card, ...shadowCard },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  starRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  starBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starBtnActive: { borderColor: colors.gold, backgroundColor: colors.goldTint },
  starText: { fontSize: 20, color: colors.inkMuted },
  starTextActive: { color: colors.gold },
  starHint: { fontSize: 13, fontWeight: '600', color: colors.goldDeep, marginTop: 4 },
  ratingValue: { fontSize: 14, color: colors.inkMuted, marginTop: 4 },

  /* ── Toggle Save Button ── */
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.card,
    marginTop: 4,
    marginBottom: 8,
  },
  saveBtnDefault: { backgroundColor: colors.teal },      // teal = unsaved
  saveBtnSaved:   { backgroundColor: '#16A34A' },         // green = saved (mirrors red heart)
  btnIcon: { marginRight: 8 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, letterSpacing: -0.1 },
});
