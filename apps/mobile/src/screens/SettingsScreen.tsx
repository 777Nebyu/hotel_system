import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { signOut as signOutAction, saveSessionToStorage } from '../store/authSlice';
import { request } from '../api';
import { getStoredPushToken, deregisterPushToken } from '../lib/notifications';
import { useTheme, type ColorScheme } from '../hooks/useTheme';
import { useBiometricAuth } from '../hooks/useBiometricAuth';
import { clearOfflineCache } from '../store/offlineCache';
import { Card } from '../components/Shared';
import { font, radius } from '../theme';
import { hapticSelection, hapticSuccess } from '../hooks/useHaptics';
import { setAppLanguage } from '../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.auth.session);
  const { preference, setPreference, colors: themeColors } = useTheme();
  const { isAvailable, isEnabled, enable, disable } = useBiometricAuth();

  const [currentLang, setCurrentLang] = useState(i18n.language.startsWith('am') ? 'am' : 'en');
  const [biometricsLoading, setBiometricsLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleLanguageChange = async (lang: 'en' | 'am') => {
    hapticSelection();
    setCurrentLang(lang);
    await setAppLanguage(lang);
  };

  const handleThemeChange = (pref: ColorScheme) => {
    hapticSelection();
    setPreference(pref);
  };

  const toggleBiometrics = async (val: boolean) => {
    setBiometricsLoading(true);
    if (val) {
      const ok = await enable();
      if (!ok) {
        Alert.alert(t('errors.biometrics_error'), t('errors.biometrics_msg'));
      } else {
        hapticSuccess();
      }
    } else {
      await disable();
      hapticSuccess();
    }
    setBiometricsLoading(false);
  };

  const handleClearCache = async () => {
    Alert.alert(
      t('settings.clear_cache_title'),
      t('settings.clear_cache_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.clear'),
          style: 'destructive',
          onPress: async () => {
            await clearOfflineCache();
            hapticSuccess();
            Alert.alert(t('common.success'), t('settings.cache_cleared'));
          },
        },
      ],
    );
  };

  const handleSignOut = () => {
    Alert.alert(t('settings.sign_out_title'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.sign_out_title'),
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            const pushToken = await getStoredPushToken();
            if (pushToken) await deregisterPushToken(pushToken);
            await request('/auth/logout', { method: 'POST', token: session?.accessToken }).catch(() => {});
          } finally {
            await saveSessionToStorage(null);
            dispatch(signOutAction());
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.paper }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.go_back_nav')}>
          <Text style={[styles.backText, { color: themeColors.teal }]}>{'← '}{t('common.back')}</Text>
        </Pressable>
        <Text style={[styles.title, { color: themeColors.ink }]}>{t('settings.title', 'Settings')}</Text>
        <Text style={[styles.subtitle, { color: themeColors.inkMuted }]}>{t('settings.subtitle')}</Text>
      </View>

      {/* Appearance Section */}
      <Card style={[styles.sectionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.line }]}>
        <Text style={[styles.sectionHeader, { color: themeColors.ink }]}>{t('settings.appearance')}</Text>
        <View style={styles.themeRow}>
          {(['system', 'light', 'dark'] as ColorScheme[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => handleThemeChange(mode)}
              style={[
                styles.themeBtn,
                { borderColor: themeColors.lineStrong },
                preference === mode && { backgroundColor: themeColors.teal, borderColor: themeColors.teal },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: preference === mode }}
              accessibilityLabel={`${mode} theme`}
            >
              <Text
                style={[
                  styles.themeBtnText,
                  { color: themeColors.inkSoft },
                  preference === mode && { color: '#FFFFFF', fontWeight: '700' },
                ]}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Language Section */}
      <Card style={[styles.sectionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.line }]}>
        <Text style={[styles.sectionHeader, { color: themeColors.ink }]}>{t('settings.language')}</Text>
        <View style={styles.langRow}>
          <Pressable
            onPress={() => handleLanguageChange('en')}
            style={[
              styles.langBtn,
              { borderColor: themeColors.lineStrong },
              currentLang === 'en' && { backgroundColor: themeColors.teal, borderColor: themeColors.teal },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: currentLang === 'en' }}
            accessibilityLabel={t('settings.english')}
          >
            <Text style={[styles.langBtnText, { color: themeColors.inkSoft }, currentLang === 'en' && { color: '#FFFFFF', fontWeight: '700' }]}>
              English (US)
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleLanguageChange('am')}
            style={[
              styles.langBtn,
              { borderColor: themeColors.lineStrong },
              currentLang === 'am' && { backgroundColor: themeColors.teal, borderColor: themeColors.teal },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected: currentLang === 'am' }}
            accessibilityLabel={t('settings.amharic')}
          >
            <Text style={[styles.langBtnText, { color: themeColors.inkSoft }, currentLang === 'am' && { color: '#FFFFFF', fontWeight: '700' }]}>
              አማርኛ (Amharic)
            </Text>
          </Pressable>
        </View>
      </Card>

      {/* Security & Biometrics */}
      {isAvailable && (
        <Card style={[styles.sectionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.line }]}>
          <Text style={[styles.sectionHeader, { color: themeColors.ink }]}>{t('settings.security')}</Text>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: themeColors.ink }]}>{t('settings.biometric')}</Text>
              <Text style={[styles.settingSub, { color: themeColors.inkMuted }]}>{t('settings.biometric_sub')}</Text>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={toggleBiometrics}
              disabled={biometricsLoading}
              trackColor={{ false: themeColors.line, true: themeColors.teal }}
            />
          </View>
        </Card>
      )}

      {/* Payments & Billing */}
      <Card style={[styles.sectionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.line }]}>
        <Text style={[styles.sectionHeader, { color: themeColors.ink }]}>{t('settings.payments')}</Text>
        <Pressable
          onPress={() => navigation.navigate('PaymentHistory')}
          style={styles.actionRow}
          accessibilityRole="button"
          accessibilityLabel={t('settings.payment_history_a11y')}
        >
          <View>
            <Text style={[styles.settingLabel, { color: themeColors.ink }]}>{t('settings.payment_history')}</Text>
            <Text style={[styles.settingSub, { color: themeColors.inkMuted }]}>{t('settings.payment_history_sub')}</Text>
          </View>
          <Text style={[styles.chevron, { color: themeColors.inkMuted }]}>›</Text>
        </Pressable>
      </Card>

      {/* Storage & Data */}
      <Card style={[styles.sectionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.line }]}>
        <Text style={[styles.sectionHeader, { color: themeColors.ink }]}>{t('settings.storage')}</Text>
        <Pressable
          onPress={handleClearCache}
          style={styles.actionRow}
          accessibilityRole="button"
          accessibilityLabel={t('settings.clear_cache_a11y')}
        >
          <View>
            <Text style={[styles.settingLabel, { color: themeColors.brick }]}>{t('settings.clear_cache')}</Text>
            <Text style={[styles.settingSub, { color: themeColors.inkMuted }]}>{t('settings.clear_cache_sub')}</Text>
          </View>
          <Text style={[styles.chevron, { color: themeColors.inkMuted }]}>›</Text>
        </Pressable>
      </Card>

      {/* Support & About */}
      <Card style={[styles.sectionCard, { backgroundColor: themeColors.surface, borderColor: themeColors.line }]}>
        <Text style={[styles.sectionHeader, { color: themeColors.ink }]}>{t('settings.support')}</Text>
        <Pressable
          onPress={() => navigation.navigate('Help' as any)}
          style={styles.actionRow}
          accessibilityRole="button"
          accessibilityLabel={t('settings.help_a11y')}
        >
          <Text style={[styles.settingLabel, { color: themeColors.ink }]}>{t('settings.help')}</Text>
          <Text style={[styles.chevron, { color: themeColors.inkMuted }]}>›</Text>
        </Pressable>
        <View style={[styles.divider, { backgroundColor: themeColors.line }]} />
        <Pressable
          onPress={() => navigation.navigate('ContactNew' as any, {})}
          style={styles.actionRow}
          accessibilityRole="button"
          accessibilityLabel={t('settings.contact_a11y')}
        >
          <Text style={[styles.settingLabel, { color: themeColors.ink }]}>{t('settings.contact')}</Text>
          <Text style={[styles.chevron, { color: themeColors.inkMuted }]}>›</Text>
        </Pressable>
      </Card>

      {/* Sign Out */}
      <Pressable
        onPress={handleSignOut}
        disabled={signingOut}
        style={({ pressed }) => [styles.signOutBtn, { borderColor: themeColors.brick + '40' }, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.signOutText, { color: themeColors.brick }]}>{signingOut ? 'Signing out…' : t('settings.sign_out_title')}</Text>
      </Pressable>

      {/* App Version */}
      <View style={styles.footer}>
        <Text style={[styles.versionText, { color: themeColors.inkMuted }]}>{t('settings.version')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  header: { marginBottom: 8 },
  backText: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  title: { fontFamily: font.display, fontSize: 26, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  sectionCard: { padding: 16, borderRadius: radius.card, gap: 12 },
  sectionHeader: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  themeRow: { flexDirection: 'row', gap: 8 },
  themeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.card - 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtnText: { fontSize: 14, fontWeight: '500' },
  langRow: { flexDirection: 'row', gap: 8 },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.card - 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBtnText: { fontSize: 13, fontWeight: '500' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  settingSub: { fontSize: 12, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '300' },
  divider: { height: 1 },
  footer: { alignItems: 'center', marginTop: 16 },
  versionText: { fontSize: 12 },
  signOutBtn: {
    borderRadius: radius.card,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  signOutText: { fontSize: 15, fontWeight: '700' },
});
