import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { request } from '../api';
import { saveSessionToStorage, setSession, type Session } from '../store/authSlice';
import { useAppDispatch } from '../store/hooks';
import { useTheme } from '../hooks/useTheme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MfaVerify'>;

export default function MfaVerifyScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const dispatch = useAppDispatch();
  const { colors: c } = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^\d{6}$/.test(code)) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your authenticator app.');
      return;
    }
    setBusy(true);
    try {
      const session = await request<Session>('/auth/mfa/verify', {
        method: 'POST',
        body: { challengeToken: route.params.challengeToken, code },
      });
      await saveSessionToStorage(session);
      dispatch(setSession(session));
      const destination: Record<string, keyof RootStackParamList> = {
        ADMIN: 'AdminOverview',
        MANAGER: 'ManagerOverview',
        STAFF: 'ManagerBookings',
      };
      navigation.reset({ index: 0, routes: [{ name: destination[session.user.role] ?? 'MainTabs' } as never] });
    } catch (error) {
      Alert.alert('MFA verification failed', error instanceof Error ? error.message : 'The code is invalid or expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.paper }]}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[styles.title, { color: c.ink }]}>Administrator verification</Text>
        <Text style={[styles.body, { color: c.inkSoft }]}>Enter the 6-digit code from your authenticator app to finish signing in.</Text>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          placeholder="000000"
          placeholderTextColor={c.inkMuted}
          style={[styles.input, { color: c.ink, borderColor: c.lineStrong }]}
          textContentType="oneTimeCode"
          accessibilityLabel="MFA code"
        />
        <Pressable onPress={() => void submit()} disabled={busy} style={[styles.button, { backgroundColor: c.teal }, busy && { opacity: 0.65 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify and continue</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { borderWidth: 1, borderRadius: 20, padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22 },
  input: { borderWidth: 1.5, borderRadius: 12, padding: 15, fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  button: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
