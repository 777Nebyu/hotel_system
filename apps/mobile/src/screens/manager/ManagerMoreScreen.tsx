import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { signOut as signOutAction, saveSessionToStorage } from '../../store/authSlice';
import { request } from '../../api';
import { getStoredPushToken, deregisterPushToken } from '../../lib/notifications';
import ScreenHeader from '../../components/ScreenHeader';
import { useTheme } from '../../hooks/useTheme';

type Props = { onBack: () => void; onNavigate?: (page: { screen: string } & Record<string, any>) => void };

const MENU_ITEMS = [
  { icon: 'business-outline', label: 'Hotel Settings', screen: 'ManagerHotel', description: 'Edit hotel profile & policies' },
  { icon: 'bed-outline', label: 'Room Management', screen: 'ManagerRooms', description: 'Add, edit & manage rooms' },
  { icon: 'analytics-outline', label: 'Reports & Revenue', screen: 'ManagerReports', description: 'View occupancy & revenue' },
  { icon: 'alert-circle-outline', label: 'Customer Disputes', screen: 'ManagerDisputes', description: 'Review customer booking issues' },
  { icon: 'walk-outline', label: 'Walk-in Booking', screen: 'WalkInBooking', description: 'Create a walk-in reservation' },
  { icon: 'notifications-outline', label: 'Notifications', screen: 'Notifications', description: 'View all notifications' },
  { icon: 'shield-checkmark-outline', label: 'Account Security', screen: 'AccountSecurity', description: 'Password & security settings' },
  { icon: 'settings-outline', label: 'App Settings', screen: 'Settings', description: 'Theme, language & preferences' },
  { icon: 'help-circle-outline', label: 'Help & Support', screen: 'Help', description: 'FAQs and contact support' },
] as const;

export default function ManagerMoreScreen({ onBack, onNavigate }: Props) {
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.auth.session);
  const user = session?.user;
  const { colors: c } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
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
    <View style={[styles.root, { backgroundColor: c.paper }]}>
      <ScreenHeader title="More" onBack={onBack} subtitle={user?.fullName ?? 'Manager'} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile card */}
        <View style={[styles.profileCard, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={[styles.avatar, { backgroundColor: c.teal }]}>
            <Text style={styles.avatarText}>{(user?.fullName ?? 'M').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: c.ink }]}>{user?.fullName ?? 'Manager'}</Text>
            <Text style={[styles.profileEmail, { color: c.inkMuted }]}>{user?.email ?? ''}</Text>
            {user?.hotelName && (
              <Text style={[styles.profileHotel, { color: c.teal }]}>{user.hotelName}</Text>
            )}
            <View style={[styles.roleBadge, { backgroundColor: c.tealTint }]}>
              <Text style={[styles.roleText, { color: c.tealDeep }]}>{user?.role ?? 'MANAGER'}</Text>
            </View>
          </View>
        </View>

        {/* Menu items */}
        <View style={[styles.menuGroup, { backgroundColor: c.surface, borderColor: c.line }]}>
          {MENU_ITEMS.filter((item) => user?.role !== 'STAFF' || !['ManagerHotel', 'ManagerRooms', 'ManagerReports'].includes(item.screen)).map((item, i) => (
            <View key={item.screen} style={[styles.menuItemWrapper, i < MENU_ITEMS.length - 1 && { borderBottomColor: c.line }]}>
              <Pressable
                style={styles.menuItem}
                onPress={() => onNavigate?.({ screen: item.screen })}
              >
                <View style={[styles.menuIcon, { backgroundColor: c.tealTint }]}>
                  <Ionicons name={item.icon as any} size={22} color={c.teal} />
                </View>
                <View style={styles.menuText}>
                  <Text style={[styles.menuLabel, { color: c.ink }]}>{item.label}</Text>
                  <Text style={[styles.menuDescription, { color: c.inkMuted }]}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.inkMuted} />
              </Pressable>
            </View>
          ))}
        </View>

        {/* Version */}
        <Text style={[styles.version, { color: c.inkMuted }]}>LuxSty Hotel System v1.0</Text>

        {/* Sign Out */}
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={({ pressed }) => [styles.signOutBtn, { borderColor: c.brick + '40' }, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="log-out-outline" size={20} color={c.brick} />
          <Text style={[styles.signOutText, { color: c.brick }]}>{signingOut ? 'Signing out…' : 'Sign Out'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 16 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: 17, fontWeight: '700' },
  profileEmail: { fontSize: 13 },
  profileHotel: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  roleBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  roleText: { fontSize: 11, fontWeight: '700' },

  menuGroup: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItemWrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: { flex: 1, gap: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600' },
  menuDescription: { fontSize: 12 },

  version: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 4,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
