import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BK } from './BookingComponents';

const DEFAULT_STEPS = ['Dates', 'Guests', 'Payment', 'Review', 'Confirmed'] as const;

type Props = { current: number; steps?: readonly string[] };

export default function BookingStepper({ current, steps = DEFAULT_STEPS }: Props) {
  return (
    <View style={styles.row}>
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <View style={[styles.connector, i <= current && styles.connectorDone]} />
            )}
            <View style={styles.step}>
              <View style={[
                styles.circle,
                state === 'done' && styles.circleDone,
                state === 'active' && styles.circleActive,
              ]}>
                {state === 'done' ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : (
                  <Text style={[styles.circleText, state === 'active' && styles.circleTextActive]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.label, state === 'todo' && styles.labelTodo]}>{label}</Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  step: { alignItems: 'center', gap: 6 },
  circle: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: BK.border,
    backgroundColor: BK.white, alignItems: 'center', justifyContent: 'center',
  },
  circleDone: { backgroundColor: BK.navy, borderColor: BK.navy },
  circleActive: { borderColor: BK.navy, shadowColor: BK.navy, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  circleText: { fontSize: 13, fontWeight: '600', color: BK.textMut },
  circleTextActive: { color: BK.navy },
  checkmark: { color: BK.white, fontSize: 15, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '600', color: BK.text, textAlign: 'center' },
  labelTodo: { color: BK.textMut },
  connector: { flex: 1, height: 2, backgroundColor: BK.border, marginTop: 16, marginHorizontal: -4 },
  connectorDone: { backgroundColor: BK.navy },
});
