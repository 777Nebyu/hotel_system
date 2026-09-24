import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { colorScheme } = useTheme();
  const palette = colorScheme === 'dark' ? DARK : LIGHT;

  const stepLabel = (label: string): string => {
    switch (label) {
      case 'Dates':     return t('booking.dates');
      case 'Guests':    return t('booking.guests');
      case 'Payment':   return t('common.payment');
      case 'Review':    return t('buttons.review');
      case 'Confirmed': return t('status.confirmed');
      default:          return label;
    }
  };

  return (
    <View style={styles.row}>
      {steps.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'active' : 'todo';
        const circleBg =
          state === 'done'
            ? palette.doneBg
            : state === 'active'
              ? palette.activeBg
              : palette.todoBg;
        const borderColor =
          state === 'done'
            ? palette.done
            : state === 'active'
              ? palette.active
              : palette.todoBorder;
        const textColor =
          state === 'todo' ? palette.textMuted : palette.text;

        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <View
                style={[
                  styles.connector,
                  { backgroundColor: i <= current ? palette.connectorDone : palette.connector },
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
                  { color: state === 'todo' ? palette.textMuted : palette.text },
                  state === 'active' && styles.labelActive,
                ]}
                numberOfLines={1}
              >
                {stepLabel(label)}
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
