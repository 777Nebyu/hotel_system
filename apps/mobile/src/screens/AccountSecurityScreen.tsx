/**
 * AccountSecurityScreen — Premium Luxury Hospitality Profile Security Screen
 *
 * Style: Marriott Bonvoy / Airbnb Luxe quality
 * - Elegant deep navy, gold & teal palette with dark/light mode support
 * - Soft rounded cards (r: 20-22px) with subtle layered shadows
 * - iOS & Android safe-area insets (no notch or home-bar clipping)
 * - 48px minimum touch targets for one-hand operation
 * - Responsive 320px–430px layout
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { signOut as signOutAction, saveSessionToStorage } from '../store/authSlice';
import { request } from '../api';
import { getStoredPushToken, deregisterPushToken } from '../lib/notifications';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../hooks/useHaptics';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { useTheme } from '../hooks/useTheme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type TabOption = 'profile' | 'security';

export default function AccountSecurityScreen() {
  const insets = useSafeAreaInsets();
  const pad = useResponsivePadding();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.auth.session);
  const { colorScheme } = useTheme();
  const dark = colorScheme === 'dark';

  // ─── Theme Colors ────────────────────────────────────────────────────────
  const c = useMemo(() => ({
    bg:           dark ? '#090F19' : '#F5F7FA',
    cardBg:       dark ? '#111B2B' : '#FFFFFF',
    cardSubtle:   dark ? '#162338' : '#F8FAFC',
    cardBorder:   dark ? '#1F314C' : '#E2E8F0',
    line:         dark ? '#1F314C' : '#E8EEF5',
    textPri:      dark ? '#F8FAFC' : '#0F172A',
    textSec:      dark ? '#94A7BF' : '#64748B',
    textMuted:    dark ? '#5F738E' : '#94A3B8',
    gold:         '#D4AF37',
    goldLight:    dark ? '#422006' : '#FEF9E7',
    goldBorder:   dark ? '#4D360E' : '#E8D5A7',
    teal:         '#0F2942',
    tealLight:    dark ? '#0B2926' : '#E6F4F2',
    red:          '#EF4444',
    redLight:     dark ? '#2B1214' : '#FEF2F2',
    redBorder:    dark ? '#501D21' : '#FEE2E2',
    navBg:        dark ? '#101C2E' : '#FFFFFF',
    navBorder:    dark ? '#1C2E46' : '#E5E9F0',
  }), [dark]);

  // ─── State ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabOption>('security');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [twoFactor, setTwoFactor] = useState(true);
  const [loginNotifs, setLoginNotifs] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  // ─── User Meta ───────────────────────────────────────────────────────────
  const role = session?.user.role;
  const membershipTitle = useMemo(() => {
    if (role === 'ADMIN') return 'Executive Admin';
    if (role === 'MANAGER') return 'Hotel Director';
    if (role === 'STAFF') return 'Hospitality Staff';
    return 'Platinum Elite';
  }, [role]);

  const initials = useMemo(() => {
    const name = session?.user.fullName ?? 'Guest User';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'GU';
  }, [session?.user.fullName]);

  // Password requirement indicators
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleUpdatePassword = async () => {
    hapticMedium();
    const errs: Record<string, string | undefined> = {};

    if (!currentPassword) {
      errs.currentPassword = 'Enter your current password.';
    }
    if (!newPassword) {
      errs.newPassword = 'Enter your new password.';
    } else if (!hasMinLength) {
      errs.newPassword = 'Password must be at least 8 characters.';
    } else if (!hasUppercase) {
      errs.newPassword = 'Must include at least one uppercase letter.';
    } else if (!hasNumber) {
      errs.newPassword = 'Must include at least one number.';
    }

    if (newPassword && !confirmPassword) {
      errs.confirmPassword = 'Confirm your new password.';
    } else if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errs).length > 0) {
      hapticError();
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setLoading(true);

    try {
      await request('/auth/me', {
        method: 'PATCH',
        body: { currentPassword, newPassword },
        token: session?.accessToken,
      });
      hapticSuccess();
      Alert.alert('Success', 'Your password has been updated securely.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      hapticError();
      Alert.alert('Security Notice', err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    hapticMedium();
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out from your luxury profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              const pushToken = await getStoredPushToken();
              if (pushToken) await deregisterPushToken(pushToken);
              await request('/auth/logout', {
                method: 'POST',
                token: session?.accessToken,
              }).catch(() => {});
            } catch {
              // Ignore logout network error to allow local signout
            }
            await saveSessionToStorage(null);
            dispatch(signOutAction());
            navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
          },
        },
      ],
    );
  };

  const goToBottomTab = (target: 'Home' | 'Explore' | 'Trips' | 'Saved' | 'Profile') => {
    hapticLight();
    switch (target) {
      case 'Home':
        navigation.navigate('MainTabs' as any, { screen: 'HomeTab' });
        break;
      case 'Explore':
        navigation.navigate('Search');
        break;
      case 'Trips':
        navigation.navigate('MainTabs' as any, { screen: 'BookingsTab' });
        break;
      case 'Saved':
        navigation.navigate('MainTabs' as any, { screen: 'FavoritesTab' });
        break;
      case 'Profile':
        navigation.navigate('MainTabs' as any, { screen: 'ProfileTab' });
        break;
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: pad,
            paddingTop: Math.max(insets.top, 16) + 4,
            paddingBottom: Math.max(insets.bottom, 12) + 96,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Top Bar with Back Button ─── */}
        <View style={styles.topNavRow}>
          <Pressable
            onPress={() => {
              hapticLight();
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('MainTabs');
            }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: c.cardBg, borderColor: c.cardBorder },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="chevron-back" size={20} color={c.textPri} />
          </Pressable>

          <Text style={[styles.screenHeading, { color: c.textPri }]}>
            Account Security
          </Text>

          <View style={styles.topNavSpacer} />
        </View>

        {/* ─── Luxury Header Card ─── */}
        <View
          style={[
            styles.headerCard,
            {
              backgroundColor: c.cardBg,
              borderColor: c.cardBorder,
              shadowColor: dark ? '#000000' : '#1A2B4A',
            },
          ]}
        >
          <View style={styles.headerTop}>
            {/* Avatar with Gold Ring */}
            <View style={[styles.avatarRing, { borderColor: c.gold }]}>
              {session?.user.profilePhotoUrl ? (
                <Image
                  source={{ uri: session.user.profilePhotoUrl }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: dark ? '#1C2C42' : '#0F263F' }]}>
                  <Text style={[styles.avatarInitials, { color: c.gold }]}>{initials}</Text>
                </View>
              )}
              <View style={[styles.avatarVerifiedBadge, { backgroundColor: c.gold }]}>
                <Ionicons name="shield-checkmark" size={10} color="#0B1320" />
              </View>
            </View>

            {/* User Details */}
            <View style={styles.headerInfo}>
              <Text style={[styles.userName, { color: c.textPri }]} numberOfLines={1}>
                {session?.user.fullName ?? 'Guest Traveler'}
              </Text>
              <Text style={[styles.userEmail, { color: c.textSec }]} numberOfLines={1}>
                {session?.user.email ?? 'guest@hospitality.com'}
              </Text>

              {/* Membership Badge */}
              <View style={[styles.memberBadge, { backgroundColor: c.goldLight, borderColor: c.goldBorder }]}>
                <Ionicons name="star" size={11} color={c.gold} />
                <Text style={[styles.memberBadgeText, { color: c.gold }]}>
                  {membershipTitle}
                </Text>
              </View>
            </View>
          </View>

          {/* Edit Profile Action */}
          <View style={[styles.headerDivider, { backgroundColor: c.line }]} />

          <Pressable
            onPress={() => {
              hapticLight();
              navigation.navigate('MainTabs' as any, { screen: 'ProfileTab' });
            }}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            style={({ pressed }) => [
              styles.editProfileBtn,
              { backgroundColor: c.cardSubtle, borderColor: c.cardBorder },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="pencil-outline" size={15} color={c.teal} />
            <Text style={[styles.editProfileText, { color: c.teal }]}>
              Edit profile
            </Text>
            <Ionicons name="chevron-forward" size={14} color={c.textMuted} />
          </Pressable>
        </View>

        {/* ─── Segmented Tabs (Profile / Security) ─── */}
        <View style={[styles.segmentedTabs, { backgroundColor: c.cardBg, borderColor: c.cardBorder }]}>
          <Pressable
            onPress={() => {
              hapticLight();
              navigation.navigate('MainTabs' as any, { screen: 'ProfileTab' });
            }}
            accessibilityRole="tab"
            accessibilityLabel="Profile tab"
            accessibilityState={{ selected: activeTab === 'profile' }}
            style={[styles.tabButton, activeTab === 'profile' && { backgroundColor: c.teal }]}
          >
            <Ionicons
              name={activeTab === 'profile' ? 'person' : 'person-outline'}
              size={15}
              color={activeTab === 'profile' ? '#FFFFFF' : c.textSec}
            />
            <Text
              style={[
                styles.tabButtonText,
                { color: activeTab === 'profile' ? '#FFFFFF' : c.textSec },
              ]}
            >
              Profile
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              hapticLight();
              setActiveTab('security');
            }}
            accessibilityRole="tab"
            accessibilityLabel="Security tab active"
            accessibilityState={{ selected: activeTab === 'security' }}
            style={[styles.tabButton, activeTab === 'security' && { backgroundColor: c.teal }]}
          >
            <Ionicons
              name={activeTab === 'security' ? 'shield-checkmark' : 'shield-outline'}
              size={15}
              color={activeTab === 'security' ? '#FFFFFF' : c.textSec}
            />
            <Text
              style={[
                styles.tabButtonText,
                { color: activeTab === 'security' ? '#FFFFFF' : c.textSec },
              ]}
            >
              Security
            </Text>
          </Pressable>
        </View>

        {/* ─── Security Card: Password Management ─── */}
        <View style={[styles.sectionCard, { backgroundColor: c.cardBg, borderColor: c.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIcon, { backgroundColor: c.tealLight }]}>
              <Ionicons name="lock-closed" size={18} color={c.teal} />
            </View>
            <View style={styles.cardHeaderMeta}>
              <Text style={[styles.cardTitle, { color: c.textPri }]}>Account Security</Text>
              <Text style={[styles.cardSubtitle, { color: c.textSec }]}>
                Update credentials & protect sign-in access
              </Text>
            </View>
          </View>

          {/* Current Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: c.textSec }]}>Current password</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: c.cardSubtle,
                  borderColor: fieldErrors.currentPassword ? c.red : c.cardBorder,
                },
              ]}
            >
              <Ionicons name="key-outline" size={18} color={c.textMuted} style={styles.inputIconLeft} />
              <TextInput
                value={currentPassword}
                onChangeText={(v) => {
                  setCurrentPassword(v);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors((p) => ({ ...p, currentPassword: undefined }));
                  }
                }}
                style={[styles.textInput, { color: c.textPri }]}
                placeholder="••••••••"
                placeholderTextColor={c.textMuted}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowCurrent(!showCurrent)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={showCurrent ? 'Hide password' : 'Show password'}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color={c.textMuted}
                />
              </Pressable>
            </View>
            {fieldErrors.currentPassword && (
              <Text style={[styles.fieldError, { color: c.red }]}>
                {fieldErrors.currentPassword}
              </Text>
            )}
          </View>

          {/* New Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: c.textSec }]}>New password</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: c.cardSubtle,
                  borderColor: fieldErrors.newPassword ? c.red : c.cardBorder,
                },
              ]}
            >
              <Ionicons name="shield-outline" size={18} color={c.textMuted} style={styles.inputIconLeft} />
              <TextInput
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v);
                  if (fieldErrors.newPassword) {
                    setFieldErrors((p) => ({ ...p, newPassword: undefined }));
                  }
                }}
                style={[styles.textInput, { color: c.textPri }]}
                placeholder="Minimum 8 characters"
                placeholderTextColor={c.textMuted}
                secureTextEntry={!showNew}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowNew(!showNew)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={showNew ? 'Hide password' : 'Show password'}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showNew ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color={c.textMuted}
                />
              </Pressable>
            </View>
            {fieldErrors.newPassword && (
              <Text style={[styles.fieldError, { color: c.red }]}>
                {fieldErrors.newPassword}
              </Text>
            )}

            {/* Password Criteria Pills */}
            <View style={styles.criteriaRow}>
              <View style={[styles.criteriaPill, hasMinLength && styles.criteriaPillActive]}>
                <Ionicons
                  name={hasMinLength ? 'checkmark-circle' : 'ellipse-outline'}
                  size={12}
                  color={hasMinLength ? c.teal : c.textMuted}
                />
                <Text style={[styles.criteriaText, { color: hasMinLength ? c.teal : c.textMuted }]}>
                  8+ chars
                </Text>
              </View>

              <View style={[styles.criteriaPill, hasUppercase && styles.criteriaPillActive]}>
                <Ionicons
                  name={hasUppercase ? 'checkmark-circle' : 'ellipse-outline'}
                  size={12}
                  color={hasUppercase ? c.teal : c.textMuted}
                />
                <Text style={[styles.criteriaText, { color: hasUppercase ? c.teal : c.textMuted }]}>
                  1 uppercase
                </Text>
              </View>

              <View style={[styles.criteriaPill, hasNumber && styles.criteriaPillActive]}>
                <Ionicons
                  name={hasNumber ? 'checkmark-circle' : 'ellipse-outline'}
                  size={12}
                  color={hasNumber ? c.teal : c.textMuted}
                />
                <Text style={[styles.criteriaText, { color: hasNumber ? c.teal : c.textMuted }]}>
                  1 number
                </Text>
              </View>
            </View>
          </View>

          {/* Confirm Password Field */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: c.textSec }]}>Confirm new password</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: c.cardSubtle,
                  borderColor: fieldErrors.confirmPassword ? c.red : c.cardBorder,
                },
              ]}
            >
              <Ionicons name="checkmark-done-outline" size={18} color={c.textMuted} style={styles.inputIconLeft} />
              <TextInput
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  if (fieldErrors.confirmPassword) {
                    setFieldErrors((p) => ({ ...p, confirmPassword: undefined }));
                  }
                }}
                style={[styles.textInput, { color: c.textPri }]}
                placeholder="Re-enter new password"
                placeholderTextColor={c.textMuted}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowConfirm(!showConfirm)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={showConfirm ? 'Hide password' : 'Show password'}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={19}
                  color={c.textMuted}
                />
              </Pressable>
            </View>
            {fieldErrors.confirmPassword && (
              <Text style={[styles.fieldError, { color: c.red }]}>
                {fieldErrors.confirmPassword}
              </Text>
            )}
          </View>

          {/* Update Password Button */}
          <Pressable
            onPress={handleUpdatePassword}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Update password"
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: c.teal },
              pressed && { opacity: 0.85 },
              loading && { opacity: 0.7 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="shield-checkmark" size={17} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Update password</Text>
              </>
            )}
          </Pressable>

          {/* Divider */}
          <View style={[styles.innerDivider, { backgroundColor: c.line }]} />

          {/* Two-Factor Authentication */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleMeta}>
              <View style={styles.toggleHeader}>
                <Text style={[styles.toggleTitle, { color: c.textPri }]}>
                  Two-factor authentication
                </Text>
                <View style={[styles.recBadge, { backgroundColor: c.goldLight, borderColor: c.goldBorder }]}>
                  <Text style={[styles.recBadgeText, { color: c.gold }]}>RECOMMENDED</Text>
                </View>
              </View>
              <Text style={[styles.toggleDesc, { color: c.textSec }]}>
                Require an SMS code or authenticator app token on new logins
              </Text>
            </View>
            <Switch
              value={twoFactor}
              onValueChange={(val) => {
                hapticLight();
                setTwoFactor(val);
              }}
              trackColor={{ true: c.teal, false: dark ? '#2B394E' : '#CBD5E1' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Divider */}
          <View style={[styles.innerDivider, { backgroundColor: c.line }]} />

          {/* Login Notifications */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleMeta}>
              <Text style={[styles.toggleTitle, { color: c.textPri }]}>
                Login notifications
              </Text>
              <Text style={[styles.toggleDesc, { color: c.textSec }]}>
                Receive immediate email and push alerts for unknown device sign-ins
              </Text>
            </View>
            <Switch
              value={loginNotifs}
              onValueChange={(val) => {
                hapticLight();
                setLoginNotifs(val);
              }}
              trackColor={{ true: c.teal, false: dark ? '#2B394E' : '#CBD5E1' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ─── Payment Section ─── */}
        <View style={[styles.sectionCard, { backgroundColor: c.cardBg, borderColor: c.cardBorder }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardHeaderIcon, { backgroundColor: c.goldLight }]}>
              <Ionicons name="card" size={18} color={c.gold} />
            </View>
            <View style={styles.cardHeaderMeta}>
              <Text style={[styles.cardTitle, { color: c.textPri }]}>Payment Methods</Text>
              <Text style={[styles.cardSubtitle, { color: c.textSec }]}>
                Cards & digital wallets on file
              </Text>
            </View>
            <View style={[styles.encryptedBadge, { backgroundColor: c.cardSubtle, borderColor: c.cardBorder }]}>
              <Ionicons name="lock-closed" size={11} color={c.teal} />
              <Text style={[styles.encryptedText, { color: c.teal }]}>256-bit</Text>
            </View>
          </View>

          {/* Card 1: Visa ****4832 */}
          <View
            style={[
              styles.paymentCard,
              {
                backgroundColor: dark ? '#16243A' : '#0F263F',
                borderColor: dark ? '#253B5D' : '#183B61',
              },
            ]}
          >
            <View style={styles.paymentCardTop}>
              {/* Chip Graphic */}
              <View style={styles.chipGraphic}>
                <View style={styles.chipLines} />
              </View>

              <View style={styles.paymentCardTopRight}>
                <View style={[styles.defaultBadge, { backgroundColor: c.gold }]}>
                  <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                </View>
                <Text style={styles.visaBrand}>VISA</Text>
              </View>
            </View>

            <Text style={styles.cardNumber}>••••  ••••  ••••  4832</Text>

            <View style={styles.paymentCardBottom}>
              <View>
                <Text style={styles.cardMetaLabel}>CARDHOLDER</Text>
                <Text style={styles.cardMetaValue}>
                  {session?.user.fullName ? session.user.fullName.toUpperCase() : 'VALUED GUEST'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardMetaLabel}>EXPIRES</Text>
                <Text style={styles.cardMetaValue}>09/28</Text>
              </View>
            </View>
          </View>

          {/* Card 2: Telebirr */}
          <View
            style={[
              styles.walletCard,
              {
                backgroundColor: dark ? '#0E232B' : '#F0F9FF',
                borderColor: dark ? '#1B4755' : '#BAE6FD',
              },
            ]}
          >
            <View style={styles.walletIconWrap}>
              <Ionicons name="phone-portrait-outline" size={20} color="#0284C7" />
            </View>
            <View style={styles.walletMeta}>
              <View style={styles.walletTitleRow}>
                <Text style={[styles.walletTitle, { color: dark ? '#E0F2FE' : '#0369A1' }]}>
                  Telebirr
                </Text>
                <View style={[styles.activeBadge, { backgroundColor: dark ? '#064E3B' : '#D1FAE5' }]}>
                  <Text style={[styles.activeBadgeText, { color: dark ? '#6EE7B7' : '#065F46' }]}>
                    ACTIVE
                  </Text>
                </View>
              </View>
              <Text style={[styles.walletSub, { color: dark ? '#93C5FD' : '#0284C7' }]}>
                +251 91 ••• •234 • Instant mobile pay
              </Text>
            </View>
            <Ionicons name="checkmark-circle" size={18} color="#0284C7" />
          </View>

          {/* Add Payment Method Button */}
          <Pressable
            onPress={() => {
              hapticLight();
              Alert.alert('Payment Gateway', 'Secure card and local gateway integration ready.');
            }}
            accessibilityRole="button"
            accessibilityLabel="Add payment method"
            style={({ pressed }) => [
              styles.addPaymentCard,
              { backgroundColor: c.cardSubtle, borderColor: c.cardBorder },
              pressed && { opacity: 0.75 },
            ]}
          >
            <View style={[styles.addIconCircle, { backgroundColor: c.tealLight }]}>
              <Ionicons name="add" size={18} color={c.teal} />
            </View>
            <View style={styles.addPaymentMeta}>
              <Text style={[styles.addPaymentTitle, { color: c.textPri }]}>
                Add payment method
              </Text>
              <Text style={[styles.addPaymentSubtitle, { color: c.textSec }]}>
                Credit card, debit card, or local mobile wallet
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
          </Pressable>
        </View>

        {/* ─── Danger Zone: Sign Out ─── */}
        <View
          style={[
            styles.dangerCard,
            {
              backgroundColor: c.redLight,
              borderColor: c.redBorder,
            },
          ]}
        >
          <View style={styles.dangerHeader}>
            <Ionicons name="alert-circle-outline" size={18} color={c.red} />
            <Text style={[styles.dangerTitle, { color: c.red }]}>Danger Zone</Text>
          </View>
          <Text style={[styles.dangerText, { color: dark ? '#FCA5A5' : '#991B1B' }]}>
            Signing out will disconnect your active session and push alerts on this device.
          </Text>

          <Pressable
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOutBtn,
              { backgroundColor: dark ? '#3D1518' : '#FFFFFF', borderColor: c.red },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="log-out-outline" size={17} color={c.red} />
            <Text style={[styles.signOutText, { color: c.red }]}>Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ─── Bottom Navigation: Home · Explore · Trips · Saved · Profile ─── */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: c.navBg,
            borderTopColor: c.navBorder,
            paddingBottom: Math.max(insets.bottom, 10),
            paddingLeft: Math.max(insets.left, 8),
            paddingRight: Math.max(insets.right, 8),
          },
        ]}
      >
        {/* Home */}
        <Pressable
          onPress={() => goToBottomTab('Home')}
          accessibilityRole="tab"
          accessibilityLabel="Home tab"
          style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="home-outline" size={22} color={c.textSec} />
          <Text style={[styles.navLabel, { color: c.textSec }, compact && styles.navLabelCompact]}>
            Home
          </Text>
        </Pressable>

        {/* Explore */}
        <Pressable
          onPress={() => goToBottomTab('Explore')}
          accessibilityRole="tab"
          accessibilityLabel="Explore hotels tab"
          style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="compass-outline" size={22} color={c.textSec} />
          <Text style={[styles.navLabel, { color: c.textSec }, compact && styles.navLabelCompact]}>
            Explore
          </Text>
        </Pressable>

        {/* Trips */}
        <Pressable
          onPress={() => goToBottomTab('Trips')}
          accessibilityRole="tab"
          accessibilityLabel="Trips tab"
          style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="calendar-outline" size={22} color={c.textSec} />
          <Text style={[styles.navLabel, { color: c.textSec }, compact && styles.navLabelCompact]}>
            Trips
          </Text>
        </Pressable>

        {/* Saved */}
        <Pressable
          onPress={() => goToBottomTab('Saved')}
          accessibilityRole="tab"
          accessibilityLabel="Saved hotels tab"
          style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="heart-outline" size={22} color={c.textSec} />
          <Text style={[styles.navLabel, { color: c.textSec }, compact && styles.navLabelCompact]}>
            Saved
          </Text>
        </Pressable>

        {/* Profile (Active) */}
        <Pressable
          onPress={() => goToBottomTab('Profile')}
          accessibilityRole="tab"
          accessibilityLabel="Profile tab, active"
          accessibilityState={{ selected: true }}
          style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.6 }]}
        >
          {/* Active Pip Indicator */}
          <View style={[styles.activePip, { backgroundColor: c.teal }]} />
          <Ionicons name="person-circle" size={23} color={c.teal} />
          <Text
            style={[
              styles.navLabel,
              styles.navLabelActive,
              { color: c.teal },
              compact && styles.navLabelCompact,
            ]}
          >
            Profile
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    gap: 16,
  },

  /* ─── Top Bar ─── */
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  screenHeading: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  topNavSpacer: {
    width: 44,
  },

  /* ─── Header Card ─── */
  headerCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    elevation: 4,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    padding: 2,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  avatarVerifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 12,
    marginTop: 2,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  memberBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  headerDivider: {
    height: 1,
    marginVertical: 12,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  editProfileText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '700',
  },

  /* ─── Segmented Tabs ─── */
  segmentedTabs: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* ─── Section Card ─── */
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderMeta: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  encryptedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  encryptedText: {
    fontSize: 10,
    fontWeight: '700',
  },

  /* ─── Form Inputs ─── */
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  inputIconLeft: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  fieldError: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 2,
  },
  criteriaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  criteriaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  criteriaPillActive: {
    backgroundColor: '#E6F4F2',
  },
  criteriaText: {
    fontSize: 10,
    fontWeight: '600',
  },

  /* ─── Primary Button ─── */
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  /* ─── Toggles ─── */
  innerDivider: {
    height: 1,
    marginVertical: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleMeta: {
    flex: 1,
    marginRight: 12,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  recBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  recBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* ─── Payment Cards ─── */
  paymentCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
  },
  paymentCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipGraphic: {
    width: 32,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#E5B869',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chipLines: {
    height: 2,
    backgroundColor: '#9E742D',
  },
  paymentCardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: {
    color: '#0D1B2A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  visaBrand: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    fontStyle: 'italic',
  },
  cardNumber: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 2,
    marginVertical: 18,
  },
  paymentCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMetaLabel: {
    color: '#94A7BF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardMetaValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },

  /* ─── Digital Wallet Card ─── */
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  walletIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletMeta: {
    flex: 1,
    marginLeft: 12,
  },
  walletTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  walletTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  activeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  walletSub: {
    fontSize: 11,
    marginTop: 2,
  },

  /* ─── Add Payment Card ─── */
  addPaymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 12,
  },
  addIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPaymentMeta: {
    flex: 1,
    marginLeft: 12,
  },
  addPaymentTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  addPaymentSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },

  /* ─── Danger Zone ─── */
  dangerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  dangerText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '800',
  },

  /* ─── Bottom Navigation ─── */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 12,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    position: 'relative',
    gap: 2,
  },
  activePip: {
    position: 'absolute',
    top: -2,
    width: 22,
    height: 3,
    borderRadius: 2,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  navLabelActive: {
    fontWeight: '700',
  },
  navLabelCompact: {
    fontSize: 9,
  },
});
