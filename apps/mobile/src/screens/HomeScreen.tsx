import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootStackParamList } from '../navigation/types';
import type { TabParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import {
  useFeaturedHotels,
  useBookingHistory,
  useToggleFavorite,
  useFavorites,
  useNotificationUnreadCount,
} from '../hooks/useQueries';
import { SkeletonCard } from '../components/Skeleton';
import { ErrorBox } from '../components/Shared';
import { FadeInCard } from '../components/FadeIn';
import { colors, darkColors, useResponsivePadding } from '../theme';
import { useTheme } from '../hooks/useTheme';
import type { HotelSummary, Booking } from '../types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'HomeTab'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const FALLBACK = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&h=600&fit=crop&auto=format';

function statusChip(status: string, dark: boolean): { bg: string; fg: string; labelKey: string } {
  if (dark) {
    switch (status) {
      case 'CONFIRMED': return { bg: '#052E16', fg: '#4ADE80', labelKey: 'status.confirmed' };
      case 'PENDING': return { bg: '#422006', fg: '#FBBF24', labelKey: 'status.pending' };
      case 'CHECKED_IN': return { bg: '#172554', fg: '#60A5FA', labelKey: 'status.checked_in' };
      default: return { bg: '#1F3448', fg: '#8FA1B3', labelKey: status };
    }
  }
  switch (status) {
    case 'CONFIRMED': return { bg: '#DBEAFE', fg: '#0F2942', labelKey: 'status.confirmed' };
    case 'PENDING': return { bg: '#FFF4D6', fg: '#B45309', labelKey: 'status.pending' };
    case 'CHECKED_IN': return { bg: '#DBEAFE', fg: '#1D4ED8', labelKey: 'status.checked_in' };
    default: return { bg: '#E5E7EB', fg: '#475569', labelKey: status };
  }
}

const UpcomingBanner = React.memo(function UpcomingBanner({ booking, onPress, dark }: { booking: Booking; onPress: () => void; dark: boolean }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const chip = statusChip(booking.status, dark);
  const checkIn = new Date(booking.checkIn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const checkOut = new Date(booking.checkOut).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const imgUrl = booking.hotel?.images?.[0]?.url ?? FALLBACK;
  const c = dark ? darkColors : colors;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.upcomingCard, { backgroundColor: c.surface, borderColor: c.line }, pressed && { opacity: 0.96, transform: [{ scale: 0.995 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`Upcoming stay at ${booking.hotel?.name ?? 'hotel'}, ${checkIn} to ${checkOut}`}
    >
      <View style={styles.upcomingHeader}>
        <View style={[styles.upcomingChip, { backgroundColor: chip.bg }]}>
          <View style={[styles.upcomingDot, { backgroundColor: chip.fg }]} />
          <Text style={[styles.upcomingChipText, { color: chip.fg }]}>{chip.labelKey.startsWith('status.') ? t(chip.labelKey) : chip.labelKey}</Text>
        </View>
        <View style={styles.upcomingManage}>
          <Text style={[styles.upcomingManageText, { color: c.teal }]}>{t('common.details')}</Text>
          <Ionicons name="chevron-forward" size={14} color={c.teal} />
        </View>
      </View>

      <View style={styles.upcomingContent}>
        <Image source={{ uri: imgUrl }} style={[styles.upcomingThumb, { width: width < 360 ? 72 : 96, height: width < 360 ? 66 : 88 }]} contentFit="cover" transition={220} placeholder={{ blurhash: 'LKO2?U42NwRn4jEYJMROM[~q?xRP' }} />
        <View style={styles.upcomingInfo}>
          <Text style={[styles.upcomingHotel, { color: c.ink }]} numberOfLines={1}>{booking.hotel?.name ?? 'Hotel Stay'}</Text>
          <View style={styles.upcomingRow}>
            <Ionicons name="calendar-outline" size={13} color={c.inkMuted} />
            <Text style={[styles.upcomingDates, { color: c.inkMuted }]}>{checkIn} – {checkOut}</Text>
          </View>
          {booking.reference ? <Text style={[styles.upcomingRef, { color: c.inkSoft }]}>{t('home.ref')} {booking.reference}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
});

const HotelCard = React.memo(function HotelCard({ hotel, isFav, onPress, onToggleFav, dark }: { hotel: HotelSummary; isFav: boolean; onPress: () => void; onToggleFav: () => void; dark: boolean }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const hotelImgHeight = width < 360 ? 170 : width < 390 ? 200 : 230;
  const stars = Math.min(5, Math.max(0, hotel.starRating || 4));
  const c = dark ? darkColors : colors;

  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={({ pressed }) => [styles.hotelCard, { backgroundColor: c.surface, borderColor: c.line }, pressed && { opacity: 0.97, transform: [{ scale: 0.995 }] }]}>
      <View style={[styles.hotelImgWrap, { height: hotelImgHeight }]}>
        <Image source={{ uri: hotel.primaryImageUrl ?? FALLBACK }} style={styles.hotelImg} contentFit="cover" transition={220} placeholder={{ blurhash: 'LKO2?U42NwRn4jEYJMROM[~q?xRP' }} />
        <View style={[styles.starPill, { backgroundColor: dark ? 'rgba(15,23,42,0.55)' : 'rgba(15,23,42,0.45)' }]}>
          <Ionicons name="star" size={10} color="#FBBF24" />
          <Text style={[styles.starPillText, { color: '#FFFFFF' }]}>{hotel.averageRating != null ? hotel.averageRating.toFixed(1) : 'New'}</Text>
        </View>
        <Pressable onPress={onToggleFav} hitSlop={10} accessibilityRole="button" style={[styles.favBtn, { backgroundColor: dark ? 'rgba(15,23,42,0.5)' : 'rgba(15,23,42,0.4)' }]}>
          <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={18} color={isFav ? '#F87171' : '#FFFFFF'} />
        </Pressable>
      </View>

      <View style={[styles.hotelBody, { backgroundColor: c.surface }]}>
        <View style={styles.hotelMetaRow}>
          {Array.from({ length: 5 }).map((_, idx) => (
            <Ionicons key={idx} name={idx < stars ? 'star' : 'star-outline'} size={11} color={idx < stars ? '#FBBF24' : c.inkMuted} />
          ))}
          <Text style={[styles.ratingText, { color: c.inkMuted }]}>{hotel.reviewCount > 0 ? `${hotel.reviewCount} reviews` : 'No reviews yet'}</Text>
        </View>

        <Text style={[styles.hotelName, { color: c.ink }]} numberOfLines={1}>{hotel.name}</Text>
        <View style={styles.hotelLocRow}>
          <Ionicons name="location-outline" size={12} color={c.inkMuted} />
          <Text style={[styles.hotelLoc, { color: c.inkMuted }]} numberOfLines={1}>{hotel.city?.name}{hotel.city?.country?.name ? `, ${hotel.city.country.name}` : ''}</Text>
        </View>

        <View style={styles.facilityRow}>
          {(hotel.amenities ?? []).slice(0, 3).map((item) => (
            <View key={item} style={[styles.facilityPill, { backgroundColor: c.clay }]}><Text style={[styles.facilityText, { color: c.inkSoft }]}>{item}</Text></View>
          ))}
        </View>

        <View style={styles.hotelFooter}>
          <View>
            <Text style={[styles.fromLabel, { color: c.inkMuted }]}>from</Text>
            <Text style={[styles.hotelPrice, { color: c.ink }]}>{hotel.minPricePerNight != null ? `ETB ${hotel.minPricePerNight}` : 'Check availability'}{hotel.minPricePerNight != null ? <Text style={[styles.perNight, { color: c.inkMuted }]}> /night</Text> : null}</Text>
          </View>
          <Pressable style={[styles.viewRoomsBtn, { backgroundColor: c.teal }]} onPress={onPress} accessibilityRole="button">
            <Text style={styles.viewRoomsText}>{t('home.view_rooms')}</Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

function SectionHeader({ title, onSeeAll, textPri, textSec }: { title: string; onSeeAll?: () => void; textPri?: string; textSec?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: textPri ?? colors.ink }]}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={[styles.seeAll, { color: textSec ?? colors.inkMuted }]}>{t('common.see_all')}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const pad = useResponsivePadding();
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';
  const firstName = session?.user.fullName?.split(' ')[0] ?? 'Guest';

  const { data: featuredData, isLoading, error: featuredError, refetch, isRefetching } = useFeaturedHotels(token);
  const { data: bookingsData } = useBookingHistory(token, 'upcoming');
  const { data: favData } = useFavorites(token);
  const { data: notifData } = useNotificationUnreadCount(token);
  const unreadCount = notifData?.unreadCount ?? 0;
  const toggleFav = useToggleFavorite(token);

  const hotels = featuredData?.data ?? [];
  const upcoming = (bookingsData?.data ?? []).filter((b) => ['CONFIRMED', 'PENDING', 'CHECKED_IN'].includes(b.status));
  const nextTrip = upcoming[0] ?? null;
  const favoriteIds = useMemo(() => new Set<string>((Array.isArray(favData) ? favData : (favData as any)?.data ?? []).map((f: any) => f.id as string)), [favData]);

  const goToSearch = useCallback(() => navigation.navigate('Search'), [navigation]);
  const goToHotel = useCallback((id: string) => navigation.navigate('HotelDetail', { hotelId: id }), [navigation]);
  const goToBooking = useCallback((id: string) => navigation.navigate('BookingDetail', { bookingId: id }), [navigation]);

  const handleToggleFav = useCallback((hotel: HotelSummary) => {
    if (!session) {
      navigation.navigate('Auth', { initialMode: 'login' });
      return;
    }
    if (toggleFav.isPending) return;
    toggleFav.mutate({ hotelId: hotel.id, isFavorite: favoriteIds.has(hotel.id) });
  }, [session, navigation, toggleFav, favoriteIds]);

  const palette = dark ? darkColors : colors;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
        backgroundColor={dark ? '#0B1220' : '#F5F4F8'}
      />
      <ScrollView
        style={[styles.root, { backgroundColor: dark ? '#0B1220' : '#F5F4F8' }]}
        contentContainerStyle={[styles.content, { paddingHorizontal: pad, paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={palette.teal} colors={[palette.teal]} progressViewOffset={insets.top} />}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.brandHeader, { color: palette.teal }]}>LuxSty</Text>
          <Text style={[styles.greeting, { color: dark ? '#B6C3D9' : colors.inkMuted }]}>{greeting},</Text>
          <Text style={[styles.greetingName, { color: dark ? '#F8FAFC' : colors.ink }]}>{firstName} 👋</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={8} accessibilityRole="button" style={[styles.notifBtn, { backgroundColor: dark ? '#182333' : '#FFFFFF', borderColor: dark ? '#24324A' : colors.line }]}
        >
          <Ionicons name="notifications-outline" size={22} color={dark ? '#F8FAFC' : colors.ink} />
          {unreadCount > 0 && (<View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>)}
        </Pressable>
      </View>

      {/* Booking Search Card (§6) */}
      <View style={[styles.heroCard, { backgroundColor: dark ? '#101C2D' : '#FFFFFF', borderColor: dark ? '#20304A' : '#E5E7EB' }]}>
        <Text style={[styles.heroHeadline, { color: dark ? '#F8FAFC' : colors.ink }]}>{t('home.find_perfect')}</Text>
        <Text style={[styles.heroSubheadline, { color: dark ? '#9DB1C9' : '#64748B' }]}>{t('home.book_luxury')}</Text>

        <Pressable onPress={goToSearch} style={({ pressed }) => [styles.searchPill, { backgroundColor: dark ? '#17263B' : '#F8FAFC', borderColor: dark ? '#24324A' : '#E2E8F0' }, pressed && { opacity: 0.9 }]}>
          <Ionicons name="location-outline" size={18} color={palette.teal} />
          <View style={styles.flex}>
            <Text style={[styles.pillLabel, { color: dark ? '#9DB1C9' : '#64748B' }]}>{t('home.location_hotel')}</Text>
            <Text style={[styles.pillValue, { color: dark ? '#F8FAFC' : colors.ink }]}>{t('home.where_going')}</Text>
          </View>
        </Pressable>

        <View style={styles.searchRow}>
          <Pressable onPress={goToSearch} style={[styles.searchHalfPill, { backgroundColor: dark ? '#17263B' : '#F8FAFC', borderColor: dark ? '#24324A' : '#E2E8F0' }]}>
            <Ionicons name="calendar-outline" size={16} color={palette.teal} />
            <View style={styles.flex}>
              <Text style={[styles.pillLabel, { color: dark ? '#9DB1C9' : '#64748B' }]}>{t('home.dates')}</Text>
              <Text style={[styles.pillValueSmall, { color: dark ? '#F8FAFC' : colors.ink }]}>{t('home.check_in_out')}</Text>
            </View>
          </Pressable>

          <Pressable onPress={goToSearch} style={[styles.searchHalfPill, { backgroundColor: dark ? '#17263B' : '#F8FAFC', borderColor: dark ? '#24324A' : '#E2E8F0' }]}>
            <Ionicons name="people-outline" size={16} color={palette.teal} />
            <View style={styles.flex}>
              <Text style={[styles.pillLabel, { color: dark ? '#9DB1C9' : '#64748B' }]}>{t('home.guests_rooms')}</Text>
              <Text style={[styles.pillValueSmall, { color: dark ? '#F8FAFC' : colors.ink }]}>2 Guests · 1 Room</Text>
            </View>
          </Pressable>
        </View>

        <Pressable
          onPress={goToSearch}
          style={({ pressed }) => [
            styles.checkAvailBtn,
            { backgroundColor: palette.teal },
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('home.check_availability')}
        >
          <Text style={styles.checkAvailBtnText}>{t('home.check_availability')}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      {nextTrip && (
        <View style={styles.section}>
          <SectionHeader title={t('home.upcoming_trip')} textPri={dark ? '#F8FAFC' : colors.ink} textSec={dark ? '#B6C3D9' : colors.inkMuted} />
          <UpcomingBanner booking={nextTrip} onPress={() => goToBooking(nextTrip.id)} dark={dark} />
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title={nextTrip ? t('home.recommended') : t('home.featured')} onSeeAll={goToSearch} textPri={dark ? '#F8FAFC' : colors.ink} textSec={dark ? '#B6C3D9' : colors.inkMuted} />
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : featuredError ? (
          <ErrorBox message={featuredError instanceof Error ? featuredError.message : 'Failed to load hotels'} onRetry={refetch} />
        ) : hotels.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: dark ? '#101C2D' : '#FFFFFF', borderColor: dark ? '#20304A' : '#E2E8F0' }]}>
            <Ionicons name="bed-outline" size={38} color={dark ? '#9DB1C9' : '#64748B'} />
            <Text style={[styles.emptyTitle, { color: dark ? '#F8FAFC' : colors.ink }]}>{t('home.no_hotels')}</Text>
            <Text style={[styles.emptySubtitle, { color: dark ? '#B6C3D9' : '#64748B' }]}>{t('home.check_back')}</Text>
          </View>
        ) : (
          hotels.slice(0, 3).map((hotel, i) => (
            <FadeInCard key={hotel.id} index={i}>
              <HotelCard hotel={hotel} isFav={favoriteIds.has(hotel.id)} onPress={() => goToHotel(hotel.id)} onToggleFav={() => handleToggleFav(hotel)} dark={dark} />
            </FadeInCard>
          ))
        )}
      </View>

      {!session && (
        <Pressable onPress={() => navigation.navigate('Auth', { initialMode: 'login' })} style={[styles.signInNudge, { backgroundColor: dark ? '#101C2D' : '#FFFFFF', borderColor: dark ? '#20304A' : '#E2E8F0' }]}>
          <Ionicons name="person-circle-outline" size={28} color={palette.teal} />
          <View style={styles.nudgeText}>
            <Text style={[styles.nudgeTitle, { color: dark ? '#F8FAFC' : colors.ink }]}>{t('home.sign_in_tailored')}</Text>
            <Text style={[styles.nudgeSub, { color: dark ? '#B6C3D9' : '#64748B' }]}>{t('home.save_favorites')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={dark ? darkColors.inkMuted : colors.inkMuted} />
        </Pressable>
      )}
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  greeting: { fontSize: 13, fontWeight: '500' },
  greetingName: { fontSize: 24, fontWeight: '700', letterSpacing: -0.4 },
  notifBtn: { position: 'relative', width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  notifBadge: { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff' },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  heroCard: { borderRadius: 24, borderWidth: 1, padding: 18, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  brandHeader: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginBottom: 2 },
  heroHeadline: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginBottom: 4 },
  heroSubheadline: { fontSize: 13, fontWeight: '500', lineHeight: 18, marginBottom: 14 },
  searchPill: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 10, marginBottom: 10 },
  flex: { flex: 1 },
  pillLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  pillValue: { fontSize: 14, fontWeight: '600' },
  pillValueSmall: { fontSize: 12, fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  searchHalfPill: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 10, gap: 8 },
  checkAvailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, gap: 8, marginTop: 2 },
  checkAvailBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 0.8 },

  section: { marginBottom: 22 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  seeAll: { fontSize: 13, fontWeight: '700' },

  upcomingCard: { borderRadius: 22, padding: 14, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  upcomingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  upcomingChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, gap: 6 },
  upcomingDot: { width: 6, height: 6, borderRadius: 3 },
  upcomingChipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  upcomingManage: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  upcomingManageText: { fontSize: 12, fontWeight: '700' },
  upcomingContent: { flexDirection: 'row', gap: 12 },
  upcomingThumb: { width: 96, height: 88, borderRadius: 14 },
  upcomingInfo: { flex: 1, justifyContent: 'center' },
  upcomingHotel: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  upcomingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  upcomingDates: { fontSize: 12, fontWeight: '600' },
  upcomingRef: { fontSize: 11, marginTop: 4 },

  hotelCard: { borderRadius: 22, overflow: 'hidden', borderWidth: 1, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  hotelImgWrap: { position: 'relative', height: 210 },
  hotelImg: { width: '100%', height: '100%' },
  starPill: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 },
  starPillText: { fontSize: 11, fontWeight: '700' },
  favBtn: { position: 'absolute', right: 12, top: 12, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  hotelBody: { padding: 14 },
  hotelMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 8 },
  ratingText: { fontSize: 11, marginLeft: 6 },
  hotelName: { fontSize: 20, fontWeight: '700', letterSpacing: -0.25, marginBottom: 6 },
  hotelLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  hotelLoc: { flex: 1, fontSize: 12 },
  facilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  facilityPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6 },
  facilityText: { fontSize: 10, fontWeight: '600' },
  hotelFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fromLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7 },
  hotelPrice: { fontWeight: '800', fontSize: 18 },
  perNight: { fontSize: 12, fontWeight: '600' },
  viewRoomsBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  viewRoomsText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  signInNudge: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, borderWidth: 1, gap: 12, marginTop: 4 },
  nudgeText: { flex: 1 },
  nudgeTitle: { fontSize: 16, fontWeight: '700' },
  nudgeSub: { fontSize: 12, marginTop: 2 },

  emptyState: { borderRadius: 20, borderWidth: 1, paddingVertical: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 10 },
  emptySubtitle: { fontSize: 12, marginTop: 6 },
});
