import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/types';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { Button, Card } from '../../components/Shared';
import ScreenHeader from '../../components/ScreenHeader';
import { colors } from '../../theme';
import { hapticSuccess, hapticError } from '../../hooks/useHaptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EarlyCheckinLateCheckout'>;

interface BookingInfo {
  id: string;
  guestName: string;
  hotelName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  totalPrice: number;
  earlyCheckIn: boolean | null;
  lateCheckOut: boolean | null;
  earlyCheckInFee: number | null;
  lateCheckOutFee: number | null;
}

export default function EarlyCheckinLateCheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { bookingId, mode } = route.params;
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');

  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);

  const isEarlyCheckIn = mode === 'early-checkin';
  const title = isEarlyCheckIn ? 'Early Check-in' : 'Late Check-out';
  const action = isEarlyCheckIn ? 'check-in-early' : 'check-out-late';

  useEffect(() => {
    (async () => {
      try {
        const res = await request<BookingInfo>(`/bookings/${bookingId}`, { token });
        setBooking(res as any);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load booking');
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId, token]);

  const handleConfirm = async () => {
    if (!consent) {
      Alert.alert('Consent Required', 'Please confirm you have informed the guest of the applicable fee and received their consent.');
      return;
    }
    setBusy(true);
    try {
      await request(`/bookings/manage/${bookingId}/${action}`, { method: 'POST', token });
      hapticSuccess();
      Alert.alert('Success', `${title} approved successfully.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      hapticError();
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to process request');
    } finally {
      setBusy(false);
    }
  };

  const fee = isEarlyCheckIn ? booking?.earlyCheckInFee : booking?.lateCheckOutFee;
  const hasFee = fee != null && fee > 0;
  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <View style={styles.container}>
      <ScreenHeader title={title} onBack={() => navigation.goBack()} subtitle="Approve guest request" />

      <ScrollView contentContainerStyle={styles.content}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {booking && (
          <>
            <Card style={styles.bookingCard}>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Guest</Text>
                <Text style={styles.value}>{booking.guestName}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Hotel</Text>
                <Text style={styles.value}>{booking.hotelName}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Room</Text>
                <Text style={styles.value}>{booking.roomNumber}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Status</Text>
                <Text style={[styles.value, styles.statusBadge]}>{booking.status.replace('_', ' ')}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Check-in</Text>
                <Text style={styles.value}>{fmt(booking.checkIn)}</Text>
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.label}>Check-out</Text>
                <Text style={styles.value}>{fmt(booking.checkOut)}</Text>
              </View>
            </Card>

            {isEarlyCheckIn && (
              <Card style={styles.infoCard}>
                <Text style={styles.infoTitle}>Early Check-in Details</Text>
                <Text style={styles.infoText}>
                  Standard check-in time is 2:00 PM. By approving early check-in, the guest will be allowed to check in before this time.
                </Text>
                {hasFee ? (
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Early Check-in Fee</Text>
                    <Text style={styles.feeValue}>ETB {fee}</Text>
                  </View>
                ) : (
                  <Text style={styles.freeText}>No additional fee applies</Text>
                )}
              </Card>
            )}

            {!isEarlyCheckIn && (
              <Card style={styles.infoCard}>
                <Text style={styles.infoTitle}>Late Check-out Details</Text>
                <Text style={styles.infoText}>
                  Standard check-out time is 12:00 PM. By approving late check-out, the guest may stay beyond this time.
                </Text>
                {hasFee ? (
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Late Check-out Fee</Text>
                    <Text style={styles.feeValue}>ETB {fee}</Text>
                  </View>
                ) : (
                  <Text style={styles.freeText}>No additional fee applies</Text>
                )}
              </Card>
            )}

            <Card style={styles.consentCard}>
              <View style={styles.consentRow}>
                <View style={styles.consentTextWrap}>
                  <Text style={styles.consentTitle}>Guest Consent</Text>
                  <Text style={styles.consentSub}>
                    {hasFee
                      ? `Confirm the guest has been informed of the ETB ${fee} fee and agrees to proceed.`
                      : 'Confirm the guest has been informed and agrees to proceed.'}
                  </Text>
                </View>
                <Switch
                  value={consent}
                  onValueChange={setConsent}
                  trackColor={{ false: colors.line, true: colors.tealTint }}
                  thumbColor={consent ? colors.teal : colors.inkMuted}
                />
              </View>
            </Card>

            <View style={{ marginTop: 8 }}>
              <Button
                title={`Approve ${title}`}
                onPress={handleConfirm}
                loading={busy}
                disabled={!consent}
              />
            </View>
          </>
        )}

        {loading && <Text style={styles.loadingText}>Loading booking details...</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  errorText: { color: colors.brick, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  loadingText: { color: colors.inkMuted, fontSize: 14, textAlign: 'center', marginTop: 24 },

  bookingCard: { padding: 16, gap: 12 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: colors.inkMuted, fontWeight: '500' },
  value: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  statusBadge: { textTransform: 'capitalize' },

  infoCard: { padding: 16, gap: 8, borderLeftWidth: 3, borderLeftColor: colors.teal },
  infoTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  infoText: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.line },
  feeLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  feeValue: { fontSize: 18, fontWeight: '800', color: colors.tealDeep },
  freeText: { fontSize: 13, color: colors.teal, fontWeight: '600', marginTop: 4 },

  consentCard: { padding: 16 },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  consentTextWrap: { flex: 1 },
  consentTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 2 },
  consentSub: { fontSize: 12, color: colors.inkMuted, lineHeight: 16 },
});
