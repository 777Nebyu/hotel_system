import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

const DEFAULT_STEPS = ['Dates', 'Guests', 'Payment', 'Review', 'Confirmed'] as const;

type Props = { current: number; steps?: readonly string[] };

const DARK = {
  active: '#0F8B7D',
  activeBg: '#0F8B7D',
  done: '#0F8B7D',
  doneBg: '#0F8B7D',
  todo: '#2A4A6A',
  todoBg: 'transparent',
  todoBorder: '#2A4A6A',
  text: '#FFFFFF',
  textMuted: '#546A82',
  connector: '#1E3A55',
  connectorDone: '#0F8B7D',
};

const LIGHT = {
  active: '#087F73',
  activeBg: '#087F73',
  done: '#087F73',
  doneBg: '#087F73',
  todo: '#CBD5E1',
  todoBg: 'transparent',
  todoBorder: '#CBD5E1',
  text: '#0F172A',
  textMuted: '#94A3B8',
  connector: '#E2E8F0',
  connectorDone: '#087F73',
};

const SHADOW_ACTIVE = Platform.select({
  ios: {
    shadowColor: '#0F8B7D',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 4 },
  default: {},
});

export default function BookingStepper({ current, steps = DEFAULT_STEPS }: Props) {
  const { colorScheme } = useTheme();
  const t = colorScheme === 'dark' ? DARK : LIGHT;

  return (
    <View style={styles.row}>
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        const circleBg =
          state === 'done'
            ? t.doneBg
            : state === 'active'
              ? t.activeBg
              : t.todoBg;
        const borderColor =
          state === 'done'
            ? t.done
            : state === 'active'
              ? t.active
              : t.todoBorder;
        const textColor =
          state === 'todo' ? t.textMuted : t.text;

        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: i <= current ? t.connectorDone : t.connector },
                ]}
              />
            )}
            <View style={styles.step}>
              <View
                style={[
                  styles.circle,
                  { backgroundColor: circleBg, borderColor },
                  state === 'active' && SHADOW_ACTIVE,
                ]}
              >
                {state === 'done' ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : (
                  <Text style={[styles.circleText, { color: textColor }]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  { color: state === 'todo' ? t.textMuted : t.text },
                  state === 'active' && styles.labelActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  step: {
    alignItems: 'center',
    gap: 6,
    minWidth: 48,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  labelActive: {
    fontWeight: '700',
  },
  connector: {
    flex: 1,
    height: 2,
    marginTop: 15,
    marginHorizontal: -2,
    borderRadius: 1,
  },
});
