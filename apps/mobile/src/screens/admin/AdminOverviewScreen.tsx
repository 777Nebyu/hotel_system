/**
 * AdminOverviewScreen — Premium Platform Admin Dashboard
 *
 * Same design language as ManagerOverviewScreen:
 *   Primary:    Deep Sapphire  #0F2942
 *   Accent:     Luxury Gold   #D4AF37
 *   Background: Clean Canvas  #F8FAFC
 *   Text:       Deep Navy     #0F172A
 *   Cards:      White + soft shadow
 *
 * Admin-specific additions:
 *   — Platform-wide KPIs (hotels, users, bookings, revenue)
 *   — Alert strip for pending items needing action
 *   — Top hotels revenue ranking
 *   — Categorised admin navigation (Operations / Finance / Platform)
 *   — Dark mode + scroll-driven header border
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { signOut, saveSessionToStorage } from '../../store/authSlice';
import { request } from '../../api';
import { getStoredPushToken, deregisterPushToken } from '../../lib/notifications';
import { ErrorBox } from '../../components/Shared';
import { SkeletonCard } from '../../components/Skeleton';
import { useThemeColors, shadowCard } from '../../theme';
import { useTheme } from '../../hooks/useTheme';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const SIDE  = 16;
const PAD   = 16;

// ─── Types ────────────────────────────────────────────────────────────────────
interface OverviewData {
  hotelCount:       number;
  activeHotels?:    number;
  pendingHotels?:   number;
  userCount:        number;
  customerCount?:   number;
  staffCount?:      number;
  bookingCount:     number;
  activeBookings?:  number;
  pendingBookings?: number;
  totalRevenue:     number;
  monthRevenue?:    number;
  pendingPayments?: number;
  pendingDisputes?: number;
  flaggedReviews?:  number;
  topHotels?:       TopHotel[];
  recentActivity?:  ActivityItem[];
}

interface TopHotel {
  id:           string;
  name:         string;
  revenue?:     number;
  bookingCount?: number;
  status?:      string;
  starRating?:  number;
}

interface ActivityItem {
  id:        string;
  action:    string;
  entity:    string;
  entityId:  string;
  createdAt: string;
}

type Props = {
  onNavigate: (page: { screen: string } & Record<string, unknown>) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCurrency = (n: number) =>
  n >= 1_000_000
    ? `ETB ${(n / 1_000_000).toFixed(1)}M`
    : `ETB ${n.toLocaleString('en-ET')}`;

const fmtNumber = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const getDate = () =>
  new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

type C = ReturnType<typeof useThemeColors>;

/** Alert strip for items requiring admin attention */
function AlertItem({
  icon, label, count, color, bg, onPress, c, // eslint-disable-line @typescript-eslint/no-unused-vars
}: {
  icon: string; label: string; count: number; color: string; bg: string;
  onPress: () => void; c: C;
}) {
  if (count <= 0) return null;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        al.row,
        { backgroundColor: c.surface, borderColor: hexToRgba(color, 0.19) },
        pressed && { opacity: 0.8 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${count} items`}
    >
      <View style={[al.iconWrap, { backgroundColor: hexToRgba(color, 0.13) }]}>
        <Ionicons name={icon as any} size={16} color={color} />
      </View>
      <Text style={[al.label, { color: c.ink }]} numberOfLines={1}>{label}</Text>
      <View style={[al.badge, { backgroundColor: color }]}>
        <Text style={al.badgeText}>{count}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={c.inkMuted} />
    </Pressable>
  );
}
const al = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label:    { flex: 1, fontSize: 13, fontWeight: '600' },
  badge:    { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, minWidth: 24, alignItems: 'center' },
  badgeText:{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});

/** Top hotel ranking row */
function HotelRankRow({
  rank, hotel, c, onPress,
}: { rank: number; hotel: TopHotel; c: C; onPress: () => void }) {
  const stars = Math.min(5, Math.max(1, hotel.starRating ?? 4));
  const rankColors: Record<number, { bg: string; fg: string }> = {
    1: { bg: c.goldTint, fg: c.gold },
    2: { bg: c.clayLight, fg: c.inkSoft },
    3: { bg: c.brickTint, fg: c.brick },
  };
  const rc = rankColors[rank] ?? { bg: c.clayLight, fg: c.inkSoft };
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        hr.row,
        { borderBottomColor: c.line },
        pressed && { opacity: 0.75 },
      ]}
      accessibilityRole="button"
    >
      {/* Rank */}
      <View style={[hr.rankBadge, { backgroundColor: rc.bg }]}>
        <Text style={[hr.rankText, { color: rc.fg }]}>#{rank}</Text>
      </View>
      {/* Info */}
      <View style={hr.info}>
        <Text style={[hr.name, { color: c.ink }]} numberOfLines={1}>
          {hotel.name}
        </Text>
        <View style={hr.meta}>
          {[...Array(stars)].map((_, i) => (
            <Ionicons key={i} name="star" size={9} color={c.gold} />
          ))}
          <Text style={[hr.bookings, { color: c.inkMuted }]}>
            {`  ${hotel.bookingCount ?? 0} bookings`}
          </Text>
        </View>
      </View>
      {/* Revenue */}
      <Text style={[hr.revenue, { color: c.success }]}>
        {fmtCurrency(hotel.revenue ?? 0)}
      </Text>
    </Pressable>
  );
}
const hr = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rankBadge:  { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rankText:   { fontSize: 12, fontWeight: '800' },
  info:       { flex: 1 },
  name:       { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  meta:       { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  bookings:   { fontSize: 11, fontWeight: '500' },
  revenue:    { fontSize: 13, fontWeight: '800' },
});

/** Section header */
function SectionHeader({
  title, actionLabel, onAction, count, c,
}: { title: string; actionLabel?: string; onAction?: () => void; count?: number; c: C }) {
  return (
    <View style={sh.row}>
      <View style={sh.left}>
        <Text style={[sh.title, { color: c.ink }]}>{title}</Text>
        {count != null && count > 0 && (
          <View style={[sh.countBadge, { backgroundColor: c.tealTint }]}>
            <Text style={[sh.countText, { color: c.teal }]}>{count}</Text>
          </View>
        )}
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[sh.action, { color: c.teal }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
const sh = StyleSheet.create({
  row:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  left:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title:  { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  countBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  countText:  { fontSize: 11, fontWeight: '800' },
  action:     { fontSize: 13, fontWeight: '700' },
});

/** Admin nav item — settings-style row */
function NavRow({
  icon, label, color, bg, onPress, c, badge,
}: {
  icon: string; label: string; color: string; bg: string;
  onPress: () => void; c: C; badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        nr.row,
        {
          backgroundColor: c.surface,
          borderColor: c.line,
          opacity: pressed ? 0.75 : 1,
        },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[nr.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[nr.label, { color: c.ink }]} numberOfLines={1}>{label}</Text>
      {badge != null && badge > 0 && (
        <View style={[nr.badge, { backgroundColor: c.brick }]}>
          <Text style={nr.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color={c.inkMuted} />
    </Pressable>
  );
}
const nr = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  iconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label:    { flex: 1, fontSize: 15, fontWeight: '600', letterSpacing: -0.1 },
  badge:    { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  badgeText:{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function AdminOverviewScreen({ onNavigate }: Props) {
  const insets   = useSafeAreaInsets();
  const c        = useThemeColors();
  const { colorScheme } = useTheme();
  const statusBarStyle = colorScheme === 'dark' ? 'light-content' : 'dark-content';
  const s        = useMemo(() => makeStyles(c), [c]);
  const dispatch = useAppDispatch();

  const token    = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const session  = useAppSelector((s) => s.auth.session);
  const adminName = session?.user?.fullName?.split(' ')[0] ?? 'Admin';

  const [data,       setData]       = useState<OverviewData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const headerBorder = scrollY.interpolate({ inputRange: [20, 60], outputRange: [0, 1], extrapolate: 'clamp' });

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await request<OverviewData>('/admin/reports/overview', { method: 'GET', token });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of the admin panel?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              const pushToken = await getStoredPushToken();
              if (pushToken) await deregisterPushToken(pushToken);
              await request('/auth/logout', { method: 'POST', token });
            } catch {
              // Server logout failing is non-fatal — clear locally regardless
            } finally {
              await saveSessionToStorage(null as any);
              dispatch(signOut());
              setSigningOut(false);
            }
          },
        },
      ],
    );
  }, [dispatch, token]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const pendingAlerts = [
    { icon: 'business-outline',  label: 'Hotels awaiting approval',  count: data?.pendingHotels   ?? 0, color: c.gold,    bg: c.goldTint,  screen: 'AdminHotels'   },
    { icon: 'alert-circle',      label: 'Open customer disputes',     count: data?.pendingDisputes ?? 0, color: c.brick,   bg: c.brickTint,    screen: 'AdminDisputes' },
    { icon: 'star-outline',      label: 'Flagged reviews to moderate',count: data?.flaggedReviews  ?? 0, color: c.warning, bg: c.goldTint,  screen: 'AdminReviews'  },
    { icon: 'cash-outline',      label: 'Pending payment settlements',count: data?.pendingPayments ?? 0, color: c.info, bg: hexToRgba(c.info, 0.1), screen: 'AdminPayments' },
  ].filter(a => a.count > 0);

  const topHotels = data?.topHotels ?? [];

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={[s.root, { backgroundColor: c.paper }]}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={c.paper} />
      <View style={[s.headerShell, { paddingTop: insets.top + 8, backgroundColor: c.paper }]}>
        <View style={s.headerRow}>
          <View style={[s.headerBtn, { backgroundColor: c.surface, borderColor: c.line }]} />
          <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View style={[s.skelLine, { backgroundColor: c.line, width: 120 }]} />
            <View style={[s.skelLine, { backgroundColor: c.line, width: 180, height: 18 }]} />
          </View>
          <View style={[s.avatarBtn, { backgroundColor: c.line }]} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: SIDE, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <SkeletonCard /><SkeletonCard />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <SkeletonCard /><SkeletonCard />
        </View>
        <SkeletonCard />
        <SkeletonCard />
      </ScrollView>
    </View>
  );

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) return (
    <View style={[s.root, { backgroundColor: c.paper }]}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={c.paper} />
      <View style={[s.headerShell, { paddingTop: insets.top + 8, backgroundColor: c.paper }]}>
        <View style={s.headerBtn} />
      </View>
      <View style={s.center}><ErrorBox message={error} onRetry={load} /></View>
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: c.paper }]}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={c.paper} />

      {/* ── Fixed header ────────────────────────────────────────────────────── */}
      <Animated.View style={[
        s.headerShell,
        {
          paddingTop: insets.top + 8,
          backgroundColor: c.paper,
          borderBottomWidth: headerBorder as any,
          borderBottomColor: c.line,
        },
      ]}>
        <View style={s.headerRow}>
          {/* Spacer (AdminOverview is root — no back button) */}
          <View style={s.headerBtn} />

          {/* Center */}
          <View style={s.headerCenter}>
            <Text style={[s.headerGreeting, { color: c.inkMuted }]}>
              {getGreeting()}, {adminName} 👋
            </Text>
            <Text style={[s.headerTitle, { color: c.ink }]}>Platform Admin</Text>
            <Text style={[s.headerDate, { color: c.inkSoft }]}>{getDate()}</Text>
          </View>

          {/* Right: notifications + avatar */}
          <View style={s.headerRight}>
            <Pressable
              onPress={() => onNavigate({ screen: 'Notifications' })}
              hitSlop={6}
              style={[s.headerBtn, { backgroundColor: c.surface, borderColor: c.line }]}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={c.ink} />
            </Pressable>
            <Pressable
              style={[s.avatarBtn, { backgroundColor: c.umber }]}
              accessibilityRole="button"
              accessibilityLabel="Admin profile"
            >
              <Text style={s.avatarText}>
                {(session?.user?.fullName ?? 'A').charAt(0).toUpperCase()}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* ── Scrollable body ──────────────────────────────────────────────────── */}
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false },
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={c.teal}
            colors={[c.teal]}
          />
        }
      >

        {/* ── KPI Grid: 2 rows of 2 ───────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: c.ink, marginTop: 4 }]}>
          Platform Overview
        </Text>

        {/* Row 1: Hotels (hero) + Users */}
        <View style={s.kpiRow}>
          {/* Hero card — Hotels */}
          {/* Match the manager dashboard: emerald is the primary KPI surface. */}
          <View style={[s.kpiHero, { backgroundColor: c.teal }, shadowCard]}>
            <View style={s.kpiCircleA} />
            <View style={s.kpiCircleB} />
            <View style={s.kpiHeroBody}>
              <View style={s.kpiHeroTop}>
                <View style={[s.kpiHeroIcon, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Ionicons name="business" size={18} color="#FFFFFF" />
                </View>
                {(data?.activeHotels ?? 0) > 0 && (
                  <View style={s.kpiLiveBadge}>
                    <View style={s.kpiLiveDot} />
                    <Text style={s.kpiLiveText}>{data?.activeHotels} active</Text>
                  </View>
                )}
              </View>
              <Text style={s.kpiHeroValue}>{data?.hotelCount ?? 0}</Text>
              <Text style={s.kpiHeroLabel}>Total Hotels</Text>
              {(data?.pendingHotels ?? 0) > 0 && (
                <Text style={s.kpiHeroSub}>
                  {data?.pendingHotels} pending approval
                </Text>
              )}
            </View>
          </View>

          {/* Users card */}
          <View style={[s.kpiCard, { backgroundColor: c.surface, borderColor: c.line, flex: 1 }, shadowCard]}>
            <View style={s.kpiTop}>
              <View style={[s.kpiIcon, { backgroundColor: hexToRgba(c.teal, 0.1) }]}>
                <Ionicons name="people" size={16} color={c.teal} />
              </View>
            </View>
            <Text style={[s.kpiValue, { color: c.ink }]}>
              {fmtNumber(data?.userCount ?? 0)}
            </Text>
            <Text style={[s.kpiLabel, { color: c.inkSoft }]}>Total Users</Text>
            {(data?.customerCount ?? 0) > 0 && (
              <Text style={[s.kpiSub, { color: c.inkMuted }]}>
                {data?.customerCount} customers
              </Text>
            )}
          </View>
        </View>

        {/* Row 2: Bookings + Revenue */}
        <View style={s.kpiRow}>
          <View style={[s.kpiCard, { backgroundColor: c.surface, borderColor: c.line, flex: 1 }, shadowCard]}>
            <View style={s.kpiTop}>
              <View style={[s.kpiIcon, { backgroundColor: hexToRgba(c.warning, 0.1) }]}>
                <Ionicons name="calendar" size={16} color={c.warning} />
              </View>
              {(data?.activeBookings ?? 0) > 0 && (
                <View style={[s.kpiBadgeSm, { backgroundColor: c.tealTint }]}>
                  <Text style={[s.kpiBadgeSmText, { color: c.teal }]}>
                    {data?.activeBookings} live
                  </Text>
                </View>
              )}
            </View>
            <Text style={[s.kpiValue, { color: c.ink }]}>
              {fmtNumber(data?.bookingCount ?? 0)}
            </Text>
            <Text style={[s.kpiLabel, { color: c.inkSoft }]}>Total Bookings</Text>
          </View>

          {/* Revenue — gold accent */}
          <View style={[s.kpiCard, { backgroundColor: c.gold, borderColor: c.gold, flex: 1.3 }, shadowCard]}>
            <View style={s.kpiTop}>
              <View style={[s.kpiIcon, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                <Ionicons name="cash" size={16} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[s.kpiValue, { color: '#FFFFFF', fontSize: 17 }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmtCurrency(data?.totalRevenue ?? 0)}
            </Text>
            <Text style={[s.kpiLabel, { color: 'rgba(255,255,255,0.8)' }]}>Platform Revenue</Text>
            {(data?.monthRevenue ?? 0) > 0 && (
              <Text style={[s.kpiSub, { color: 'rgba(255,255,255,0.65)' }]}>
                {fmtCurrency(data?.monthRevenue ?? 0)} this month
              </Text>
            )}
          </View>
        </View>

        {/* ── Alerts: Items needing attention ──────────────────────────── */}
        {pendingAlerts.length > 0 && (
          <>
            <SectionHeader
              title="Needs Attention"
              count={pendingAlerts.length}
              c={c}
            />
            <View style={[s.alertCard, { backgroundColor: c.surface, borderColor: c.line }, shadowCard]}>
              {pendingAlerts.map((alert, i) => (
                <AlertItem
                  key={i}
                  icon={alert.icon}
                  label={alert.label}
                  count={alert.count}
                  color={alert.color}
                  bg={alert.bg}
                  onPress={() => onNavigate({ screen: alert.screen })}
                  c={c}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Top Hotels ranking ────────────────────────────────────────── */}
        {topHotels.length > 0 && (
          <>
            <SectionHeader
              title="Top Hotels"
              actionLabel="View All"
              onAction={() => onNavigate({ screen: 'AdminHotels' })}
              c={c}
            />
            <View style={[s.rankCard, { backgroundColor: c.surface, borderColor: c.line }, shadowCard]}>
              {topHotels.slice(0, 5).map((hotel, i) => (
                <HotelRankRow
                  key={hotel.id}
                  rank={i + 1}
                  hotel={hotel}
                  c={c}
                  onPress={() => onNavigate({ screen: 'AdminHotels', hotelId: hotel.id })}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Platform Administration ───────────────────────────────────── */}
        {/* Category 1: Operations */}
        <SectionHeader title="Operations" c={c} />
        <View>
          <NavRow icon="people"          label="Users & Role Management"    color={c.teal}       bg={hexToRgba(c.teal, 0.1)}    onPress={() => onNavigate({ screen: 'AdminUsers' })}      c={c} />
          <NavRow icon="business"        label="Hotels & Approvals"         color={c.tealDeep}   bg={c.tealTint}   onPress={() => onNavigate({ screen: 'AdminHotels' })}     c={c} badge={data?.pendingHotels} />
          <NavRow icon="calendar"        label="Platform Bookings"          color={c.warning}    bg={hexToRgba(c.warning, 0.1)} onPress={() => onNavigate({ screen: 'AdminBookings' })}   c={c} badge={data?.pendingBookings} />
          <NavRow icon="people-circle"   label="Staff–Hotel Assignment"     color={c.info}       bg={hexToRgba(c.info, 0.1)}    onPress={() => onNavigate({ screen: 'AdminStaffHotels' })} c={c} />
        </View>

        {/* Category 2: Finance */}
        <SectionHeader title="Finance" c={c} />
        <View>
          <NavRow icon="card"            label="Payment Transactions"       color={c.success}    bg={hexToRgba(c.success, 0.1)} onPress={() => onNavigate({ screen: 'AdminPayments' })}   c={c} />
          <NavRow icon="pricetag"        label="Coupons & Discounts"        color={c.brick}      bg={c.brickTint}         onPress={() => onNavigate({ screen: 'AdminCoupons' })}    c={c} />
          <NavRow icon="stats-chart"     label="Platform Reports"           color={c.teal}       bg={c.tealTint}          onPress={() => onNavigate({ screen: 'AdminReports' })}    c={c} />
        </View>

        {/* Category 3: Trust & Safety */}
        <SectionHeader title="Trust & Safety" c={c} />
        <View>
          <NavRow icon="star"            label="Review Moderation"          color={c.gold}       bg={c.goldTint}      onPress={() => onNavigate({ screen: 'AdminReviews' })}    c={c} badge={data?.flaggedReviews} />
          <NavRow icon="alert-circle"    label="Customer Disputes"          color={c.brick}      bg={c.brickTint}     onPress={() => onNavigate({ screen: 'AdminDisputes' })}   c={c} badge={data?.pendingDisputes} />
          <NavRow icon="warning"         label="Emergency Suspensions"      color={c.brick}      bg={c.brickTint}     onPress={() => onNavigate({ screen: 'AdminEmergency' })}  c={c} />
        </View>

        {/* Category 4: Platform */}
        <SectionHeader title="Platform" c={c} />
        <View>
          <NavRow icon="document-text"   label="Audit Trail Logs"           color={c.info}       bg={hexToRgba(c.info, 0.1)}       onPress={() => onNavigate({ screen: 'AdminAuditLog' })}   c={c} />
          <NavRow icon="settings"        label="Platform Settings"          color={c.inkSoft}    bg={c.clayLight}       onPress={() => onNavigate({ screen: 'AdminSettings' })}   c={c} />
          <NavRow icon="flag"            label="Feature Flags"              color={c.success}    bg={hexToRgba(c.success, 0.1)}   onPress={() => onNavigate({ screen: 'AdminFeatureFlags' })} c={c} />
        </View>

        {/* ── Admin identity footer + Sign Out ─────────────────────── */}
        <View style={[s.adminFooter, { borderTopColor: c.line }]}>
          <View style={[s.adminFooterAvatar, { backgroundColor: c.umber }]}>
            <Text style={s.adminFooterInitial}>
              {(session?.user?.fullName ?? 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={s.adminFooterInfo}>
            <Text style={[s.adminFooterName, { color: c.ink }]}>
              {session?.user?.fullName ?? 'Administrator'}
            </Text>
            <Text style={[s.adminFooterRole, { color: c.inkSoft }]}>
              {session?.user?.email ?? 'admin@luxsty.com'}
            </Text>
          </View>
          <View style={[s.adminRolePill, { backgroundColor: c.umber }]}>
            <Text style={s.adminRolePillText}>ADMIN</Text>
          </View>
        </View>

        {/* Sign Out button — separate from the footer card for clarity */}
        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          style={({ pressed }) => [
            s.signOutBtn,
            { borderColor: hexToRgba(c.brick, 0.25), backgroundColor: c.brickTint },
            (pressed || signingOut) && { opacity: 0.7 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={18} color={c.brick} />
          <Text style={[s.signOutText, { color: c.brick }]}>
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </Text>
        </Pressable>

      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(_c: C) { // eslint-disable-line @typescript-eslint/no-unused-vars
  return StyleSheet.create({
    root:   { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    body:   { paddingHorizontal: SIDE, paddingTop: 12 },

    // ── Header
    headerShell: {
      paddingHorizontal: SIDE,
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
    headerTitle: {
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
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
    skelLine: { borderRadius: 8, height: 14 },

    // ── Section title (inline)
    sectionTitle: {
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: -0.3,
    },

    // ── KPI rows
    kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 0 },

    // Hero card
    kpiHero: {
      flex: 1.4,
      borderRadius: 20,
      padding: PAD,
      overflow: 'hidden',
      minHeight: 160,
      marginBottom: 10,
    },
    kpiCircleA: {
      position: 'absolute',
      width: 130,
      height: 130,
      borderRadius: 65,
      backgroundColor: 'rgba(255,255,255,0.06)',
      top: -40,
      right: -25,
    },
    kpiCircleB: {
      position: 'absolute',
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'rgba(255,255,255,0.04)',
      bottom: 10,
      left: -10,
    },
    kpiHeroBody:  { flex: 1, justifyContent: 'flex-end' },
    kpiHeroTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    kpiHeroIcon:  { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    kpiLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(22,163,74,0.2)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
    kpiLiveDot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
    kpiLiveText:  { color: '#4ADE80', fontSize: 11, fontWeight: '700' },
    kpiHeroValue: { color: '#FFFFFF', fontSize: 40, fontWeight: '800', letterSpacing: -1, lineHeight: 44 },
    kpiHeroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginTop: 2 },
    kpiHeroSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },

    // Regular card
    kpiCard: {
      borderRadius: 20,
      padding: PAD,
      borderWidth: 1,
      marginBottom: 10,
      justifyContent: 'flex-end',
      gap: 4,
      minHeight: 130,
    },
    kpiTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    kpiIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kpiBadgeSm:     { borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
    kpiBadgeSmText: { fontSize: 10, fontWeight: '700' },
    kpiValue: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    kpiLabel: { fontSize: 12, fontWeight: '600' },
    kpiSub:   { fontSize: 11, fontWeight: '500', marginTop: 1 },

    // ── Alert card wrapper
    alertCard: {
      borderRadius: 18,
      padding: 12,
      borderWidth: 1,
    },

    // ── Rank card wrapper
    rankCard: {
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
      borderWidth: 1,
    },

    // ── Admin footer
    adminFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 28,
      paddingTop: 20,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    adminFooterAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adminFooterInitial: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
    adminFooterInfo:    { flex: 1 },
    adminFooterName:    { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    adminFooterRole:    { fontSize: 12, fontWeight: '500', marginTop: 1 },
    adminRolePill: {
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    adminRolePillText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
    },

    // ── Sign Out button
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      marginBottom: 8,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1,
    },
    signOutText: {
      fontSize: 15,
      fontWeight: '700',
    },
  });
}
