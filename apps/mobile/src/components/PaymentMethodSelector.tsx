import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';

export type PaymentMethod = 'TELEBIRR' | 'CBE_BIRR' | 'CREDIT_CARD' | 'PAYPAL' | 'CASH_AT_HOTEL';

export interface PaymentDetails {
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  telebirrPhone?: string;
  paypalEmail?: string;
}

export interface PaymentMethodItem {
  id: PaymentMethod;
  name: string;
  tag: string;
  icon: string;
  category: 'ONLINE' | 'HOTEL';
  bg: string;
  fg: string;
}

export const METHODS: PaymentMethodItem[] = [
  { id: 'CREDIT_CARD', name: 'Credit / Debit Card', tag: 'Visa, Mastercard, Amex', icon: '💳', category: 'ONLINE', bg: colors.paperDeep, fg: colors.inkSoft },
  { id: 'TELEBIRR', name: 'Telebirr', tag: 'Pay securely from your Telebirr wallet', icon: '📱', category: 'ONLINE', bg: colors.goldTint, fg: colors.goldDeep },
  { id: 'CBE_BIRR', name: 'CBE Birr', tag: 'Commercial Bank of Ethiopia mobile pay', icon: '🏦', category: 'ONLINE', bg: colors.tealTint, fg: colors.tealDeep },
  { id: 'PAYPAL', name: 'PayPal', tag: 'International cards and USD/EUR balance', icon: '🌐', category: 'ONLINE', bg: colors.paperDeep, fg: colors.inkSoft },
  { id: 'CASH_AT_HOTEL', name: 'Pay at Hotel', tag: 'Reserve now, pay at reception during stay', icon: '💵', category: 'HOTEL', bg: colors.line, fg: colors.inkSoft },
];

export function PaymentMethodCard({
  item,
  selected,
  onPress,
}: {
  item: PaymentMethodItem;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.option, selected && styles.optionActive]}
    >
      <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
        <Text style={styles.iconText}>{item.icon}</Text>
      </View>
      <View style={styles.optionText}>
        <Text style={styles.optionName}>{item.name}</Text>
        <Text style={styles.optionTag}>{item.tag}</Text>
      </View>
      <View style={[styles.radioDot, selected && styles.radioDotSelected]}>
        {selected && <View style={styles.radioDotInner} />}
      </View>
    </Pressable>
  );
}

type Props = {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  onDetailsChange?: (details: PaymentDetails) => void;
  details?: PaymentDetails;
};

function formatCardNumber(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return digits.slice(0, 2) + ' / ' + digits.slice(2);
  return digits;
}

