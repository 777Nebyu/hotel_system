import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
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
  TELEBIRR: 'payment.telebirr',
  CBE_BIRR: 'payment.cbe_birr',
  CREDIT_CARD: 'paymentMethods.credit_card',
  PAYPAL: 'payment.paypal',
  CASH: 'payment.cash',
  AWASH_BANK: 'paymentMethods.awash_bank',
  ENAT_BANK: 'paymentMethods.enat_bank',
  AMHARA_BANK: 'paymentMethods.amhara_bank',
  COOP_BANK: 'paymentMethods.coop_bank',
};

export default function PaymentResultScreen() {
  const { t } = useTranslation();
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
          iconColor: '#10B981',
          iconBg: '#10B98120',
          title: t('payment.successful'),
          subtitle: t('payment.successful_msg'),
        };
      case 'FAILED':
        return {
          icon: 'close-circle',
          iconColor: '#EF4444',
          iconBg: '#EF444420',
          title: t('payment.payment_failed'),
          subtitle: t('payment.failed_msg'),
        };
      case 'PROCESSING':
        return {
          icon: 'time',
          iconColor: '#F59E0B',
          iconBg: '#F59E0B20',
          title: t('payment.pending'),
          subtitle: t('payment.successful_msg'),
        };
      case 'CANCELLED':
        return {
          icon: 'ban',
          iconColor: '#6B7280',
          iconBg: '#6B728020',
          title: t('payment.cancelled'),
          subtitle: t('payment.failed_msg'),
        };
      default:
        return {
          icon: 'alert-circle',
          iconColor: '#EF4444',
          iconBg: '#EF444420',
          title: t('payment.payment_failed'),
          subtitle: t('bookingDetail.bookingNotFound'),
        };
    }
  })();

  const methodLabel = (m: string) => {
    switch (m) {
      case 'TELEBIRR': return t('payment.telebirr');
      case 'CBE_BIRR': return t('payment.cbe_birr');
      case 'CREDIT_CARD': return t('payment.card');
      case 'PAYPAL': return t('payment.paypal');
      case 'CASH': return t('payment.cash');
      default: return METHOD_LABELS[m] ? t(METHOD_LABELS[m]) : m;
    }
  };

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
        <Text style={[styles.headerTitle, { color: c.ink }]}>{t('payment.payment')}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.content, { paddingHorizontal: pad }]}>
        {/* Status Icon */}
        <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
          <Ionicons name={config.icon as any} size={64} color={config.iconColor} />
        </View>

        <Text style={[styles.title, { color: c.ink }]}>{config.title}</Text>
        <Text style={[styles.subtitle, { color: c.inkMuted }]}>{config.subtitle}</Text>

        {/* Payment Details */}
        <View style={[styles.detailsCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>{t('common.amount')}</Text>
            <Text style={[styles.detailValue, { color: c.ink }]}>{currency} {Number(amount).toLocaleString()}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>{t('common.method')}</Text>
            <Text style={[styles.detailValue, { color: c.ink }]}>{methodLabel(method)}</Text>
          </View>
          <View style={[styles.detailRow, { borderBottomColor: c.line }]}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>{t('common.hotel')}</Text>
            <Text style={[styles.detailValue, { color: c.ink }]} numberOfLines={1}>{hotelName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: c.inkMuted }]}>{t('common.reference')}</Text>
            <Text style={[styles.detailValue, { color: c.ink, fontFamily: 'Menlo' }]}>{reference}</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {status === 'SUCCEEDED' && (
            <Button title={t('buttons.view_booking')} variant="primary" onPress={handleViewBooking} fullWidth />
          )}
          {status === 'PROCESSING' && (
            <Button title={t('buttons.view_booking')} variant="primary" onPress={handleViewBooking} fullWidth />
          )}
          {(status === 'FAILED' || status === 'CANCELLED' || status === 'UNKNOWN') && (
            <>
              <Button title={t('buttons.try_again')} variant="primary" onPress={handleTryAgain} fullWidth />
              <Button title={t('buttons.change_payment_method')} variant="secondary" onPress={handleTryAgain} fullWidth />
            </>
          )}
          <Button title={t('buttons.back_to_home')} variant="ghost" onPress={handleGoHome} fullWidth />
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
});
