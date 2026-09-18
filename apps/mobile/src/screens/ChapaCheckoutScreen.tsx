import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
type Route = RouteProp<RootStackParamList, 'ChapaCheckout'>;

type ChapaMethod = {
  id: string;
  name: string;
  tag: string;
  icon: string;
  color: string;
};

const CHAPA_METHODS: ChapaMethod[] = [
  { id: 'TELEBIRR', name: 'Telebirr', tag: 'Mobile money payment', icon: 'phone-portrait-outline', color: '#E2B94A' },
  { id: 'CBE_BIRR', name: 'CBE Bank Transfer', tag: 'Commercial Bank of Ethiopia', icon: 'business-outline', color: '#0F8A83' },
  { id: 'AWASH_BANK', name: 'Awash Bank', tag: 'Bank transfer', icon: 'business-outline', color: '#1E3A5F' },
  { id: 'ENAT_BANK', name: 'Enat Bank', tag: 'Bank transfer', icon: 'business-outline', color: '#8B1A1A' },
  { id: 'AMHARA_BANK', name: 'Amhara Bank', tag: 'Bank transfer', icon: 'business-outline', color: '#2563EB' },
  { id: 'COOP_BANK', name: 'COOP Bank', tag: 'Bank transfer', icon: 'business-outline', color: '#047857' },
];

const BANK_NAMES: Record<string, string> = {
  CBE_BIRR: 'Commercial Bank of Ethiopia',
  AWASH_BANK: 'Awash Bank',
  ENAT_BANK: 'Enat Bank',
  AMHARA_BANK: 'Amhara Bank',
  COOP_BANK: 'COOP Bank',
};

