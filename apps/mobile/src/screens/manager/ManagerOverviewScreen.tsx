/**
 * ManagerOverviewScreen — Premium Hotel PMS Dashboard
 *
 * Design system:
 *   Primary:    Deep Emerald  #0F766E
 *   Accent:     Luxury Gold   #C89B3C
 *   Background: Warm Ivory    #FAFAF7
 *   Text:       Dark Navy     #132238
 *   Cards:      White + soft shadow + glassmorphism tint
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { ErrorBox } from '../../components/Shared';
import { SkeletonCard } from '../../components/Skeleton';
import { useTheme } from '../../hooks/useTheme';

// ─── Design tokens ────────────────────────────────────────────────────────────
const EMERALD       = '#0F766E';
const EMERALD_DARK  = '#0A5A54';
const EMERALD_LIGHT = '#E6F4F2';
const GOLD          = '#C89B3C';
const GOLD_LIGHT    = '#FBF4E5';
const IVORY         = '#FAFAF7';
const NAVY          = '#132238';
const NAVY_MUTED    = '#4A5568';
const NAVY_SUBTLE   = '#8FA1B3';
const WHITE         = '#FFFFFF';
const SUCCESS       = '#16A34A';
const SUCCESS_BG    = '#F0FDF4';
const WARNING       = '#D97706';
const WARNING_BG    = '#FFFBEB';
const ERROR         = '#DC2626';
const ERROR_BG      = '#FEF2F2';
const BLUE          = '#2563EB';
const BLUE_BG       = '#EFF6FF';

// Dark mode overrides
const D_BG          = '#0D1B2A';
const D_SURFACE     = '#152233';
const D_CARD        = '#1A2D40';
const D_BORDER      = '#1F3448';
const D_TEXT        = '#F0F4F8';
const D_MUTED       = '#8FA1B3';

const CARD_PADDING = 16;
const SIDE_PADDING = 16;

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardStats {
  occupancyRate: number;
  arrivalsToday: number;
  departuresToday: number;
  pendingQueue: number;
  monthlyRevenue: number;
  todayRevenue?: number;
  availableRooms?: number;
  totalRooms?: number;
  cleaningRooms?: number;
  maintenanceRooms?: number;
  pendingPayments?: number;
  weeklyRevenue?: number[];
  arrivals: BookingEntry[];
  departures: BookingEntry[];
}

interface BookingEntry {
  id: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  guestCount?: number;
}

type Props = {
  onBack: () => void;
  onNavigate: (page: { screen: string } & Record<string, unknown>) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const fmtCurrency = (n: number) =>
  `ETB ${n.toLocaleString('en-ET', { minimumFractionDigits: 0 })}`;

const getDate = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

// Weekly revenue mock fallback
const WEEK_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Pill badge for booking status */
function StatusPill({ status, dark }: { status: string; dark: boolean }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    CONFIRMED:  { bg: EMERALD_LIGHT, fg: EMERALD, label: 'Confirmed' },
    PENDING:    { bg: WARNING_BG,    fg: WARNING,  label: 'Pending'   },
    CHECKED_IN: { bg: SUCCESS_BG,    fg: SUCCESS,  label: 'Checked In'},
    CHECKED_OUT:{ bg: '#F1F5F9',     fg: '#64748B',label: 'Checked Out'},
    CANCELLED:  { bg: ERROR_BG,      fg: ERROR,    label: 'Cancelled' },
  };
  const s = map[status] ?? { bg: '#F1F5F9', fg: '#64748B', label: status };
  return (
    <View style={[pill.wrap, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : s.bg }]}>
      <Text style={[pill.text, { color: dark ? D_MUTED : s.fg }]}>{s.label}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  wrap: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});

