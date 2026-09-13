import React, { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../hooks/useTheme';
import { Button, Card } from '../components/Shared';
import { font, radius } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface FAQ {
  q: string;
  a: string;
}

const FAQS: FAQ[] = [
  {
    q: 'How do I cancel or modify my booking?',
    a: 'Go to your Bookings tab, select the active booking, and tap "Modify Booking" or "Cancel Booking". Cancellation terms depend on the hotel’s cancellation policy.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'We support Telebirr, CBE Birr, Awash Birr, Bank Transfers, and major Credit/Debit cards.',
  },
  {
    q: 'Can I check in late?',
    a: 'Yes, when making your booking you can specify special requests such as Late Check-In. You can also message the hotel front desk directly via the Contact tab.',
  },
  {
    q: 'How do refunds work?',
    a: 'Eligible refunds are processed immediately upon cancellation and credited back to your original payment method (typically within 1-3 business days for Telebirr/mobile money, 3-5 days for banks).',
  },
  {
    q: 'How do I file a dispute?',
    a: 'If you encountered issues during your stay that were not resolved by the hotel staff, you can navigate to the Disputes section from your Profile to submit a formal complaint with photo evidence.',
  },
];

export default function HelpScreen() {
  const navigation = useNavigation<Nav>();
  const { colors: themeColors } = useTheme();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleFAQ = (i: number) => {
    setExpandedIndex(expandedIndex === i ? null : i);
  };

  const callHotline = () => {
    Linking.openURL('tel:+251911000000').catch(() => {});
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.paper }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={[styles.backText, { color: themeColors.teal }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: themeColors.ink }]}>Help & Support</Text>
        <Text style={[styles.subtitle, { color: themeColors.inkMuted }]}>We are here 24/7 to assist with your stay</Text>
      </View>

      {/* Emergency & Quick Contact */}
      <Card style={[styles.quickCard, { backgroundColor: themeColors.tealTint, borderColor: themeColors.teal }]}>
        <Text style={[styles.quickTitle, { color: themeColors.tealDeep }]}>Need Immediate Assistance?</Text>
        <Text style={[styles.quickSub, { color: themeColors.tealDeep }]}>
          Speak with our 24/7 concierge & guest support team.
        </Text>
        <View style={styles.btnRow}>
          <Button
            title="📞 Call Support"
            size="sm"
            variant="primary"
            onPress={callHotline}
            accessibilityLabel="Call support hotline"
          />
          <Button
            title="✉️ Send Message"
            size="sm"
            variant="secondary"
            onPress={() => navigation.navigate('ContactNew' as any, {})}
            accessibilityLabel="Send message to support"
          />
        </View>
      </Card>

      {/* FAQs */}
      <Text style={[styles.sectionTitle, { color: themeColors.ink }]}>Frequently Asked Questions</Text>
      <View style={styles.faqList}>
        {FAQS.map((faq, idx) => {
          const isOpen = expandedIndex === idx;
          return (
            <Card key={idx} style={[styles.faqCard, { backgroundColor: themeColors.surface, borderColor: themeColors.line }]}>
              <Pressable
                onPress={() => toggleFAQ(idx)}
                style={styles.faqHeader}
                accessibilityRole="button"
                accessibilityLabel={faq.q}
                accessibilityState={{ expanded: isOpen }}
              >
                <Text style={[styles.faqQuestion, { color: themeColors.ink }]}>{faq.q}</Text>
                <Text style={[styles.faqChevron, { color: themeColors.teal }]}>{isOpen ? '−' : '+'}</Text>
              </Pressable>
              {isOpen && (
                <View style={styles.faqBody}>
                  <Text style={[styles.faqAnswer, { color: themeColors.inkSoft }]}>{faq.a}</Text>
                </View>
              )}
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  header: { marginBottom: 4 },
  backText: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  title: { fontFamily: font.display, fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  quickCard: { padding: 18, borderRadius: radius.card, gap: 10 },
  quickTitle: { fontSize: 16, fontWeight: '700' },
  quickSub: { fontSize: 13, lineHeight: 18 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 8 },
  faqList: { gap: 10 },
  faqCard: { padding: 14, borderRadius: radius.card },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQuestion: { fontSize: 15, fontWeight: '600', flex: 1, paddingRight: 8 },
  faqChevron: { fontSize: 20, fontWeight: '700' },
  faqBody: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CBD5E1' },
  faqAnswer: { fontSize: 14, lineHeight: 20 },
});
