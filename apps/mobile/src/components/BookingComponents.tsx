/**
 * BookingComponents — Complete booking lifecycle design system
 *
 * Premium hotel aesthetic:
 *   Primary:    Deep Navy     #1A2B4A
 *   Accent:     Hotel Blue    #3B82F6
 *   Success:    Confirmed Green #10B981
 *   Background: Off-white    #F8F9FB
 *   Cards:      White + subtle shadow
 *
 * Covers all states: PENDING · CONFIRMED · CHECKED_IN · CHECKED_OUT
 *                    CANCELLED · NO_SHOW
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { textProps } from './ScaledText';


// ─── Design tokens ─────────────────────────────────────────────────────────
export const BK = {
  // Core palette
  navy:       '#1A2B4A',
  navyMid:    '#2D3F5C',
  navyMuted:  '#5A6D8A',
  navySubtle: '#94A7BF',
  white:      '#FFFFFF',
  bg:         '#F8F9FB',
  bgDeep:     '#EEF1F6',
  border:     '#E4E8F0',
  borderSoft: '#F0F3F8',

  // Status semantic colors
  pending:    '#F59E0B',
  pendingBg:  '#FFFBEB',
  pendingBd:  '#FDE68A',

  confirmed:  '#10B981',
  confirmedBg:'#F0FDF4',
  confirmedBd:'#BBF7D0',

  checkedIn:  '#3B82F6',
  checkedInBg:'#EFF6FF',
  checkedInBd:'#BFDBFE',

  checkedOut: '#6B7280',
  checkedOutBg:'#F9FAFB',
  checkedOutBd:'#E5E7EB',

  cancelled:  '#EF4444',
  cancelledBg:'#FEF2F2',
  cancelledBd:'#FECACA',

  noShow:     '#374151',
  noShowBg:   '#F3F4F6',
  noShowBd:   '#D1D5DB',

  gold:       '#D4AF37',
  goldBg:     '#FBF4E5',

  // Text
  text:       '#1A2B4A',
  textSec:    '#5A6D8A',
  textMut:    '#94A7BF',
} as const;

const SHADOW = Platform.select({
  ios:     { shadowColor: '#1A2B4A', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 3 },
  default: {},
});
const SHADOW_SM = Platform.select({
  ios:     { shadowColor: '#1A2B4A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 1 },
  default: {},
});

// ─── Status config ──────────────────────────────────────────────────────────
interface StatusConfig {
  label:   string;
  color:   string;
  bg:      string;
  border:  string;
  icon:    string;
  iconLib: 'ionicons';
  emoji:   string;
  friendlyTitle: string;
  friendlyDesc:  string;
  step:    number; // 0-based index in the main timeline
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: {
    label: 'Pending',
    color: BK.pending, bg: BK.pendingBg, border: BK.pendingBd,
    icon: 'time-outline', iconLib: 'ionicons', emoji: '🟡',
    friendlyTitle: 'Awaiting Confirmation',
    friendlyDesc:  'Your booking is waiting for the hotel to confirm.',
    step: 0,
  },
  CONFIRMED: {
    label: 'Confirmed',
    color: BK.confirmed, bg: BK.confirmedBg, border: BK.confirmedBd,
    icon: 'checkmark-circle', iconLib: 'ionicons', emoji: '🟢',
    friendlyTitle: 'Booking Confirmed',
    friendlyDesc:  "You're all set. See you at check-in.",
    step: 1,
  },
  CHECKED_IN: {
    label: 'Checked In',
    color: BK.checkedIn, bg: BK.checkedInBg, border: BK.checkedInBd,
    icon: 'bed', iconLib: 'ionicons', emoji: '🔵',
    friendlyTitle: 'Checked In',
    friendlyDesc:  "You're currently staying with us.",
    step: 2,
  },
  CHECKED_OUT: {
    label: 'Checked Out',
    color: BK.checkedOut, bg: BK.checkedOutBg, border: BK.checkedOutBd,
    icon: 'checkmark-done-circle', iconLib: 'ionicons', emoji: '⚪',
    friendlyTitle: 'Stay Completed',
    friendlyDesc:  'We hope you had a wonderful stay.',
    step: 3,
  },
  CANCELLED: {
    label: 'Cancelled',
    color: BK.cancelled, bg: BK.cancelledBg, border: BK.cancelledBd,
    icon: 'close-circle', iconLib: 'ionicons', emoji: '🔴',
    friendlyTitle: 'Booking Cancelled',
    friendlyDesc:  'This reservation has been cancelled.',
    step: -1,
  },
  NO_SHOW: {
    label: 'No Show',
    color: BK.noShow, bg: BK.noShowBg, border: BK.noShowBd,
    icon: 'person-remove-outline', iconLib: 'ionicons', emoji: '⚫',
    friendlyTitle: 'No Show',
    friendlyDesc:  'Guest did not check in for this reservation.',
    step: -1,
  },
};

const getConfig = (status: string): StatusConfig =>
  STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;

const statusLabel = (status: string, t: TFunction): string => {
  switch (status) {
    case 'PENDING':    return t('status.pending');
    case 'CONFIRMED':  return t('status.confirmed');
    case 'CHECKED_IN': return t('status.checked_in');
    case 'CHECKED_OUT':return t('status.checked_out');
    case 'CANCELLED':  return t('status.cancelled');
    case 'NO_SHOW':    return t('status.no_show');
    default:           return t('status.pending');
  }
};

const statusTitle = (status: string, t: TFunction): string => {
  switch (status) {
    case 'CONFIRMED':  return t('notifications.lifecycle.bookingConfirmed.title');
    case 'CHECKED_IN': return t('status.checked_in');
    case 'CANCELLED':  return t('notifications.lifecycle.bookingCancelled.title');
    default:           return getConfig(status).friendlyTitle;
  }
};

const statusDesc = (status: string, t: TFunction): string =>
  status === 'NO_SHOW' ? t('bookingComponents.no_show') : getConfig(status).friendlyDesc;

// ─── BookingStatusBadge ─────────────────────────────────────────────────────
export function BookingStatusBadge({
  status, size = 'md',
}: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const { t } = useTranslation();
  const c = getConfig(status);
  const label = statusLabel(status, t);
  const pad = size === 'sm' ? { px: 8, py: 3 } : size === 'lg' ? { px: 14, py: 7 } : { px: 10, py: 5 };
  const fs  = size === 'sm' ? 10 : size === 'lg' ? 14 : 12;
  const is  = size === 'sm' ? 11 : size === 'lg' ? 16 : 13;
  return (
    <View style={[
      badge.wrap,
      {
        backgroundColor: c.bg,
        borderColor: c.border,
        paddingHorizontal: pad.px,
        paddingVertical: pad.py,
      },
    ]}
    accessibilityRole="text"
    accessibilityLabel={`Booking status: ${label}`}
    >
      <Ionicons name={c.icon as any} size={is} color={c.color} />
      <Text style={[badge.text, { color: c.color, fontSize: fs }]}>{label}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start' },
  text: { fontWeight: '700', letterSpacing: 0.3 },
});

// ─── BookingTimeline (§20, §13) ─────────────────────────────────────────────
export function BookingTimeline({
  status,
  isCashAtHotel = false,
  style,
}: {
  status: string;
  isCashAtHotel?: boolean;
  style?: ViewStyle;
}) {
  const { t } = useTranslation();
  // Special handling for terminal states (§20)
  const isCancelled = status === 'CANCELLED';
  const isNoShow    = status === 'NO_SHOW';
  if (isCancelled || isNoShow) {
    return (
      <View style={[tl.wrap, style]}>
        <TimelineRow
          step={{
            key: 'CONFIRMED',
            label: t('notifications.lifecycle.bookingConfirmed.title'),
            sub: 'Reservation confirmed',
            icon: 'checkmark-circle',
          }}
          state="done"
          isLast={false}
        />
        <TimelineRow
          step={{
            key: status,
            label: isCancelled ? t('notifications.lifecycle.bookingCancelled.title') : t('status.no_show'),
            sub: isCancelled ? 'Reservation cancelled' : 'Guest did not check in',
            icon: isCancelled ? 'close-circle' : 'person-remove-outline',
          }}
          state="terminal"
          isLast
          color={isCancelled ? BK.cancelled : BK.noShow}
        />
      </View>
    );
  }

  // PENDING state (§22, §14)
  if (status === 'PENDING' && !isCashAtHotel) {
    const pendingSteps: Array<{ key: string; label: string; sub: string; icon: string; state: 'done' | 'active' | 'todo' }> = [
      { key: 'PENDING',     label: t('bookingComponents.booking_created'),   sub: t('bookingComponents.payment_required'), icon: 'time-outline',            state: 'active' },
      { key: 'CONFIRMED',   label: t('notifications.lifecycle.bookingConfirmed.title'), sub: t('bookingComponents.ready_checkin'), icon: 'checkmark-circle-outline', state: 'todo' },
      { key: 'CHECKED_IN',  label: t('booking.check_in'),  sub: t('bookingComponents.from_2pm'),                icon: 'log-in-outline',          state: 'todo'   },
      { key: 'CHECKED_OUT', label: t('booking.check_out'), sub: t('bookingComponents.by_12pm'),                 icon: 'log-out-outline',         state: 'todo'   },
    ];
    return (
      <View style={[tl.wrap, style]}>
        {pendingSteps.map((s, i) => (
          <TimelineRow
            key={s.key}
            step={s}
            state={s.state}
            isLast={i === pendingSteps.length - 1}
          />
        ))}
      </View>
    );
  }

  // Standard Lifecycle (§20): CONFIRMED · CHECKED_IN · CHECKED_OUT (Applies to both Cash-at-hotel and Online paid)
  // CONFIRMED:   ✓ Booking Confirmed | ○ Check-in | ○ Check-out
  // CHECKED_IN:  ✓ Booking Confirmed | ✓ Checked In | ○ Check-out
  // CHECKED_OUT: ✓ Booking Confirmed | ✓ Checked In | ✓ Checked Out
  const isCheckedIn  = status === 'CHECKED_IN';
  const isCheckedOut = status === 'CHECKED_OUT';

  const lifecycleSteps: Array<{ key: string; label: string; sub: string; icon: string; state: 'done' | 'active' | 'todo' }> = [
    {
      key: 'CONFIRMED',
      label: t('notifications.lifecycle.bookingConfirmed.title'),
      sub: isCashAtHotel ? 'Pay at hotel during stay' : 'Reservation confirmed',
      icon: 'checkmark-circle',
      state: 'done',
    },
    {
      key: 'CHECKED_IN',
      label: isCheckedIn || isCheckedOut ? t('status.checked_in') : t('booking.check_in'),
      sub: isCheckedIn ? 'Currently staying with us' : isCheckedOut ? 'Checked in' : 'From 2:00 PM on arrival date',
      icon: isCheckedIn || isCheckedOut ? 'bed' : 'log-in-outline',
      state: isCheckedIn ? 'active' : isCheckedOut ? 'done' : 'todo',
    },
    {
      key: 'CHECKED_OUT',
      label: isCheckedOut ? t('status.checked_out') : t('booking.check_out'),
      sub: isCheckedOut ? 'Stay completed' : 'By 12:00 PM on departure date',
      icon: isCheckedOut ? 'checkmark-done-circle' : 'log-out-outline',
      state: isCheckedOut ? 'done' : 'todo',
    },
  ];

  return (
    <View style={[tl.wrap, style]}>
      {lifecycleSteps.map((step, i) => (
        <TimelineRow
          key={step.key}
          step={step}
          state={step.state}
          isLast={i === lifecycleSteps.length - 1}
        />
      ))}
    </View>
  );
}

function TimelineRow({
  step, state, isLast, color,
}: {
  step: { key: string; label: string; sub: string; icon: string };
  state: 'done' | 'active' | 'todo' | 'terminal';
  isLast: boolean;
  color?: string;
}) {
  // Pulse animation for active step
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state !== 'active') return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [state, pulse]);

  const cfg = getConfig(step.key);
  const effectiveColor = color ??
    (state === 'done'     ? BK.confirmed :
     state === 'active'   ? cfg.color    :
     state === 'terminal' ? (color ?? BK.cancelled) : BK.border);

  const dotBg   = state === 'done' || state === 'active' || state === 'terminal' ? effectiveColor : BK.white;
  const textCol = state === 'todo' ? BK.textMut : BK.text;
  const subCol  = state === 'todo' ? BK.textMut : BK.textSec;

  return (
    <View style={tl.row}>
      {/* Left: dot + connector */}
      <View style={tl.left}>
        {state === 'active' ? (
          <View style={tl.dotOuter}>
            <Animated.View style={[tl.dotPulse, { backgroundColor: effectiveColor, transform: [{ scale: pulse }], opacity: 0.2 }]} />
            <View style={[tl.dot, { backgroundColor: dotBg, borderColor: effectiveColor }]}>
              <Ionicons name={step.icon as any} size={12} color={BK.white} />
            </View>
          </View>
        ) : (
          <View style={[tl.dot, {
            backgroundColor: dotBg,
            borderColor: state === 'done' ? effectiveColor : state === 'terminal' ? effectiveColor : BK.border,
          }]}>
            {state === 'done' ? (
              <Ionicons name="checkmark" size={12} color={BK.white} />
            ) : state === 'terminal' ? (
              <Ionicons name={step.icon as any} size={12} color={BK.white} />
            ) : (
              <View style={[tl.dotInner, { backgroundColor: BK.border }]} />
            )}
          </View>
        )}
        {!isLast && (
          <View style={[tl.connector, {
            backgroundColor: state === 'done' ? BK.confirmed : BK.border,
          }]} />
        )}
      </View>

      {/* Right: text */}
      <View style={tl.content}>
        <Text style={[tl.label, { color: textCol, fontWeight: state === 'active' ? '700' : '600' }]}>
          {step.label}
        </Text>
        <Text style={[tl.sub, { color: subCol }]}>{step.sub}</Text>
      </View>
    </View>
  );
}

