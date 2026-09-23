/**
 * BookingReviewCard — Premium dark-luxury booking review section.
 *
 * Color palette (dark mode):
 *   Background #071525   Cards #152A43   Primary #0F8B7D
 *   Gold #D4A72C          Text #FFFFFF    Secondary #94A3B8
 *
 * Color palette (light mode):
 *   Background #F8FAFC   Cards #FFFFFF   Primary #087F73
 *   Gold #C79216          Text #0F172A    Secondary #64748B
 */

import React, { useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';

// ─── Design tokens ─────────────────────────────────────────────────────────
const DARK = {
  bg: '#071525',
  card: '#152A43',
  primary: '#0F8B7D',
  gold: '#D4A72C',
  text: '#FFFFFF',
  secondary: '#94A3B8',
  cardBorder: '#1E3A55',
  divider: '#1E3A55',
  successBg: '#0D2E25',
  successBorder: '#0F8B7D',
  holdBg: '#0D2E25',
};

const LIGHT = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  primary: '#087F73',
  gold: '#C79216',
  text: '#0F172A',
  secondary: '#64748B',
  cardBorder: '#E2E8F0',
  divider: '#E2E8F0',
  successBg: '#F0FDF4',
  successBorder: '#087F73',
  holdBg: '#F0FDF4',
};

const SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  android: { elevation: 4 },
  default: {},
});

const SHADOW_SM = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 2 },
  default: {},
});

const ROOM_FALLBACK =
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&h=300&fit=crop';

