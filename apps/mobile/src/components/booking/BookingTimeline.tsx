/**
 * booking/BookingTimeline.tsx
 * Visual step-by-step timeline of the booking lifecycle.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { BK, getConfig } from './_shared';

function TimelineRow({
  step, state, isLast, color,
}: {
  step: { key: string; label: string; sub: string; icon: string };
  state: 'done' | 'active' | 'todo' | 'terminal';
  isLast: boolean;
  color?: string;
}) {
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
    <View style={styles.row}>
      <View style={styles.left}>
        {state === 'active' ? (
          <View style={styles.dotOuter}>
            <Animated.View style={[styles.dotPulse, { backgroundColor: effectiveColor, transform: [{ scale: pulse }], opacity: 0.2 }]} />
            <View style={[styles.dot, { backgroundColor: dotBg, borderColor: effectiveColor }]}>
              <Ionicons name={step.icon as any} size={12} color={BK.white} />
            </View>
          </View>
        ) : (
          <View style={[styles.dot, {
            backgroundColor: dotBg,
            borderColor: state === 'done' ? effectiveColor : state === 'terminal' ? effectiveColor : BK.border,
          }]}>
            {state === 'done' ? (
              <Ionicons name="checkmark" size={12} color={BK.white} />
            ) : state === 'terminal' ? (
              <Ionicons name={step.icon as any} size={12} color={BK.white} />
            ) : (
              <View style={[styles.dotInner, { backgroundColor: BK.border }]} />
            )}
          </View>
        )}
        {!isLast && (
          <View style={[styles.connector, {
            backgroundColor: state === 'done' ? BK.confirmed : BK.border,
          }]} />
        )}
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: textCol, fontWeight: state === 'active' ? '700' : '600' }]}>
          {step.label}
        </Text>
        <Text style={[styles.sub, { color: subCol }]}>{step.sub}</Text>
      </View>
    </View>
  );
}

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
  const isCancelled = status === 'CANCELLED';
  const isNoShow    = status === 'NO_SHOW';
  if (isCancelled || isNoShow) {
    return (
      <View style={[styles.wrap, style]}>
        <TimelineRow
          step={{ key: 'CONFIRMED', label: t('notifications.lifecycle.bookingConfirmed.title'), sub: t('bookingComponents.reservation_confirmed'), icon: 'checkmark-circle' }}
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

  if (status === 'PENDING' && !isCashAtHotel) {
    const pendingSteps: Array<{ key: string; label: string; sub: string; icon: string; state: 'done' | 'active' | 'todo' }> = [
      { key: 'PENDING',     label: t('bookingComponents.booking_created'),   sub: t('bookingComponents.payment_required'), icon: 'time-outline',            state: 'active' },
      { key: 'CONFIRMED',   label: t('notifications.lifecycle.bookingConfirmed.title'), sub: t('bookingComponents.ready_checkin'), icon: 'checkmark-circle-outline', state: 'todo' },
      { key: 'CHECKED_IN',  label: t('booking.check_in'),  sub: t('bookingComponents.from_2pm'),                icon: 'log-in-outline',          state: 'todo'   },
      { key: 'CHECKED_OUT', label: t('booking.check_out'), sub: t('bookingComponents.by_12pm'),                 icon: 'log-out-outline',         state: 'todo'   },
    ];
    return (
      <View style={[styles.wrap, style]}>
        {pendingSteps.map((s, i) => (
          <TimelineRow key={s.key} step={s} state={s.state} isLast={i === pendingSteps.length - 1} />
        ))}
      </View>
    );
  }

  const isCheckedIn  = status === 'CHECKED_IN';
  const isCheckedOut = status === 'CHECKED_OUT';
  const lifecycleSteps: Array<{ key: string; label: string; sub: string; icon: string; state: 'done' | 'active' | 'todo' }> = [
    {
      key: 'CONFIRMED',
      label: t('notifications.lifecycle.bookingConfirmed.title'),
      sub: isCashAtHotel ? t('bookingComponents.pay_at_hotel_stay') : t('bookingComponents.reservation_confirmed'),
      icon: 'checkmark-circle',
      state: 'done',
    },
    {
      key: 'CHECKED_IN',
      label: isCheckedIn || isCheckedOut ? t('status.checked_in') : t('booking.check_in'),
      sub: isCheckedIn ? t('bookingComponents.currently_staying') : isCheckedOut ? t('status.checked_in') : t('bookingComponents.from_2pm'),
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
    <View style={[styles.wrap, style]}>
      {lifecycleSteps.map((step, i) => (
        <TimelineRow key={step.key} step={step} state={step.state} isLast={i === lifecycleSteps.length - 1} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:      { gap: 0 },
  row:       { flexDirection: 'row', gap: 14, minHeight: 60 },
  left:      { alignItems: 'center', width: 28 },
  dotOuter:  { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  dotPulse:  { position: 'absolute', width: 28, height: 28, borderRadius: 14 },
  dot:       { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  dotInner:  { width: 8, height: 8, borderRadius: 4 },
  connector: { flex: 1, width: 2, marginTop: 2, borderRadius: 1 },
  content:   { flex: 1, paddingBottom: 16, justifyContent: 'center' },
  label:     { fontSize: 14, color: BK.text, letterSpacing: -0.1 },
  sub:       { fontSize: 12, marginTop: 2, color: BK.textSec },
});