const tl = StyleSheet.create({
  wrap:      { gap: 0 },
  row:       { flexDirection: 'row', gap: 14, minHeight: 60 },
  left:      { alignItems: 'center', width: 28 },
  dotOuter:  { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dotPulse:  { position: 'absolute', width: 28, height: 28, borderRadius: 14 },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1,
  },
  dotInner:  { width: 8, height: 8, borderRadius: 4 },
  connector: { flex: 1, width: 2, marginTop: 2, borderRadius: 1 },
  content:   { flex: 1, paddingBottom: 16, justifyContent: 'center' },
  label:     { fontSize: 14, color: BK.text, letterSpacing: -0.1 },
  sub:       { fontSize: 12, marginTop: 2, color: BK.textSec },
});

// ─── StatusHero ─────────────────────────────────────────────────────────────
// Large centered status display used at top of detail screens
export function StatusHero({ status, bookingRef }: { status: string; bookingRef?: string }) {
  const { t } = useTranslation();
  const c = getConfig(status);
  const title = statusTitle(status, t);
  const desc = statusDesc(status, t);
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
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[ds.date, compact && ds.dateSmall]}>{fmt(checkIn)}</Text>
      </View>
      <View style={ds.mid} accessibilityLabel={`${nights} ${nights === 1 ? 'night' : t('booking.nights')}`}>
        <View style={[ds.line, { backgroundColor: BK.border }]} />
        <View style={ds.pill}>
          <Text numberOfLines={1} style={ds.nights}>{nights} {nights === 1 ? 'night' : t('booking.nights')}</Text>
        </View>
        <View style={[ds.line, { backgroundColor: BK.border }]} />
      </View>
      <View style={[ds.block, { alignItems: 'flex-end' }]}>
        <Text style={ds.label}>{t('common.check_out')}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[ds.date, compact && ds.dateSmall]}>{fmt(checkOut)}</Text>
      </View>
    </View>
  );
}
const ds = StyleSheet.create({
  strip:     { flexDirection: 'row', alignItems: 'center', backgroundColor: BK.bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, minHeight: 66 },
  block:     { flex: 1, minWidth: 0 },
  label:     { fontSize: 11, fontWeight: '700', color: BK.checkedIn, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  date:      { fontSize: 14, fontWeight: '700', color: BK.text },
  dateSmall: { fontSize: 13 },
  mid:       { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minWidth: 76 },
  line:      { flex: 1, height: 1, minWidth: 6 },
  pill:      { backgroundColor: BK.white, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: BK.border },
  nights:    { fontSize: 10, fontWeight: '700', color: BK.navyMuted, letterSpacing: 0.1 },
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
    discount     ? { label: t('bookingFlow.discount'), value: `−${fmt(discount)}`,  green: true  } : null,
    taxAmount    ? { label: t('bookingComponents.tax_fees'),  value: fmt(taxAmount),        neutral: true } : null,
    serviceFee   ? { label: t('bookingComponents.service_fee'), value: fmt(serviceFee),       neutral: true } : null,
  ].filter(Boolean) as { label: string; value: string; neutral?: boolean; green?: boolean }[];

  const savings = priceLocked && currentRoomPrice != null && basePrice != null && nights != null
    ? (currentRoomPrice - basePrice) * nights
    : 0;

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
              <Text style={[pb.savingsText, { color: BK.confirmed }]}>{t('bookingComponents.you_saved', { amount: Number(savings).toLocaleString() })}</Text>
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
export function RoomSummaryCard({
  imageUrl, roomType, roomNumber, hotelName, guests, onPress, style,
}: {
  imageUrl?: string | null; roomType?: string; roomNumber?: string;
  hotelName?: string; guests?: number; onPress?: () => void; style?: ViewStyle;
}) {
  const { t } = useTranslation();
  const FALLBACK = 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&h=300&fit=crop';
  const inner = (
    <View style={[rm.card, SHADOW_SM, style]}>
      <Image
        source={{ uri: imageUrl ?? FALLBACK }}
        style={rm.image}
        contentFit="cover"
        placeholder={{ blurhash: 'LKO2?U42NwRn4jEYJMROM[~q?xRP' }}
        transition={300}
      />
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
  card:    { flexDirection: 'row', backgroundColor: BK.white, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: BK.border },
  image:   { width: 90, height: 90, aspectRatio: 1 },
  body:    { flex: 1, padding: 12, justifyContent: 'space-between' },
  room:    { fontSize: 15, fontWeight: '700', color: BK.text },
  sub:     { fontSize: 12, color: BK.textSec, marginTop: 2 },
  hotel:   { fontSize: 13, color: BK.navyMuted, fontWeight: '500' },
  guestRow:{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  guestText:{ fontSize: 12, color: BK.textMut },
});

// ─── PaymentStatusRow ────────────────────────────────────────────────────────
export function PaymentStatusRow({
  method, status, amount,
}: { method: string; status: string; amount?: number | string }) {
  const { t } = useTranslation();
  const map: Record<string, { color: string; bg: string; label: string; icon: string }> = {
    SUCCEEDED: { color: BK.confirmed, bg: BK.confirmedBg, label: 'Paid',      icon: 'checkmark-circle' },
    PENDING:   { color: BK.pending,   bg: BK.pendingBg,   label: t('status.pending'),   icon: 'time-outline'     },
    PENDING_AT_HOTEL: { color: BK.confirmed, bg: BK.confirmedBg, label: 'Pay at hotel', icon: 'cash-outline' },
    FAILED:    { color: BK.cancelled, bg: BK.cancelledBg, label: 'Failed',    icon: 'close-circle'     },
    REFUNDED:  { color: BK.checkedIn, bg: BK.checkedInBg, label: 'Refunded',  icon: 'return-down-back' },
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

// ─── Refund lifecycle ───────────────────────────────────────────────────────
export type RefundState = 'REQUESTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'NOT_APPLICABLE' | 'NO_REFUND' | 'UNKNOWN';

const REFUND_CONFIG: Record<RefundState, { label: string; message: string; color: string; bg: string; icon: string }> = {
  REQUESTED: { label: 'Refund requested', message: 'Your refund request has been received.', color: BK.pending, bg: BK.pendingBg, icon: 'time-outline' },
  PROCESSING: { label: 'Refund processing', message: 'Your payment provider is processing the refund.', color: BK.checkedIn, bg: BK.checkedInBg, icon: 'sync-outline' },
  COMPLETED: { label: 'Refund completed', message: 'The refund was successfully processed.', color: BK.confirmed, bg: BK.confirmedBg, icon: 'checkmark-circle' },
  FAILED: { label: 'Refund failed', message: 'We could not complete the refund automatically. Our team has been notified.', color: BK.cancelled, bg: BK.cancelledBg, icon: 'warning-outline' },
  NOT_APPLICABLE: { label: 'No refund required', message: 'No payment was collected, so no refund is required.', color: BK.cancelled, bg: BK.cancelledBg, icon: 'information-circle-outline' },
  NO_REFUND: { label: 'No refund available', message: 'This booking was cancelled outside the refundable period.', color: BK.cancelled, bg: BK.cancelledBg, icon: 'close-circle-outline' },
  UNKNOWN: { label: 'Refund status unavailable', message: 'We will show the provider status here once it is available.', color: BK.navyMuted, bg: BK.bgDeep, icon: 'help-circle-outline' },
};

export function RefundStatus({
  state,
  amount,
  method,
  reference,
  onContactSupport,
  style,
}: {
  state: RefundState;
  amount?: number | string;
  method?: string;
  reference?: string | null;
  onContactSupport?: () => void;
  style?: ViewStyle;
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
  const cfgLabel = t(refundLabelKey[state] ?? 'bookingComponents.refund_unknown_status');
  const cfgMessage = t(refundMsgKey[state] ?? 'bookingComponents.refund_unknown_msg');
  return (
    <View style={[refund.status, { backgroundColor: config.bg }, style]} accessibilityRole="text" accessibilityLabel={`${cfgLabel}. ${cfgMessage}`}>
      <Ionicons name={config.icon as any} size={19} color={config.color} />
      <View style={refund.body}>
        <Text style={[refund.title, { color: config.color }]}>{cfgLabel}</Text>
        <Text style={refund.message}>{cfgMessage}</Text>
        {amount != null && <Text style={refund.meta}>{t('bookingComponents.refund_amount')} ETB {Number(amount).toLocaleString()}</Text>}
        {method && <Text style={refund.meta}>{t('bookingComponents.original_payment', { method: method.replace(/_/g, ' ') })}</Text>}
        {reference && <Text style={refund.meta}>{t('bookingDetail.reference')}: {reference}</Text>}
        {state === 'FAILED' && onContactSupport && (
          <Pressable
            onPress={onContactSupport}
            style={refund.supportBtn}
            accessibilityRole="button"
            accessibilityLabel={t('bookingComponents.contact_support')}
          >
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
  const steps: Array<{ label: string; icon: string; state: 'done' | 'active' | 'todo' | 'terminal' }> = state === 'NOT_APPLICABLE'
    ? [{ label: t('bookingComponents.cancellation_confirmed'), icon: 'checkmark', state: 'done' }, { label: t('bookingComponents.no_refund_required_status'), icon: 'information', state: 'terminal' }]
    : state === 'NO_REFUND'
    ? [{ label: t('bookingComponents.cancellation_confirmed'), icon: 'checkmark', state: 'done' }, { label: t('bookingComponents.no_refund_available_status'), icon: 'close', state: 'terminal' }]
    : state === 'FAILED'
    ? [
        { label: t('bookingComponents.cancellation_confirmed'), icon: 'checkmark', state: 'done' },
        { label: t('bookingComponents.refund_requested_step'), icon: 'checkmark', state: 'done' },
        { label: t('bookingComponents.refund_processing_step'), icon: 'sync', state: 'done' },
        { label: t('bookingComponents.refund_failed_step'), icon: 'close', state: 'terminal' },
        { label: t('bookingComponents.support_followup'), icon: 'headset', state: 'active' },
      ]
    : [
        { label: t('bookingComponents.cancellation_confirmed'), icon: 'checkmark', state: 'done' },
        { label: t('bookingComponents.refund_requested_step'), icon: 'checkmark', state: state === 'REQUESTED' ? 'active' : 'done' },
        { label: t('bookingComponents.refund_processing_step'), icon: 'sync', state: state === 'PROCESSING' ? 'active' : state === 'REQUESTED' ? 'todo' : 'done' },
        { label: t('bookingComponents.refund_completed_step'), icon: 'checkmark', state: state === 'COMPLETED' ? 'active' : 'todo' },
      ];

  return (
    <View style={[refund.timeline, style]}>
      {steps.map((step, index) => (
        <View key={step.label} style={refund.timelineRow}>
          <View style={refund.timelineRail}>
            <View style={[refund.timelineDot, { backgroundColor: step.state === 'todo' ? BK.white : step.state === 'terminal' ? BK.cancelled : step.state === 'active' ? BK.pending : BK.confirmed, borderColor: step.state === 'todo' ? BK.border : step.state === 'terminal' ? BK.cancelled : step.state === 'active' ? BK.pending : BK.confirmed }]}>
              {step.state !== 'todo' && <Ionicons name={step.icon as any} size={11} color={BK.white} />}
            </View>
            {index < steps.length - 1 && <View style={[refund.timelineLine, { backgroundColor: step.state === 'done' ? BK.confirmed : BK.border }]} />}
          </View>
          <Text style={[refund.timelineLabel, { color: step.state === 'todo' ? BK.textMut : step.state === 'terminal' ? BK.cancelled : step.state === 'active' ? BK.navy : BK.text }]}>{step.label}</Text>
        </View>
      ))}
    </View>
  );
}
const refund = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 12 },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '800' },
  message: { fontSize: 12, color: BK.textSec, lineHeight: 17 },
  meta: { fontSize: 12, color: BK.textSec, fontWeight: '600', marginTop: 2 },
  supportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: BK.cancelled, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
  supportBtnText: { color: BK.white, fontSize: 12, fontWeight: '700' },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', minHeight: 42, gap: 10 },
  timelineRail: { width: 20, alignItems: 'center' },
  timelineDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  timelineLine: { width: 2, flex: 1, marginVertical: 2 },
  timelineLabel: { flex: 1, fontSize: 13, fontWeight: '700', paddingTop: 2 },
});

// ─── CancellationPolicy ──────────────────────────────────────────────────────
export function CancellationPolicy({
  cancellationHours = 48, checkIn, style,
}: { cancellationHours?: number; checkIn: string; style?: ViewStyle }) {
  const hoursUntil = (new Date(checkIn).getTime() - Date.now()) / 3_600_000;
  const isFreePeriod = hoursUntil > cancellationHours;
  const is50Period   = !isFreePeriod && hoursUntil > cancellationHours / 2;
  const tier = isFreePeriod
    ? { label: 'Free cancellation',   color: BK.confirmed, bg: BK.confirmedBg, pct: 100 }
    : is50Period
    ? { label: '50% refund available', color: BK.pending,   bg: BK.pendingBg,   pct: 50  }
    : { label: 'Non-refundable',        color: BK.cancelled,  bg: BK.cancelledBg, pct: 0   };

  return (
    <View style={[cp.wrap, { backgroundColor: tier.bg }, style]} accessibilityLabel={tier.label}>
      <Ionicons name="shield-checkmark-outline" size={16} color={tier.color} />
      <View style={cp.body}>
        <Text style={[cp.label, { color: tier.color }]}>{tier.label}</Text>
        <Text style={cp.sub}>
          {isFreePeriod
            ? `Cancel free up to ${cancellationHours}h before check-in`
            : is50Period
            ? `50% refund if cancelled now`
            : 'No refund for cancellations at this stage'}
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

// ─── QRCodeCard ──────────────────────────────────────────────────────────────
// Renders a deterministic QR-like pattern with proper finder patterns
// (real QR generation would use react-native-qrcode-svg)
export function QRCodeCard({
  bookingRef, guestName, style,
}: { bookingRef: string; guestName?: string; style?: ViewStyle }) {
  const { t } = useTranslation();
  const { width: screenW } = useWindowDimensions();
  const QR_W = Math.min(screenW - 80, 240);
  const SIZE = 21; // QR Version 1 (21x21 modules)
  const QR_CELL = QR_W / SIZE;

  const grid = useMemo(() => {
    const seed = bookingRef.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xfffff, 0);
    const cells: boolean[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

    // Finder patterns (7x7 in three corners)
    const drawFinder = (startX: number, startY: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          const isOuter = x === 0 || x === 6 || y === 0 || y === 6;
          const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          cells[startY + y][startX + x] = isOuter || isInner;
        }
      }
    };
    drawFinder(0, 0);       // top-left
    drawFinder(SIZE - 7, 0); // top-right
    drawFinder(0, SIZE - 7); // bottom-left

    // Timing patterns (row 6 and column 6)
    for (let i = 8; i < SIZE - 8; i++) {
      cells[6][i] = i % 2 === 0;
      cells[i][6] = i % 2 === 0;
    }

    // Alignment pattern (center for Version 1: at position 16,16 if present)
    if (SIZE >= 21) {
      const ax = SIZE - 7;
      const ay = SIZE - 7;
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const py = ay + y;
          const px = ax + x;
          if (py >= 0 && py < SIZE && px >= 0 && px < SIZE) {
            const isOuter = Math.abs(x) === 2 || Math.abs(y) === 2;
            const isCenter = x === 0 && y === 0;
            cells[py][px] = isOuter || isCenter;
          }
        }
      }
    }

    // Reserve format info areas (around finder patterns)
    for (let i = 0; i < 8; i++) {
      cells[8][i] = false; // top-left horizontal
      cells[i][8] = false; // top-left vertical
      cells[8][SIZE - 1 - i] = false; // top-right
      cells[SIZE - 1 - i][8] = false; // bottom-left
    }
    cells[8][8] = false;

    // Fill data area with deterministic pattern from booking ref
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (cells[y][x]) continue; // skip reserved
        // Skip finder pattern zones
        if ((x < 9 && y < 9) || (x >= SIZE - 8 && y < 9) || (x < 9 && y >= SIZE - 8)) continue;
        // Skip timing
        if (x === 6 || y === 6) continue;
        const idx = y * SIZE + x;
        cells[y][x] = ((seed * (idx + 1) * 7 + idx * 13 + seed * 3) & 3) < 2;
      }
    }

    return cells;
  }, [bookingRef]);

  return (
    <View style={[qr.wrap, SHADOW, style]}>
      <View style={[qr.grid, { width: QR_W, height: QR_W }]}>
        {grid.flat().map((filled, i) => (
          <View
            key={i}
            style={[qr.cell, { width: QR_CELL, height: QR_CELL, backgroundColor: filled ? BK.navy : BK.white }]}
          />
        ))}
      </View>
      <Text style={qr.ref}>{bookingRef}</Text>
      {guestName && <Text style={qr.guest}>{guestName}</Text>}
      <View style={qr.hint}>
        <Ionicons name="information-circle-outline" size={14} color={BK.textMut} />
        <Text style={qr.hintText}>{t('bookingComponents.show_at_reception')}</Text>
      </View>
    </View>
  );
}
const qr = StyleSheet.create({
  wrap:    { backgroundColor: BK.white, borderRadius: 20, padding: 20, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: BK.border },
  grid:    { flexDirection: 'row', flexWrap: 'wrap' },
  cell:    {},
  ref:     { fontSize: 14, fontWeight: '800', color: BK.navy, letterSpacing: 1 },
  guest:   { fontSize: 13, color: BK.textSec, fontWeight: '500' },
  hint:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  hintText:{ fontSize: 11, color: BK.textMut },
});

// ─── BookingCard (list item §21, §22, §23) ─────────────────────────────────
export const BookingCard = React.memo(function BookingCard({
  booking, onPress, showCancelButton, onCancel, onShowQR, onCompletePayment, onContactReception, onLeaveReview,
}: {
  booking: {
    id: string; status: string; checkIn: string; checkOut: string;
    totalPrice: number | string; reference?: string;
    hotel?: { name?: string; images?: { url: string }[] };
    details?: { room?: { type?: string; roomNumber?: string }; guestCount?: number }[];
    payment?: { method: string; status: string };
  };
  onPress: () => void;
  showCancelButton?: boolean;
  onCancel?: () => void;
  onShowQR?: () => void;
  onCompletePayment?: () => void;
  onContactReception?: () => void;
  onLeaveReview?: () => void;
}) {
  const { t } = useTranslation();
  const nights = Math.max(1, Math.ceil(
    (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / 86400000,
  ));
  const ref    = booking.reference ?? `#${booking.id.slice(0, 8).toUpperCase()}`;
  const img    = booking.hotel?.images?.[0]?.url;
  const room   = booking.details?.[0]?.room;
  const guests = booking.details?.reduce((s, d) => s + (d.guestCount ?? 1), 0) ?? 1;
  const isCheckedIn  = booking.status === 'CHECKED_IN';
  const isCheckedOut = booking.status === 'CHECKED_OUT';
  const isNoShow     = booking.status === 'NO_SHOW';
  const statusText   = statusLabel(booking.status, t);
  const paymentLabel = booking.status === 'PENDING'
    ? 'Payment required'
    : booking.payment?.method === 'CASH_AT_HOTEL'
    ? 'Pay at hotel'
    : 'Booked price';
  const FALLBACK = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=300&fit=crop';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [bc.card, SHADOW, pressed && bc.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Booking at ${booking.hotel?.name ?? 'Hotel'}, ${statusText}, check-in ${booking.checkIn}`}
    >
      {/* Hero image */}
      <Image
        source={{ uri: img ?? FALLBACK }}
        style={bc.image}
        contentFit="cover"
        placeholder={{ blurhash: 'LKO2?U42NwRn4jEYJMROM[~q?xRP' }}
        transition={300}
      />

      {/* Status badge overlay */}
      <View style={bc.badgeOverlay}>
        <BookingStatusBadge status={booking.status} size="sm" />
      </View>

      {/* Body */}
      <View style={bc.body}>
        {/* Hotel + ref */}
        <View style={bc.headerRow}>
          <View style={bc.flex}>
            <Text style={bc.hotelName} numberOfLines={1}>{booking.hotel?.name ?? 'Hotel Booking'}</Text>
            <Text style={bc.roomName} numberOfLines={1}>{room?.type ?? t('common.room')}{room?.roomNumber ? ` · ${room.roomNumber}` : ''}</Text>
          </View>
          <View style={bc.refWrap}>
            <Text style={bc.ref}>{ref}</Text>
          </View>
        </View>

        {/* Status-specific message */}
        {isCheckedIn && (
          <View style={[bc.statusMsg, { backgroundColor: BK.checkedInBg }]}>
            <Ionicons name="bed" size={13} color={BK.checkedIn} />
            <Text style={[bc.statusMsgText, { color: BK.checkedIn }]}>{"You're currently staying with us."}</Text>
          </View>
        )}
        {isCheckedOut && (
          <View style={[bc.statusMsg, { backgroundColor: BK.checkedOutBg }]}>
            <Ionicons name="checkmark-done-circle" size={13} color={BK.checkedOut} />
            <Text style={[bc.statusMsgText, { color: BK.checkedOut }]}>{t('bookingComponents.stay_completed')}</Text>
          </View>
        )}
        {isNoShow && (
          <View style={[bc.statusMsg, { backgroundColor: BK.noShowBg }]}>
            <Ionicons name="person-remove-outline" size={13} color={BK.noShow} />
            <Text style={[bc.statusMsgText, { color: BK.noShow }]}>{t('bookingComponents.no_show')}</Text>
          </View>
        )}

        {/* Date strip */}
        <DateStrip
          checkIn={booking.checkIn}
          checkOut={booking.checkOut}
          nights={nights}
          compact
        />

        {/* Meta row */}
        <View style={bc.meta}>
          <View style={bc.metaItem}>
            <Ionicons name="moon-outline" size={13} color={BK.textMut} />
            <Text style={bc.metaText}>{nights} {nights !== 1 ? t('booking.nights') : 'night'}</Text>
          </View>
          <View style={bc.metaDot} />
          <View style={bc.metaItem}>
            <Ionicons name="people-outline" size={13} color={BK.textMut} />
            <Text style={bc.metaText}>{guests} {guests !== 1 ? t('hotel.guestsPlural') : t('hotel.guestsSingle')}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={bc.footer}>
          <View>
            <Text style={bc.totalLabel}>{paymentLabel}</Text>
            <Text style={bc.price}>ETB {Number(booking.totalPrice).toLocaleString()}</Text>
          </View>
          <View style={bc.actions}>
            {/* PENDING: Complete payment (§22) */}
            {booking.status === 'PENDING' && onCompletePayment && (
              <Pressable
                onPress={onCompletePayment}
                style={bc.payBtn}
                accessibilityRole="button"
                accessibilityLabel={t('bookingDetail.completePayment')}
                hitSlop={6}
              >
                <Ionicons name="card-outline" size={13} color={BK.white} />
                <Text style={bc.payBtnText}>{t('buttons.complete_payment')}</Text>
              </Pressable>
            )}

            {/* CONFIRMED: QR code (§23) */}
            {booking.status === 'CONFIRMED' && onShowQR && (
              <Pressable
                onPress={onShowQR}
                style={bc.qrBtn}
                accessibilityRole="button"
                accessibilityLabel="Show check-in QR code"
                hitSlop={6}
              >
                <Ionicons name="qr-code-outline" size={13} color={BK.navy} />
                <Text style={bc.qrBtnText}>QR</Text>
              </Pressable>
            )}

            {/* CHECKED_IN: Contact reception (§24) */}
            {isCheckedIn && onContactReception && (
              <Pressable
                onPress={onContactReception}
                style={bc.qrBtn}
                accessibilityRole="button"
                accessibilityLabel="Contact reception"
                hitSlop={6}
              >
                <Ionicons name="call-outline" size={13} color={BK.navy} />
                <Text style={bc.qrBtnText}>{t('bookingComponents.reception')}</Text>
              </Pressable>
            )}

            {/* CHECKED_OUT: Leave review (§25) */}
            {isCheckedOut && onLeaveReview && (
              <Pressable
                onPress={onLeaveReview}
                style={bc.payBtn}
                accessibilityRole="button"
                accessibilityLabel="Leave review"
                hitSlop={6}
              >
                <Ionicons name="star-outline" size={13} color={BK.white} />
                <Text style={bc.payBtnText}>{t('buttons.review')}</Text>
              </Pressable>
            )}

            {showCancelButton && onCancel && (
              <Pressable
                onPress={onCancel}
                style={bc.cancelBtn}
                accessibilityRole="button"
                accessibilityLabel={t('bookingDetail.confirmCancel')}
                hitSlop={6}
              >
                <Text style={bc.cancelBtnText}>{t('bookingComponents.cancel')}</Text>
              </Pressable>
            )}
            <View style={bc.viewBtn}>
              <Text style={bc.viewBtnText}>{t('bookingComponents.view_arrow')}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

// ─── RoomCard (§8, §47) ──────────────────────────────────────────────────────
export interface RoomCardProps {
  room: {
    id: string;
    roomNumber?: string;
    type: string;
    capacity: number;
    beds: number;
    bathroom?: number;
    basePrice: number | string;
    status: string;
    description?: string | null;
    amenities?: string[];
  };
  hotelName?: string;
  imageUrl?: string;
  rating?: number;
  roomSizeM2?: number | string;
  nights?: number;
  availabilityLabel?: 'Available' | 'Only 1 left' | 'Sold out';
  onViewRoom?: () => void;
  onBookRoom?: () => void;
  dark?: boolean;
}

export const RoomCard = React.memo(function RoomCard({
  room,
  hotelName,
  imageUrl,
  rating = 4.8,
  roomSizeM2 = 32,
  nights = 1,
  availabilityLabel,
  onViewRoom,
  onBookRoom,
  dark = false,
}: RoomCardProps) {
  const { t } = useTranslation();
  const isAvailable = room.status === 'AVAILABLE';
  const label = availabilityLabel ?? (isAvailable ? 'Available' : 'Sold out');
  const basePrice = Number(room.basePrice);
  const totalStayPrice = basePrice * Math.max(1, nights);

  const labelBg = label === 'Available' ? BK.confirmedBg : label === 'Only 1 left' ? BK.pendingBg : BK.cancelledBg;
  const labelBd = label === 'Available' ? BK.confirmedBd : label === 'Only 1 left' ? BK.pendingBd : BK.cancelledBd;
  const labelColor = label === 'Available' ? BK.confirmed : label === 'Only 1 left' ? BK.pending : BK.cancelled;

  const bg = dark ? '#152233' : BK.white;
  const borderC = dark ? '#1F3448' : BK.border;
  const textPri = dark ? '#F0F4F8' : BK.navy;
  const textSec = dark ? '#8FA1B3' : BK.textSec;
  const FALLBACK_IMG = 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&h=300&fit=crop';

  return (
    <View style={[rc.card, { backgroundColor: bg, borderColor: borderC }, SHADOW]}>
      {/* Image with overlay badge */}
      <View style={rc.imageContainer}>
        <Image
          source={{ uri: imageUrl || FALLBACK_IMG }}
          style={rc.image}
          contentFit="cover"
          transition={300}
        />
        <View style={[rc.availBadge, { backgroundColor: labelBg, borderColor: labelBd }]}>
          <Text style={[rc.availText, { color: labelColor }]}>{label}</Text>
        </View>
        <View style={rc.ratingBadge}>
          <Ionicons name="star" size={12} color={BK.gold} />
          <Text style={rc.ratingText}>{rating.toFixed(1)}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={rc.body}>
        <View style={rc.titleRow}>
          <View style={rc.flex}>
            <Text style={[rc.roomType, { color: textPri }]} numberOfLines={1}>
              {room.type.charAt(0) + room.type.slice(1).toLowerCase()}
            </Text>
            {hotelName && (
              <Text style={[rc.hotelName, { color: textSec }]} numberOfLines={1}>
                {hotelName}
              </Text>
            )}
          </View>
          <View style={rc.priceCol}>
            <Text style={[rc.pricePerNight, { color: BK.navy }]}>
              ETB {basePrice.toLocaleString()}
            </Text>
            <Text style={[rc.perNightSub, { color: textSec }]}>/ night</Text>
          </View>
        </View>

        {/* Specs row */}
        <View style={rc.specsRow}>
          <View style={rc.specItem}>
            <Ionicons name="bed-outline" size={13} color={BK.navyMuted} />
            <Text style={[rc.specText, { color: textSec }]}>
              {room.beds} {room.beds !== 1 ? t('hotel.bedsPlural') : t('hotel.beds')}
            </Text>
          </View>
          <View style={rc.specDot} />
          <View style={rc.specItem}>
            <Ionicons name="people-outline" size={13} color={BK.navyMuted} />
            <Text style={[rc.specText, { color: textSec }]}>
              Up to {room.capacity} {t('hotel.guestsPlural')}
            </Text>
          </View>
          {roomSizeM2 ? (
            <>
              <View style={rc.specDot} />
              <View style={rc.specItem}>
                <Ionicons name="expand-outline" size={13} color={BK.navyMuted} />
                <Text style={[rc.specText, { color: textSec }]}>{roomSizeM2} m²</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Amenities pills */}
        {room.amenities && room.amenities.length > 0 && (
          <View style={rc.amenitiesWrap}>
            {room.amenities.slice(0, 3).map((a) => (
              <View key={a} style={[rc.amenityPill, { backgroundColor: dark ? '#1F3448' : BK.bg }]}>
                <Text style={[rc.amenityText, { color: textSec }]}>{a}</Text>
              </View>
            ))}
            {room.amenities.length > 3 && (
              <Text style={[rc.moreAmenities, { color: textSec }]}>
                +{room.amenities.length - 3} more
              </Text>
            )}
          </View>
        )}

        {/* Total price & Actions */}
        <View style={[rc.footer, { borderTopColor: borderC }]}>
          <View>
            {nights > 1 && (
              <Text style={[rc.totalStay, { color: textSec }]}>
                ETB {totalStayPrice.toLocaleString()} total ({nights} {t('booking.nights')})
              </Text>
            )}
            <Text style={[rc.roomNumber, { color: textSec }]}>
              {room.roomNumber ? `${t('common.room')} #${room.roomNumber}` : 'Standard allocation'}
            </Text>
          </View>
          <View style={rc.actionsRow}>
            {onViewRoom && (
              <Pressable
                onPress={onViewRoom}
                style={[rc.viewBtn, { borderColor: borderC }]}
                accessibilityRole="button"
                accessibilityLabel={t('bookingComponents.view')}
              >
                <Text style={[rc.viewBtnText, { color: textPri }]}>{t('bookingComponents.view')}</Text>
              </Pressable>
            )}
            {onBookRoom && (
              <Pressable
                onPress={onBookRoom}
                disabled={!isAvailable}
                style={[rc.bookBtn, !isAvailable && rc.bookBtnDisabled]}
                accessibilityRole="button"
                accessibilityLabel={t('buttons.book_this_room')}
              >
                <Text style={rc.bookBtnText}>
                  {isAvailable ? 'Book Room' : 'Sold Out'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
});

const rc = StyleSheet.create({
  card: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, marginBottom: 14 },
  imageContainer: { width: '100%', aspectRatio: 16 / 9, position: 'relative' },
  image: { width: '100%', height: '100%' },
  availBadge: { position: 'absolute', top: 10, left: 12, borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  availText: { fontSize: 11, fontWeight: '700' },
  ratingBadge: { position: 'absolute', top: 10, right: 12, backgroundColor: 'rgba(26,43,74,0.85)', borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  ratingText: { fontSize: 11, fontWeight: '700', color: BK.white },
  body: { padding: 14, gap: 10 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1 },
  roomType: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  hotelName: { fontSize: 12, marginTop: 2 },
  priceCol: { alignItems: 'flex-end' },
  pricePerNight: { fontSize: 16, fontWeight: '800' },
  perNightSub: { fontSize: 11, fontWeight: '500' },
  specsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  specItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  specText: { fontSize: 12, fontWeight: '500' },
  specDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: BK.border },
  amenitiesWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  amenityPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  amenityText: { fontSize: 11, fontWeight: '500' },
  moreAmenities: { fontSize: 11, fontWeight: '500', marginLeft: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  totalStay: { fontSize: 11, fontWeight: '600' },
  roomNumber: { fontSize: 11 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, borderWidth: 1, backgroundColor: 'transparent' },
  viewBtnText: { fontSize: 12, fontWeight: '700' },
  bookBtn: { backgroundColor: BK.navy, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  bookBtnDisabled: { backgroundColor: BK.border },
  bookBtnText: { color: BK.white, fontSize: 12, fontWeight: '700' },
});

const bc = StyleSheet.create({
  card:        { backgroundColor: BK.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: BK.border },
  pressed:     { opacity: 0.92, transform: [{ scale: 0.985 }] },
  image:       { width: '100%', aspectRatio: 2 / 1 },
  badgeOverlay:{ position: 'absolute', top: 10, left: 12 },
  body:        { padding: 14, gap: 12 },
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  flex:        { flex: 1 },
  hotelName:   { fontSize: 16, fontWeight: '700', color: BK.text, letterSpacing: -0.2 },
  roomName:    { fontSize: 13, color: BK.textSec, marginTop: 2 },
  refWrap:     { backgroundColor: BK.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  ref:         { fontSize: 10, fontWeight: '700', color: BK.navyMuted, letterSpacing: 0.5 },
  meta:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:    { fontSize: 12, color: BK.textMut, fontWeight: '500' },
  metaDot:     { width: 3, height: 3, borderRadius: 1.5, backgroundColor: BK.border },
  footer:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 12, borderTopWidth: 1, borderTopColor: BK.border },
  totalLabel:  { fontSize: 10, fontWeight: '600', color: BK.textMut, textTransform: 'uppercase', letterSpacing: 0.5 },
  price:       { fontSize: 18, fontWeight: '800', color: BK.navy, marginTop: 2 },
  actions:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BK.pending, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  payBtnText:  { fontSize: 12, fontWeight: '700', color: BK.white },
  qrBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BK.bgDeep, borderRadius: 8, borderWidth: 1, borderColor: BK.border, paddingHorizontal: 10, paddingVertical: 7 },
  qrBtnText:   { fontSize: 12, fontWeight: '700', color: BK.navy },
  cancelBtn:   { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: BK.cancelledBd, backgroundColor: BK.cancelledBg },
  cancelBtnText:{ fontSize: 12, fontWeight: '700', color: BK.cancelled },
  viewBtn:     { backgroundColor: BK.navy, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  viewBtnText: { fontSize: 13, fontWeight: '700', color: BK.white },
  statusMsg:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8 },
  statusMsgText:{ fontSize: 12, fontWeight: '600' },
});

// ─── Action buttons ──────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function ActionButton({
  label, icon, variant = 'primary', onPress, disabled, loading, fullWidth = true, style,
}: {
  label: string; icon?: string; variant?: BtnVariant;
  onPress: () => void; disabled?: boolean; loading?: boolean;
  fullWidth?: boolean; style?: ViewStyle;
}) {
  const v = {
    primary:   { bg: BK.navy,      fg: BK.white,     bd: BK.navy      },
    secondary: { bg: BK.white,     fg: BK.navy,      bd: BK.border    },
    danger:    { bg: BK.cancelledBg, fg: BK.cancelled, bd: BK.cancelledBd },
    ghost:     { bg: 'transparent', fg: BK.navyMuted, bd: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        ab.btn,
        { backgroundColor: v.bg, borderColor: v.bd },
        fullWidth && ab.full,
        (disabled || loading) && ab.disabled,
        pressed && ab.pressed,
        style,
      ]}
    >
      {loading ? (
        <Text style={[ab.label, { color: v.fg }]}>{label}…</Text>
      ) : (
        <>
          {icon && <Ionicons name={icon as any} size={18} color={v.fg} />}
          <Text style={[ab.label, { color: v.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}
const ab = StyleSheet.create({
  btn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 20 },
  full:     { width: '100%' },
  disabled: { opacity: 0.5 },
  pressed:  { opacity: 0.85, transform: [{ scale: 0.98 }] },
  label:    { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
});

// ─── SectionCard wrapper ─────────────────────────────────────────────────────
export function SectionCard({
  title, children, style,
}: { title?: string; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[sc.card, SHADOW_SM, style]}>
      {title && <Text style={sc.title}>{title}</Text>}
      {children}
    </View>
  );
}
const sc = StyleSheet.create({
  card:  { backgroundColor: BK.white, borderRadius: 16, borderWidth: 1, borderColor: BK.border, padding: 16, gap: 14 },
  title: { fontSize: 14, fontWeight: '700', color: BK.textSec, textTransform: 'uppercase', letterSpacing: 0.5 },
});

// ─── StateTransitionBanner ───────────────────────────────────────────────────
// Shown briefly after a state change (e.g. booking confirmed)
export function StateTransitionBanner({
  newStatus, message,
}: { newStatus: string; message?: string }) {
  const { t } = useTranslation();
  const c = getConfig(newStatus);
  return (
    <View style={[stb.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Ionicons name={c.icon as any} size={20} color={c.color} />
      <View>
        <Text style={[stb.title, { color: c.color }]}>{statusTitle(newStatus, t)}</Text>
        {message && <Text style={stb.msg}>{message}</Text>}
      </View>
    </View>
  );
}
const stb = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  title: { fontSize: 15, fontWeight: '700' },
  msg:   { fontSize: 13, color: BK.textSec, marginTop: 3, lineHeight: 18 },
});

// ─── SkeletonBookingCard ─────────────────────────────────────────────────────
export function SkeletonBookingCard() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const animLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    animLoop.start();
    return () => animLoop.stop();
  }, [anim]);
  const bg = BK.bgDeep;
  return (
    <Animated.View style={[sk.card, { opacity: anim }]}>
      <View style={[sk.image, { backgroundColor: bg }]} />
      <View style={sk.body}>
        <View style={[sk.line, { width: '65%', height: 16, backgroundColor: bg }]} />
        <View style={[sk.line, { width: '45%', height: 12, backgroundColor: bg }]} />
        <View style={[sk.dateStrip, { backgroundColor: bg }]} />
        <View style={[sk.footer, { backgroundColor: bg }]} />
      </View>
    </Animated.View>
  );
}
const sk = StyleSheet.create({
  card:      { backgroundColor: BK.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: BK.border },
  image:     { width: '100%', aspectRatio: 2 / 1 },
  body:      { padding: 14, gap: 10 },
  line:      { borderRadius: 6 },
  dateStrip: { height: 52, borderRadius: 12 },
  footer:    { height: 40, borderRadius: 10 },
});

// ─── HoldTimer (§10, §11, §47) ───────────────────────────────────────────────
export function HoldTimer({
  expiresAt,
  onExpire,
  onSearchAgain,
  style,
}: {
  expiresAt: number;
  onExpire?: () => void;
  onSearchAgain?: () => void;
  style?: ViewStyle;
}) {
  const { t } = useTranslation();
  const [remaining, setRemaining] = React.useState(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
  const expired = remaining <= 0;

  React.useEffect(() => {
    const update = () => {
      const rem = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0) {
        onExpire?.();
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onExpire]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  if (expired) {
    return (
      <View style={[ht.wrap, ht.expiredWrap, style]}>
        <Ionicons name="time-outline" size={20} color={BK.cancelled} />
        <View style={ht.content}>
          <Text style={[ht.title, { color: BK.cancelled }]}>{t('bookingComponents.hold_expired')}</Text>
          <Text style={ht.sub}>{t('bookingComponents.hold_expired_sub')}</Text>
          {onSearchAgain && (
            <Pressable
              onPress={onSearchAgain}
              style={ht.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={t('bookingComponents.search_rooms')}
            >
              <Text style={ht.actionBtnText}>{t('bookingComponents.search_rooms')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={[ht.wrap, ht.activeWrap, style]}>
      <View style={ht.iconPulse}>
        <Ionicons name="lock-closed" size={16} color={BK.confirmed} />
      </View>
      <View style={ht.content}>
        <View style={ht.row}>
          <Text style={[ht.title, { color: BK.navy }]}>{t('bookingComponents.room_held')}</Text>
          <View style={ht.timePill}>
            <Ionicons name="time-outline" size={12} color={BK.confirmed} />
            <Text style={ht.timeText}>{timeStr}</Text>
          </View>
        </View>
        <Text style={ht.sub}>{t('bookingComponents.room_held_sub')}</Text>
      </View>
    </View>
  );
}

const ht = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  activeWrap: { backgroundColor: BK.confirmedBg, borderColor: BK.confirmedBd },
  expiredWrap: { backgroundColor: BK.cancelledBg, borderColor: BK.cancelledBd },
  iconPulse: { width: 32, height: 32, borderRadius: 16, backgroundColor: BK.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BK.confirmedBd },
  content: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 12, color: BK.textSec, lineHeight: 17 },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: BK.white, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: BK.confirmedBd },
  timeText: { fontSize: 12, fontWeight: '800', color: BK.confirmed, fontVariant: ['tabular-nums'] },
  actionBtn: { alignSelf: 'flex-start', backgroundColor: BK.cancelled, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginTop: 6 },
  actionBtnText: { color: BK.white, fontSize: 12, fontWeight: '700' },
});

// ─── AvailabilityAlert (§15, §42, §47) ───────────────────────────────────────
export function AvailabilityAlert({
  visible,
  onViewOtherRooms,
  onModifySearch,
}: {
  visible: boolean;
  onViewOtherRooms: () => void;
  onModifySearch: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={[modalStyles.iconCircle, { backgroundColor: BK.cancelledBg, borderColor: BK.cancelledBd }]}>
            <Ionicons name="alert-circle" size={32} color={BK.cancelled} />
          </View>
          <Text style={modalStyles.title}>{t('bookingComponents.just_booked')}</Text>
          <Text style={modalStyles.desc}>
            Another guest confirmed this room. We have released the temporary hold so you can select another room.
          </Text>
          <View style={modalStyles.btnRow}>
            <Pressable
              onPress={onViewOtherRooms}
              style={[modalStyles.btn, modalStyles.btnPrimary]}
              accessibilityRole="button"
            >
              <Text style={modalStyles.btnPrimaryText}>{t('bookingComponents.view_other')}</Text>
            </Pressable>
            <Pressable
              onPress={onModifySearch}
              style={[modalStyles.btn, modalStyles.btnSecondary]}
              accessibilityRole="button"
            >
              <Text style={modalStyles.btnSecondaryText}>{t('bookingComponents.modify_search')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── PriceChangeAlert (§16, §47) ─────────────────────────────────────────────
export function PriceChangeAlert({
  visible,
  previousPrice,
  newPrice,
  updatedTotal,
  onAccept,
  onGoBack,
}: {
  visible: boolean;
  previousPrice: number | string;
  newPrice: number | string;
  updatedTotal: number | string;
  onAccept: () => void;
  onGoBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <View style={[modalStyles.iconCircle, { backgroundColor: BK.pendingBg, borderColor: BK.pendingBd }]}>
            <Ionicons name="pricetag-outline" size={30} color={BK.pending} />
          </View>
          <Text style={modalStyles.title}>{t('bookingComponents.price_updated')}</Text>
          <Text style={modalStyles.desc}>
            Because the price changed, please review the updated total before continuing.
          </Text>
          <View style={priceChangeStyles.box}>
            <View style={priceChangeStyles.row}>
              <Text style={priceChangeStyles.label}>{t('bookingComponents.previous_price')}</Text>
              <Text style={priceChangeStyles.prevVal}>ETB {Number(previousPrice).toLocaleString()}</Text>
            </View>
            <View style={priceChangeStyles.row}>
              <Text style={priceChangeStyles.label}>{t('bookingComponents.new_price')}</Text>
              <Text style={priceChangeStyles.newVal}>ETB {Number(newPrice).toLocaleString()}</Text>
            </View>
            <View style={[priceChangeStyles.row, priceChangeStyles.totalRow]}>
              <Text style={priceChangeStyles.totalLabel}>{t('bookingComponents.updated_total')}</Text>
              <Text style={priceChangeStyles.totalVal}>ETB {Number(updatedTotal).toLocaleString()}</Text>
            </View>
          </View>
          <View style={modalStyles.btnRow}>
            <Pressable
              onPress={onAccept}
              style={[modalStyles.btn, modalStyles.btnPrimary]}
              accessibilityRole="button"
            >
              <Text style={modalStyles.btnPrimaryText}>{t('bookingComponents.accept_price')}</Text>
            </Pressable>
            <Pressable
              onPress={onGoBack}
              style={[modalStyles.btn, modalStyles.btnSecondary]}
              accessibilityRole="button"
            >
              <Text style={modalStyles.btnSecondaryText}>{t('common.go_back')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── CancellationDialog (§28, §29, §47) ──────────────────────────────────────
export function CancellationDialog({
  visible,
  hotelName,
  roomType,
  bookingRef,
  checkIn,
  checkOut,
  totalPrice,
  cancellationHours = 48,
  isCashAtHotel = false,
  loading = false,
  onConfirmCancel,
  onKeepBooking,
}: {
  visible: boolean;
  hotelName: string;
  roomType?: string;
  bookingRef: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number | string;
  cancellationHours?: number;
  isCashAtHotel?: boolean;
  loading?: boolean;
  onConfirmCancel: () => void;
  onKeepBooking: () => void;
}) {
  const { t } = useTranslation();
  const hoursUntil = (new Date(checkIn).getTime() - Date.now()) / 3_600_000;
  const isFree = hoursUntil > cancellationHours;
  const is50   = !isFree && hoursUntil > cancellationHours / 2;
  const total  = Number(totalPrice);
  const refundAmount = isFree ? total : is50 ? total * 0.5 : 0;
  const feeAmount    = total - refundAmount;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={[modalStyles.card, { maxHeight: '90%' }]}>
          <View style={[modalStyles.iconCircle, { backgroundColor: BK.cancelledBg, borderColor: BK.cancelledBd }]}>
            <Ionicons name="close-circle-outline" size={32} color={BK.cancelled} />
          </View>
          <Text style={modalStyles.title}>{t('bookingComponents.cancel_reservation')}</Text>
          <Text style={modalStyles.desc}>{t('bookingComponents.cancel_review')}</Text>

          <View style={cancelStyles.recap}>
            <Text style={cancelStyles.hotel} numberOfLines={1}>{hotelName}</Text>
            {roomType && <Text style={cancelStyles.room}>{roomType}</Text>}
            <Text style={cancelStyles.dates}>{checkIn} → {checkOut}</Text>
            <Text style={cancelStyles.ref}>{bookingRef}</Text>
          </View>

          <View style={[cancelStyles.tierBox, { backgroundColor: isCashAtHotel ? BK.bg : isFree ? BK.confirmedBg : is50 ? BK.pendingBg : BK.cancelledBg }]}>
            {isCashAtHotel ? (
              <>
                <Text style={[cancelStyles.tierTitle, { color: BK.navy }]}>{t('bookingComponents.no_refund_required')}</Text>
                <Text style={cancelStyles.tierDesc}>{t('bookingComponents.no_refund_required_sub')}</Text>
              </>
            ) : isFree ? (
              <>
                <Text style={[cancelStyles.tierTitle, { color: BK.confirmed }]}>{t('bookingComponents.full_refund')}</Text>
                <Text style={cancelStyles.tierDesc}>{t('bookingComponents.cancelled_more_than', { hours: cancellationHours })}</Text>
                <View style={cancelStyles.calcRow}>
                  <Text style={cancelStyles.calcKey}>{t('bookingComponents.refund_amount')}</Text>
                  <Text style={[cancelStyles.calcVal, { color: BK.confirmed }]}>ETB {refundAmount.toLocaleString()}</Text>
                </View>
              </>
            ) : is50 ? (
              <>
                <Text style={[cancelStyles.tierTitle, { color: BK.pending }]}>{t('bookingComponents.partial_refund')}</Text>
                <Text style={cancelStyles.tierDesc}>{t('bookingComponents.within_policy')}</Text>
                <View style={cancelStyles.calcRow}>
                  <Text style={cancelStyles.calcKey}>{t('bookingComponents.refund_amount')}</Text>
                  <Text style={[cancelStyles.calcVal, { color: BK.pending }]}>ETB {refundAmount.toLocaleString()}</Text>
                </View>
                <View style={cancelStyles.calcRow}>
                  <Text style={cancelStyles.calcKey}>{t('bookingComponents.cancel_fee')}</Text>
                  <Text style={cancelStyles.calcKey}>ETB {feeAmount.toLocaleString()}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={[cancelStyles.tierTitle, { color: BK.cancelled }]}>{t('bookingComponents.no_refund')}</Text>
                <Text style={cancelStyles.tierDesc}>{t('bookingComponents.outside_period')}</Text>
                <View style={cancelStyles.calcRow}>
                  <Text style={cancelStyles.calcKey}>{t('bookingComponents.refund_amount')}</Text>
                  <Text style={[cancelStyles.calcVal, { color: BK.cancelled }]}>ETB 0</Text>
                </View>
              </>
            )}
          </View>

          <Text style={cancelStyles.confirmQuestion}>{t('bookingComponents.confirm_cancel_q')}</Text>

          <View style={modalStyles.btnRow}>
            <Pressable
              onPress={onKeepBooking}
              disabled={loading}
              style={[modalStyles.btn, modalStyles.btnSecondary]}
              accessibilityRole="button"
            >
              <Text style={modalStyles.btnSecondaryText}>{t('buttons.keep_booking')}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirmCancel}
              disabled={loading}
              style={[modalStyles.btn, cancelStyles.destructiveBtn]}
              accessibilityRole="button"
              accessibilityLabel={t('buttons.cancel_booking')}
            >
              {loading ? (
                <ActivityIndicator size="small" color={BK.white} />
              ) : (
                <Text style={cancelStyles.destructiveBtnText}>{t('buttons.cancel_booking')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── QRCodeModal (§40, §47) ──────────────────────────────────────────────────
export function QRCodeModal({
  visible,
  bookingRef,
  guestName,
  hotelName,
  roomType,
  roomNumber,
  checkIn,
  checkOut,
  onClose,
}: {
  visible: boolean;
  bookingRef: string;
  guestName?: string;
  hotelName?: string;
  roomType?: string;
  roomNumber?: string;
  checkIn?: string;
  checkOut?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const handleShare = async () => {
    try {
      await Share.share({
        message: `LuxSty Booking: ${bookingRef}\n${t('common.hotel')}: ${hotelName ?? 'Hotel'}\n${t('common.room')}: ${roomType ?? ''}${roomNumber ? ` #${roomNumber}` : ''}\n${t('booking.dates')}: ${checkIn ?? ''} - ${checkOut ?? ''}\nGuest: ${guestName ?? ''}`,
      });
    } catch { /* share cancelled */ }
  };

  const handleSave = async () => {
    try {
      await Share.share({
        message: `${t('bookingComponents.booking')}: ${bookingRef} | ${hotelName ?? 'Hotel'} | ${t('common.room')}: ${roomType ?? ''}${roomNumber ? ` #${roomNumber}` : ''} | ${checkIn ?? ''} → ${checkOut ?? ''} | Guest: ${guestName ?? ''}`,
      });
    } catch { /* share cancelled */ }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={modalStyles.overlay}>
        <View style={modalStyles.card}>
          <Pressable onPress={onClose} style={qrModalStyles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color={BK.navy} />
          </Pressable>
          <Text style={qrModalStyles.title}>{t('bookingDetail.qr_title')}</Text>
          <Text style={qrModalStyles.subtitle}>{t('bookingComponents.qr_sub')}</Text>

          <View style={qrModalStyles.qrCardWrap}>
            <QRCodeCard bookingRef={bookingRef} guestName={guestName} />
          </View>

          <View style={qrModalStyles.infoSection}>
            <View style={qrModalStyles.infoRow}>
              <Ionicons name="bed-outline" size={14} color={BK.navyMuted} />
              <Text style={qrModalStyles.infoText}>
                {roomType ?? t('common.room')}{roomNumber ? ` #${roomNumber}` : ''}
              </Text>
            </View>
            {(checkIn || checkOut) && (
              <View style={qrModalStyles.infoRow}>
                <Ionicons name="calendar-outline" size={14} color={BK.navyMuted} />
                <Text style={qrModalStyles.infoText}>{checkIn} → {checkOut}</Text>
              </View>
            )}
          </View>

          <View style={modalStyles.btnRow}>
            <Pressable
              onPress={handleSave}
              style={[modalStyles.btn, modalStyles.btnSecondary]}
              accessibilityRole="button"
              accessibilityLabel={t('common.save')}
            >
              <Ionicons name="download-outline" size={18} color={BK.navy} />
              <Text style={modalStyles.btnSecondaryText}>{t('common.save')}</Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              style={[modalStyles.btn, modalStyles.btnPrimary]}
              accessibilityRole="button"
              accessibilityLabel={t('common.share')}
            >
              <Ionicons name="share-outline" size={18} color={BK.white} />
              <Text style={modalStyles.btnPrimaryText}>{t('common.share')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── BookingSummary (§17, §47) ───────────────────────────────────────────────
export function BookingSummary({
  roomImage,
  roomName,
  roomType,
  hotelName,
  checkIn,
  checkOut,
  nights,
  adults,
  children,
  leadGuestName,
  leadGuestEmail,
  leadGuestPhone,
  subtotal,
  taxAmount,
  discount,
  promoCode,
  total,
  paymentMethod,
  cancellationHours = 48,
  style,
}: {
  roomImage?: string | null;
  roomName?: string;
  roomType?: string;
  hotelName?: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  children: number;
  leadGuestName: string;
  leadGuestEmail?: string;
  leadGuestPhone?: string;
  subtotal: number;
  taxAmount?: number;
  discount?: number;
  promoCode?: string;
  total: number;
  paymentMethod: string;
  cancellationHours?: number;
  style?: ViewStyle;
}) {
  const { t } = useTranslation();
  const isCash = paymentMethod === 'CASH_AT_HOTEL';
  return (
    <View style={[bs.container, style]}>
      <RoomSummaryCard
        imageUrl={roomImage}
        roomType={roomType ?? roomName}
        roomNumber={roomName}
        hotelName={hotelName}
        guests={adults + children}
      />

      <DateStrip checkIn={checkIn} checkOut={checkOut} nights={nights} />

      <View style={bs.card}>
        <Text style={bs.cardTitle}>{t('bookingComponents.guest_info')}</Text>
        <View style={bs.row}>
          <Text style={bs.label}>{t('bookingFlow.lead_guest')}</Text>
          <Text style={bs.val}>{leadGuestName}</Text>
        </View>
        {leadGuestEmail ? (
          <View style={bs.row}>
            <Text style={bs.label}>{t('common.email')}</Text>
            <Text style={bs.val}>{leadGuestEmail}</Text>
          </View>
        ) : null}
        {leadGuestPhone ? (
          <View style={bs.row}>
            <Text style={bs.label}>{t('common.phone')}</Text>
            <Text style={bs.val}>{leadGuestPhone}</Text>
          </View>
        ) : null}
        <View style={bs.row}>
          <Text style={bs.label}>{t('bookingComponents.party')}</Text>
          <Text style={bs.val}>{adults} {adults !== 1 ? t('bookingFlow.adults') : 'Adult'}{children > 0 ? `, ${children} ${children !== 1 ? t('bookingFlow.children') : 'Child'}` : ''}</Text>
        </View>
      </View>

      <View style={bs.card}>
        <Text style={bs.cardTitle}>{t('bookingComponents.price_breakdown')}</Text>
        <PriceBreakdown
          basePrice={nights > 0 ? subtotal / nights : subtotal}
          nights={nights}
          taxAmount={taxAmount}
          discount={discount}
          total={total}
        />
        {promoCode ? (
          <View style={bs.promoRow}>
            <Ionicons name="pricetag-outline" size={13} color={BK.confirmed} />
            <Text style={bs.promoText}>{t('bookingComponents.promo_applied_code', { code: promoCode })}</Text>
          </View>
        ) : null}
      </View>

      <View style={bs.card}>
        <Text style={bs.cardTitle}>{t('bookingComponents.payment_selection')}</Text>
        <View style={bs.row}>
          <View style={bs.payMethod}>
            <Ionicons name={isCash ? 'cash-outline' : 'card-outline'} size={18} color={BK.navy} />
            <Text style={bs.payMethodText}>{paymentMethod.replace(/_/g, ' ')}</Text>
          </View>
          <View style={[bs.payBadge, { backgroundColor: isCash ? BK.confirmedBg : BK.checkedInBg }]}>
            <Text style={[bs.payBadgeText, { color: isCash ? BK.confirmed : BK.checkedIn }]}>
              {isCash ? t('payment.pay_at_hotel') : t('payment.online_payment')}
            </Text>
          </View>
        </View>
        {isCash && (
          <Text style={bs.cashNote}>{t('payment.pay_at_reception')}</Text>
        )}
      </View>

      <CancellationPolicy cancellationHours={cancellationHours} checkIn={checkIn} />
    </View>
  );
}

const bs = StyleSheet.create({
  container: { gap: 12 },
  card: { backgroundColor: BK.white, borderRadius: 14, borderWidth: 1, borderColor: BK.border, padding: 14, gap: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: BK.textSec, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: BK.textSec },
  val: { fontSize: 13, fontWeight: '600', color: BK.text },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  promoText: { fontSize: 12, fontWeight: '700', color: BK.confirmed },
  payMethod: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  payMethodText: { fontSize: 14, fontWeight: '700', color: BK.navy },
  payBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  payBadgeText: { fontSize: 11, fontWeight: '800' },
  cashNote: { fontSize: 12, color: BK.textSec, fontStyle: 'italic', marginTop: 2 },
});

// ─── Modal Styles ────────────────────────────────────────────────────────────
const modalStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 380, backgroundColor: BK.white, borderRadius: 20, padding: 20, alignItems: 'center', gap: 12, ...SHADOW },
  iconCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '800', color: BK.navy, textAlign: 'center', letterSpacing: -0.3 },
  desc: { fontSize: 13, color: BK.textSec, textAlign: 'center', lineHeight: 19 },
  btnRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, minHeight: 48, paddingHorizontal: 14 },
  btnPrimary: { backgroundColor: BK.navy },
  btnPrimaryText: { color: BK.white, fontSize: 14, fontWeight: '700' },
  btnSecondary: { backgroundColor: BK.bg, borderWidth: 1, borderColor: BK.border },
  btnSecondaryText: { color: BK.navy, fontSize: 14, fontWeight: '600' },
});

const priceChangeStyles = StyleSheet.create({
  box: { width: '100%', backgroundColor: BK.bg, borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: BK.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: BK.textSec },
  prevVal: { fontSize: 13, color: BK.textMut, textDecorationLine: 'line-through' },
  newVal: { fontSize: 14, fontWeight: '700', color: BK.navy },
  totalRow: { paddingTop: 6, borderTopWidth: 1, borderTopColor: BK.border },
  totalLabel: { fontSize: 14, fontWeight: '700', color: BK.navy },
  totalVal: { fontSize: 16, fontWeight: '800', color: BK.confirmed },
});

const cancelStyles = StyleSheet.create({
  recap: { width: '100%', backgroundColor: BK.bg, borderRadius: 12, padding: 12, gap: 4, borderWidth: 1, borderColor: BK.border },
  hotel: { fontSize: 14, fontWeight: '700', color: BK.navy },
  room: { fontSize: 12, color: BK.textSec },
  dates: { fontSize: 12, fontWeight: '600', color: BK.text },
  ref: { fontSize: 11, color: BK.textMut, fontWeight: '700', letterSpacing: 0.5 },
  tierBox: { width: '100%', borderRadius: 12, padding: 12, gap: 6, borderWidth: 1, borderColor: BK.border },
  tierTitle: { fontSize: 14, fontWeight: '800' },
  tierDesc: { fontSize: 12, color: BK.textSec, lineHeight: 16 },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  calcKey: { fontSize: 12, color: BK.textSec, fontWeight: '600' },
  calcVal: { fontSize: 13, fontWeight: '800' },
  confirmQuestion: { fontSize: 14, fontWeight: '700', color: BK.navy, textAlign: 'center', marginTop: 4 },
  destructiveBtn: { backgroundColor: BK.cancelled },
  destructiveBtnText: { color: BK.white, fontSize: 14, fontWeight: '700' },
});

const qrModalStyles = StyleSheet.create({
  closeBtn: { alignSelf: 'flex-end', padding: 4 },
  title: { fontSize: 18, fontWeight: '800', color: BK.navy, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: BK.textSec, textAlign: 'center', lineHeight: 18 },
  qrCardWrap: { width: '100%', alignItems: 'center', marginVertical: 8 },
  infoSection: { gap: 6, backgroundColor: BK.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginVertical: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 12, fontWeight: '600', color: BK.textSec },
});

// ─── Primary, Secondary, Danger Button primitives (§47) ──────────────────────
export function PrimaryButton({ label, onPress, loading, disabled, icon, style }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; icon?: string; style?: ViewStyle }) {
  return <ActionButton label={label} onPress={onPress} loading={loading} disabled={disabled} icon={icon} variant="primary" style={style} />;
}
export function SecondaryButton({ label, onPress, loading, disabled, icon, style }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; icon?: string; style?: ViewStyle }) {
  return <ActionButton label={label} onPress={onPress} loading={loading} disabled={disabled} icon={icon} variant="secondary" style={style} />;
}
export function DangerButton({ label, onPress, loading, disabled, icon, style }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; icon?: string; style?: ViewStyle }) {
  return <ActionButton label={label} onPress={onPress} loading={loading} disabled={disabled} icon={icon} variant="danger" style={style} />;
}

// ─── NotificationItem (§41, §47) ─────────────────────────────────────────────
export function NotificationItem({
  icon,
  iconColor,
  title,
  body,
  date,
  isUnread,
  onPress,
  viewLabel,
  style,
}: {
  icon?: string;
  iconColor?: string;
  title: string;
  body: string;
  date?: string;
  isUnread?: boolean;
  onPress?: () => void;
  viewLabel?: string;
  style?: ViewStyle;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.96 : 1 }, style]}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
    >
      <View style={[ni.card, isUnread && ni.unread]}>
        <View style={[ni.iconCircle, { backgroundColor: (iconColor ?? BK.confirmed) + '18' }]}>
          <Text style={ni.iconText}>{icon ?? '🔔'}</Text>
        </View>
        <View style={ni.body}>
          <View style={ni.topRow}>
            <Text style={ni.title} numberOfLines={1}>{title}</Text>
            <View style={ni.right}>
              {isUnread && <View style={ni.dot} />}
              {date && <Text style={ni.date}>{date}</Text>}
            </View>
          </View>
          <Text style={ni.text} numberOfLines={2}>{body}</Text>
          {onPress && (
            <Text style={ni.link}>{viewLabel ?? t('buttons.view_booking_arrow')}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
const ni = StyleSheet.create({
  card:     { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 16, backgroundColor: BK.white, borderWidth: 1, borderColor: BK.border },
  unread:   { backgroundColor: BK.confirmedBg, borderColor: BK.confirmedBd },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  body:     { flex: 1, gap: 4 },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title:    { fontSize: 14, fontWeight: '600', color: BK.navy, flex: 1 },
  right:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  dot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: BK.confirmed },
  date:     { fontSize: 11, color: BK.textMut },
  text:     { fontSize: 13, lineHeight: 18, color: BK.textSec },
  link:     { fontSize: 12, fontWeight: '700', color: BK.confirmed, marginTop: 2 },
});