// ─── Types ─────────────────────────────────────────────────────────────────
export interface BookingReviewCardProps {
  hotelName?: string;
  roomName?: string;
  roomType?: string;
  roomImage?: string | null;
  location?: string;
  guests: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  subtotal: number;
  taxAmount?: number;
  discount?: number;
  promoCode?: string;
  total: number;
  paymentMethod: string;
  leadGuestName: string;
  leadGuestEmail?: string;
  leadGuestPhone?: string;
  cancellationHours?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtDate = (d: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const fmtCurrency = (n: number) =>
  `ETB ${Number(n).toLocaleString('en-ET', { minimumFractionDigits: 0 })}`;

// ─── Main Component ────────────────────────────────────────────────────────
export default function BookingReviewCard({
  hotelName,
  roomName,
  roomType,
  roomImage,
  location,
  guests,
  checkIn,
  checkOut,
  nights,
  subtotal,
  taxAmount,
  discount,
  promoCode,
  total,
  paymentMethod,
  leadGuestName,
  leadGuestEmail,
  leadGuestPhone,
  cancellationHours = 48,
}: BookingReviewCardProps) {
  const { colorScheme } = useTheme();
  const t = colorScheme === 'dark' ? DARK : LIGHT;

  const isCash = paymentMethod === 'CASH_AT_HOTEL';

  const refundInfo = useMemo(() => {
    if (!checkIn) return null;
    const hoursUntilCheckIn =
      (new Date(checkIn).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilCheckIn >= cancellationHours) {
      return { label: 'Free cancellation', color: t.primary, bg: t.successBg };
    }
    if (hoursUntilCheckIn >= cancellationHours / 2) {
      return {
        label: '50% refund if cancelled',
        color: t.gold,
        bg: 'transparent',
      };
    }
    return { label: 'Non-refundable', color: '#EF4444', bg: 'transparent' };
  }, [checkIn, cancellationHours, t]);

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* ── Reservation Card ─────────────────────────────────────── */}
      <View
        style={[
          styles.card,
          { backgroundColor: t.card, borderColor: t.cardBorder },
          SHADOW,
        ]}
      >
        {/* Hotel Image */}
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: roomImage ?? ROOM_FALLBACK }}
            style={styles.image}
            contentFit="cover"
            placeholder={{ blurhash: 'LKO2?U42NwRn4jEYJMROM[~q?xRP' }}
            transition={300}
            cachePolicy="memory-disk"
          />
          <View style={styles.imageOverlay} />
          <View style={styles.imageBadge}>
            <Ionicons name="star" size={11} color={t.gold} />
            <Text style={[styles.imageBadgeText, { color: t.gold }]}>
              Premium
            </Text>
          </View>
        </View>

        {/* Hotel & Room Info */}
        <View style={styles.cardBody}>
          <Text style={[styles.roomType, { color: t.text }]} numberOfLines={1}>
            {roomType ?? roomName ?? 'Selected Room'}
          </Text>
          <Text style={[styles.hotelName, { color: t.secondary }]} numberOfLines={1}>
            {hotelName ?? 'Hotel'}
          </Text>
          <View style={styles.infoRow}>
            {location && (
              <View style={styles.infoChip}>
                <Ionicons name="location-outline" size={12} color={t.secondary} />
                <Text style={[styles.infoChipText, { color: t.secondary }]}>
                  {location}
                </Text>
              </View>
            )}
            <View style={styles.infoChip}>
              <Ionicons name="people-outline" size={12} color={t.secondary} />
              <Text style={[styles.infoChipText, { color: t.secondary }]}>
                {guests} guest{guests !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Stay Details Card ────────────────────────────────────── */}
      <View
        style={[
          styles.card,
          { backgroundColor: t.card, borderColor: t.cardBorder },
          SHADOW_SM,
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons name="calendar-outline" size={16} color={t.primary} />
          <Text style={[styles.cardTitle, { color: t.text }]}>Stay Details</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        {/* Check-in / Check-out */}
        <View style={styles.dateRow}>
          <View style={styles.dateBlock}>
            <Text style={[styles.dateLabel, { color: t.secondary }]}>CHECK-IN</Text>
            <Text style={[styles.dateValue, { color: t.text }]}>
              {fmtDate(checkIn)}
            </Text>
          </View>
          <View style={styles.dateArrow}>
            <Ionicons name="arrow-forward" size={16} color={t.primary} />
          </View>
          <View style={[styles.dateBlock, styles.dateBlockEnd]}>
            <Text style={[styles.dateLabel, { color: t.secondary }]}>CHECK-OUT</Text>
            <Text style={[styles.dateValue, { color: t.text }]}>
              {fmtDate(checkOut)}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        {/* Nights Badge */}
        <View style={styles.nightsRow}>
          <View style={[styles.nightsBadge, { backgroundColor: t.primary + '18' }]}>
            <Ionicons name="moon-outline" size={14} color={t.primary} />
            <Text style={[styles.nightsText, { color: t.primary }]}>
              {nights} night{nights !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        {/* Price Breakdown */}
        <View style={styles.priceSection}>
          <View style={styles.priceRow}>
            <Text style={[styles.priceLabel, { color: t.secondary }]}>
              Room ({nights} night{nights !== 1 ? 's' : ''})
            </Text>
            <Text style={[styles.priceValue, { color: t.text }]}>
              {fmtCurrency(subtotal)}
            </Text>
          </View>
          {discount != null && discount > 0 && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: t.primary }]}>Discount</Text>
              <Text style={[styles.priceValue, { color: t.primary }]}>
                −{fmtCurrency(discount)}
              </Text>
            </View>
          )}
          {taxAmount != null && taxAmount > 0 && (
            <View style={styles.priceRow}>
              <Text style={[styles.priceLabel, { color: t.secondary }]}>
                Tax & fees
              </Text>
              <Text style={[styles.priceValue, { color: t.text }]}>
                {fmtCurrency(taxAmount)}
              </Text>
            </View>
          )}
          {promoCode && (
            <View style={styles.promoRow}>
              <Ionicons name="pricetag-outline" size={13} color={t.primary} />
              <Text style={[styles.promoText, { color: t.primary }]}>
                Promo: {promoCode}
              </Text>
            </View>
          )}

          <View style={[styles.totalRow, { borderTopColor: t.divider }]}>
            <Text style={[styles.totalLabel, { color: t.text }]}>Total</Text>
            <Text style={[styles.totalValue, { color: t.primary }]}>
              {fmtCurrency(total)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Guest Information Card ───────────────────────────────── */}
      <View
        style={[
          styles.card,
          { backgroundColor: t.card, borderColor: t.cardBorder },
          SHADOW_SM,
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons name="person-outline" size={16} color={t.primary} />
          <Text style={[styles.cardTitle, { color: t.text }]}>
            Guest Information
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        <View style={styles.guestGrid}>
          <View style={styles.guestItem}>
            <Text style={[styles.guestLabel, { color: t.secondary }]}>Name</Text>
            <Text style={[styles.guestValue, { color: t.text }]} numberOfLines={1}>
              {leadGuestName}
            </Text>
          </View>
          {leadGuestEmail ? (
            <View style={styles.guestItem}>
              <Text style={[styles.guestLabel, { color: t.secondary }]}>Email</Text>
              <Text
                style={[styles.guestValue, { color: t.text }]}
                numberOfLines={1}
              >
                {leadGuestEmail}
              </Text>
            </View>
          ) : null}
          {leadGuestPhone ? (
            <View style={styles.guestItem}>
              <Text style={[styles.guestLabel, { color: t.secondary }]}>Phone</Text>
              <Text
                style={[styles.guestValue, { color: t.text }]}
                numberOfLines={1}
              >
                {leadGuestPhone}
              </Text>
            </View>
          ) : null}
          <View style={styles.guestItem}>
            <Text style={[styles.guestLabel, { color: t.secondary }]}>Guests</Text>
            <Text style={[styles.guestValue, { color: t.text }]}>
              {guests} guest{guests !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Payment Summary Card ─────────────────────────────────── */}
      <View
        style={[
          styles.card,
          { backgroundColor: t.card, borderColor: t.cardBorder },
          SHADOW_SM,
        ]}
      >
        <View style={styles.cardHeader}>
          <Ionicons
            name={isCash ? 'cash-outline' : 'card-outline'}
            size={16}
            color={t.primary}
          />
          <Text style={[styles.cardTitle, { color: t.text }]}>
            Payment Summary
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: t.divider }]} />

        <View style={styles.payRow}>
          <View style={styles.payMethod}>
            <Text style={[styles.payMethodText, { color: t.text }]}>
              {paymentMethod.replace(/_/g, ' ')}
            </Text>
          </View>
          <View
            style={[
              styles.payBadge,
              {
                backgroundColor: isCash ? t.gold + '20' : t.primary + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.payBadgeText,
                { color: isCash ? t.gold : t.primary },
              ]}
            >
              {isCash ? 'PAY AT HOTEL' : 'ONLINE'}
            </Text>
          </View>
        </View>
        {isCash && (
          <Text style={[styles.payNote, { color: t.secondary }]}>
            Pay the full amount at hotel reception during check-in.
          </Text>
        )}
      </View>

      {/* ── Cancellation Policy ──────────────────────────────────── */}
      {refundInfo && (
        <View
          style={[
            styles.card,
            { backgroundColor: t.card, borderColor: t.cardBorder },
            SHADOW_SM,
          ]}
        >
          <View style={styles.cancelRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={refundInfo.color}
            />
            <Text style={[styles.cancelText, { color: refundInfo.color }]}>
              {refundInfo.label}
            </Text>
            <Text style={[styles.cancelSub, { color: t.secondary }]}>
              {cancellationHours}h before check-in
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { gap: 14 },

  // Card base
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardBody: {
    padding: 16,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },

  // Image
  imageWrap: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  imageBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  imageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Room info
  roomType: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  hotelName: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 1,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoChipText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Dates
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateBlock: {
    flex: 1,
  },
  dateBlockEnd: {
    alignItems: 'flex-end',
  },
  dateArrow: {
    paddingHorizontal: 12,
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Nights
  nightsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  nightsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nightsText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Price
  priceSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promoText: {
    fontSize: 12,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    marginTop: 2,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // Guest
  guestGrid: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  guestItem: {
    gap: 2,
  },
  guestLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  guestValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Payment
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  payMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payMethodText: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  payBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  payBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  payNote: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },

  // Cancel
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  cancelSub: {
    fontSize: 11,
    fontWeight: '500',
  },
});
