import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppDispatch } from '../store/hooks';
import { setSession, saveSessionToStorage, type Session } from '../store/authSlice';
import { request } from '../api';
import { classifyAndAnnounce } from '../errors';
import { FieldError } from '../components/Shared';
import { font } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { hapticSuccess, hapticError } from '../hooks/useHaptics';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { loginSchema, registerSchema } from '../lib/schemas';
import { getExpoPushToken, registerPushToken } from '../lib/notifications';
import { isBiometricEnabled, getStoredRefreshToken, enableBiometric, disableBiometric } from '../lib/biometrics';

type Nav   = NativeStackNavigationProp<RootStackParamList, 'Auth'>;
type Route = RouteProp<RootStackParamList, 'Auth'>;

type Mode = 'login' | 'register';

const TERMS_URL = 'https://yayetech.com/terms';
const PRIVACY_URL = 'https://yayetech.com/privacy';

// ─── Reusable labelled input ──────────────────────────────────────────────────
function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  returnKeyType,
  onSubmitEditing,
  inputRef,
  error,
  autoFocus,
  rightElement,
  onBlur,
  c,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  secureTextEntry?: boolean;
  returnKeyType?: 'next' | 'done' | 'go';
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput | null>;
  error?: string;
  autoFocus?: boolean;
  rightElement?: React.ReactNode;
  onBlur?: () => void;
  c: Record<string, string>;
}) {
  return (
    <View style={inputStyles.wrap}>
      <Text style={[inputStyles.label, { color: c.inkSoft }]}>{label}</Text>
      <View style={[inputStyles.box, { backgroundColor: c.surface, borderColor: c.line }, !!error && { borderColor: c.danger }]}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={c.inkMuted}
          style={[inputStyles.input, { color: c.ink }]}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? 'none'}
          secureTextEntry={secureTextEntry}
          returnKeyType={returnKeyType ?? 'next'}
          onSubmitEditing={onSubmitEditing}
          autoFocus={autoFocus}
          autoCorrect={false}
          accessibilityLabel={label}
          accessibilityHint={placeholder}
        />
        {rightElement}
      </View>
      <FieldError message={error} />
    </View>
  );
}

const inputStyles = StyleSheet.create({
  wrap:     { gap: 6 },
  label:    { fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    minHeight: 50,
  },
  input:    { flex: 1, fontSize: 15, paddingVertical: 0 },
});

