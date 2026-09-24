import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

const EMERALD = '#0F2942';
const NAVY = '#0F172A';
const WHITE = '#FFFFFF';
const BG = '#F8FAFC';
const BORDER = '#E4E8F0';
const SUCCESS = '#10B981';
const WARNING = '#F59E0B';
const ERROR = '#EF4444';
const TEXT_SEC = '#5A6D8A';

const SHADOW = Platform.select({
  ios: { shadowColor: '#0F172A', shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 5 } },
  android: { elevation: 4 },
  default: {},
});

interface RefundConfirmDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  bookingRef: string;
  totalPrice: number | string;
  checkIn: string;
  loading?: boolean;
}

function calculateRefundTier(checkIn: string): { tier: string; labelKey: string; color: string } {
  const hoursUntil = (new Date(checkIn).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil >= 168) return { tier: '100%', labelKey: 'refundDialog.full', color: SUCCESS };
  if (hoursUntil >= 72) return { tier: '50%', labelKey: 'refundDialog.partial', color: WARNING };
  return { tier: '0%', labelKey: 'refundDialog.none', color: ERROR };
}

function calculateRefundAmount(totalPrice: number | string, checkIn: string): number {
  const total = Number(totalPrice);
  const hoursUntil = (new Date(checkIn).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil >= 168) return total;
  if (hoursUntil >= 72) return total * 0.5;
  return 0;
}

export function RefundConfirmDialog({
  visible,
  onClose,
  onConfirm,
  bookingRef,
  totalPrice,
  checkIn,
  loading = false,
}: RefundConfirmDialogProps) {
  const { t } = useTranslation();
  const { tier, labelKey, color } = calculateRefundTier(checkIn);
  const refundAmount = calculateRefundAmount(totalPrice, checkIn);
  const total = Number(totalPrice);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconCircle, { backgroundColor: color + '15', borderColor: color + '40' }]}>
            <Ionicons name="wallet-outline" size={32} color={color} />
          </View>

          <Text style={styles.title}>{t('refund.request')}</Text>
          <Text style={styles.desc}>
            {t('refundDialog.near_checkin')}
          </Text>

          <View style={styles.recap}>
            <Text style={styles.recapRef}>{bookingRef}</Text>
            <Text style={styles.recapAmount}>ETB {total.toLocaleString()}</Text>
          </View>

          <View style={[styles.tierBox, { backgroundColor: color + '10', borderColor: color + '30' }]}>
            <View style={styles.tierHeader}>
              <Text style={[styles.tierTitle, { color }]}>{t(labelKey)}</Text>
              <View style={[styles.tierBadge, { backgroundColor: color }]}>
                <Text style={styles.tierBadgeText}>{tier}</Text>
              </View>
            </View>
            {tier !== '0%' && (
              <View style={styles.calcRow}>
                <Text style={styles.calcKey}>{t('refund.amount')}</Text>
                <Text style={[styles.calcVal, { color }]}>
                  ETB {refundAmount.toLocaleString()}
                </Text>
              </View>
            )}
            {tier === '0%' && (
              <Text style={styles.tierDesc}>
                {t('refundDialog.near_checkin')}
              </Text>
            )}
          </View>

          <View style={styles.btnRow}>
            <Pressable
              onPress={onClose}
              disabled={loading}
              style={[styles.btn, styles.btnSecondary]}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Text style={styles.btnSecondaryText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
              accessibilityRole="button"
              accessibilityLabel={t('refund.request_a11y')}
            >
              {loading ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <Ionicons name="arrow-undo-outline" size={16} color={WHITE} />
              )}
              <Text style={styles.btnPrimaryText}>
                {loading ? 'Processing…' : t('refund.request')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    ...SHADOW,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: NAVY,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  desc: {
    fontSize: 13,
    color: TEXT_SEC,
    textAlign: 'center',
    lineHeight: 19,
  },
  recap: {
    width: '100%',
    backgroundColor: BG,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  recapRef: {
    fontSize: 12,
    fontWeight: '700',
    color: NAVY,
    letterSpacing: 0.5,
  },
  recapAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: NAVY,
  },
  tierBox: {
    width: '100%',
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tierTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  tierBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tierBadgeText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '800',
  },
  tierDesc: {
    fontSize: 12,
    color: TEXT_SEC,
    lineHeight: 16,
    marginTop: 4,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  calcKey: {
    fontSize: 12,
    color: TEXT_SEC,
    fontWeight: '600',
  },
  calcVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  btnPrimary: {
    backgroundColor: EMERALD,
  },
  btnPrimaryText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  btnSecondaryText: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
