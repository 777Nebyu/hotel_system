import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { request } from '../api';
import { Button } from '../components/Shared';
import { colors, font, radius, shadowCard } from '../theme';

type Props = {
  token: string;
  onReset: () => void;
  onError: () => void;
};

export default function ResetPasswordScreen({ token, onReset, onError }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'form' | 'loading' | 'success' | 'error'>('form');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const validateField = (field: string) => {
    const errs: Record<string, string | undefined> = { ...fieldErrors };
    delete errs[field];
    if (field === 'password') {
      if (!password) errs.password = 'Enter a new password.';
      else if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
      else if (!/[A-Z]/.test(password)) errs.password = 'Password must contain an uppercase letter.';
      else if (!/[a-z]/.test(password)) errs.password = 'Password must contain a lowercase letter.';
      else if (!/[0-9]/.test(password)) errs.password = 'Password must contain a number.';
    }
    if (field === 'confirmPassword') {
      if (!confirmPassword) errs.confirmPassword = 'Please confirm your password.';
      else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errs);
  };

  const submit = async () => {
    const errs: Record<string, string | undefined> = {};
    if (!password) errs.password = 'Enter a new password.';
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
    if (!confirmPassword) errs.confirmPassword = 'Please confirm your password.';
    else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setStatus('loading');
    try {
      await request('/auth/reset-password', { method: 'POST', body: { token, password } });
      setStatus('success');
      setMessage('Your password has been reset successfully.');
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Something went wrong.');
      onError();
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.card, shadowCard]}>
        {status === 'form' && (
          <>
            <Text style={styles.heading}>Reset your password</Text>
            <Text style={styles.sub}>Enter your new password below.</Text>
            <TextInput value={password} onChangeText={(v) => { setPassword(v); setFieldErrors((p) => ({ ...p, password: undefined })); }} onBlur={() => validateField('password')} placeholder="New password" placeholderTextColor={colors.inkMuted} style={[styles.input, fieldErrors.password && styles.inputError]} secureTextEntry />
            {fieldErrors.password ? <Text style={styles.fieldError}>{fieldErrors.password}</Text> : null}
            <TextInput value={confirmPassword} onChangeText={(v) => { setConfirmPassword(v); setFieldErrors((p) => ({ ...p, confirmPassword: undefined })); }} onBlur={() => validateField('confirmPassword')} placeholder="Confirm password" placeholderTextColor={colors.inkMuted} style={[styles.input, fieldErrors.confirmPassword && styles.inputError]} secureTextEntry onSubmitEditing={submit} />
            {fieldErrors.confirmPassword ? <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text> : null}
            <Button title="Reset password" onPress={submit} />
          </>
        )}
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={colors.teal} />
            <Text style={styles.heading}>Resetting password...</Text>
          </>
        )}
        {status === 'success' && (
          <>
            <Text style={styles.doneIcon}>✓</Text>
            <Text style={styles.heading}>Password reset</Text>
            <Text style={styles.sub}>{message}</Text>
            <Button title="Go to login" onPress={onReset} />
          </>
        )}
        {status === 'error' && (
          <>
            <Text style={styles.errorIcon}>✕</Text>
            <Text style={styles.heading}>Reset failed</Text>
            <Text style={styles.sub}>{message}</Text>
            <Button title="Try again" onPress={() => setStatus('form')} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 28, alignItems: 'center', gap: 14, width: '100%' },
  heading: { fontFamily: font.display, fontSize: 22, fontWeight: '600', color: colors.ink },
  sub: { color: colors.inkMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  input: { borderWidth: 1, borderColor: colors.lineStrong, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: colors.ink, width: '100%' },
  inputError: { borderColor: '#EF4444' },
  fieldError: { color: '#EF4444', fontSize: 12, marginTop: 4, textAlign: 'center' },
  doneIcon: { fontSize: 40, color: colors.teal, fontWeight: '700' },
  errorIcon: { fontSize: 40, color: colors.brick, fontWeight: '700' },
});