export default function ChapaCheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const pad = useResponsivePadding();
  const { colors: c } = useTheme();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';

  const { bookingId, method: initialMethod, amount, currency = 'ETB', hotelName, roomType, phone: defaultPhone } = route.params;

  const [selectedMethod] = useState<string>(initialMethod);
  const [processing, setProcessing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone || '');

  const isBankMethod = selectedMethod !== 'TELEBIRR' && selectedMethod !== 'CASH';

  const handleContinue = async () => {
    if (processing) return;

    if (isBankMethod && !phoneNumber.trim()) {
      Alert.alert('Phone Required', 'Please enter your phone number to continue.');
      return;
    }

    setProcessing(true);

    try {
      const response = await request(`/payments/${bookingId}/chapa-intent`, {
        method: 'POST',
        body: {
          method: selectedMethod,
          ...(selectedMethod === 'TELEBIRR'
            ? { phone: phoneNumber || '+251911111111' }
            : {
                phone: phoneNumber,
                bankCode: selectedMethod.replace('_BANK', '').replace('_BIRR', ''),
              }),
        },
        token,
      });

      hapticSuccess();

      if (selectedMethod === 'TELEBIRR') {
        navigation.navigate('TelebirrOtp', {
          bookingId,
          paymentId: (response as any)?.paymentId,
          amount,
          currency,
          hotelName,
          phone: phoneNumber || '+251911111111',
        });
      } else {
        navigation.navigate('BankAuth', {
          bookingId,
          paymentId: (response as any)?.paymentId,
          amount,
          currency,
          hotelName,
          method: selectedMethod,
          bankCode: selectedMethod.replace('_BANK', '').replace('_BIRR', ''),
          cbeReference: (response as any)?.paymentReference,
        });
      }
    } catch (err) {
      hapticError();
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Payment failed';
      Alert.alert('Payment Failed', message, [
        { text: 'Retry', onPress: () => setProcessing(false) },
        { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.paper, paddingTop: insets.top + 12 }]}>
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={[styles.backBtn, { backgroundColor: c.paperDeep }]}>
          <Ionicons name="arrow-back" size={20} color={c.teal} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.ink }]}>Payment</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 20 }}>
        <MockModeBanner />

        {/* Provider Header */}
        <View style={[styles.providerCard, { backgroundColor: c.teal }]}>
          <Ionicons name="wallet-outline" size={28} color="#FFFFFF" />
          <Text style={styles.providerTitle}>CHAPA PAYMENT</Text>
          <Text style={styles.providerSub}>Sandbox Environment</Text>
        </View>

        {/* Payment Summary */}
        <View style={[styles.summaryCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.merchantName, { color: c.ink }]}>{hotelName || 'YayeTech Hotel'}</Text>
          {roomType && <Text style={[styles.roomType, { color: c.inkMuted }]}>{roomType}</Text>}
          <Text style={[styles.amount, { color: c.teal }]}>{currency} {Number(amount).toLocaleString()}</Text>
        </View>

        {/* The method was selected on the booking payment step. */}
        <View style={[styles.methodCard, { backgroundColor: c.surface, borderColor: c.teal, borderWidth: 2 }]}>
          <View style={[styles.methodIcon, { backgroundColor: (CHAPA_METHODS.find((m) => m.id === selectedMethod)?.color ?? c.teal) + '20' }]}>
            <Ionicons name={(CHAPA_METHODS.find((m) => m.id === selectedMethod)?.icon ?? 'card-outline') as any} size={22} color={c.teal} />
          </View>
          <View style={styles.methodInfo}>
            <Text style={[styles.methodName, { color: c.ink }]}>Payment with {CHAPA_METHODS.find((m) => m.id === selectedMethod)?.name ?? selectedMethod}</Text>
            <Text style={[styles.methodTag, { color: c.inkMuted }]}>Selected from your booking payment options</Text>
          </View>
        </View>
        <Pressable onPress={() => navigation.goBack()} style={styles.changeMethod}>
          <Text style={[styles.changeMethodText, { color: c.teal }]}>Change payment method</Text>
        </Pressable>

        {/* Phone Number Input (for bank methods) */}
        {isBankMethod && (
          <View style={styles.phoneSection}>
            <Text style={[styles.sectionTitle, { color: c.ink }]}>Phone Number</Text>
            <Text style={[styles.phoneHint, { color: c.inkMuted }]}>
              Enter the phone number linked to your {BANK_NAMES[selectedMethod] || 'bank'} account
            </Text>
            <View style={[styles.phoneInputWrap, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Ionicons name="call-outline" size={18} color={c.inkMuted} />
              <TextInput
                style={[styles.phoneInput, { color: c.ink }]}
                placeholder="+2519XXXXXXXX"
                placeholderTextColor={c.inkMuted}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoComplete="tel"
                maxLength={15}
              />
            </View>
          </View>
        )}

        {/* Continue Button */}
        <Button
          title={processing ? 'Processing...' : 'Continue'}
          variant="primary"
          onPress={handleContinue}
          disabled={processing}
          fullWidth
        />

        {processing && (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color={c.teal} />
            <Text style={[styles.loadingText, { color: c.inkMuted }]}>Creating payment session...</Text>
          </View>
        )}

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
  providerCard: { alignItems: 'center', paddingVertical: 24, borderRadius: 16, gap: 6, marginBottom: 16 },
  providerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  providerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  summaryCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 20 },
  merchantName: { fontSize: 16, fontWeight: '700' },
  roomType: { fontSize: 13, marginTop: 2 },
  amount: { fontSize: 28, fontWeight: '800', marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  phoneSection: { marginBottom: 16 },
  phoneHint: { fontSize: 13, marginBottom: 8 },
  phoneInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 48 },
  phoneInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  methodCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8, gap: 12 },
  methodIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodInfo: { flex: 1 },
  methodName: { fontSize: 15, fontWeight: '600' },
  methodTag: { fontSize: 12, marginTop: 2 },
  changeMethod: { alignItems: 'center', paddingVertical: 8, marginBottom: 12 },
  changeMethodText: { fontSize: 13, fontWeight: '700' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 12, height: 12, borderRadius: 6 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  loadingText: { fontSize: 13 },
  sandboxNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12 },
  sandboxText: { fontSize: 12 },
});
