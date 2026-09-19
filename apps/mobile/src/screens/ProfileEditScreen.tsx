import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { signOut as signOutAction, saveSessionToStorage, updateUser } from '../store/authSlice';
import { request, requestFormData } from '../api';
import { Button, Card } from '../components/Shared';
import { colors } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { updateProfileSchema } from '../lib/schemas';
import { getStoredPushToken, deregisterPushToken } from '../lib/notifications';
import { compressImage } from '../lib/compressImage';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { hapticLight, hapticMedium } from '../hooks/useHaptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const PREFS_KEY = 'luxsty.notification.prefs';

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const pad = useResponsivePadding();
  const { t: _t } = useTranslation(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.auth.session);
  const { colors: palette, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';

  const [fullName, setFullName] = useState(session?.user.fullName ?? '');
  const [email, setEmail] = useState(session?.user.email ?? '');
  const [phone, setPhone] = useState(session?.user.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [emailDeals, setEmailDeals] = useState(true);
  const [smsUpdates, setSmsUpdates] = useState(true);
  const [amharicEmails, setAmharicEmails] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const role = session?.user.role;
  const isStaffOrManager = role === 'MANAGER' || role === 'STAFF';
  const isAdmin = role === 'ADMIN';

  const initials = useMemo(
    () =>
      (session?.user.fullName ?? 'Guest')
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'GU',
    [session],
  );

  // Synchronize state when session changes or restores
  useEffect(() => {
    if (session?.user) {
      setFullName(session.user.fullName ?? '');
      setEmail(session.user.email ?? '');
      setPhone(session.user.phone ?? '');
    }
  }, [session?.user]);

  useEffect(() => {
    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(PREFS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.emailDeals !== undefined) setEmailDeals(parsed.emailDeals);
          if (parsed.smsUpdates !== undefined) setSmsUpdates(parsed.smsUpdates);
          if (parsed.amharicEmails !== undefined) setAmharicEmails(parsed.amharicEmails);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const savePrefs = async (deals: boolean, sms: boolean, amharic: boolean) => {
    try {
      await SecureStore.setItemAsync(
        PREFS_KEY,
        JSON.stringify({ emailDeals: deals, smsUpdates: sms, amharicEmails: amharic }),
      );
      if (session?.accessToken) {
        await request('/auth/me', {
          method: 'PATCH',
          body: { emailDeals: deals, smsUpdates: sms, amharicEmails: amharic },
          token: session.accessToken,
        });
      }
    } catch {
      /* ignore */
    }
  };

  const launchPicker = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please enable photo library access to change your avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    try {
      const compressedUri = await compressImage(asset.uri);
      const formData = new FormData();
      formData.append('photo', { uri: compressedUri, name: 'photo.jpg', type: 'image/jpeg' } as any);
      const res = await requestFormData<{ profilePhotoUrl: string }>('/auth/me/photo', formData, session?.accessToken);
      dispatch(updateUser({ profilePhotoUrl: res.profilePhotoUrl }));
      Alert.alert('Updated', 'Profile photo updated successfully.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload photo.');
    }
  };

  const pickImage = async () => {
    if (!session) {
      navigation.navigate('Auth', { initialMode: 'login' });
      return;
    }
    await launchPicker();
  };

  const validateField = (field: string) => {
    try {
      const baseShape = (updateProfileSchema as any)._def?.schema?.shape || (updateProfileSchema as any).innerType?.()?.shape;
      if (field === 'fullName') baseShape?.fullName?.parse(fullName.trim());
      if (field === 'phone' && phone.trim()) baseShape?.phone?.parse(phone.trim());
      setFieldErrors((p) => ({ ...p, [field]: undefined }));
    } catch (err: any) {
      setFieldErrors((p) => ({ ...p, [field]: err.errors?.[0]?.message }));
    }
  };

  const updateProfile = async () => {
    if (!session) {
      navigation.navigate('Auth', { initialMode: 'login' });
      return;
    }

    try {
      updateProfileSchema.parse({ fullName: fullName.trim(), phone: phone.trim() || undefined });
      setFieldErrors({});
    } catch (err: any) {
      const errors: Record<string, string | undefined> = {};
      err.errors?.forEach((e: any) => {
        errors[e.path?.[0]] = e.message;
      });
      setFieldErrors(errors);
      return Alert.alert('Validation error', err.errors?.[0]?.message ?? 'Full name is required.');
    }

    setLoading(true);
    try {
      await Promise.all([
        request('/auth/me', {
          method: 'PATCH',
          body: { fullName: fullName.trim(), phone: phone.trim() || undefined },
          token: session?.accessToken,
        }),
        savePrefs(emailDeals, smsUpdates, amharicEmails),
      ]);
      dispatch(updateUser({ fullName: fullName.trim(), phone: phone.trim() || undefined }));
      Alert.alert('Updated', 'Your profile details have been saved.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    hapticMedium();
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            const pushToken = await getStoredPushToken();
            if (pushToken) await deregisterPushToken(pushToken);
            await request('/auth/logout', { method: 'POST', token: session?.accessToken }).catch(() => {});
          } catch {
            /* ignore */
          }
          await saveSessionToStorage(null);
          dispatch(signOutAction());
        },
      },
    ]);
  };

  const navigate = (screen: string) => {
    hapticLight();
    // Tab routes live inside the tab navigator nested under the root stack.
    if (screen === 'BookingsTab' || screen === 'FavoritesTab' || screen === 'ProfileTab') {
      (navigation.getParent() as any)?.navigate('MainTabs', { screen });
      return;
    }
    // All other screens (AccountSecurity, MyReviews, Disputes, etc.) are root
    // stack screens. Since ProfileEditScreen lives inside the tab navigator,
    // we must navigate through the parent root stack.
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate(screen as any);
    } else {
      navigation.navigate(screen as any);
    }
  };

  return (
    <>
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
        backgroundColor={dark ? '#07111E' : '#F4F6FB'}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: dark ? '#07111E' : '#F4F6FB' }]}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: pad,
            paddingTop: Math.max(insets.top, 16) + 4,
          paddingBottom: Math.max(insets.bottom, 16) + 36,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      {/* ─── Header Card ─── */}
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: dark ? '#101C2D' : '#FFFFFF',
            borderColor: dark ? '#1E2F46' : '#E2E8F0',
          },
        ]}
      >
        <Pressable onPress={pickImage} style={styles.avatarWrap} accessibilityRole="button" accessibilityLabel="Change profile photo">
          {session?.user.profilePhotoUrl ? (
            <Image source={{ uri: session.user.profilePhotoUrl }} style={styles.avatarPhoto} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: palette.teal }]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {session && (
            <View style={[styles.avatarBadge, { backgroundColor: '#C89B3C' }]}>
              <Ionicons name="camera" size={12} color="#FFFFFF" />
            </View>
          )}
        </Pressable>

        <View style={styles.headerMeta}>
          <Text style={[styles.userName, { color: dark ? '#F8FAFC' : colors.ink }]} numberOfLines={1}>
            {session?.user.fullName ?? 'Guest Traveler'}
          </Text>
          <Text style={[styles.userEmail, { color: dark ? '#A4B4CD' : colors.inkMuted }]} numberOfLines={1}>
            {session?.user.email ?? 'Sign in to access your profile'}
          </Text>
          <View style={[styles.membershipBadge, { backgroundColor: dark ? '#16273E' : '#F4F1FF' }]}>
            <Text style={[styles.membershipText, { color: dark ? '#E9D5FF' : '#6D28D9' }]}>
              {role ?? 'Guest'}
            </Text>
          </View>
        </View>
      </View>

      {/* ─── Role Dashboard Shortcut (Admin / Manager / Staff) ─── */}
      {session && (isAdmin || isStaffOrManager) && (
        <Pressable
          onPress={() => navigate(isAdmin ? 'AdminOverview' : 'ManagerOverview')}
          accessibilityRole="button"
          style={[
            styles.roleBanner,
            {
              backgroundColor: dark ? '#132439' : '#F0FDF4',
              borderColor: dark ? '#223E5F' : '#BBF7D0',
            },
          ]}
        >
          <View style={[styles.roleIconCircle, { backgroundColor: dark ? '#1E3A5F' : '#DCFCE7' }]}>
            <Ionicons name="shield-half" size={18} color={dark ? '#6EE7B7' : '#16A34A'} />
          </View>
          <View style={styles.roleBannerMeta}>
            <Text style={[styles.roleBannerTitle, { color: dark ? '#F8FAFC' : '#14532D' }]}>
              {isAdmin ? 'Admin Control Center' : 'Manager Portal'}
            </Text>
            <Text style={[styles.roleBannerSub, { color: dark ? '#9DB1C9' : '#15803D' }]}>
              Access staff controls & hotel operations
            </Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={22} color={dark ? '#6EE7B7' : '#16A34A'} />
        </Pressable>
      )}

      {/* ─── Guest Welcome State ─── */}
      {!session ? (
        <Card
          style={[
            styles.card,
            {
              backgroundColor: dark ? '#101C2D' : '#FFFFFF',
              borderColor: dark ? '#1E2F46' : '#E2E8F0',
              alignItems: 'center',
              paddingVertical: 24,
            },
          ]}
        >
          <View style={[styles.guestIconCircle, { backgroundColor: dark ? '#16273E' : '#E6F4F2' }]}>
            <Ionicons name="person-circle-outline" size={48} color={palette.teal} />
          </View>
          <Text style={[styles.guestTitle, { color: dark ? '#F8FAFC' : colors.ink }]}>
            Sign in to your account
          </Text>
          <Text style={[styles.guestSubtitle, { color: dark ? '#9DB1C9' : colors.inkMuted }]}>
            Save favorites, manage your bookings, and customize your luxury travel experience.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Auth', { initialMode: 'login' })}
            style={[styles.primaryAuthBtn, { backgroundColor: palette.teal }]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryAuthBtnText}>Sign In / Register</Text>
          </Pressable>

          <View style={[styles.divider, { width: '100%', marginVertical: 18, backgroundColor: dark ? '#24324A' : '#E2E8F0' }]} />

          <View style={{ width: '100%' }}>
            <MenuItem label="App settings" icon="settings" onPress={() => navigate('Settings')} dark={dark} />
            <MenuItem label="Help & Support" icon="help-circle" onPress={() => navigate('Help')} dark={dark} />
          </View>
        </Card>
      ) : (
        <>
          {/* ─── Segmented Tabs (Profile / Security) ─── */}
          <View style={styles.tabs}>
            <Pressable
              onPress={() => setActiveTab('profile')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'profile' }}
              style={[
                styles.tab,
                activeTab === 'profile' && styles.tabActive,
                { borderColor: dark ? '#24324A' : '#E2E8F0' },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'profile' && styles.tabTextActive,
                  { color: activeTab === 'profile' ? '#FFFFFF' : dark ? '#C7D2FE' : '#475569' },
                ]}
              >
                Profile
              </Text>
            </Pressable>

            <Pressable
              onPress={() => navigate('AccountSecurity')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'security' }}
              style={[
                styles.tab,
                activeTab === 'security' && styles.tabActive,
                { borderColor: dark ? '#24324A' : '#E2E8F0' },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'security' && styles.tabTextActive,
                  { color: activeTab === 'security' ? '#FFFFFF' : dark ? '#C7D2FE' : '#475569' },
                ]}
              >
                Security
              </Text>
            </Pressable>
          </View>

          {/* ─── Profile Info Card ─── */}
          <Card
            style={[
              styles.card,
              {
                backgroundColor: dark ? '#101C2D' : '#FFFFFF',
                borderColor: dark ? '#1E2F46' : '#E2E8F0',
              },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: dark ? '#F8FAFC' : colors.ink }]}>
              Profile details
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: dark ? '#9DB1C9' : colors.inkMuted }]}>
                Full name
              </Text>
              <TextInput
                value={fullName}
                onChangeText={(v) => {
                  setFullName(v);
                  setFieldErrors((p) => ({ ...p, fullName: undefined }));
                }}
                onBlur={() => validateField('fullName')}
                style={[
                  styles.input,
                  {
                    backgroundColor: dark ? '#16273E' : '#F8FAFC',
                    borderColor: fieldErrors.fullName ? '#F87171' : dark ? '#24324A' : '#E2E8F0',
                    color: dark ? '#F8FAFC' : colors.ink,
                  },
                ]}
                placeholderTextColor={dark ? '#8FA1B3' : '#64748B'}
                autoCapitalize="words"
              />
              {fieldErrors.fullName ? <Text style={styles.errorText}>{fieldErrors.fullName}</Text> : null}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: dark ? '#9DB1C9' : colors.inkMuted }]}>
                Email address
              </Text>
              <TextInput
                value={email}
                style={[
                  styles.input,
                  {
                    backgroundColor: dark ? '#16273E' : '#F8FAFC',
                    borderColor: dark ? '#24324A' : '#E2E8F0',
                    color: dark ? '#A4B4CD' : '#64748B',
                  },
                ]}
                editable={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: dark ? '#9DB1C9' : colors.inkMuted }]}>
                Phone number
              </Text>
              <TextInput
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  setFieldErrors((p) => ({ ...p, phone: undefined }));
                }}
                onBlur={() => validateField('phone')}
                style={[
                  styles.input,
                  {
                    backgroundColor: dark ? '#16273E' : '#F8FAFC',
                    borderColor: fieldErrors.phone ? '#F87171' : dark ? '#24324A' : '#E2E8F0',
                    color: dark ? '#F8FAFC' : colors.ink,
                  },
                ]}
                placeholderTextColor={dark ? '#8FA1B3' : '#64748B'}
                keyboardType="phone-pad"
                placeholder="+251 9XX XXX XXX"
              />
              {fieldErrors.phone ? <Text style={styles.errorText}>{fieldErrors.phone}</Text> : null}
            </View>

            <Button title="Save changes" onPress={updateProfile} loading={loading} disabled={loading} />
          </Card>

          {/* ─── Preferences Card ─── */}
          <Card
            style={[
              styles.card,
              {
                backgroundColor: dark ? '#101C2D' : '#FFFFFF',
                borderColor: dark ? '#1E2F46' : '#E2E8F0',
              },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: dark ? '#F8FAFC' : colors.ink }]}>
              Preferences
            </Text>
            <ToggleRow label="Email deals" hint="Exclusive seasonal offers" value={emailDeals} onChange={setEmailDeals} dark={dark} />
            <View style={[styles.divider, { backgroundColor: dark ? '#24324A' : '#E2E8F0' }]} />
            <ToggleRow label="SMS updates" hint="Booking confirmations & alerts" value={smsUpdates} onChange={setSmsUpdates} dark={dark} />
            <View style={[styles.divider, { backgroundColor: dark ? '#24324A' : '#E2E8F0' }]} />
            <ToggleRow label="Amharic emails" hint="Receive communications in Amharic" value={amharicEmails} onChange={setAmharicEmails} dark={dark} />
          </Card>

          {/* ─── Account & Navigation Links ─── */}
          <Card
            style={[
              styles.card,
              {
                backgroundColor: dark ? '#101C2D' : '#FFFFFF',
                borderColor: dark ? '#1E2F46' : '#E2E8F0',
              },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: dark ? '#F8FAFC' : colors.ink }]}>
              Your account
            </Text>
            <MenuItem label="Account security & credentials" icon="shield-checkmark" onPress={() => navigate('AccountSecurity')} dark={dark} />
            <MenuItem label="Trips & reservations" icon="calendar" onPress={() => navigate('BookingsTab')} dark={dark} />
            <MenuItem label="Saved stays" icon="heart" onPress={() => navigate('FavoritesTab')} dark={dark} />
            {role === 'CUSTOMER' && (
              <MenuItem label="My hotel reviews" icon="star" onPress={() => navigate('MyReviews')} dark={dark} />
            )}
            {role === 'CUSTOMER' && (
              <MenuItem label="Disputes & complaints" icon="alert-circle" onPress={() => navigate('Disputes')} dark={dark} />
            )}
            <MenuItem label="Support inbox & messages" icon="chatbubbles" onPress={() => navigate('ContactInbox')} dark={dark} />
            <MenuItem label="Notifications" icon="notifications" onPress={() => navigate('Notifications')} dark={dark} />
            <MenuItem label="App settings" icon="settings" onPress={() => navigate('Settings')} dark={dark} />
            <MenuItem label="Help & FAQs" icon="help-circle" onPress={() => navigate('Help')} dark={dark} />
          </Card>

          {/* ─── Sign Out Button ─── */}
          <Pressable
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={[
              styles.signOutButton,
              {
                backgroundColor: dark ? '#101C2D' : '#FFFFFF',
                borderColor: dark ? '#1E2F46' : '#E2E8F0',
              },
            ]}
          >
            <Ionicons name="log-out-outline" size={18} color="#F87171" style={{ marginRight: 6 }} />
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
    </>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  dark,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  dark: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextWrap}>
        <Text style={[styles.toggleLabel, { color: dark ? '#F8FAFC' : colors.ink }]}>{label}</Text>
        <Text style={[styles.toggleHint, { color: dark ? '#A4B4CD' : colors.inkMuted }]}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: '#0F766E', false: '#64748B' }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function MenuItem({
  label,
  icon,
  onPress,
  dark,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  dark: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: dark ? '#16273E' : '#F8FAFC' },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Ionicons name={icon} size={18} color={dark ? '#9DB1C9' : '#475569'} style={styles.menuIcon} />
      <Text style={[styles.menuLabel, { color: dark ? '#F8FAFC' : colors.ink }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={dark ? '#9DB1C9' : '#64748B'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },

  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    overflow: 'hidden',
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 68, height: 68, borderRadius: 34 },
  avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerMeta: { flex: 1, marginLeft: 14 },
  userName: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  userEmail: { marginTop: 3, fontSize: 12 },
  membershipBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  membershipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  roleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  roleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleBannerMeta: {
    flex: 1,
    marginLeft: 12,
  },
  roleBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  roleBannerSub: {
    fontSize: 11,
    marginTop: 1,
  },

  guestIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  guestSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
    marginBottom: 18,
  },
  primaryAuthBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAuthBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, borderRadius: 14, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  tabText: { fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },

  card: { borderRadius: 20, borderWidth: 1, padding: 16, marginBottom: 16, overflow: 'hidden' },
  sectionLabel: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2, marginBottom: 12 },
  fieldGroup: { marginBottom: 12 },
  fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14 },
  errorText: { color: '#F87171', fontSize: 11, marginTop: 4 },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  toggleTextWrap: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 14, fontWeight: '700' },
  toggleHint: { marginTop: 2, fontSize: 12 },
  divider: { height: 1 },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    minHeight: 48,
  },
  menuIcon: { marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600' },

  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    minHeight: 48,
    marginTop: 4,
  },
  signOutText: { color: '#F87171', fontSize: 14, fontWeight: '800' },
});
