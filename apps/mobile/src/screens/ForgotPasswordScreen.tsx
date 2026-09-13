import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { request } from '../api';
import { Button, Logo } from '../components/Shared';
import { colors, font, radius, shadowCard } from '../theme';
import { forgotPasswordSchema } from '../lib/schemas';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const validateField = (field: string) => {
    try {
      if (field === 'email') {
        if (!email.trim()) { setFieldErrors((prev) => ({ ...prev, email: 'Email is required.' })); return; }
        forgotPasswordSchema.shape.email.parse(email.trim());
      }
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    } catch (err: any) {
      const msg = err.errors?.[0]?.message ?? 'Invalid email';
      setFieldErrors((prev) => ({ ...prev, [field]: msg }));
    }
  };

  const submit = async () => {
    if (!email.trim()) { setFieldErrors({ email: 'Email is required.' }); return; }
    try {
      forgotPasswordSchema.parse({ email: email.trim() });
      setFieldErrors({});
    } catch (err: any) {
      const errors: Record<string, string | undefined> = {};
      err.errors?.forEach((e: any) => { errors[e.path?.[0]] = e.message; });
      setFieldErrors(errors);
      return;
    }
    setLoading(true);
    try {
      await request('/auth/forgot-password', { method: 'POST', body: { email: email.trim() } });
      setSent(true);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not send reset link');
    } finally { setLoading(false); }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.centerCard}>
          <Text style={styles.doneIcon}>✉️</Text>
          <Text style={styles.doneTitle}>Check your inbox</Text>
          <Text style={styles.doneSub}>We sent a password reset link to {email}</Text>
          <Button title="Back to sign in" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.goBack()}><Text style={styles.backText}>{'< Back to sign in'}</Text></Pressable>
      <View style={styles.brandBlock}>
        <Logo size={30} />
        <Text style={styles.heading}>Reset your password</Text>
        <Text style={styles.sub}>{`Enter the email you used to sign up. We'll send you a reset link.`}</Text>
      </View>
      <View style={[styles.card, shadowCard]}>
        <TextInput value={email} onChangeText={(v) => { setEmail(v); setFieldErrors((p) => ({ ...p, email: undefined })); }} onBlur={() => validateField('email')} placeholder="Email address" placeholderTextColor={colors.inkMuted} style={[styles.input, fieldErrors.email && styles.inputError]} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
        <Button title={loading ? 'Sending...' : 'Send reset link'} onPress={submit} disabled={loading} loading={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: 'center' },
  backText: { color: colors.teal, fontSize: 14, fontWeight: '600', marginBottom: 20 },
  brandBlock: { alignItems: 'center', marginBottom: 28 },
  heading: { fontFamily: font.display, color: colors.ink, fontSize: 24, fontWeight: '600', marginTop: 12 },
  sub: { color: colors.inkMuted, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 20, gap: 14 },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.ink },
  inputError: { borderColor: '#EF4444' },
  fieldError: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  centerCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 28, alignItems: 'center', gap: 10 },
  doneIcon: { fontSize: 40 },
  doneTitle: { fontFamily: font.display, fontSize: 20, fontWeight: '600', color: colors.ink, marginTop: 6 },
  doneSub: { color: colors.inkMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
