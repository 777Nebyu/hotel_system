import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { Card, EmptyState, ErrorBox, Stars } from '../../components/Shared';
import ScreenHeader from '../../components/ScreenHeader';
import { SkeletonKPI } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { colors, radius, shadowCard } from '../../theme';
import { getHotelIdFromToken } from '../../utils/jwt';

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

interface HotelPolicy {
  checkInTime: string;
  checkOutTime: string;
  cancellationWindowDays: number;
  cancellationFeePercent: number;
  allowEarlyCheckIn: boolean;
  earlyCheckInFee: number;
  allowLateCheckOut: boolean;
  lateCheckOutFee: number;
}

const DEFAULT_POLICY: HotelPolicy = {
  checkInTime: '14:00',
  checkOutTime: '11:00',
  cancellationWindowDays: 3,
  cancellationFeePercent: 0,
  allowEarlyCheckIn: true,
  earlyCheckInFee: 0,
  allowLateCheckOut: true,
  lateCheckOutFee: 0,
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ManagerHotelScreen({ onBack, onNavigate }: Props) {
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const userRole = useAppSelector((s) => s.auth.session?.user?.role ?? 'MANAGER');
  const toast = useToast();

  const [hotel, setHotel] = useState<HotelProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [starRating, setStarRating] = useState(3);
  const [address, setAddress] = useState('');

  const [policy, setPolicy] = useState<HotelPolicy>({ ...DEFAULT_POLICY });
  const [policySaving, setPolicySaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const hotelId = getHotelIdFromToken(token);
      if (!hotelId) {
        setError('No hotel assigned to your account');
        return;
      }
      const [h, p] = await Promise.all([
        request<HotelProfile>(`/catalog/hotels/${hotelId}`, { token }),
        request<{ data: HotelPolicy }>(`/catalog/hotels/${hotelId}/policy`, { token }).catch(() => null),
      ]);
      setHotel(h);
      if (h) {
        setName(h.name);
        setDescription(h.description ?? '');
        setStarRating(h.starRating ?? 3);
        setAddress(h.address ?? '');
      }
      if (p?.data) {
        setPolicy({
          checkInTime: p.data.checkInTime ?? DEFAULT_POLICY.checkInTime,
          checkOutTime: p.data.checkOutTime ?? DEFAULT_POLICY.checkOutTime,
          cancellationWindowDays: p.data.cancellationWindowDays ?? DEFAULT_POLICY.cancellationWindowDays,
          cancellationFeePercent: p.data.cancellationFeePercent ?? DEFAULT_POLICY.cancellationFeePercent,
          allowEarlyCheckIn: p.data.allowEarlyCheckIn ?? DEFAULT_POLICY.allowEarlyCheckIn,
          earlyCheckInFee: p.data.earlyCheckInFee ?? DEFAULT_POLICY.earlyCheckInFee,
          allowLateCheckOut: p.data.allowLateCheckOut ?? DEFAULT_POLICY.allowLateCheckOut,
          lateCheckOutFee: p.data.lateCheckOutFee ?? DEFAULT_POLICY.lateCheckOutFee,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hotel');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // ─── Toggle Save/Unsave — mirrors customer heart button ───────────────────

  const [isSaved, setIsSaved] = useState(false);
  const savedSnapshot = useRef({ name: '', description: '', starRating: 3, address: '' });
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Defense-in-depth: block STAFF even if navigation guard is bypassed
  if (userRole === 'STAFF') {
    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <ScreenHeader title="Hotel Settings" onBack={onBack} subtitle="Access restricted" />
        <EmptyState title="Access Denied" subtitle="Hotel settings are restricted to managers" />
      </View>
    );
  }

  const markUnsaved = () => { if (isSaved) setIsSaved(false); };

  const popAnimation = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.12, useNativeDriver: true, speed: 40, bounciness: 8 }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 4 }),
    ]).start();
  };

  const handleToggleSave = async () => {
    if (saving) return;

    if (isSaved) {
      popAnimation();
      setName(savedSnapshot.current.name);
      setDescription(savedSnapshot.current.description);
      setStarRating(savedSnapshot.current.starRating);
      setAddress(savedSnapshot.current.address);
      setIsSaved(false);
      toast('info', 'Changes reset', 'Form reverted to last saved state.');
      return;
    }

    if (!hotel) return;
    setSaving(true);

    const prevSnapshot = { ...savedSnapshot.current };
    const prevName = name;
    const prevDesc = description;
    const prevStar = starRating;
    const prevAddr = address;

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

  const handleSavePolicy = async () => {
    if (policySaving || !hotel) return;
    setPolicySaving(true);
    try {
      await request(`/catalog/hotels/${hotel.id}/policy`, {
        method: 'PUT',
        body: policy,
        token,
      });
      toast('success', 'Policy saved', 'Hotel policy has been updated.');
    } catch (err) {
      toast('error', 'Save failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPolicySaving(false);
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

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Hotel Policy</Text>

          <Text style={styles.label}>Check-in Time</Text>
          <TextInput
            style={styles.input}
            value={policy.checkInTime}
            onChangeText={(v) => setPolicy((p) => ({ ...p, checkInTime: v }))}
            placeholder="HH:mm"
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={styles.label}>Check-out Time</Text>
          <TextInput
            style={styles.input}
            value={policy.checkOutTime}
            onChangeText={(v) => setPolicy((p) => ({ ...p, checkOutTime: v }))}
            placeholder="HH:mm"
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={styles.label}>Cancellation Window (days)</Text>
          <TextInput
            style={styles.input}
            value={String(policy.cancellationWindowDays)}
            onChangeText={(v) => setPolicy((p) => ({ ...p, cancellationWindowDays: Number(v) || 0 }))}
            keyboardType="numeric"
            placeholder="0–90"
            placeholderTextColor={colors.inkMuted}
          />

          <Text style={styles.label}>Cancellation Fee (%)</Text>
          <TextInput
            style={styles.input}
            value={String(policy.cancellationFeePercent)}
            onChangeText={(v) => setPolicy((p) => ({ ...p, cancellationFeePercent: Number(v) || 0 }))}
            keyboardType="numeric"
            placeholder="0–100"
            placeholderTextColor={colors.inkMuted}
          />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Allow Early Check-in</Text>
            <Switch
              value={policy.allowEarlyCheckIn}
              onValueChange={(v) => setPolicy((p) => ({ ...p, allowEarlyCheckIn: v }))}
              trackColor={{ false: colors.line, true: colors.teal }}
              thumbColor="#FFF"
            />
          </View>

          <Text style={styles.label}>Early Check-in Fee</Text>
          <TextInput
            style={styles.input}
            value={String(policy.earlyCheckInFee)}
            onChangeText={(v) => setPolicy((p) => ({ ...p, earlyCheckInFee: Number(v) || 0 }))}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.inkMuted}
          />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Allow Late Check-out</Text>
            <Switch
              value={policy.allowLateCheckOut}
              onValueChange={(v) => setPolicy((p) => ({ ...p, allowLateCheckOut: v }))}
              trackColor={{ false: colors.line, true: colors.teal }}
              thumbColor="#FFF"
            />
          </View>

          <Text style={styles.label}>Late Check-out Fee</Text>
          <TextInput
            style={styles.input}
            value={String(policy.lateCheckOutFee)}
            onChangeText={(v) => setPolicy((p) => ({ ...p, lateCheckOutFee: Number(v) || 0 }))}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.inkMuted}
          />

          <Pressable
            onPress={handleSavePolicy}
            disabled={policySaving}
            style={({ pressed }) => [
              styles.policySaveBtn,
              (policySaving || pressed) && { opacity: 0.8 },
            ]}
          >
            {policySaving ? (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFF" style={styles.btnIcon} />
                <Text style={styles.saveBtnText}>Saving…</Text>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" style={styles.btnIcon} />
                <Text style={styles.saveBtnText}>Save Policy</Text>
              </>
            )}
          </Pressable>
        </Card>

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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: radius.card,
    marginTop: 4,
    marginBottom: 8,
  },
  saveBtnDefault: { backgroundColor: colors.teal },
  saveBtnSaved:   { backgroundColor: '#10B981' },
  policySaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radius.card,
    marginTop: 8,
    backgroundColor: colors.teal,
  },
  btnIcon: { marginRight: 8 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15, letterSpacing: -0.1 },
});
