/**
 * MainTabs — OT.md §10 compliant bottom navigation
 *
 * — Dark mode via useTheme
 * — Respects bottom + horizontal safe-area insets
 * — 48px touch targets (OT.md §9)
 * — Compact labels on 320–359px screens (OT.md §10)
 * — Active pip indicator replaces underline
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TabParamList } from './types';
import { useAppSelector } from '../store/hooks';
import { colors, darkColors } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { useNotificationUnreadCount } from '../hooks/useQueries';

const Tab = createBottomTabNavigator<TabParamList>();

const HomeScreen = React.lazy(() => import('../screens/HomeScreen'));
const BookingHistoryScreen = React.lazy(() => import('../screens/BookingHistoryScreen'));
const FavoritesScreen = React.lazy(() => import('../screens/FavoritesScreen'));
const ProfileEditScreen = React.lazy(() => import('../screens/ProfileEditScreen'));
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: {
  name:         keyof TabParamList;
  labelKey:     string;
  labelCompactKey: string;
  icon:         IoniconName;
  iconActive:   IoniconName;
}[] = [
  { name: 'HomeTab',      labelKey: 'tabs.home',      labelCompactKey: 'tabs.home',      icon: 'home-outline',          iconActive: 'home' },
  { name: 'BookingsTab',  labelKey: 'tabs.bookings',  labelCompactKey: 'tabs.bookings',  icon: 'calendar-outline',      iconActive: 'calendar' },
  { name: 'FavoritesTab', labelKey: 'tabs.saved',     labelCompactKey: 'tabs.saved',     icon: 'heart-outline',         iconActive: 'heart' },
  { name: 'ProfileTab',   labelKey: 'tabs.profile',   labelCompactKey: 'tabs.profile',   icon: 'person-circle-outline', iconActive: 'person-circle' },
];

export default function MainTabs() {
  const { t } = useTranslation();
  const session = useAppSelector((s) => s.auth.session);
  const token   = session?.accessToken ?? '';
  const { data: notifData } = useNotificationUnreadCount(token);
  const unread  = notifData?.unreadCount ?? 0;
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const c = dark ? darkColors : colors;
  const { width } = useWindowDimensions();
  const visibleTabs = session?.user?.role === 'STAFF'
    ? TAB_CONFIG.filter((tab) => tab.name !== 'FavoritesTab')
    : TAB_CONFIG;
  // OT.md §10: shorter labels on compact screens
  const compact = width < 360;

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <View style={[
          s.bar,
          {
            paddingBottom: Math.max(insets.bottom, 8),
            paddingLeft:   Math.max(insets.left, 0),
            paddingRight:  Math.max(insets.right, 0),
            backgroundColor: c.surface,
            borderTopColor:  c.line,
          },
        ]}>
          {visibleTabs.map((tab, index) => {
            const focused   = state.index === index;
            const isProfile = tab.name === 'ProfileTab';
            const hasNotif  = isProfile && unread > 0;
            const label     = isProfile && !session
              ? (compact ? t('tabs.sign_in_short') : t('tabs.sign_in'))
              : (compact ? t(tab.labelCompactKey) : t(tab.labelKey));

            return (
              <View key={tab.name} style={s.item}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: focused }}
                  onPress={() => navigation.navigate(tab.name)}
                  style={({ pressed }) => [s.touch, pressed && { opacity: 0.6 }]}
                >
                  {/* Active indicator pip */}
                  {focused && (
                    <View style={[s.pip, { backgroundColor: c.teal }]} />
                  )}

                  {/* Icon */}
                  <View style={s.iconBox}>
                    <Ionicons
                      name={focused ? tab.iconActive : tab.icon}
                      size={24}
                      color={focused ? c.teal : c.inkMuted}
                    />
                    {/* Notification badge */}
                    {hasNotif && (
                      <View style={[s.badge, { borderColor: c.surface }]}>
                        <Text style={s.badgeT}>
                          {unread > 9 ? '9+' : unread}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Label */}
                  <Text
                    style={[
                      s.label,
                      { color: focused ? c.teal : c.inkMuted },
                      focused && { fontWeight: '700' },
                      compact && { fontSize: 9 },
                    ]}
                    numberOfLines={1}
                  >
                    {label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    >
      <Tab.Screen name="HomeTab"      component={HomeScreen} />
      <Tab.Screen name="BookingsTab"  component={BookingHistoryScreen} />
      {session?.user?.role !== 'STAFF' && (
        <Tab.Screen name="FavoritesTab" component={FavoritesScreen} />
      )}
      <Tab.Screen name="ProfileTab"   component={ProfileEditScreen} />
    </Tab.Navigator>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  item:  { flex: 1, alignItems: 'center' },
  // OT.md §9: 48px minimum touch area
  touch: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: '100%',
    gap: 2,
    position: 'relative',
  },
  pip: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  iconBox: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -6,
    backgroundColor: '#EF4444', borderRadius: 8,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5,
  },
  badgeT: { color: '#FFF', fontSize: 9, fontWeight: '800', lineHeight: 12 },
  label:  { fontSize: 10, fontWeight: '500', letterSpacing: 0.1 },
});
