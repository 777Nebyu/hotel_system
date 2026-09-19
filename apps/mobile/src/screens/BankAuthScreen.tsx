import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { request, ApiError } from '../api';
import { useTheme } from '../hooks/useTheme';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import MockModeBanner from '../components/MockModeBanner';
import { Button } from '../components/Shared';
import { hapticSuccess, hapticError } from '../hooks/useHaptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'BankAuth'>;

const BANK_NAMES: Record<string, string> = {
  CBE: 'Commercial Bank of Ethiopia',
  AWASH: 'Awash Bank',
  ENAT: 'Enat Bank',
  AMHARA: 'Amhara Bank',
  COOP: 'COOP Bank',
};

type Step = 'reference' | 'cbe-app';

export default function BankAuthScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const pad = useResponsivePadding();
  const { colors: c } = useTheme();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';

  const { bookingId, paymentId, amount, currency = 'ETB', hotelName, method, bankCode, cbeReference } = route.params;

  const [step, setStep] = useState<Step>('reference');
  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);

  const bankName = BANK_NAMES[bankCode] || bankCode;
  const paymentRef = cbeReference || bookingId.slice(0, 12).toUpperCase();

  const handleConfirmPayment = async () => {
    if (processing) return;

    if (pin.length < 4) {
      Alert.alert('PIN Required', 'Please enter your CBE PIN (4-6 digits).');
      return;
    }

    setProcessing(true);

    try {
      const res = await request<{ status: string; reason?: string; paymentId: string }>(`/payments/${paymentId}/bank-callback`, {
        method: 'POST',
        body: {
          status: 'AUTHORIZED',
          bankCode,
          pin,
        },
        token,
      });

      hapticSuccess();

      navigation.navigate('PaymentResult', {
        bookingId,
        status: res.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'FAILED',
        amount,
        currency,
        hotelName,
        method,
        reference: paymentRef,
      });
    } catch (err) {
      hapticError();
      const message = err instanceof ApiError ? err.message : 'Payment confirmation failed';
      Alert.alert('Error', message, [
        { text: 'Retry', onPress: () => setProcessing(false) },
        { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  // ── Step 1: Payment Reference Display ──────────────────────────────────────
  if (step === 'reference') {
    return (
      <View style={[styles.container, { backgroundColor: c.paper, paddingTop: insets.top + 12 }]}>
        <View style={[styles.header, { paddingHorizontal: pad }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={[styles.backBtn, { backgroundColor: c.paperDeep }]}>
            <Ionicons name="arrow-back" size={20} color={c.teal} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.ink }]}>Bank Payment</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 20 }}>
          <MockModeBanner />

          {/* Sandbox Banner */}
          <View style={[styles.sandboxBanner, { backgroundColor: c.goldTint, borderColor: c.gold }]}>
            <Ionicons name="flask-outline" size={20} color={c.gold} />
            <View style={styles.sandboxTextWrap}>
              <Text style={[styles.sandboxTitle, { color: c.ink }]}>DEMO BANKING ENVIRONMENT</Text>
              <Text style={[styles.sandboxSub, { color: c.inkMuted }]}>This is a sandbox. No real money transferred.</Text>
            </View>
          </View>

          {/* Payment Summary */}
          <View style={[styles.summaryCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={[styles.summaryRow, { borderBottomColor: c.line }]}>
              <Text style={[styles.summaryLabel, { color: c.inkMuted }]}>Bank</Text>
              <Text style={[styles.summaryValue, { color: c.ink }]}>{bankName}</Text>
            </View>
            <View style={[styles.summaryRow, { borderBottomColor: c.line }]}>
              <Text style={[styles.summaryLabel, { color: c.inkMuted }]}>Amount</Text>
              <Text style={[styles.summaryValue, { color: c.teal }]}>{currency} {Number(amount).toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: c.inkMuted }]}>Hotel</Text>
              <Text style={[styles.summaryValue, { color: c.ink }]}>{hotelName}</Text>
            </View>
          </View>

          {/* Payment Reference */}
          <Text style={[styles.sectionTitle, { color: c.ink }]}>Payment Reference</Text>
          <Text style={[styles.refHint, { color: c.inkMuted }]}>
            Use this reference when paying through the {bankName} mobile app.
          </Text>

          <View style={[styles.refCard, { backgroundColor: c.teal + '10', borderColor: c.teal }]}>
            <Text style={[styles.refCode, { color: c.teal }]}>{paymentRef}</Text>
          </View>

          {/* Instructions */}
          <Text style={[styles.sectionTitle, { color: c.ink, marginTop: 20 }]}>How to pay</Text>

          <View style={styles.steps}>
            <View style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: c.teal }]}>
                <Text style={styles.stepNumText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: c.ink }]}>Open {bankName} app</Text>
                <Text style={[styles.stepDesc, { color: c.inkMuted }]}>Launch the mobile banking app on your phone</Text>
              </View>
            </View>

            <View style={[styles.stepLine, { backgroundColor: c.line }]} />

            <View style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: c.teal }]}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: c.ink }]}>Select Pay for → Chapa</Text>
                <Text style={[styles.stepDesc, { color: c.inkMuted }]}>Navigate to payments and choose Chapa as the merchant</Text>
              </View>
            </View>

            <View style={[styles.stepLine, { backgroundColor: c.line }]} />

            <View style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: c.teal }]}>
                <Text style={styles.stepNumText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: c.ink }]}>Enter reference</Text>
                <Text style={[styles.stepDesc, { color: c.inkMuted }]}>Type the payment reference shown above</Text>
              </View>
            </View>

            <View style={[styles.stepLine, { backgroundColor: c.line }]} />

            <View style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: c.teal }]}>
                <Text style={styles.stepNumText}>4</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: c.ink }]}>Confirm with PIN</Text>
                <Text style={[styles.stepDesc, { color: c.inkMuted }]}>Review the amount and enter your PIN to confirm</Text>
              </View>
            </View>
          </View>

          {/* Continue Button */}
          <Button
            title="I've made the payment → Confirm"
            variant="primary"
            onPress={() => setStep('cbe-app')}
            fullWidth
          />

          <View style={styles.sandboxNotice}>
            <Ionicons name="lock-closed" size={14} color={c.inkMuted} />
            <Text style={[styles.sandboxText, { color: c.inkMuted }]}>SANDBOX — No real charge</Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Step 2: CBE App Simulation (PIN Confirmation) ──────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: c.paper, paddingTop: insets.top + 12 }]}>
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <Pressable onPress={() => setStep('reference')} hitSlop={8} style={[styles.backBtn, { backgroundColor: c.paperDeep }]}>
          <Ionicons name="arrow-back" size={20} color={c.teal} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.ink }]}>CBE Confirmation</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 20 }}>
        <MockModeBanner />

        {/* Simulated CBE App Header */}
        <View style={[styles.cbeHeader, { backgroundColor: '#1A5276' }]}>
          <Ionicons name="business" size={24} color="#FFFFFF" />
          <Text style={styles.cbeTitle}>CBE Mobile Banking</Text>
          <Text style={styles.cbeSub}>Simulated Environment</Text>
        </View>

        {/* Payment Details in CBE Style */}
        <View style={[styles.cbeCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.cbeLabel, { color: c.inkMuted }]}>Merchant</Text>
          <Text style={[styles.cbeValue, { color: c.ink }]}>Chapa</Text>

          <View style={[styles.cbeDivider, { backgroundColor: c.line }]} />

          <Text style={[styles.cbeLabel, { color: c.inkMuted }]}>Reference</Text>
          <Text style={[styles.cbeRefCode, { color: c.teal }]}>{paymentRef}</Text>

          <View style={[styles.cbeDivider, { backgroundColor: c.line }]} />

          <Text style={[styles.cbeLabel, { color: c.inkMuted }]}>Amount</Text>
          <Text style={[styles.cbeAmount, { color: c.ink }]}>{currency} {Number(amount).toLocaleString()}</Text>
        </View>

        {/* PIN Input */}
        <Text style={[styles.sectionTitle, { color: c.ink, marginTop: 20 }]}>Enter your CBE PIN</Text>
        <Text style={[styles.pinHint, { color: c.inkMuted }]}>
          Enter your 4-6 digit CBE PIN to authorize this payment.
        </Text>

        <View style={[styles.pinInputWrap, { backgroundColor: c.surface, borderColor: pin.length > 0 ? c.teal : c.line }]}>
          <Ionicons name="lock-closed-outline" size={18} color={c.inkMuted} />
          <TextInput
            style={[styles.pinInput, { color: c.ink }]}
            placeholder="Enter PIN"
            placeholderTextColor={c.inkMuted}
            value={pin}
            onChangeText={(text) => setPin(text.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
          />
          <Text style={[styles.pinCounter, { color: c.inkMuted }]}>{pin.length}/6</Text>
        </View>

        {/* Confirm Button */}
        <View style={styles.actions}>
          <Button
            title={processing ? 'Processing...' : `Confirm Payment ${currency} ${Number(amount).toLocaleString()}`}
            variant="primary"
            onPress={handleConfirmPayment}
            disabled={pin.length < 4 || processing}
            fullWidth
          />
          <Button
            title="Cancel"
            variant="danger"
            onPress={() => navigation.goBack()}
            disabled={processing}
            fullWidth
          />
        </View>

        <View style={styles.sandboxNotice}>
          <Ionicons name="lock-closed" size={14} color={c.inkMuted} />
          <Text style={[styles.sandboxText, { color: c.inkMuted }]}>SANDBOX — No real charge</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { flex: 1 },
  sandboxBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  sandboxTextWrap: { flex: 1 },
  sandboxTitle: { fontSize: 14, fontWeight: '700' },
  sandboxSub: { fontSize: 12, marginTop: 2 },
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  refHint: { fontSize: 13, marginBottom: 10 },
  refCard: { borderRadius: 12, borderWidth: 1.5, padding: 16, alignItems: 'center', marginBottom: 4 },
  refCode: { fontSize: 22, fontWeight: '800', fontFamily: 'Menlo', letterSpacing: 2 },
  steps: { marginBottom: 20 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  stepContent: { flex: 1, paddingBottom: 4 },
  stepTitle: { fontSize: 14, fontWeight: '600' },
  stepDesc: { fontSize: 12, marginTop: 2 },
  stepLine: { width: 2, height: 16, marginLeft: 13, marginVertical: 2 },
  actions: { gap: 10, marginTop: 8 },
  sandboxNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  sandboxText: { fontSize: 12 },
  // CBE App Simulation styles
  cbeHeader: { alignItems: 'center', paddingVertical: 20, borderRadius: 16, gap: 4, marginBottom: 16 },
  cbeTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginTop: 4 },
  cbeSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  cbeCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 4 },
  cbeLabel: { fontSize: 12, marginBottom: 2 },
  cbeValue: { fontSize: 15, fontWeight: '600' },
  cbeDivider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  cbeRefCode: { fontSize: 16, fontWeight: '700', fontFamily: 'Menlo' },
  cbeAmount: { fontSize: 22, fontWeight: '800' },
  pinHint: { fontSize: 13, marginBottom: 10 },
  pinInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, height: 52, marginBottom: 8 },
  pinInput: { flex: 1, fontSize: 18, paddingVertical: 0, letterSpacing: 4 },
  pinCounter: { fontSize: 12 },
});
