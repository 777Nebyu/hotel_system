import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { request } from '../api';
import { classifyAndAnnounce } from '../errors';
import { Button, Card, ErrorBox } from '../components/Shared';
import { SkeletonDetail } from '../components/Skeleton';
import type { Booking, BookingQuote } from '../types';
import { colors, font } from '../theme';
import { hapticSuccess, hapticError } from '../hooks/useHaptics';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useResponsivePadding } from '../hooks/useResponsivePadding';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'BookingModify'>;

export default function BookingModifyScreen() {
  const pad = useResponsivePadding();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const bookingId = route.params.bookingId;
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';
  const { isOffline } = useNetworkStatus();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [adults, setAdults] = useState('2');
  const [childrenCount, setChildrenCount] = useState('0');
  const [newQuote, setNewQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  // L3 — idempotency key generated once on mount, prevents duplicate PATCH on double-tap
  const [idempotencyKey] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const load = useCallback(async () => {
    setError(null);
    try {
      const b = await request<Booking>(`/bookings/${bookingId}`, { token });
      setBooking(b);
      setCheckIn(b.checkIn?.split('T')[0] ?? '');
      setCheckOut(b.checkOut?.split('T')[0] ?? '');
      setAdults(String(b.details?.[0]?.guestCount ?? 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('bookingModify.loadFailed'));
    } finally { setLoading(false); }
  }, [bookingId, token, t]);

  useEffect(() => { void load(); }, [load]);

  const fetchNewQuote = useCallback(async () => {
    if (!booking || !checkIn || !checkOut || checkIn === booking.checkIn?.split('T')[0] && checkOut === booking.checkOut?.split('T')[0]) {
      setNewQuote(null);
      return;
    }
    setQuoteLoading(true);
    try {
      const roomIds = (booking.details ?? []).map((d) => d.roomId);
      if (roomIds.length === 0) { setQuoteLoading(false); return; }
      const body: Record<string, unknown> = {
        hotelId: booking.hotelId,
        roomIds,
        checkIn,
        checkOut,
        guests: {
          adults: parseInt(adults, 10) || 1,
          children: parseInt(childrenCount, 10) || 0,
        },
      };
      const q = await request<BookingQuote>('/bookings/checkout', {
        method: 'POST',
        body,
        token,
      });
      setNewQuote(q);
    } catch { setNewQuote(null); }
    finally { setQuoteLoading(false); }
  }, [booking, checkIn, checkOut, adults, childrenCount, token]);

  useEffect(() => { void fetchNewQuote(); }, [fetchNewQuote]);

  const saveChanges = async () => {
    if (isOffline) return Alert.alert('Offline', 'Cannot modify booking while offline. Please connect to the internet.');
    if (!checkIn || !checkOut) {
      const errs: Record<string, string | undefined> = {};
      if (!checkIn) errs.checkIn = 'Check-in date is required.';
      if (!checkOut) errs.checkOut = 'Check-out date is required.';
      setFieldErrors(errs);
      return Alert.alert(t('bookingModify.error'), t('bookingFlow.missingDatesMsg'));
    }
    // BOOKMOD-001: New check-in < new check-out
    if (new Date(checkIn) >= new Date(checkOut)) {
      setFieldErrors({ checkOut: 'Check-out must be after check-in.' });
      return Alert.alert(t('bookingModify.error'), 'Check-out must be after check-in.');
    }
    // BOOKMOD-001: New dates are today or in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(checkIn) < today) {
      setFieldErrors({ checkIn: 'Check-in date must be today or in the future.' });
      return Alert.alert(t('bookingModify.error'), 'Check-in date must be today or in the future.');
    }
    setFieldErrors({});
    setSaving(true);
    try {
      await request(`/bookings/${bookingId}`, {
        method: 'PATCH',
        body: {
          checkIn,
          checkOut,
          guests: { adults: parseInt(adults) || 2, children: parseInt(childrenCount) || 0 },
          idempotencyKey,
        },
        token,
      });
      hapticSuccess();
      Alert.alert(t('bookingModify.modified'), t('bookingModify.modifiedMsg'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      hapticError();
      const classified = classifyAndAnnounce(err);
      Alert.alert(t('bookingModify.error'), classified.title);
    } finally { setSaving(false); }
  };

  if (loading) return <View style={styles.center}><SkeletonDetail /></View>;
  if (error) return <View style={styles.center}><ErrorBox message={error} onRetry={load} /></View>;
  if (!booking) return null;

  // BOOKMOD-001: Date modification requires CONFIRMED or PENDING status
  // BOOKMOD-003: Guest info modification allowed for PENDING or CONFIRMED
  const canModifyDates = booking.status === 'CONFIRMED' || booking.status === 'PENDING';
  const canModifyGuests = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
  const canModify = canModifyDates || canModifyGuests;
  if (!canModify) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('bookingModify.cannotModify')}</Text>
        <Button variant="secondary" title={t('buttons.back')} onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingHorizontal: pad }]}>
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.backText}>{'< Back'}</Text></Pressable>
      <Text style={styles.title}>{t('bookingModify.title')}</Text>
      <Text style={styles.ref}>Booking #{booking.id.slice(0, 8)}</Text>

      <Card style={styles.card}>
        <Text style={styles.label}>{t('bookingFlow.checkIn')} (YYYY-MM-DD)</Text>
        <TextInput value={checkIn} onChangeText={(v) => { setCheckIn(v); setFieldErrors((p) => ({ ...p, checkIn: undefined })); }} onBlur={() => { if (!checkIn) setFieldErrors((p) => ({ ...p, checkIn: 'Check-in date is required.' })); }} placeholder="2099-01-15" placeholderTextColor={colors.inkMuted} style={[styles.input, fieldErrors.checkIn && styles.inputError]} editable={canModifyDates} />
        {fieldErrors.checkIn ? <Text style={styles.fieldError}>{fieldErrors.checkIn}</Text> : null}

        <Text style={styles.label}>{t('bookingFlow.checkOut')} (YYYY-MM-DD)</Text>
        <TextInput value={checkOut} onChangeText={(v) => { setCheckOut(v); setFieldErrors((p) => ({ ...p, checkOut: undefined })); }} onBlur={() => { if (!checkOut) setFieldErrors((p) => ({ ...p, checkOut: 'Check-out date is required.' })); }} placeholder="2099-01-17" placeholderTextColor={colors.inkMuted} style={[styles.input, fieldErrors.checkOut && styles.inputError]} editable={canModifyDates} />
        {fieldErrors.checkOut ? <Text style={styles.fieldError}>{fieldErrors.checkOut}</Text> : null}

        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('bookingFlow.adults')}</Text>
            <TextInput value={adults} onChangeText={setAdults} keyboardType="numeric" style={styles.input} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('bookingFlow.children')}</Text>
            <TextInput value={childrenCount} onChangeText={setChildrenCount} keyboardType="numeric" style={styles.input} />
          </View>
        </View>

        <View style={styles.currentInfo}>
          <Text style={styles.currentLabel}>Current: {booking.checkIn?.split('T')[0]} → {booking.checkOut?.split('T')[0]}</Text>
          <Text style={styles.currentTotal}>Current total: ETB {booking.totalPrice}</Text>
          {newQuote && (
            <>
              <Text style={styles.newTotal}>New total: ETB {newQuote.total}</Text>
              {newQuote.total !== Number(booking.totalPrice) && (
                <Text style={[styles.priceDiff, { color: newQuote.total > Number(booking.totalPrice) ? colors.brick : colors.teal }]}>
                  {newQuote.total > Number(booking.totalPrice) ? 'Additional: ' : 'Savings: '}ETB {Math.abs(newQuote.total - Number(booking.totalPrice)).toFixed(2)}
                </Text>
              )}
            </>
          )}
          {quoteLoading && <Text style={styles.quoteLoading}>Fetching new quote…</Text>}
        </View>
      </Card>

      <View style={styles.actions}>
        <Button title={saving ? t('bookingModify.saving') : t('bookingModify.saveChanges')} onPress={saveChanges} loading={saving} disabled={saving} />
        <Button variant="secondary" title={t('buttons.cancel')} onPress={() => navigation.goBack()} disabled={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, gap: 16 },
  backText: { color: colors.teal, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  title: { fontFamily: font.display, color: colors.ink, fontSize: 24, fontWeight: '600' },
  ref: { fontFamily: font.mono, fontSize: 12, color: colors.inkMuted, marginTop: 4, marginBottom: 16 },
  card: { gap: 10, marginBottom: 16 },
  label: { color: colors.inkSoft, fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: colors.ink },
  inputError: { borderColor: '#EF4444' },
  fieldError: { color: '#EF4444', fontSize: 12, marginTop: 2 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  currentInfo: { backgroundColor: colors.tealTint, borderRadius: 8, padding: 12, marginTop: 8 },
  currentLabel: { fontSize: 13, color: colors.tealDeep },
  currentTotal: { fontSize: 14, fontWeight: '700', color: colors.tealDeep, marginTop: 4 },
  newTotal: { fontSize: 14, fontWeight: '700', color: colors.ink, marginTop: 8 },
  priceDiff: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  quoteLoading: { fontSize: 12, color: colors.inkMuted, marginTop: 4 },
  actions: { gap: 10 },
  errorText: { fontSize: 16, color: colors.brick, fontWeight: '600' },
});
