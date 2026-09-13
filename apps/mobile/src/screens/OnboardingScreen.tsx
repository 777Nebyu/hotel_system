import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { Button } from '../components/Shared';
import { font } from '../theme';
import { hapticSelection, hapticSuccess } from '../hooks/useHaptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SLIDES = [
  {
    icon: '🏨',
    title: 'Discover Luxury Stays',
    description: 'Explore premier boutique hotels, scenic resorts, and top-rated accommodations curated across Ethiopia and East Africa.',
  },
  {
    icon: '⚡',
    title: 'Instant Seamless Booking',
    description: 'Lock in your dates with instant confirmation and localized payments including Telebirr, CBE Birr, and cards.',
  },
  {
    icon: '🛎️',
    title: 'Personalized Concierge',
    description: 'Manage bookings on the go, request custom amenities, and connect with 24/7 guest support directly from your pocket.',
  },
];

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < SLIDES.length - 1) {
      hapticSelection();
      setCurrentStep(currentStep + 1);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = () => {
    hapticSuccess();
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  const slide = SLIDES[currentStep];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.paper, paddingTop: insets.top + 16 }]}>
      {/* Top bar with skip */}
      <View style={styles.topBar}>
        <Pressable onPress={finishOnboarding} hitSlop={12} accessibilityRole="button" accessibilityLabel="Skip onboarding">
          <Text style={[styles.skipText, { color: themeColors.inkMuted }]}>Skip</Text>
        </Pressable>
      </View>

      {/* Main Slide Content */}
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: themeColors.tealTint, borderColor: themeColors.teal }]}>
          <Text style={styles.iconText}>{slide.icon}</Text>
        </View>
        <Text style={[styles.title, { color: themeColors.ink }]}>{slide.title}</Text>
        <Text style={[styles.desc, { color: themeColors.inkSoft }]}>{slide.description}</Text>
      </View>

      {/* Indicator & Controls */}
      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: themeColors.lineStrong },
                i === currentStep && [styles.dotActive, { backgroundColor: themeColors.teal }],
              ]}
            />
          ))}
        </View>
        <Button
          title={currentStep === SLIDES.length - 1 ? 'Get Started' : 'Continue →'}
          size="lg"
          variant="primary"
          onPress={handleNext}
          accessibilityLabel={currentStep === SLIDES.length - 1 ? 'Get Started' : 'Continue to next slide'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 16,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    marginBottom: 12,
  },
  iconText: {
    fontSize: 48,
  },
  title: {
    fontFamily: font.display,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  footer: {
    gap: 24,
    marginBottom: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
  },
});
