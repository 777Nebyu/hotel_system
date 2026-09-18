import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import MockModeBanner from '../components/MockModeBanner';
import { Button } from '../components/Shared';
import { hapticSuccess } from '../hooks/useHaptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'PaymentResult'>;

type ResultConfig = {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
};

const METHOD_LABELS: Record<string, string> = {
  TELEBIRR: 'Telebirr',
  CBE_BIRR: 'CBE Birr',
  CREDIT_CARD: 'Credit Card',
  PAYPAL: 'PayPal',
  CASH: 'Cash',
  AWASH_BANK: 'Awash Bank',
  ENAT_BANK: 'Enat Bank',
  AMHARA_BANK: 'Amhara Bank',
  COOP_BANK: 'COOP Bank',
};

export default function PaymentResultScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const pad = useResponsivePadding();
  const { colors: c } = useTheme();

  const { bookingId, status, amount, currency = 'ETB', hotelName, method, reference } = route.params;

  const config: ResultConfig = (() => {
    switch (status) {
      case 'SUCCEEDED':
        return {
          icon: 'checkmark-circle',
          iconColor: '#16A34A',
          iconBg: '#16A34A20',
          title: 'Payment Successful',
          subtitle: 'Your payment has been processed successfully.',
        };
      case 'FAILED':
        return {
          icon: 'close-circle',
          iconColor: '#EF4444',
          iconBg: '#EF444420',
          title: 'Payment Failed',
          subtitle: 'Your payment could not be processed.',
        };
      case 'PROCESSING':
        return {
          icon: 'time',
          iconColor: '#F59E0B',
          iconBg: '#F59E0B20',
          title: 'Payment Processing',
          subtitle: 'Your payment is being processed by the provider.',
        };
      case 'CANCELLED':
        return {
          icon: 'ban',
          iconColor: '#6B7280',
          iconBg: '#6B728020',
          title: 'Payment Cancelled',
          subtitle: 'The payment was cancelled.',
        };
      default:
        return {
          icon: 'alert-circle',
          iconColor: '#EF4444',
          iconBg: '#EF444420',
          title: 'Payment Status Unknown',
          subtitle: 'Please check your booking details.',
        };
    }
  })();

  const handleViewBooking = () => {
    hapticSuccess();
    navigation.navigate('BookingDetail', { bookingId });
  };

  const handleGoHome = () => {
    navigation.navigate('MainTabs');
  };

  const handleTryAgain = () => {
    navigation.goBack();
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

      <View style={[styles.content, { paddingHorizontal: pad }]}>
        <MockModeBanner />

        {/* Status Icon */}
        <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
          <Ionicons name={config.icon as any} size={64} color={config.iconColor} />
        </View>

        <Text style={[styles.title, { color: c.ink }]}>{config.title}</Text>
        <Text style={[styles.subtitle, { color: c.inkMuted }]}>{config.subtitle}</Text>

        {/* Payment Details */}
        <View style={[styles.detailsCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Amount</Text>
            <Text style={[styles.detailValue, { color: c.ink }]}>{currency} {Number(amount).toLocaleString()}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Method</Text>
            <Text style={[styles.detailValue, { color: c.ink }]}>{METHOD_LABELS[method] || method}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Hotel</Text>
            <Text style={[styles.detailValue, { color: c.ink }]} numberOfLines={1}>{hotelName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>Reference</Text>
            <Text style={[styles.detailValue, { color: c.ink, fontFamily: 'Menlo' }]}>{reference}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {status === 'SUCCEEDED' && (
            <Button title="View Booking" variant="primary" onPress={handleViewBooking} fullWidth />
          )}
          {status === 'PROCESSING' && (
            <Button title="View Booking" variant="primary" onPress={handleViewBooking} fullWidth />
          )}
          {(status === 'FAILED' || status === 'CANCELLED' || status === 'UNKNOWN') && (
            <>
              <Button title="Try Again" variant="primary" onPress={handleTryAgain} fullWidth />
              <Button title="Change Payment Method" variant="secondary" onPress={handleTryAgain} fullWidth />
            </>
          )}
          <Button title="Back to Home" variant="ghost" onPress={handleGoHome} fullWidth />
        </View>

        {/* Sandbox Notice */}
        <View style={styles.sandboxNotice}>
          <Ionicons name="lock-closed" size={14} color={c.inkMuted} />
          <Text style={[styles.sandboxText, { color: c.inkMuted }]}>SANDBOX — No real charge</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { flex: 1, gap: 16, alignItems: 'center' },
  iconContainer: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 8 },
  detailsCard: { borderRadius: 14, borderWidth: 1, padding: 16, width: '100%' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  detailLabel: { fontSize: 14 },
  detailValue: { fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: 16 },
  actions: { width: '100%', gap: 10 },
  sandboxNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 },
  sandboxText: { fontSize: 12 },
});
