import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { request, ApiError } from '../api';
import { useTheme } from '../hooks/useTheme';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { getMockScenario, type MockScenario } from '../components/MockScenarioSelector';
import { Button } from '../components/Shared';
import { hapticSuccess, hapticError } from '../hooks/useHaptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MockAuth'>;

const PROVIDER_META: Record<string, { name: string; color: string; icon: string }> = {
  CREDIT_CARD: { name: 'Card Payment', color: '#0F172A', icon: 'card-outline' },
  TELEBIRR: { name: 'Telebirr', color: '#E2B94A', icon: 'phone-portrait-outline' },
  CBE_BIRR: { name: 'CBE Birr', color: '#0F2942', icon: 'business-outline' },
  PAYPAL: { name: 'PayPal', color: '#3B82F6', icon: 'globe-outline' },
};

export default function MockAuthorizationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const pad = useResponsivePadding();
  const { colors: c } = useTheme();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';

  const { bookingId, method, amount, currency = 'ETB', hotelName, reference } = route.params;
  const provider = PROVIDER_META[method] ?? PROVIDER_META.CREDIT_CARD;

  const [processing, setProcessing] = useState(false);
  const [scenario, setScenario] = useState<MockScenario>('SUCCESS');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getMockScenario().then(setScenario);
  }, []);

  // Elapsed timer for pending scenario
  useEffect(() => {
    if (processing) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [processing]);

  const executePayment = async (status: 'SUCCEEDED' | 'FAILED') => {
    if (processing) return;
    setProcessing(true);

    try {
      // Handle scenario delays
      if (scenario === 'PENDING' && status === 'SUCCEEDED') {
        await new Promise((resolve) => setTimeout(resolve, 10000));
      } else if (scenario === 'TIMEOUT') {
        await new Promise((resolve) => setTimeout(resolve, 30000));
        throw new Error('Payment request timed out');
      } else if (scenario === 'EXPIRED') {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        throw new Error('Payment session expired');
      } else if (scenario === 'CANCELLED') {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        throw new Error('Payment cancelled by user');
      }

      const mockSecret = process.env.EXPO_PUBLIC_MOCK_PAYMENT_SECRET;
      await request(`/payments/mock/${bookingId}`, {
        method: 'POST',
        body: { status },
        token,
        headers: mockSecret ? { 'x-mock-payment-secret': mockSecret } : {},
      });

      if (scenario === 'DUPLICATE') {
        // Simulate immediate duplicate request to test backend idempotency / conflict handling
        await request(`/payments/mock/${bookingId}`, {
          method: 'POST',
          body: { status },
          token,
          headers: mockSecret ? { 'x-mock-payment-secret': mockSecret } : {},
        });
      }

      if (status === 'SUCCEEDED') {
        hapticSuccess();
        // Go back to the calling screen — it will detect the completed payment
        // via a focus listener that checks server-side booking status.
        navigation.goBack();
      } else {
        hapticError();
        Alert.alert('Payment Failed', 'Your payment was not processed. Please try again.', [
          { text: 'Retry', onPress: () => setProcessing(false) },
          { text: 'Change Method', onPress: () => navigation.goBack() },
          { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      hapticError();
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Payment failed';
      Alert.alert('Payment Failed', message, [
        { text: 'Retry', onPress: () => setProcessing(false) },
        { text: 'Change Method', onPress: () => navigation.goBack() },
        { text: 'Cancel', style: 'cancel', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setProcessing(false);
      setElapsed(0);
    }
  };

  const handleApprove = () => executePayment('SUCCEEDED');
  const handleReject = () => executePayment('FAILED');

  return (
    <View style={[styles.container, { backgroundColor: c.paper, paddingTop: insets.top + 12 }]}>
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={[styles.backBtn, { backgroundColor: c.paperDeep }]}>
          <Ionicons name="arrow-back" size={20} color={c.teal} />
        </Pressable>
      </View>

      <View style={[styles.content, { paddingHorizontal: pad }]}>
        {/* Provider Header */}
        <View style={[styles.providerCard, { backgroundColor: provider.color }]}>
          <Ionicons name={provider.icon as any} size={32} color="#FFFFFF" />
          <Text style={styles.providerName}>{provider.name}</Text>
          <Text style={styles.providerSub}>Simulated Payment</Text>
        </View>

        {/* Payment Details */}
        <View style={[styles.detailsCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.detailsTitle, { color: c.ink }]}>Payment Request</Text>

          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Amount</Text>
            <Text style={[styles.detailValue, { color: c.ink }]}>{currency} {Number(amount).toLocaleString()}</Text>
          </View>

          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>To</Text>
            <Text style={[styles.detailValue, { color: c.ink }]} numberOfLines={1}>{hotelName}</Text>
          </View>

          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Reference</Text>
            <Text style={[styles.detailValue, { color: c.ink, fontFamily: 'Menlo' }]}>{reference}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Method</Text>
            <Text style={[styles.detailValue, { color: c.ink }]}>{method.replace('_', ' ')}</Text>
          </View>
        </View>

        {/* Processing State */}
        {processing && (
          <View style={[styles.processingCard, { backgroundColor: c.tealTint, borderColor: c.teal }]}>
            <ActivityIndicator size="small" color={c.teal} />
            <View style={styles.processingText}>
              <Text style={[styles.processingTitle, { color: c.teal }]}>Processing payment...</Text>
              <Text style={[styles.processingSub, { color: c.inkMuted }]}>
                {scenario === 'PENDING' ? `Waiting for provider response (${elapsed}s)` : 'Creating payment session'}
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {!processing && (
          <View style={styles.actions}>
            <Button
              title="Approve Payment"
              variant="primary"
              onPress={handleApprove}
              disabled={processing}
            />
            <Button
              title="Reject Payment"
              variant="danger"
              onPress={handleReject}
              disabled={processing}
            />
          </View>
        )}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { marginBottom: 8 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 16 },
  providerCard: { alignItems: 'center', paddingVertical: 28, borderRadius: 20, gap: 8 },
  providerName: { color: '#FFFFFF', fontSize: 22, fontWeight: '700' },
  providerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  detailsCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 0 },
  detailsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },
  processingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  processingText: { flex: 1 },
  processingTitle: { fontSize: 14, fontWeight: '600' },
  processingSub: { fontSize: 12, marginTop: 2 },
  actions: { gap: 10 },
});