// ─── Static styles (theme-independent) ─────────────────────────────────────
const staticStyles = StyleSheet.create({
  eyeBtn: { paddingLeft: 8 },
  forgotRow: { alignSelf: 'flex-end', marginTop: -4 },
  strengthWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -4 },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 42, textAlign: 'right' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 },
  checkbox: { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  ctaInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  dividerLine: { flex: 1, height: 1 },
  googleBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchRow: { alignItems: 'center', marginTop: 8 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AuthScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const dispatch   = useAppDispatch();
  const insets     = useSafeAreaInsets();
  const initialMode = route.params?.initialMode ?? 'login';

  const [mode,            setMode]            = useState<Mode>(initialMode);
  const [fullName,        setFullName]        = useState('');
  const [email,           setEmail]           = useState('');
  const [phone,           setPhone]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [termsAccepted,   setTermsAccepted]   = useState(false);
  const [busy,            setBusy]            = useState(false);
  const [fieldErrors,     setFieldErrors]     = useState<Record<string, string | undefined>>({});

  const { promptAsync: googlePrompt, handleGoogleAuth, loading: googleLoading, setLoading: setGoogleLoading } = useGoogleAuth();

  const emailRef   = useRef<TextInput>(null);
  const phoneRef   = useRef<TextInput>(null);
  const passRef    = useRef<TextInput>(null);
  const confRef    = useRef<TextInput>(null);

  const { colors: c } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    root:   { flex: 1, backgroundColor: c.paper },
    scroll: { paddingHorizontal: 24 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.line, marginBottom: 28 },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
    logoMark: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.teal, alignItems: 'center', justifyContent: 'center' },
    logoWord: { fontFamily: font.display, fontSize: 26, fontWeight: '700', color: c.ink, letterSpacing: -0.5 },
    heading: { fontSize: 28, fontWeight: '800', color: c.ink, letterSpacing: -0.4, marginBottom: 6 },
    subheading: { fontSize: 15, color: c.inkMuted, marginBottom: 28, lineHeight: 21 },
    modePills: { flexDirection: 'row', backgroundColor: c.paperDeep, borderRadius: 12, padding: 4, marginBottom: 28 },
    modePill: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
    modePillActive: { backgroundColor: c.surface, shadowColor: c.ink, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
    modePillText: { fontSize: 14, fontWeight: '600', color: c.inkMuted },
    modePillTextActive: { color: c.ink, fontWeight: '700' },
    form: { gap: 16, marginBottom: 20 },
    forgotText: { fontSize: 13, fontWeight: '600', color: c.teal },
    termsText: { flex: 1, fontSize: 13, color: c.inkSoft, lineHeight: 19 },
    termsLink: { color: c.teal, fontWeight: '600' },
    checkboxChecked: { backgroundColor: c.teal, borderColor: c.teal },
    cta: { backgroundColor: c.teal, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginTop: 4, shadowColor: c.teal, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4, minHeight: 52 },
    ctaBusy: { opacity: 0.65 },
    ctaPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
    ctaText: { color: c.surface, fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
    dividerText: { fontSize: 13, fontWeight: '600', color: c.inkMuted },
    googleBtn: { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1.5, borderColor: c.lineStrong, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 52, shadowColor: c.ink, shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    googleBtnBusy: { opacity: 0.65 },
    googleBtnPressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
    googleBtnText: { color: c.ink, fontSize: 15, fontWeight: '600' },
    switchText: { fontSize: 14, color: c.inkMuted, textAlign: 'center' },
    switchLink: { color: c.teal, fontWeight: '700' },
  }), [c]);

  // ── Biometric auto-login on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const biometricEnabled = await isBiometricEnabled();
        if (!biometricEnabled) return;
        const storedRefreshToken = await getStoredRefreshToken();
        if (!storedRefreshToken) return;
        const { authenticateWithBiometrics } = await import('../lib/biometrics');
        const ok = await authenticateWithBiometrics('Unlock Yayetech Hotel');
        if (ok) {
          setBusy(true);
          try {
            const session = await request<Session>('/auth/refresh', {
              method: 'POST',
              body: { refreshToken: storedRefreshToken },
            });
            await saveSessionToStorage(session);
            dispatch(setSession(session));
            if (session.refreshToken) {
              await enableBiometric(session.refreshToken);
            }
            hapticSuccess();
            const dest: Record<string, keyof RootStackParamList> = {
              ADMIN:   'AdminOverview',
              MANAGER: 'ManagerOverview',
              STAFF:   'ManagerBookings',
            };
            navigation.reset({
              index: 0,
              routes: [{ name: (dest[session.user.role] ?? 'MainTabs') as any }],
            });
          } catch {
            await disableBiometric();
          } finally {
            setBusy(false);
          }
        }
      } catch { /* ignore */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearErrors = () => setFieldErrors({});

  const switchMode = (next: Mode) => {
    clearErrors();
    setFullName(''); setEmail(''); setPhone('');
    setPassword(''); setConfirmPassword('');
    setTermsAccepted(false);
    setMode(next);
  };

  const validateField = (field: 'email' | 'password' | 'fullName' | 'phone' | 'confirmPassword') => {
    try {
      if (field === 'email') {
        loginSchema.shape.email.parse(email.trim());
      } else if (field === 'password') {
        loginSchema.shape.password.parse(password);
      } else if (field === 'fullName') {
        registerSchema.innerType().shape.fullName.parse(fullName.trim());
      } else if (field === 'phone') {
        if (phone.trim()) {
          registerSchema.innerType().shape.phone.parse(phone.trim());
        }
      } else if (field === 'confirmPassword') {
        if (confirmPassword && confirmPassword !== password) {
          setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
          return;
        }
      }
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    } catch (err: any) {
      const msg = err.errors?.[0]?.message ?? 'Invalid value';
      setFieldErrors((prev) => ({ ...prev, [field]: msg }));
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await googlePrompt();
      if (result?.type !== 'success') {
        setGoogleLoading(false);
        return;
      }
      const idToken = (result as any).authentication?.idToken ?? (result as any).params?.id_token;
      if (!idToken) {
        setGoogleLoading(false);
        return;
      }

      const session = await handleGoogleAuth(idToken);
      await saveSessionToStorage(session);
      dispatch(setSession(session));
      hapticSuccess();

      const pushToken = await getExpoPushToken();
      if (pushToken) {
        registerPushToken(pushToken, session.accessToken).catch(() => {});
      }

      if (session.refreshToken) {
        const already = await isBiometricEnabled();
        if (!already) {
          const { isBiometricAvailable } = await import('../lib/biometrics');
          if (await isBiometricAvailable()) {
            Alert.alert(
              'Enable Biometric Login',
              'Use Face ID or fingerprint for faster sign-in next time?',
              [
                { text: 'Not now', style: 'cancel' },
                { text: 'Enable', onPress: () => enableBiometric(session.refreshToken!) },
              ],
            );
          }
        }
      }

      const dest: Record<string, keyof RootStackParamList> = {
        ADMIN:   'AdminOverview',
        MANAGER: 'ManagerOverview',
        STAFF:   'ManagerBookings',
      };
      navigation.reset({
        index: 0,
        routes: [{ name: (dest[session.user.role] ?? 'MainTabs') as any }],
      });
    } catch (err) {
      hapticError();
      const errorClass = classifyAndAnnounce(err);
      Alert.alert('Google sign-in failed', errorClass.title);
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    clearErrors();
    try {
      if (mode === 'login') {
        loginSchema.parse({ email: email.trim(), password });
      } else {
        registerSchema.parse({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          confirmPassword,
        });
        if (!termsAccepted) {
          setFieldErrors({ terms: 'Please accept the Terms of Service to continue.' });
          return false;
        }
      }
      return true;
    } catch (err: any) {
      const errs: Record<string, string> = {};
      err.errors?.forEach((e: any) => {
        const field = e.path?.[0] ?? 'root';
        errs[field] = e.message;
      });
      setFieldErrors(errs);
      return false;
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === 'register') {
        await request<{ message: string }>('/auth/register', {
          method: 'POST',
          body: { fullName: fullName.trim(), email: email.trim(), phone: phone.trim() || undefined, password },
        });
        hapticSuccess();
        Alert.alert(
          'Verify your email',
          `We sent a verification link to ${email.trim()}. Please check your inbox and verify your email before signing in.`,
          [{ text: 'OK', onPress: () => switchMode('login') }],
        );
        return;
      }

      const session = await request<Session>('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });
      await saveSessionToStorage(session);
      dispatch(setSession(session));
      hapticSuccess();

      const pushToken = await getExpoPushToken();
      if (pushToken) {
        registerPushToken(pushToken, session.accessToken).catch(() => {});
      }

      if (session.refreshToken) {
        const already = await isBiometricEnabled();
        if (!already) {
          const { isBiometricAvailable } = await import('../lib/biometrics');
          if (await isBiometricAvailable()) {
            Alert.alert(
              'Enable Biometric Login',
              'Use Face ID or fingerprint for faster sign-in next time?',
              [
                { text: 'Not now', style: 'cancel' },
                { text: 'Enable', onPress: () => enableBiometric(session.refreshToken!) },
              ],
            );
          }
        }
      }

      const dest: Record<string, keyof RootStackParamList> = {
        ADMIN:   'AdminOverview',
        MANAGER: 'ManagerOverview',
        STAFF:   'ManagerBookings',
      };
      navigation.reset({
        index: 0,
        routes: [{ name: (dest[session.user.role] ?? 'MainTabs') as any }],
      });
    } catch (err) {
      hapticError();
      const errCls = classifyAndAnnounce(err);
      Alert.alert(mode === 'login' ? 'Sign in failed' : 'Registration failed', errCls.title);
    } finally {
      setBusy(false);
    }
  };

  // ── Password strength indicator ────────────────────────────────────────────
  const strengthChecks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
  ];
  const strengthPassed = strengthChecks.filter(Boolean).length;
  const strengthLabel  = strengthPassed <= 1 ? 'Weak' : strengthPassed <= 3 ? 'Fair' : 'Strong';
  const strengthColor  = strengthPassed <= 1 ? c.danger : strengthPassed <= 3 ? c.warning : c.success;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Back button ───────────────────────────────────────────────── */}
        <Pressable
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('MainTabs' as any)}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={c.ink} />
        </Pressable>

        {/* ── Logo + heading ────────────────────────────────────────────── */}
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <Ionicons name="bed" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.logoWord}>LuxSty</Text>
        </View>

        <Text style={styles.heading}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </Text>
        <Text style={styles.subheading}>
          {mode === 'login'
            ? 'Sign in to manage your stays'
            : 'Join thousands of travellers on LuxSty'}
        </Text>

        {/* ── Mode toggle pills ─────────────────────────────────────────── */}
        <View style={styles.modePills}>
          {(['login', 'register'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              onPress={() => switchMode(m)}
              style={[styles.modePill, mode === m && styles.modePillActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
            >
              <Text style={[styles.modePillText, mode === m && styles.modePillTextActive]}>
                {m === 'login' ? 'Sign in' : 'Register'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Form ─────────────────────────────────────────────────────── */}
        <View style={styles.form}>

          {/* Register-only: full name */}
          {mode === 'register' && (
            <InputField
              label="Full name"
              value={fullName}
              onChangeText={(v) => { setFullName(v); clearErrors(); }}
              onBlur={() => validateField('fullName')}
              placeholder="e.g. Selam Tesfaye"
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              error={fieldErrors.fullName}
              autoFocus
              c={c}
            />
          )}

          {/* Email */}
          <InputField
            label="Email address"
            value={email}
            onChangeText={(v) => { setEmail(v); clearErrors(); }}
            onBlur={() => validateField('email')}
            placeholder="you@example.com"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => mode === 'register' ? phoneRef.current?.focus() : passRef.current?.focus()}
            inputRef={emailRef}
            error={fieldErrors.email}
            autoFocus={mode === 'login'}
            c={c}
          />

          {/* Register-only: phone */}
          {mode === 'register' && (
            <InputField
              label="Phone number (optional)"
              value={phone}
              onChangeText={setPhone}
              onBlur={() => validateField('phone')}
              placeholder="+251 9XX XXX XXX"
              keyboardType="phone-pad"
              returnKeyType="next"
              onSubmitEditing={() => passRef.current?.focus()}
              inputRef={phoneRef}
              c={c}
            />
          )}

          {/* Password */}
          <InputField
            label="Password"
            value={password}
            onChangeText={(v) => { setPassword(v); clearErrors(); }}
            onBlur={() => validateField('password')}
            placeholder="8+ characters"
            secureTextEntry={!showPassword}
            returnKeyType={mode === 'register' ? 'next' : 'done'}
            onSubmitEditing={() => mode === 'register' ? confRef.current?.focus() : void submit()}
            inputRef={passRef}
            error={fieldErrors.password}
            c={c}
            rightElement={
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8} style={staticStyles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={c.inkMuted}
                />
              </Pressable>
            }
          />

          {/* Forgot password link (login only) */}
          {mode === 'login' && (
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              style={staticStyles.forgotRow}
              accessibilityRole="link"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>
          )}

          {/* Password strength bar (register only) */}
          {mode === 'register' && password.length > 0 && (
            <View style={staticStyles.strengthWrap}>
              <View style={staticStyles.strengthBars}>
                {strengthChecks.map((ok, i) => (
                  <View
                    key={i}
                    style={[staticStyles.strengthBar, { backgroundColor: ok ? strengthColor : c.line }]}
                  />
                ))}
              </View>
              <Text style={[staticStyles.strengthLabel, { color: strengthColor }]}>{strengthLabel}</Text>
            </View>
          )}

          {/* Register-only: confirm password */}
          {mode === 'register' && (
            <InputField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); clearErrors(); }}
              onBlur={() => validateField('confirmPassword')}
              placeholder="Re-enter password"
              secureTextEntry={!showConfirm}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              inputRef={confRef}
              error={fieldErrors.confirmPassword}
              c={c}
              rightElement={
                <Pressable onPress={() => setShowConfirm(!showConfirm)} hitSlop={8} style={staticStyles.eyeBtn}>
                  <Ionicons
                    name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={c.inkMuted}
                  />
                </Pressable>
              }
            />
          )}

          {/* Register-only: terms checkbox */}
          {mode === 'register' && (
            <Pressable
              onPress={() => { setTermsAccepted(!termsAccepted); clearErrors(); }}
              style={staticStyles.termsRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: termsAccepted }}
            >
              <View style={[staticStyles.checkbox, { borderColor: c.lineStrong }, termsAccepted && styles.checkboxChecked]}>
                {termsAccepted && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>Terms of Service</Text>
                {' '}and{' '}
                <Text style={styles.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)}>Privacy Policy</Text>
              </Text>
            </Pressable>
          )}
          {fieldErrors.terms && <FieldError message={fieldErrors.terms} />}

          {/* ── Primary CTA ─────────────────────────────────────────────── */}
          <Pressable
            onPress={() => void submit()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={mode === 'login' ? 'Sign in' : 'Create account'}
            accessibilityState={{ busy }}
            style={({ pressed }) => [
              styles.cta,
              busy   && styles.ctaBusy,
              pressed && styles.ctaPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={staticStyles.ctaInner}>
                <Text style={styles.ctaText}>
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            )}
          </Pressable>

          {/* ── Divider ──────────────────────────────────────────────────── */}
          <View style={staticStyles.dividerRow}>
            <View style={[staticStyles.dividerLine, { backgroundColor: c.line }]} />
            <Text style={styles.dividerText}>or</Text>
            <View style={[staticStyles.dividerLine, { backgroundColor: c.line }]} />
          </View>

          {/* ── Google Sign-In ───────────────────────────────────────────── */}
          <Pressable
            onPress={() => void handleGoogleSignIn()}
            disabled={googleLoading || busy}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ busy: googleLoading }}
            style={({ pressed }) => [
              styles.googleBtn,
              (googleLoading || busy) && styles.googleBtnBusy,
              pressed && styles.googleBtnPressed,
            ]}
          >
            {googleLoading ? (
              <ActivityIndicator color={c.ink} size="small" />
            ) : (
              <View style={staticStyles.googleBtnInner}>
                <Ionicons name="logo-google" size={20} color="#DB4437" />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </View>
            )}
          </Pressable>

        </View>

        {/* ── Switch mode ────────────────────────────────────────────────── */}
        <Pressable
          onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
          style={staticStyles.switchRow}
          accessibilityRole="button"
        >
          <Text style={styles.switchText}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.switchLink}>
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </Text>
          </Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