/** Mini sparkline — simple SVG-free bar chart rendered with Views */
function RevenueChart({ data, dark }: { data: number[]; dark: boolean }) {
  const max = Math.max(...data, 1);
  return (
    <View style={chart.container}>
      {data.map((v, i) => {
        const isToday = i === new Date().getDay() - 1;
        const height = Math.max(6, (v / max) * 80);
        return (
          <View key={i} style={chart.col}>
            <View style={[
              chart.bar,
              {
                height,
                backgroundColor: isToday
                  ? GOLD
                  : dark ? 'rgba(15,118,110,0.5)' : EMERALD_LIGHT,
              },
              isToday && chart.barActive,
            ]} />
            <Text style={[chart.label, { color: dark ? D_MUTED : NAVY_SUBTLE }]}>
              {WEEK_DAYS[i]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
const chart = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingTop: 8, paddingBottom: 4 },
  col: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: '100%', borderRadius: 6 },
  barActive: { backgroundColor: GOLD },
  label: { fontSize: 10, fontWeight: '600' },
});

/** Room status progress row */
function RoomStatusRow({
  label, count, total, color, bg, icon, dark
}: { label: string; count: number; total: number; color: string; bg: string; icon: string; dark: boolean }) {
  const { width: SCREEN_W } = useWindowDimensions();
  const pct = total > 0 ? count / total : 0;
  const trackW = SCREEN_W - SIDE_PADDING * 2 - CARD_PADDING * 2 - 80;
  return (
    <View style={rs.row}>
      <View style={[rs.dot, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={13} color={color} />
      </View>
      <View style={rs.mid}>
        <View style={rs.labelRow}>
          <Text style={[rs.label, { color: dark ? D_TEXT : NAVY }]}>{label}</Text>
          <Text style={[rs.count, { color: dark ? D_MUTED : NAVY_MUTED }]}>{count} rooms</Text>
        </View>
        <View style={[rs.track, { backgroundColor: dark ? D_BORDER : '#EEF2F6', width: trackW }]}>
          <Animated.View style={[rs.fill, { width: trackW * pct, backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}
const rs = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  dot:      { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mid:      { flex: 1 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label:    { fontSize: 13, fontWeight: '600' },
  count:    { fontSize: 12, fontWeight: '500' },
  track:    { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill:     { height: 6, borderRadius: 3 },
});

/** Guest arrival / departure card */
function GuestCard({
  booking, actionLabel, actionColor, onAction, dark
}: {
  booking: BookingEntry;
  actionLabel: string;
  actionColor: string;
  onAction: () => void;
  dark: boolean;
}) {
  const initials = booking.guestName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={[gc.card, {
      backgroundColor: dark ? D_CARD : WHITE,
      borderColor: dark ? D_BORDER : '#F0F4F7',
      shadowColor: dark ? 'transparent' : '#132238',
    }]}>
      {/* Avatar */}
      <View style={[gc.avatar, { backgroundColor: dark ? 'rgba(15,118,110,0.25)' : EMERALD_LIGHT }]}>
        <Text style={[gc.initials, { color: EMERALD }]}>{initials}</Text>
      </View>
      {/* Info */}
      <View style={gc.info}>
        <Text style={[gc.name, { color: dark ? D_TEXT : NAVY }]} numberOfLines={1}>
          {booking.guestName}
        </Text>
        <View style={gc.metaRow}>
          <Ionicons name="bed-outline" size={11} color={dark ? D_MUTED : NAVY_SUBTLE} />
          <Text style={[gc.meta, { color: dark ? D_MUTED : NAVY_MUTED }]}>
            {` Room ${booking.roomNumber}`}
          </Text>
          <View style={gc.dot} />
          <Ionicons name="time-outline" size={11} color={dark ? D_MUTED : NAVY_SUBTLE} />
          <Text style={[gc.meta, { color: dark ? D_MUTED : NAVY_MUTED }]}>
            {` ${fmtTime(booking.checkIn)}`}
          </Text>
        </View>
      </View>
      {/* Status + action */}
      <View style={gc.right}>
        <StatusPill status={booking.status} dark={dark} />
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            gc.btn,
            { backgroundColor: pressed ? EMERALD_DARK : actionColor },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} ${booking.guestName}`}
        >
          <Text style={gc.btnText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const gc = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 16, marginBottom: 10,
    borderWidth: 1,
    shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  meta: { fontSize: 11, fontWeight: '500' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CBD5E1', marginHorizontal: 4 },
  right: { alignItems: 'flex-end', gap: 6 },
  btn: {
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  btnText: { color: WHITE, fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ManagerOverviewScreen({ onBack, onNavigate }: Props) {
  const insets     = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const dark       = colorScheme === 'dark';

  const token      = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const session    = useAppSelector((s) => s.auth.session);
  const userRole   = session?.user?.role ?? 'MANAGER';

  const [stats,      setStats]      = useState<DashboardStats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Scroll-driven header opacity
  const scrollY    = useRef(new Animated.Value(0)).current;
  const headerBorder = scrollY.interpolate({ inputRange: [20, 60], outputRange: [0, 1], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await request<DashboardStats>('/bookings/manage/dashboard/stats', { token });
      setStats(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  // Derive room status breakdown
  const totalRooms     = stats?.totalRooms      ?? 0;
  const availRooms     = stats?.availableRooms  ?? 0;
  const cleaningRooms  = stats?.cleaningRooms   ?? 0;
  const maintRooms     = stats?.maintenanceRooms ?? 0;
  const occupiedRooms  = totalRooms - availRooms - cleaningRooms - maintRooms;

  const weeklyData = useMemo(() => (
    stats?.weeklyRevenue ?? [0, 0, 0, 0, 0, 0, 0]
  ), [stats]);

  // ── Colors (theme-aware) ───────────────────────────────────────────────────
  const bg      = dark ? D_BG      : IVORY;
  const card    = dark ? D_CARD    : WHITE;
  const border  = dark ? D_BORDER  : '#EEF2F6';
  const textPri = dark ? D_TEXT    : NAVY;
  const textSec = dark ? D_MUTED   : NAVY_MUTED;
  const textMut = dark ? '#6B8099' : NAVY_SUBTLE;

  const shadow = Platform.select({
    ios:     { shadowColor: dark ? 'transparent' : NAVY, shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
    android: { elevation: dark ? 0 : 3 },
    default: {},
  });

  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
        <View style={[s.headerShell, { paddingTop: insets.top + 8, backgroundColor: bg }]}>
          <View style={s.headerSkeletonRow}>
            <View style={[s.skeletonCircle, { backgroundColor: border }]} />
            <View style={[s.skeletonBlock, { backgroundColor: border, width: 180, height: 18 }]} />
            <View style={[s.skeletonCircle, { backgroundColor: border }]} />
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: SIDE_PADDING, paddingBottom: 40 }}>
          <SkeletonCard />
          <View style={{ marginTop: 12, gap: 10, flexDirection: 'row' }}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
          <View style={{ marginTop: 12, gap: 10, flexDirection: 'row' }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        </ScrollView>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[s.root, { backgroundColor: bg }]}>
        <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={bg} />
        <View style={[s.headerShell, { paddingTop: insets.top + 8, backgroundColor: bg }]}>
          <Pressable onPress={onBack} hitSlop={10} style={[s.headerBtn, { backgroundColor: card, borderColor: border }]}>
            <Ionicons name="arrow-back" size={20} color={textPri} />
          </Pressable>
        </View>
        <View style={s.center}><ErrorBox message={error} onRetry={load} /></View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={bg} />

      {/* ── Fixed header ──────────────────────────────────────────────────── */}
      <Animated.View style={[
        s.headerShell,
        {
          paddingTop: insets.top + 8,
          backgroundColor: bg,
          borderBottomWidth: headerBorder as any,
          borderBottomColor: border,
        },
      ]}>
        <View style={s.headerRow}>
          {/* Back */}
          <Pressable
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [
              s.headerBtn,
              { backgroundColor: pressed ? border : card, borderColor: border },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={textPri} />
          </Pressable>

          {/* Center */}
          <View style={s.headerCenter}>
            <Text style={[s.headerGreeting, { color: textMut }]}>
              {getGreeting()}, {userRole === 'STAFF' ? 'Staff' : 'Manager'} 👋
            </Text>
            <Text style={[s.headerHotel, { color: textPri }]} numberOfLines={1}>
              {session?.user?.hotelName ?? 'My Hotel'}
            </Text>
            <Text style={[s.headerDate, { color: textSec }]}>{getDate()}</Text>
          </View>

          {/* Right actions */}
          <View style={s.headerRight}>
            <Pressable
              onPress={() => onNavigate({ screen: 'Notifications' })}
              hitSlop={6}
              style={[s.headerBtn, { backgroundColor: card, borderColor: border }]}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={textPri} />
            </Pressable>
            <Pressable
              onPress={onBack}
              style={[s.avatarBtn, { backgroundColor: EMERALD }]}
              accessibilityRole="button"
              accessibilityLabel="Profile"
            >
              <Text style={s.avatarText}>
                {(session?.user?.fullName ?? 'M').charAt(0).toUpperCase()}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <Animated.ScrollView
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={EMERALD}
            colors={[EMERALD]}
          />
        }
      >

        {/* ── KPI Grid ──────────────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: textPri, marginTop: 4 }]}>Performance Overview</Text>

        {/* Row 1: Occupancy + Revenue */}
        <View style={s.kpiRow}>
          {/* Occupancy — large hero card */}
          {/* Occupancy — large hero card with layered overlay for gradient effect */}
          <View style={[s.kpiHero, shadow, { backgroundColor: EMERALD }]}>
            {/* Decorative overlay circles for depth */}
            <View style={[s.kpiCircle, { top: -30, right: -20, opacity: 0.12 }]} />
            <View style={[s.kpiCircle, { width: 70, height: 70, top: 60, right: 50, opacity: 0.07 }]} />
            <View style={s.kpiHeroBody}>
              <View style={s.kpiHeroTop}>
                <View style={s.kpiHeroIconWrap}>
                  <Ionicons name="business" size={18} color={WHITE} />
                </View>
                <View style={s.kpiBadge}>
                  <Ionicons name="trending-up" size={11} color={GOLD} />
                  <Text style={s.kpiBadgeText}>+8%</Text>
                </View>
              </View>
              <Text style={s.kpiHeroValue}>
                {stats?.occupancyRate ?? 72}%
              </Text>
              <Text style={s.kpiHeroLabel}>Occupancy Rate</Text>
              <Text style={s.kpiHeroSub}>vs. yesterday</Text>
            </View>
          </View>

          {/* Revenue */}
          <View style={[s.kpiCard, { backgroundColor: card, borderColor: border, flex: 1 }, shadow]}>
            <View style={s.kpiTop}>
              <View style={[s.kpiIcon, { backgroundColor: GOLD_LIGHT }]}>
                <Ionicons name="cash-outline" size={16} color={GOLD} />
              </View>
              <View style={[s.kpiBadgeSmall, { backgroundColor: '#F0FDF4' }]}>
                <Text style={[s.kpiBadgeSmallText, { color: SUCCESS }]}>+12%</Text>
              </View>
            </View>
            <Text style={[s.kpiValue, { color: textPri }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmtCurrency(stats?.todayRevenue ?? 0)}
            </Text>
            <Text style={[s.kpiLabel, { color: textSec }]}>{"Today's Revenue"}</Text>
          </View>
        </View>

        {/* Row 2: 4 small KPI cards */}
        <View style={s.kpiRow}>
          {[
            { icon: 'log-in-outline',  color: EMERALD,   bg: EMERALD_LIGHT, value: stats?.arrivalsToday ?? 0,       label: 'Arrivals',    sub: 'Check-in today'  },
            { icon: 'log-out-outline', color: BLUE,      bg: BLUE_BG,       value: stats?.departuresToday ?? 0,     label: 'Departures',  sub: 'Check-out today' },
            { icon: 'receipt-outline', color: WARNING,   bg: WARNING_BG,    value: fmtCurrency(stats?.pendingPayments ?? 0), label: 'Pending Pay', sub: 'Outstanding', isText: true },
            { icon: 'bed-outline',     color: SUCCESS,   bg: SUCCESS_BG,    value: availRooms,                       label: 'Available',   sub: 'Rooms free'      },
          ].map((kpi, i) => (
            <View key={i} style={[s.kpiSmall, { backgroundColor: card, borderColor: border }, shadow]}>
              <View style={[s.kpiSmallIcon, { backgroundColor: kpi.bg }]}>
                <Ionicons name={kpi.icon as any} size={15} color={kpi.color} />
              </View>
              <Text
                style={[s.kpiSmallValue, { color: textPri, fontSize: kpi.isText ? 11 : 20 }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {String(kpi.value)}
              </Text>
              <Text style={[s.kpiSmallLabel, { color: textSec }]}>{kpi.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <View style={s.sectionHeaderRow}>
          <Text style={[s.sectionTitle, { color: textPri }]}>Quick Actions</Text>
        </View>

        <View style={s.actionGrid}>
          {[
            { icon: 'calendar-outline',   color: EMERALD, bg: EMERALD_LIGHT, label: 'New Booking',      screen: 'ManagerBookings',                  roles: ['MANAGER','STAFF','ADMIN'] },
            { icon: 'person-add-outline', color: GOLD,    bg: GOLD_LIGHT,    label: 'Walk-in Guest',    screen: 'WalkInBooking',                    roles: ['MANAGER','STAFF','ADMIN'] },
            { icon: 'bed-outline',        color: BLUE,    bg: BLUE_BG,       label: 'Room Mgmt',        screen: 'ManagerRooms',                     roles: ['MANAGER','ADMIN'] },
            { icon: 'key-outline',        color: SUCCESS, bg: SUCCESS_BG,    label: 'Check-in',         screen: 'ManagerBookings',                  roles: ['MANAGER','STAFF','ADMIN'] },
            { icon: 'receipt-outline',    color: WARNING, bg: WARNING_BG,    label: 'Billing',          screen: 'ManagerBookings',                  roles: ['MANAGER','STAFF','ADMIN'] },
            { icon: 'stats-chart',        color: EMERALD, bg: EMERALD_LIGHT, label: 'Reports',          screen: 'ManagerReports',                   roles: ['MANAGER','STAFF','ADMIN'] },
          ]
            .filter(a => a.roles.includes(userRole))
            .map((action, i) => (
              <Pressable
                key={i}
                onPress={() => onNavigate({ screen: action.screen })}
                style={({ pressed }) => [
                  s.actionBtn,
                  { backgroundColor: pressed ? border : card, borderColor: border },
                  shadow,
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View style={[s.actionIcon, { backgroundColor: action.bg }]}>
                  <Ionicons name={action.icon as any} size={22} color={action.color} />
                </View>
                <Text style={[s.actionLabel, { color: textPri }]}>{action.label}</Text>
              </Pressable>
            ))}
        </View>

        {/* ── Room Status ───────────────────────────────────────────────── */}
        <View style={s.sectionHeaderRow}>
          <Text style={[s.sectionTitle, { color: textPri }]}>Room Status</Text>
          {userRole !== 'STAFF' && (
            <Pressable onPress={() => onNavigate({ screen: 'ManagerRooms' })} hitSlop={8}>
              <Text style={s.seeAll}>Manage</Text>
            </Pressable>
          )}
        </View>

        <View style={[s.roomCard, { backgroundColor: card, borderColor: border }, shadow]}>
          {/* Summary row */}
          <View style={s.roomSummaryRow}>
            {[
              { label: 'Total', value: totalRooms,    color: textPri },
              { label: 'Occupied', value: occupiedRooms, color: BLUE   },
              { label: 'Available', value: availRooms,   color: SUCCESS },
              { label: 'Cleaning', value: cleaningRooms,  color: WARNING },
            ].map((item, i) => (
              <View key={i} style={s.roomSummaryItem}>
                <Text style={[s.roomSummaryValue, { color: item.color }]}>{item.value}</Text>
                <Text style={[s.roomSummaryLabel, { color: textMut }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={[s.divider, { backgroundColor: border }]} />

          <RoomStatusRow label="Available"   count={availRooms}    total={totalRooms} color={SUCCESS} bg={SUCCESS_BG}   icon="checkmark-circle-outline" dark={dark} />
          <RoomStatusRow label="Occupied"    count={occupiedRooms} total={totalRooms} color={BLUE}    bg={BLUE_BG}      icon="person-outline"            dark={dark} />
          <RoomStatusRow label="Cleaning"    count={cleaningRooms} total={totalRooms} color={WARNING} bg={WARNING_BG}   icon="water-outline"             dark={dark} />
          <RoomStatusRow label="Maintenance" count={maintRooms}    total={totalRooms} color={ERROR}   bg={ERROR_BG}     icon="construct-outline"         dark={dark} />
        </View>

        {/* ── Today's Arrivals ──────────────────────────────────────────── */}
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionTitleRow}>
            <Text style={[s.sectionTitle, { color: textPri }]}>{"Today's Arrivals"}</Text>
            {(stats?.arrivalsToday ?? 0) > 0 && (
              <View style={s.countBadge}>
                <Text style={s.countBadgeText}>{stats?.arrivalsToday ?? 0}</Text>
              </View>
            )}
          </View>
          <Pressable onPress={() => onNavigate({ screen: 'ManagerBookings' })} hitSlop={8}>
            <Text style={s.seeAll}>See All</Text>
          </Pressable>
        </View>

        {(stats?.arrivals ?? []).length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: card, borderColor: border }]}>
            <Ionicons name="sunny-outline" size={32} color={dark ? D_MUTED : NAVY_SUBTLE} />
            <Text style={[s.emptyText, { color: textSec }]}>No arrivals today</Text>
          </View>
        ) : (
          (stats?.arrivals ?? []).map((b) => (
            <GuestCard
              key={b.id}
              booking={b}
              actionLabel="Check-in"
              actionColor={EMERALD}
              onAction={() => onNavigate({ screen: 'ManagerBookings', bookingId: b.id })}
              dark={dark}
            />
          ))
        )}

        {/* ── Today's Departures ────────────────────────────────────────── */}
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionTitleRow}>
            <Text style={[s.sectionTitle, { color: textPri }]}>{"Today's Departures"}</Text>
            {(stats?.departuresToday ?? 0) > 0 && (
              <View style={[s.countBadge, { backgroundColor: GOLD_LIGHT }]}>
                <Text style={[s.countBadgeText, { color: GOLD }]}>{stats?.departuresToday ?? 0}</Text>
              </View>
            )}
          </View>
          <Pressable onPress={() => onNavigate({ screen: 'ManagerBookings' })} hitSlop={8}>
            <Text style={s.seeAll}>See All</Text>
          </Pressable>
        </View>

        {(stats?.departures ?? []).length === 0 ? (
          <View style={[s.emptyCard, { backgroundColor: card, borderColor: border }]}>
            <Ionicons name="moon-outline" size={32} color={dark ? D_MUTED : NAVY_SUBTLE} />
            <Text style={[s.emptyText, { color: textSec }]}>No departures today</Text>
          </View>
        ) : (
          (stats?.departures ?? []).map((b) => (
            <GuestCard
              key={b.id}
              booking={{ ...b, checkIn: b.checkOut }}
              actionLabel="Checkout"
              actionColor={GOLD}
              onAction={() => onNavigate({ screen: 'ManagerBookings', bookingId: b.id })}
              dark={dark}
            />
          ))
        )}

        {/* ── Revenue Analytics ─────────────────────────────────────────── */}
        <View style={s.sectionHeaderRow}>
          <Text style={[s.sectionTitle, { color: textPri }]}>Revenue Overview</Text>
          <Pressable onPress={() => onNavigate({ screen: 'ManagerReports' })} hitSlop={8}>
            <Text style={s.seeAll}>Full Report</Text>
          </Pressable>
        </View>

        <View style={[s.revenueCard, { backgroundColor: card, borderColor: border }, shadow]}>
          {/* Header row */}
          <View style={s.revenueHeaderRow}>
            <View>
              <Text style={[s.revenueTotal, { color: textPri }]}>
                {fmtCurrency(weeklyData.reduce((a, b) => a + b, 0))}
              </Text>
              <Text style={[s.revenueSubLabel, { color: textSec }]}>{"This week's total"}</Text>
            </View>
            <View style={[s.revenueBadge, { backgroundColor: SUCCESS_BG }]}>
              <Ionicons name="trending-up" size={13} color={SUCCESS} />
              <Text style={[s.revenueBadgeText, { color: SUCCESS }]}>+15.2%</Text>
            </View>
          </View>
          {/* Chart */}
          <RevenueChart data={weeklyData} dark={dark} />
          {/* Legend */}
          <View style={[s.revenueLegend, { borderTopColor: border }]}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: EMERALD }]} />
              <Text style={[s.legendText, { color: textSec }]}>Previous weeks</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: GOLD }]} />
              <Text style={[s.legendText, { color: textSec }]}>Today</Text>
            </View>
          </View>
        </View>

      </Animated.ScrollView>

      {/* ── Bottom Navigation ─────────────────────────────────────────────── */}
      <View style={[
        s.bottomNav,
        {
          paddingBottom: insets.bottom + 6,
          backgroundColor: dark ? D_SURFACE : WHITE,
          borderTopColor: border,
          shadowColor: dark ? 'transparent' : NAVY,
        },
      ]}>
        {[
          { icon: 'grid',              activeIcon: 'grid',              label: 'Dashboard', screen: 'ManagerOverview',  active: true  },
          { icon: 'calendar-outline',  activeIcon: 'calendar',          label: 'Bookings',  screen: 'ManagerBookings',  active: false },
          ...(userRole !== 'STAFF' ? [{ icon: 'bed-outline', activeIcon: 'bed', label: 'Rooms', screen: 'ManagerRooms', active: false }] : []),
          { icon: 'people-outline',    activeIcon: 'people',            label: 'Guests',    screen: 'ManagerBookings',  active: false },
          { icon: 'ellipsis-horizontal-outline', activeIcon: 'ellipsis-horizontal', label: 'More', screen: 'ManagerMore', active: false },
        ].map((tab, i) => (
          <Pressable
            key={i}
            onPress={() => tab.screen ? onNavigate({ screen: tab.screen }) : null}
            style={s.navTab}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: tab.active }}
          >
            {tab.active && <View style={[s.navPip, { backgroundColor: EMERALD }]} />}
            <Ionicons
              name={(tab.active ? tab.activeIcon : tab.icon) as any}
              size={22}
              color={tab.active ? EMERALD : (dark ? D_MUTED : NAVY_SUBTLE)}
            />
            <Text style={[s.navLabel, { color: tab.active ? EMERALD : (dark ? D_MUTED : NAVY_SUBTLE) }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body:   { paddingHorizontal: SIDE_PADDING, paddingTop: 12 },

  // ── Header
  headerShell: {
    paddingHorizontal: SIDE_PADDING,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  headerGreeting: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  headerHotel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerDate: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
  },
  headerSkeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  skeletonCircle: { width: 38, height: 38, borderRadius: 19 },
  skeletonBlock:  { borderRadius: 8, height: 18 },

  // ── Section
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '700',
    color: EMERALD,
  },

  // ── KPI Hero
  kpiRow:    { flexDirection: 'row', gap: 10, marginBottom: 0 },
  kpiHero: {
    flex: 1.4,
    borderRadius: 20,
    padding: CARD_PADDING,
    overflow: 'hidden',
    minHeight: 160,
    marginBottom: 10,
  },
  kpiCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: WHITE,
  },
  kpiHeroBody: { flex: 1, justifyContent: 'flex-end' },
  kpiHeroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  kpiHeroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(200,155,60,0.2)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kpiBadgeText: { color: GOLD, fontSize: 11, fontWeight: '700' },
  kpiHeroValue: {
    color: WHITE,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  kpiHeroLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  kpiHeroSub:   { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },

  // ── KPI regular
  kpiCard: {
    borderRadius: 20,
    padding: CARD_PADDING,
    borderWidth: 1,
    gap: 6,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  kpiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiBadgeSmall: {
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  kpiBadgeSmallText: { fontSize: 10, fontWeight: '700' },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  kpiLabel: { fontSize: 11, fontWeight: '600' },

  // ── KPI small (4-in-a-row)
  kpiSmall: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 10,
  },
  kpiSmallIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiSmallValue: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  kpiSmallLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Quick Actions
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBtn: {
    flexBasis: '30%',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    minHeight: 88,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.1,
  },

  // ── Room Card
  roomCard: {
    borderRadius: 20,
    padding: CARD_PADDING,
    borderWidth: 1,
  },
  roomSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  roomSummaryItem: { alignItems: 'center' },
  roomSummaryValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  roomSummaryLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  divider: { height: 1, marginBottom: 14 },

  // ── Guest cards badge
  countBadge: {
    backgroundColor: EMERALD_LIGHT,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: EMERALD,
  },

  // ── Empty
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13, fontWeight: '600' },

  // ── Revenue
  revenueCard: {
    borderRadius: 20,
    padding: CARD_PADDING,
    borderWidth: 1,
  },
  revenueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  revenueTotal: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  revenueSubLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  revenueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  revenueBadgeText: { fontSize: 12, fontWeight: '700' },
  revenueLegend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontWeight: '500' },

  // ── Bottom nav
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 2,
    minHeight: 48,
    position: 'relative',
  },
  navPip: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 3,
    borderRadius: 2,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
