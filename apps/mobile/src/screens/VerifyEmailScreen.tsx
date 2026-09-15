import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { request } from '../api';
import { Button } from '../components/Shared';
import { colors, font, radius, shadowCard } from '../theme';

type Props = {
  token: string;
  onVerified: () => void;
  onError: () => void;
};

export default function VerifyEmailScreen({ token, onVerified, onError }: Props) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await request(`/auth/verify-email/${encodeURIComponent(token)}`, { method: 'POST' });
        if (cancelled) return;
        setStatus('success');
        setMessage('Your email has been verified successfully.');
        onVerified();
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Something went wrong.');
      }
    })();
    return () => { cancelled = true; };
  }, [token, onVerified, onError]);

  return (
    <View style={styles.container}>
      <View style={[styles.card, shadowCard]}>
        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={colors.teal} />
            <Text style={styles.title}>Verifying your email...</Text>
            <Text style={styles.sub}>Please wait a moment.</Text>
          </>
        )}
        {status === 'success' && (
          <>
            <Text style={styles.doneIcon}>✓</Text>
            <Text style={styles.title}>Email verified</Text>
            <Text style={styles.sub}>{message}</Text>
            <Button title="Continue to login" onPress={onVerified} />
          </>
        )}
        {status === 'error' && (
          <>
            <Text style={styles.errorIcon}>✕</Text>
            <Text style={styles.title}>Verification failed</Text>
            <Text style={styles.sub}>{message}</Text>
            <Button title="Try again" onPress={onError} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, padding: 24, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, padding: 28, alignItems: 'center', gap: 14, width: '100%' },
  title: { fontFamily: font.display, fontSize: 22, fontWeight: '600', color: colors.ink, marginTop: 6 },
  sub: { color: colors.inkMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  doneIcon: { fontSize: 40, color: colors.teal, fontWeight: '700' },
  errorIcon: { fontSize: 40, color: colors.brick, fontWeight: '700' },
});
