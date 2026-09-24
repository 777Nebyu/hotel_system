/**
 * booking/BookingInfoComponents.tsx
 * Small presentational components: StatusHero, DateStrip, PriceBreakdown,
 * RoomSummaryCard, PaymentStatusRow, CancellationPolicy, RefundStatus, RefundTimeline.
 */
import React from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { textProps } from '../ScaledText';
import { BK, SHADOW_SM, getConfig } from './_shared';

// ─── StatusHero ─────────────────────────────────────────────────────────────
export function StatusHero({ status, bookingRef }: { status: string; bookingRef?: string }) {
  const { t } = useTranslation();
  const c = getConfig(status);
  const title =
    status === 'CONFIRMED' ? t('notifications.lifecycle.bookingConfirmed.title') :
    status === 'CHECKED_IN' ? t('status.checked_in') :
    status === 'CANCELLED' ? t('notifications.lifecycle.bookingCancelled.title') :
    c.friendlyTitle;
  const desc = status === 'NO_SHOW' ? t('bookingComponents.no_show') : c.friendlyDesc;
  return (
    <View style={hero.wrap} accessibilityRole="text" accessibilityLabel={title}>
      <View style={[hero.iconCircle, { backgroundColor: c.bg, borderColor: c.border }]}>
        <Ionicons name={c.icon as any} size={36} color={c.color} />
      </View>
      <Text {...textProps} style={[hero.title, { color: c.color }]}>{title}</Text>
      <Text style={hero.desc}>{desc}</Text>
      {bookingRef && (
        <View style={hero.refRow}>
          <Text style={hero.refLabel}>{t('bookingComponents.booking')}</Text>
          <Text style={hero.ref}>{bookingRef}</Text>
        </View>
      )}
    </View>
  );
}
const hero = StyleSheet.create({
  wrap:       { alignItems: 'center', paddingVertical: 24, gap: 8 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title:      { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  desc:       { fontSize: 14, color: BK.textSec, textAlign: 'center', lineHeight: 20 },
  refRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  refLabel:   { fontSize: 12, color: BK.textMut, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  ref:        { fontSize: 12, color: BK.navy, fontWeight: '800', letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
});

// ─── DateStrip ───────────────────────────────────────────────────────────────
export function DateStrip({
  checkIn, checkOut, nights, compact = false,
}: { checkIn: string; checkOut: string; nights: number; compact?: boolean }) {
  const { t } = useTranslation();
  const fmtLong  = (d: string) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtShort = (d: string) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const fmt = compact ? fmtShort : fmtLong;
  return (
    <View style={ds.strip} accessibilityLabel={`Check in ${fmtLong(checkIn)}, check out ${fmtLong(checkOut)}, ${nights} ${t('booking.nights')}`}>
      <View style={ds.block}>
        <Text style={ds.label}>{t('common.check_in')}</Text>
        <Text style={[ds.date, compact && ds.dateSmall]}>{fmt(checkIn)}</Text>
      </View>
      <View style={ds.mid}>
        <View style={[ds.line, { backgroundColor: BK.border }]} />
        <View style={ds.pill}>
          <Text style={ds.nights}>{nights} {nights === 1 ? 'night' : t('booking.nights')}</Text>
        </View>
        <View style={[ds.line, { backgroundColor: BK.border }]} />
      </View>
      <View style={[ds.block, { alignItems: 'flex-end' }]}>
        <Text style={ds.label}>{t('common.check_out')}</Text>
        <Text style={[ds.date, compact && ds.dateSmall]}>{fmt(checkOut)}</Text>
      </View>
    </View>
  );
}
const ds = StyleSheet.create({
  strip:     { flexDirection: 'row', alignItems: 'center', backgroundColor: BK.bg, borderRadius: 12, padding: 14 },
  block:     { flex: 1 },
  label:     { fontSize: 11, fontWeight: '700', color: BK.checkedIn, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  date:      { fontSize: 14, fontWeight: '700', color: BK.text },
  dateSmall: { fontSize: 13 },
  mid:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  line:      { flex: 1, height: 1, width: 16 },
  pill:      { backgroundColor: BK.white, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: BK.border },
  nights:    { fontSize: 11, fontWeight: '700', color: BK.navyMuted, letterSpacing: 0.2 },
});

// ─── PriceBreakdown ──────────────────────────────────────────────────────────
export function PriceBreakdown({
  basePrice, nights, taxAmount, discount, serviceFee, total, currentRoomPrice, priceLocked, style,
}: {
  basePrice?: number; nights?: number;
  taxAmount?: number; discount?: number; serviceFee?: number;
  total: number | string; currentRoomPrice?: number; priceLocked?: boolean; style?: ViewStyle;
}) {
  const { t } = useTranslation();
  const fmt = (n: number) => `ETB ${Number(n).toLocaleString('en-ET', { minimumFractionDigits: 2 })}`;
  const rows = [
    basePrice != null && nights != null ? { label: `${t('booking.room')} (${nights} ${nights !== 1 ? t('booking.nights') : 'night'})`, value: fmt(basePrice * nights), neutral: true } : null,
    discount     ? { label: t('bookingFlow.discount'),    value: `−${fmt(discount)}`,  green: true  } : null,
    taxAmount    ? { label: t('bookingComponents.tax_fees'),  value: fmt(taxAmount),        neutral: true } : null,
    serviceFee   ? { label: t('bookingComponents.service_fee'), value: fmt(serviceFee),       neutral: true } : null,
  ].filter(Boolean) as { label: string; value: string; neutral?: boolean; green?: boolean }[];

  const savings = priceLocked && currentRoomPrice != null && basePrice != null && nights != null
    ? (currentRoomPrice - basePrice) * nights : 0;

  return (
    <View style={[pb.wrap, style]}>
      {priceLocked && (
        <View style={pb.lockedRow}>
          <Ionicons name="lock-closed" size={13} color={BK.confirmed} />
          <Text style={pb.lockedText}>{t('bookingComponents.price_locked')}</Text>
        </View>
      )}
      {rows.map((row, i) => (
        <View key={i} style={pb.row}>
          <Text style={pb.label}>{row.label}</Text>
          <Text style={[pb.value, row.green && pb.green]}>{row.value}</Text>
        </View>
      ))}
      <View style={[pb.row, pb.totalRow]}>
        <Text style={pb.totalLabel}>{t('common.total')}</Text>
        <Text style={pb.total}>ETB {Number(total).toLocaleString()}</Text>
      </View>
      {priceLocked && currentRoomPrice != null && basePrice != null && (
        <View style={pb.compareBlock}>
          <View style={pb.compareRow}>
            <Text style={pb.compareLabel}>{t('bookingComponents.booked_at')}</Text>
            <Text style={pb.compareValue}>ETB {Number(basePrice).toLocaleString()} {t('bookingComponents.per_night')}</Text>
          </View>
          <View style={pb.compareRow}>
            <Text style={pb.compareLabel}>{t('bookingComponents.current_price')}</Text>
            <Text style={pb.compareValueCurrent}>ETB {Number(currentRoomPrice).toLocaleString()} {t('bookingComponents.per_night')}</Text>
          </View>
          {savings > 0 && (
            <View style={[pb.savingsBadge, { backgroundColor: BK.confirmedBg }]}>
              <Ionicons name="trending-down" size={12} color={BK.confirmed} />
              <Text style={[pb.savingsText, { color: BK.confirmed }]}>{t('bookingInfo.you_saved', { amount: Number(savings).toLocaleString() })}</Text>
            </View>
          )}
          {savings < 0 && (
            <View style={[pb.savingsBadge, { backgroundColor: BK.pendingBg }]}>
              <Ionicons name="information-circle" size={12} color={BK.pending} />
              <Text style={[pb.savingsText, { color: BK.pending }]}>{t('bookingComponents.price_increased')}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
const pb = StyleSheet.create({
  wrap:          { gap: 10 },
  row:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:         { fontSize: 14, color: BK.textSec },
  value:         { fontSize: 14, color: BK.text, fontWeight: '600' },
  green:         { color: BK.confirmed },
  totalRow:      { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BK.border, marginTop: 4 },
  totalLabel:    { fontSize: 15, fontWeight: '700', color: BK.text },
  total:         { fontSize: 22, fontWeight: '800', color: BK.navy },
  lockedRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BK.confirmedBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 4 },
  lockedText:    { fontSize: 12, fontWeight: '600', color: BK.confirmed },
  compareBlock:  { marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BK.border, gap: 6 },
  compareRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compareLabel:  { fontSize: 13, color: BK.textSec },
  compareValue:  { fontSize: 13, fontWeight: '700', color: BK.confirmed },
  compareValueCurrent: { fontSize: 13, fontWeight: '700', color: BK.text },
  savingsBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  savingsText:   { fontSize: 12, fontWeight: '700' },
});

// ─── RoomSummaryCard ─────────────────────────────────────────────────────────
const ROOM_FALLBACK = 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&h=300&fit=crop';

export function RoomSummaryCard({
  imageUrl, roomType, roomNumber, hotelName, guests, onPress, style,
}: {
  imageUrl?: string | null; roomType?: string; roomNumber?: string;
  hotelName?: string; guests?: number; onPress?: () => void; style?: ViewStyle;
}) {
  const { t } = useTranslation();
  const inner = (
    <View style={[rm.card, SHADOW_SM, style]}>
      <Image source={{ uri: imageUrl ?? ROOM_FALLBACK }} style={rm.image} contentFit="cover"
        placeholder={{ blurhash: 'LKO2?U42NwRn4jEYJMROM[~q?xRP' }} transition={300} />
      <View style={rm.body}>
        <View>
          <Text style={rm.room} numberOfLines={1}>{roomType ?? t('common.room')}</Text>
          {roomNumber && <Text style={rm.sub}>{t('common.room')} {roomNumber}</Text>}
        </View>
        <View>
          <Text style={rm.hotel} numberOfLines={1}>{hotelName}</Text>
          {guests != null && (
            <View style={rm.guestRow}>
              <Ionicons name="people-outline" size={12} color={BK.textMut} />
              <Text style={rm.guestText}>{guests} {guests !== 1 ? t('hotel.guestsPlural') : t('hotel.guestsSingle')}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
  if (onPress) return <Pressable onPress={onPress}>{inner}</Pressable>;
  return inner;
}
const rm = StyleSheet.create({
  card:     { flexDirection: 'row', backgroundColor: BK.white, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: BK.border },
  image:    { width: 90, height: 90, aspectRatio: 1 },
  body:     { flex: 1, padding: 12, justifyContent: 'space-between' },
  room:     { fontSize: 15, fontWeight: '700', color: BK.text },
  sub:      { fontSize: 12, color: BK.textSec, marginTop: 2 },
  hotel:    { fontSize: 13, color: BK.navyMuted, fontWeight: '500' },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  guestText:{ fontSize: 12, color: BK.textMut },
});

// ─── PaymentStatusRow ────────────────────────────────────────────────────────
export function PaymentStatusRow({
  method, status, amount,
}: { method: string; status: string; amount?: number | string }) {
  const { t } = useTranslation();
  const map: Record<string, { color: string; bg: string; label: string; icon: string }> = {
    SUCCEEDED:        { color: BK.confirmed, bg: BK.confirmedBg, label: t('bookingComponents.paid'),         icon: 'checkmark-circle' },
    PENDING:          { color: BK.pending,   bg: BK.pendingBg,   label: t('status.pending'),       icon: 'time-outline'     },
    PENDING_AT_HOTEL: { color: BK.confirmed, bg: BK.confirmedBg, label: t('bookingComponents.pay_at_hotel'),  icon: 'cash-outline'     },
    FAILED:           { color: BK.cancelled, bg: BK.cancelledBg, label: t('bookingComponents.failed'),        icon: 'close-circle'     },
    REFUNDED:         { color: BK.checkedIn, bg: BK.checkedInBg, label: t('bookingComponents.refunded'),      icon: 'return-down-back' },
  };
  const cfg = map[status] ?? map.PENDING;
  const methodLabel = method.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <View style={pay.row} accessibilityLabel={`Payment ${cfg.label}, ${methodLabel}`}>
      <View style={pay.left}>
        <Ionicons name="card-outline" size={18} color={BK.navyMuted} />
        <View>
          <Text style={pay.method}>{methodLabel}</Text>
          {amount != null && <Text style={pay.amount}>ETB {Number(amount).toLocaleString()}</Text>}
        </View>
      </View>
      <View style={[pay.badge, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
        <Text style={[pay.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  );
}
const pay = StyleSheet.create({
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  method:    { fontSize: 14, fontWeight: '600', color: BK.text },
  amount:    { fontSize: 12, color: BK.textSec, marginTop: 2 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});

// ─── CancellationPolicy ──────────────────────────────────────────────────────
export function CancellationPolicy({
  cancellationHours = 48, checkIn, style,
}: { cancellationHours?: number; checkIn: string; style?: ViewStyle }) {
  const { t } = useTranslation();
  const hoursUntil = (new Date(checkIn).getTime() - Date.now()) / 3_600_000;
  const isFreePeriod = hoursUntil > cancellationHours;
  const is50Period   = !isFreePeriod && hoursUntil > cancellationHours / 2;
  const tier = isFreePeriod
    ? { label: t('bookingComponents.free_cancellation'),    color: BK.confirmed, bg: BK.confirmedBg, pct: 100 }
    : is50Period
    ? { label: t('bookingComponents.partial_50'), color: BK.pending,   bg: BK.pendingBg,   pct: 50  }
    : { label: t('bookingComponents.non_refundable'),        color: BK.cancelled, bg: BK.cancelledBg, pct: 0   };

  return (
    <View style={[cp.wrap, { backgroundColor: tier.bg }, style]} accessibilityLabel={tier.label}>
      <Ionicons name="shield-checkmark-outline" size={16} color={tier.color} />
      <View style={cp.body}>
        <Text style={[cp.label, { color: tier.color }]}>{tier.label}</Text>
        <Text style={cp.sub}>
          {isFreePeriod
            ? t('bookingComponents.cancelled_more_than', { hours: cancellationHours })
            : is50Period
            ? t('bookingReview.partial_50')
            : t('bookingComponents.no_refund_stage')}
        </Text>
      </View>
    </View>
  );
}
const cp = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 12 },
  body: { flex: 1 },
  label:{ fontSize: 13, fontWeight: '700' },
  sub:  { fontSize: 12, color: BK.textSec, marginTop: 2, lineHeight: 17 },
});

// ─── Refund types & components ───────────────────────────────────────────────
export type RefundState = 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NOT_APPLICABLE' | 'NO_REFUND' | 'UNKNOWN';

const REFUND_CONFIG: Record<RefundState, { label: string; message: string; color: string; bg: string; icon: string }> = {
  REQUESTED:      { label: 'Refund requested',   message: 'Your refund request has been received.',                                              color: BK.pending,   bg: BK.pendingBg,   icon: 'time-outline'              },
  PROCESSING:     { label: 'Refund processing',  message: 'Your payment provider is processing the refund.',                                    color: BK.checkedIn, bg: BK.checkedInBg, icon: 'sync-outline'              },
  COMPLETED:      { label: 'Refund completed',   message: 'The refund was successfully processed.',                                             color: BK.confirmed, bg: BK.confirmedBg, icon: 'checkmark-circle'          },
  FAILED:         { label: 'Refund failed',      message: 'We could not complete the refund automatically. Our team has been notified.',        color: BK.cancelled, bg: BK.cancelledBg, icon: 'warning-outline'           },
  NOT_APPLICABLE: { label: 'No refund required', message: 'No payment was collected, so no refund is required.',                                color: BK.cancelled, bg: BK.cancelledBg, icon: 'information-circle-outline' },
  NO_REFUND:      { label: 'No refund available',message: 'This booking was cancelled outside the refundable period.',                           color: BK.cancelled, bg: BK.cancelledBg, icon: 'close-circle-outline'       },
  UNKNOWN:        { label: 'Refund status unavailable', message: 'We will show the provider status here once it is available.',                 color: BK.navyMuted, bg: BK.bgDeep,     icon: 'help-circle-outline'       },
};

export function RefundStatus({
  state, amount, method, reference, onContactSupport, style,
}: {
  state: RefundState; amount?: number | string; method?: string;
  reference?: string | null; onContactSupport?: () => void; style?: ViewStyle;
}) {
  const { t } = useTranslation();
  const refundLabelKey: Record<RefundState, string> = {
    REQUESTED: 'bookingComponents.refund_requested_status',
    PROCESSING: 'bookingComponents.refund_processing',
    COMPLETED: 'bookingComponents.refund_completed',
    FAILED: 'bookingComponents.refund_failed_status',
    NOT_APPLICABLE: 'bookingComponents.no_refund_required_status',
    NO_REFUND: 'bookingComponents.no_refund_available_status',
    UNKNOWN: 'bookingComponents.refund_unknown_status',
  };
  const refundMsgKey: Record<RefundState, string> = {
    REQUESTED: 'bookingComponents.refund_requested_msg',
    PROCESSING: 'bookingComponents.refund_processing_msg',
    COMPLETED: 'bookingComponents.refund_completed_msg',
    FAILED: 'bookingComponents.refund_failed_msg',
    NOT_APPLICABLE: 'bookingComponents.no_refund_required_msg',
    NO_REFUND: 'bookingComponents.no_refund_available_msg',
    UNKNOWN: 'bookingComponents.refund_unknown_msg',
  };
  const config = REFUND_CONFIG[state];
  const cfgLabel = t(refundLabelKey[state]);
  const cfgMessage = t(refundMsgKey[state]);
  return (
    <View style={[refund.status, { backgroundColor: config.bg }, style]} accessibilityRole="text" accessibilityLabel={`${cfgLabel}. ${cfgMessage}`}>
      <Ionicons name={config.icon as any} size={19} color={config.color} />
      <View style={refund.body}>
        <Text style={[refund.title, { color: config.color }]}>{cfgLabel}</Text>
        <Text style={refund.message}>{cfgMessage}</Text>
        {amount != null && <Text style={refund.meta}>{t('bookingComponents.refund_amount')} ETB {Number(amount).toLocaleString()}</Text>}
        {method    && <Text style={refund.meta}>{t('bookingInfo.original_payment', { method: method.replace(/_/g, ' ') })}</Text>}
        {reference && <Text style={refund.meta}>{t('bookingDetail.reference')}: {reference}</Text>}
        {state === 'FAILED' && onContactSupport && (
          <Pressable onPress={onContactSupport} style={refund.supportBtn} accessibilityRole="button" accessibilityLabel={t('bookingComponents.contact_support')}>
            <Ionicons name="headset-outline" size={14} color={BK.white} />
            <Text style={refund.supportBtnText}>{t('bookingComponents.contact_support')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function RefundTimeline({ state, style }: { state: RefundState; style?: ViewStyle }) {
  const { t } = useTranslation();
  const steps: Array<{ label: string; icon: string; state: 'done' | 'active' | 'todo' | 'terminal' }> =
    state === 'NOT_APPLICABLE'
      ? [{ label: t('bookingComponents.cancellation_confirmed'), icon: 'checkmark', state: 'done' }, { label: t('bookingComponents.no_refund_required_status'), icon: 'information', state: 'terminal' }]
      : state === 'NO_REFUND'
      ? [{ label: t('bookingComponents.cancellation_confirmed'), icon: 'checkmark', state: 'done' }, { label: t('bookingComponents.no_refund_available_status'), icon: 'close', state: 'terminal' }]
      : state === 'FAILED'
      ? [
          { label: t('bookingComponents.cancellation_confirmed'), icon: 'checkmark', state: 'done'     },
          { label: t('bookingComponents.refund_requested_step'),       icon: 'checkmark', state: 'done'     },
          { label: t('bookingComponents.refund_processing_step'),      icon: 'sync',      state: 'done'     },
          { label: t('bookingComponents.refund_failed_step'),          icon: 'close',     state: 'terminal' },
          { label: t('bookingComponents.support_followup'),      icon: 'headset',   state: 'active'   },
        ]
      : [
          { label: t('bookingComponents.cancellation_confirmed'), icon: 'checkmark', state: 'done'  },
          { label: t('bookingComponents.refund_requested_step'),       icon: 'checkmark', state: state === 'REQUESTED'  ? 'active' : 'done'                                },
          { label: t('bookingComponents.refund_processing_step'),      icon: 'sync',      state: state === 'PROCESSING' ? 'active' : state === 'REQUESTED' ? 'todo' : 'done' },
          { label: t('bookingComponents.refund_completed_step'),       icon: 'checkmark', state: state === 'COMPLETED'  ? 'active' : 'todo'                                 },
        ];

  return (
    <View style={[refund.timeline, style]}>
      {steps.map((step, index) => (
        <View key={step.label} style={refund.timelineRow}>
          <View style={refund.timelineRail}>
            <View style={[refund.timelineDot, {
              backgroundColor: step.state === 'todo' ? BK.white : step.state === 'terminal' ? BK.cancelled : step.state === 'active' ? BK.pending : BK.confirmed,
              borderColor:     step.state === 'todo' ? BK.border : step.state === 'terminal' ? BK.cancelled : step.state === 'active' ? BK.pending : BK.confirmed,
            }]}>
              {step.state !== 'todo' && <Ionicons name={step.icon as any} size={11} color={BK.white} />}
            </View>
            {index < steps.length - 1 && (
              <View style={[refund.timelineLine, { backgroundColor: step.state === 'done' ? BK.confirmed : BK.border }]} />
            )}
          </View>
          <Text style={[refund.timelineLabel, {
            color: step.state === 'todo' ? BK.textMut : step.state === 'terminal' ? BK.cancelled : step.state === 'active' ? BK.navy : BK.text,
          }]}>{step.label}</Text>
        </View>
      ))}
    </View>
  );
}

const refund = StyleSheet.create({
  status:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 12 },
  body:          { flex: 1, gap: 3 },
  title:         { fontSize: 14, fontWeight: '800' },
  message:       { fontSize: 12, color: BK.textSec, lineHeight: 17 },
  meta:          { fontSize: 12, color: BK.textSec, fontWeight: '600', marginTop: 2 },
  supportBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: BK.cancelled, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
  supportBtnText:{ color: BK.white, fontSize: 12, fontWeight: '700' },
  timeline:      { gap: 0 },
  timelineRow:   { flexDirection: 'row', minHeight: 42, gap: 10 },
  timelineRail:  { width: 20, alignItems: 'center' },
  timelineDot:   { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  timelineLine:  { width: 2, flex: 1, marginVertical: 2 },
  timelineLabel: { flex: 1, fontSize: 13, fontWeight: '700', paddingTop: 2 },
});