function detectCardBrand(num: string): string | null {
  const clean = num.replace(/\D/g, '');
  if (clean.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return 'Mastercard';
  if (/^3[47]/.test(clean)) return 'American Express';
  return null;
}

export default function PaymentMethodSelector({ value, onChange, onDetailsChange, details }: Props) {
  const [cardNumber, setCardNumber] = useState(details?.cardNumber ?? '');
  const [cardExpiry, setCardExpiry] = useState(details?.cardExpiry ?? '');
  const [cardCvv, setCardCvv] = useState(details?.cardCvv ?? '');
  const [telebirrPhone, setTelebirrPhone] = useState(details?.telebirrPhone ?? '');
  const [cbePhone, setCbePhone] = useState(details?.telebirrPhone ?? '');
  const [paypalEmail, setPaypalEmail] = useState(details?.paypalEmail ?? '');

  const cardBrand = detectCardBrand(cardNumber);

  const updateDetails = (partial: PaymentDetails) => {
    const updated = { cardNumber, cardExpiry, cardCvv, telebirrPhone, paypalEmail, ...partial };
    onDetailsChange?.(updated);
  };

  const onlineMethods = METHODS.filter((m) => m.category === 'ONLINE');
  const hotelMethods = METHODS.filter((m) => m.category === 'HOTEL');

  return (
    <View style={styles.container}>
      {/* ONLINE PAYMENT SECTION */}
      <View style={styles.section}>
        <Text style={styles.categoryLabel}>ONLINE PAYMENT</Text>
        <View style={styles.grid}>
          {onlineMethods.map((m) => (
            <PaymentMethodCard
              key={m.id}
              item={m}
              selected={value === m.id}
              onPress={() => onChange(m.id)}
            />
          ))}
        </View>
      </View>

      {/* PAY AT HOTEL SECTION */}
      <View style={styles.section}>
        <Text style={styles.categoryLabel}>PAY AT HOTEL</Text>
        <View style={styles.grid}>
          {hotelMethods.map((m) => (
            <PaymentMethodCard
              key={m.id}
              item={m}
              selected={value === m.id}
              onPress={() => onChange(m.id)}
            />
          ))}
        </View>
      </View>

      {value === 'CREDIT_CARD' && (
        <View style={styles.subForm}>
          <View style={styles.fieldHeaderRow}>
            <Text style={styles.fieldLabel}>Card number</Text>
            {cardBrand && (
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>{cardBrand}</Text>
              </View>
            )}
          </View>
          <TextInput
            style={styles.input}
            inputMode="numeric"
            placeholder="4111 1111 1111 1111"
            placeholderTextColor={colors.inkMuted}
            maxLength={19}
            value={cardNumber}
            onChangeText={(t) => { const formatted = formatCardNumber(t); setCardNumber(formatted); updateDetails({ cardNumber: formatted }); }}
          />
          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Expiry</Text>
              <TextInput
                style={styles.input}
                placeholder="MM / YY"
                placeholderTextColor={colors.inkMuted}
                maxLength={7}
                value={cardExpiry}
                onChangeText={(t) => { const formatted = formatExpiry(t); setCardExpiry(formatted); updateDetails({ cardExpiry: formatted }); }}
              />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>CVV</Text>
              <TextInput
                style={styles.input}
                inputMode="numeric"
                placeholder="123"
                placeholderTextColor={colors.inkMuted}
                maxLength={4}
                secureTextEntry
                value={cardCvv}
                onChangeText={(t) => { setCardCvv(t); updateDetails({ cardCvv: t }); }}
              />
            </View>
          </View>
        </View>
      )}

      {value === 'TELEBIRR' && (
        <View style={styles.subForm}>
          <Text style={styles.fieldLabel}>Telebirr number</Text>
          <TextInput
            style={styles.input}
            inputMode="tel"
            placeholder="09··· ··· ···"
            placeholderTextColor={colors.inkMuted}
            maxLength={10}
            value={telebirrPhone}
            onChangeText={(t) => { setTelebirrPhone(t); updateDetails({ telebirrPhone: t }); }}
          />
          <Text style={styles.hint}>{`You'll approve a push payment on your phone`}</Text>
        </View>
      )}

      {value === 'PAYPAL' && (
        <View style={styles.subForm}>
          <Text style={styles.fieldLabel}>PayPal email</Text>
          <TextInput
            style={styles.input}
            inputMode="email"
            placeholder="you@example.com"
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            value={paypalEmail}
            onChangeText={(t) => { setPaypalEmail(t); updateDetails({ paypalEmail: t }); }}
          />
          <Text style={styles.hint}>{`You'll be redirected to PayPal to complete payment`}</Text>
        </View>
      )}

      {value === 'CBE_BIRR' && (
        <View style={styles.subForm}>
          <Text style={styles.fieldLabel}>CBE Birr mobile number</Text>
          <TextInput
            style={styles.input}
            inputMode="tel"
            placeholder="09··· ··· ···"
            placeholderTextColor={colors.inkMuted}
            maxLength={10}
            value={cbePhone}
            onChangeText={(t) => { setCbePhone(t); updateDetails({ telebirrPhone: t }); }}
          />
          <Text style={styles.hint}>Open the CBE Birr app on your phone and approve the payment request</Text>
        </View>
      )}

      {value === 'CASH_AT_HOTEL' && (
        <View style={styles.cashInfo}>
          <Text style={styles.cashInfoText}>
            The hotel holds your room for 6:00 PM on check-in day. Settle the full amount in birr at the front desk — bring your booking reference.
          </Text>
        </View>
      )}
    </View>
  );
}

export function methodLabel(m: PaymentMethod): string {
  return METHODS.find((x) => x.id === m)?.name ?? m;
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  section: { gap: 8 },
  categoryLabel: { fontSize: 11, fontWeight: '800', color: colors.inkMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  legend: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 10 },
  grid: { gap: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.line,
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 12,
  },
  optionActive: { borderColor: colors.teal, shadowColor: colors.teal, shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  radioDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioDotSelected: { borderColor: colors.teal },
  radioDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.teal },
  iconCircle: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  optionText: { flex: 1 },
  optionName: { fontSize: 14, fontWeight: '600', color: colors.ink },
  optionTag: { fontSize: 12, color: colors.inkMuted, marginTop: 1, lineHeight: 16 },
  subForm: { marginTop: 12, gap: 8, backgroundColor: colors.paperDeep, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14 },
  fieldHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  brandBadge: { backgroundColor: colors.tealTint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: colors.teal },
  brandBadgeText: { fontSize: 11, fontWeight: '700', color: colors.teal },
  input: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: colors.ink },
  hint: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
  cashInfo: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.gold + '66', backgroundColor: colors.goldTint, paddingHorizontal: 16, paddingVertical: 12 },
  cashInfoText: { fontSize: 13, color: colors.goldDeep, lineHeight: 19 },
});
