import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
type Route = RouteProp<RootStackParamList, 'TelebirrOtp'>;

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300;
const RESEND_COOLDOWN = 60;

export default function TelebirrOtpScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const pad = useResponsivePadding();
  const { colors: c } = useTheme();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';

  const { bookingId, paymentId, amount, currency = 'ETB', hotelName, phone } = route.params;

  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [processing, setProcessing] = useState(false);
  const [expirySeconds, setExpirySeconds] = useState(OTP_EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Expiry timer
  useEffect(() => {
    if (expirySeconds <= 0) return;
    const timer = setInterval(() => setExpirySeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [expirySeconds]);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const otpCode = otp.join('');

  const handleVerify = useCallback(async () => {
    if (otpCode.length !== OTP_LENGTH || processing) return;
    setProcessing(true);

    try {
      await request<{ status: string }>(`/payments/${paymentId}/verify-otp`, {
        method: 'POST',
        body: { code: otpCode },
        token,
      });

      hapticSuccess();

      navigation.navigate('PaymentResult', {
        bookingId,
        status: 'PROCESSING',
        amount,
        currency,
        hotelName,
        method: 'TELEBIRR',
        reference: bookingId.slice(0, 8),
      });
    } catch (err) {
      hapticError();
      const message = err instanceof ApiError ? err.message : 'OTP verification failed';
      Alert.alert('Verification Failed', message, [
        { text: 'Try Again', onPress: () => { setOtp(Array(OTP_LENGTH).fill('')); inputRefs.current[0]?.focus(); } },
        { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setProcessing(false);
    }
  }, [otpCode, processing, paymentId, bookingId, token, amount, currency, hotelName, navigation]);

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await request(`/payments/${bookingId}/chapa-intent`, {
        method: 'POST',
        body: { method: 'TELEBIRR', phone },
        token,
      });
      setExpirySeconds(OTP_EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch {
      Alert.alert('Resend Failed', 'Could not resend OTP code.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.paper, paddingTop: insets.top + 12 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={[styles.backBtn, { backgroundColor: c.paperDeep }]}>
          <Ionicons name="arrow-back" size={20} color={c.teal} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.ink }]}>Verify Payment</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.content, { paddingHorizontal: pad }]}>
        <MockModeBanner />

        {/* Provider Header */}
        <View style={[styles.providerCard, { backgroundColor: '#E2B94A' }]}>
          <Ionicons name="phone-portrait-outline" size={32} color="#FFFFFF" />
          <Text style={styles.providerTitle}>TELEBIRR PAYMENT</Text>
          <Text style={styles.providerSub}>Sandbox</Text>
        </View>

        {/* Payment Details */}
        <View style={[styles.detailsCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Amount</Text>
            <Text style={[styles.detailValue, { color: c.ink }]}>{currency} {Number(amount).toLocaleString()}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Phone</Text>
            <Text style={[styles.detailValue, { color: c.ink }]}>{phone}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Hotel</Text>
            <Text style={[styles.detailValue, { color: c.ink }]} numberOfLines={1}>{hotelName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Expires in</Text>
            <Text style={[styles.detailValue, { color: expirySeconds > 0 ? c.ink : c.brick }]}>
              {formatTime(expirySeconds)}
            </Text>
          </View>
        </View>

        {/* OTP Input */}
        <Text style={[styles.otpLabel, { color: c.ink }]}>Enter the 6-digit code sent to your phone</Text>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputRefs.current[i] = ref; }}
              style={[styles.otpBox, { backgroundColor: c.paperDeep, borderColor: digit ? c.teal : c.line, color: c.ink }]}
              value={digit}
              onChangeText={(t) => handleOtpChange(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify Button */}
        <Button
          title={processing ? 'Verifying...' : 'Verify Payment'}
          variant="primary"
          onPress={handleVerify}
          disabled={otpCode.length !== OTP_LENGTH || processing}
          fullWidth
        />

        {/* Resend */}
        <Pressable
          onPress={handleResend}
          disabled={resendCooldown > 0}
          style={styles.resendRow}
        >
          <Text style={[styles.resendText, { color: resendCooldown > 0 ? c.inkMuted : c.teal }]}>
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
          </Text>
        </Pressable>

        {/* Mock SMS hint */}
        <View style={[styles.smsHint, { backgroundColor: c.paperDeep, borderColor: c.line }]}>
          <Ionicons name="information-circle-outline" size={16} color={c.inkMuted} />
          <Text style={[styles.smsHintText, { color: c.inkMuted }]}>
            Check the mock SMS inbox for the verification code
          </Text>
        </View>

        <View style={styles.sandboxNotice}>
          <Ionicons name="lock-closed" size={14} color={c.inkMuted} />
          <Text style={[styles.sandboxText, { color: c.inkMuted }]}>SANDBOX — No real charge</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { flex: 1, gap: 16 },
  providerCard: { alignItems: 'center', paddingVertical: 24, borderRadius: 16, gap: 6 },
  providerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  providerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  detailsCard: { borderRadius: 14, borderWidth: 1, padding: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600' },
  otpLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  otpBox: { width: 48, height: 56, borderRadius: 12, borderWidth: 2, textAlign: 'center', fontSize: 22, fontWeight: '700' },
  resendRow: { alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 14, fontWeight: '500' },
  smsHint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  smsHintText: { fontSize: 13, flex: 1 },
  sandboxNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  sandboxText: { fontSize: 12 },
});
