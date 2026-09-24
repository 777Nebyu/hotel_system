import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import {
  useHotelDetail,
  useHotelRooms,
  useHotelReviews,
  useFavorites,
  useToggleFavorite,
} from '../hooks/useQueries';
import { useResponsive } from '../hooks/useResponsive';
import { request } from '../api';
import { Button, Card, ErrorBox, Stars } from '../components/Shared';
import { SkeletonDetail } from '../components/Skeleton';
import ReviewCard from '../components/ReviewCard';
import { RoomCard } from '../components/BookingComponents';
import type { Room } from '../types';
import { colors, darkColors, font, radius, shadowCard } from '../theme';
import { useTheme } from '../hooks/useTheme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'HotelDetail'>;

const TABS = ['Overview', 'Rooms', 'Amenities', 'Reviews', 'Policies'];
const FALLBACK =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&h=800&fit=crop&auto=format';

const makeStyles = (c: any, r: any, dark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  content: { paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.paper },
  flex: { flex: 1 },

  /* ─── Breadcrumb ─── */
  breadcrumbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: r.pad,
    paddingVertical: 14,
  },
  backText: { color: c.teal, fontSize: r.bodySmall, fontWeight: '600' },
  breadcrumb: { color: c.inkMuted, fontSize: r.caption, flex: 1, textAlign: 'center', marginHorizontal: 8 },

  /* ─── Gallery ─── */
  galleryWrap: { paddingHorizontal: r.pad, gap: 8 },
  galleryMain: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.card, overflow: 'hidden' },
  galleryThumbs: { flexDirection: 'row', gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: 10, borderWidth: 2, borderColor: c.surface },
  thumbActive: { borderColor: c.teal },
  thumbMore: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMoreText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  /* ─── Hotel header ─── */
  hotelHeader: { paddingHorizontal: r.pad, paddingTop: 16 },
  hotelMeta: { gap: 4 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  starAmber: { color: '#F59E0B', fontSize: 14 },
  starBadge: {
    backgroundColor: dark ? '#1A1A00' : '#F0FDFA',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: c.gold + '50',
  },
  starBadgeText: { color: c.gold, fontSize: 11, fontWeight: '700' },
  hotelName: {
    fontFamily: font.display,
    color: c.ink,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  hotelAddr: { color: c.inkMuted, fontSize: 14, marginTop: 2 },

  /* ─── Rating strip ─── */
  ratingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: r.pad,
    borderWidth: 1,
    borderColor: c.line,
    padding: 14,
  },
  ratingLeft: { alignItems: 'center', minWidth: 50 },
  ratingScore: { fontFamily: font.display, fontSize: 32, fontWeight: '700', color: c.ink },
  ratingLabel: { color: c.inkMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  ratingBar: { flex: 1, gap: 8 },
  ratingDesc: { color: c.inkMuted, fontSize: 12, lineHeight: 17 },
  ratingTrack: { height: 6, backgroundColor: c.line, borderRadius: 3 },
  ratingFill: { height: 6, backgroundColor: c.teal, borderRadius: 3 },
  ratingRight: { alignItems: 'center', minWidth: 40 },
  reviewCount: { fontFamily: font.display, fontSize: 20, fontWeight: '700', color: c.ink },

  /* ─── Tabs ─── */
  tabsWrap: { marginTop: 16, borderBottomWidth: 1, borderBottomColor: c.line },
  tabsContent: { paddingHorizontal: r.pad, gap: 0 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabText: { fontSize: r.body, fontWeight: '500', color: c.inkMuted },
  tabBody: { padding: r.pad },

  /* ─── Overview ─── */
  description: { color: c.inkSoft, fontSize: 14, lineHeight: 22 },

  /* ─── Rooms ─── */
  roomsList: { gap: 12 },
  roomCard: { gap: 10 },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  roomType: { fontFamily: font.display, color: c.ink, fontSize: 17, fontWeight: '600' },
  roomMeta: { color: c.inkMuted, fontSize: 12, marginTop: 2 },
  roomPriceBlock: { alignItems: 'flex-end', gap: 4 },
  roomPrice: { color: c.teal, fontSize: 16, fontWeight: '800' },
  perNight: { color: c.inkMuted, fontSize: 11, fontWeight: '400' },
  roomDesc: { color: c.inkSoft, fontSize: 13, lineHeight: 19 },
  roomAmenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roomAmenityPill: {
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  roomAmenityText: { color: c.inkMuted, fontSize: 11 },
  muted: { color: c.inkMuted, fontSize: 14 },

  /* ─── Amenities ─── */
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  amenityCheck: { color: c.teal, fontSize: 13, fontWeight: '700' },
  amenityText: { color: c.inkSoft, fontSize: 13, fontWeight: '500' },

  /* ─── Reviews ─── */
  reviewsList: { gap: 10 },
  reviewActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  editReview: { color: c.teal, fontSize: 12, fontWeight: '600' },

  /* ─── Policies ─── */
  policiesCard: { gap: 14 },
  policyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  policyIcon: { fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  policyLabel: { fontSize: 13, fontWeight: '600', color: c.ink },
  policyValue: { fontSize: 13, color: c.inkMuted, marginTop: 2, lineHeight: 18 },

  /* ─── Location ─── */
  section: { paddingHorizontal: r.pad, paddingBottom: 8 },
  sectionTitle: {
    fontFamily: font.display,
    color: c.ink,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  locationCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationAddr: { fontSize: 14, fontWeight: '600', color: c.ink },
  locationCoords: { color: c.inkMuted, fontSize: 12, marginTop: 2 },
  locationLink: { color: c.teal, fontSize: 13, fontWeight: '600' },

  /* ─── Sticky footer ─── */
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: r.pad,
    paddingVertical: 14,
  },
  footerLabel: { color: c.inkMuted, fontSize: 11 },
  footerFrom: { color: c.inkMuted, fontSize: 11 },
  footerPrice: { color: c.ink, fontSize: 22, fontWeight: '800' },
  footerPerNight: { color: c.inkMuted, fontSize: 12, fontWeight: '400' },
  footerRating: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  footerRatingText: { color: c.inkMuted, fontSize: 11 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});

export default function HotelDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const r = useResponsive();
  const { colors: c, colorScheme } = useTheme();
  const dark   = colorScheme === 'dark';
  const hotelId = route.params?.hotelId ?? '';
  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';

  const flowCheckIn = useAppSelector((s) => s.bookingFlow.checkIn);
  const flowCheckOut = useAppSelector((s) => s.bookingFlow.checkOut);
  const flowAdults = useAppSelector((s) => s.bookingFlow.adults);
  const flowChildren = useAppSelector((s) => s.bookingFlow.childrenCount);
  const totalGuests = (parseInt(flowAdults) || 1) + (parseInt(flowChildren) || 0);

  const defaultCheckIn = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const defaultCheckOut = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const effectiveCheckIn = flowCheckIn || defaultCheckIn;
  const effectiveCheckOut = flowCheckOut || defaultCheckOut;

  const { data: hotel, isLoading, error, refetch } = useHotelDetail(token, hotelId);
  const { data: roomsData } = useHotelRooms(token, hotelId, effectiveCheckIn, effectiveCheckOut);
  const { data: reviewsData } = useHotelReviews(token, hotelId);
  const { data: favoritesData } = useFavorites(token);
  const toggleFavorite = useToggleFavorite(token);

  const reviews = reviewsData?.data ?? [];
  const favorites: any[] = Array.isArray(favoritesData)
    ? favoritesData
    : (favoritesData as any)?.data ?? [];
  const isFavorite = favorites.some((f: any) => f.id === hotelId);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('Overview');
  const [policies, setPolicies] = useState<{
    checkInTime?: string;
    checkOutTime?: string;
    cancellationHours?: number;
    cancellationPolicy?: string;
    houseRules?: string;
    childPolicy?: string;
    petPolicy?: string;
  } | null>(null);

  useEffect(() => {
    if (!hotelId) return;
    request<{ data: any }>(`/catalog/hotels/${hotelId}/policy`, { token })
      .then((res) => setPolicies(res.data ?? res))
      .catch(() => {});
  }, [hotelId, token]);

  const handleBookRoom = useCallback(
    (room: Room) => {
      if (!session) {
                      Alert.alert(t('common.sign_in_required'), t('hotelDetail.signin_booking'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.sign_in'), onPress: () => navigation.navigate('Auth', { initialMode: 'login' }) },
        ]);
        return;
      }
      navigation.navigate('RoomDetail', {
        room,
        hotelName: hotel?.name ?? '',
        hotelId,
        checkIn: '',
        checkOut: '',
        hotelImages: hotel?.images,
        guests: { adults: parseInt(flowAdults) || 2, children: parseInt(flowChildren) || 0 },
      });
    },
    [navigation, session, hotel, hotelId, flowAdults, flowChildren, t],
  );

  const handleToggleFavorite = useCallback(() => {
    if (!session) {
      Alert.alert(t('common.sign_in_required'), t('hotelDetail.signin_favorites'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.sign_in'), onPress: () => navigation.navigate('Auth', { initialMode: 'login' }) },
      ]);
      return;
    }
    if (toggleFavorite.isPending) return;
    toggleFavorite.mutate({ hotelId, isFavorite });
  }, [session, navigation, toggleFavorite, hotelId, isFavorite, t]);

  const styles = useMemo(() => makeStyles(c, r, dark), [c, r, dark]);

  if (!hotelId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: '#888' }}>{t('hotel.not_found')}</Text>
        <Button title={t('common.go_back')} onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (isLoading) return <View style={styles.center}><SkeletonDetail /></View>;
  if (error) return <View style={styles.center}><ErrorBox message={error.message} onRetry={refetch} /></View>;
  if (!hotel) return null;

  const images = hotel.images ?? [];
  const gallery = images.length
    ? images.map((i: any) => i.url)
    : [FALLBACK];
  const activeImageUrl = gallery[activeImageIndex] ?? gallery[0];

  // Use availability data with seasonal pricing when dates are provided
  const roomsWithAvailability = roomsData?.data ?? roomsData;
  const lowestPrice = Array.isArray(roomsWithAvailability) && roomsWithAvailability.length > 0
    ? Math.min(...roomsWithAvailability.map((r: any) => Number(r.minPrice ?? r.basePrice ?? Infinity)).filter((p: number) => isFinite(p) && p > 0))
    : hotel.rooms?.length
      ? Math.min(...hotel.rooms.map((r: any) => Number(r.basePrice)))
      : null;

  return (
    <View style={[styles.container, { backgroundColor: c.paper }]}>
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
        backgroundColor={c.paper}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ─── Header row — OT.md §6: respects notch/status bar ─── */}
        <View style={[styles.breadcrumbRow, {
          paddingTop: insets.top + 10,
          paddingHorizontal: r.pad,
          backgroundColor: c.surface,
          borderBottomColor: c.line,
        }]}>
          {/* OT.md §9: 44×44 back button */}
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={4}
            style={[styles.backBtn, { backgroundColor: dark ? c.clay : 'rgba(15,23,42,0.06)' }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.go_back_nav')}
          >
            <Ionicons name="arrow-back" size={22} color={c.ink} />
          </Pressable>
          <Text style={[styles.breadcrumb, { color: c.inkMuted, fontSize: r.caption }]} numberOfLines={1}>
            {hotel.city?.name ? `Hotels / ${hotel.city.name}` : 'Hotels'}
          </Text>
          {/* OT.md §9: 44×44 favourite button */}
          <Pressable
            onPress={handleToggleFavorite}
            disabled={toggleFavorite.isPending}
            hitSlop={4}
            style={[styles.backBtn, { backgroundColor: isFavorite ? '#FEF2F2' : (dark ? c.clay : 'rgba(15,23,42,0.06)') }]}
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove from saved' : 'Save hotel'}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? '#EF4444' : c.inkMuted}
            />
          </Pressable>
        </View>

        {/* ─── Gallery ─── */}
        <View style={[styles.galleryWrap, { paddingHorizontal: r.pad }]}>
          <Image
            source={{ uri: activeImageUrl }}
            style={[styles.galleryMain, { height: r.galleryMainH }]}
            contentFit="cover"
            placeholder={{ blurhash: 'LKO2?U42NwRn4jEYJMROM[~q?xRP' }}
            transition={300}
          />
          {gallery.length > 1 && (
            <View style={styles.galleryThumbs}>
              {gallery.slice(0, 5).map((url: string, i: number) => {
                const thumbUrl = url.includes('?') ? `${url}&w=128&h=128&fit=crop` : `${url}?w=128&h=128&fit=crop`;
                return (
                  <Pressable key={i} onPress={() => setActiveImageIndex(i)}>
                    <Image
                      source={{ uri: thumbUrl }}
                      style={[styles.thumb, i === activeImageIndex && styles.thumbActive]}
                      contentFit="cover"
                      transition={200}
                    />
                    {i === 4 && gallery.length > 5 && (
                      <View style={styles.thumbMore}>
                        <Text style={styles.thumbMoreText}>+{gallery.length - 5}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* ─── Hotel header ─── */}
        <View style={styles.hotelHeader}>
          <View style={styles.hotelMeta}>
            <View style={styles.starRow}>
              {Array.from({ length: hotel.starRating }).map((_: any, i: number) => (
                <Text key={i} style={styles.starAmber}>★</Text>
              ))}
              <View style={styles.starBadge}>
                <Text style={styles.starBadgeText}>{hotel.starRating}-Star Hotel</Text>
              </View>
            </View>
            <Text style={styles.hotelName}>{hotel.name}</Text>
            <Text style={styles.hotelAddr}>
              📍 {hotel.address}, {hotel.city?.name}
              {hotel.city?.country?.name ? `, ${hotel.city.country.name}` : ''}
            </Text>
          </View>
        </View>

        {/* ─── Rating strip ─── */}
        <View style={styles.ratingStrip}>
          <View style={styles.ratingLeft}>
            <Text style={styles.ratingScore}>{hotel.averageRating?.toFixed(1) ?? '—'}</Text>
            <Text style={styles.ratingLabel}>{t('hotel.guest_rating')}</Text>
          </View>
          <View style={styles.ratingBar}>
            <Text style={styles.ratingDesc}>{t('hotel.based_on')}</Text>
            <View style={styles.ratingTrack}>
              <View
                style={[
                  styles.ratingFill,
                  { width: `${Math.max(0, (hotel.averageRating ?? 0) * 20)}%`, backgroundColor: c.teal },
                ]}
              />
            </View>
          </View>
          <View style={styles.ratingRight}>
            <Text style={[styles.reviewCount, { color: c.ink }]}>{hotel.reviewCount?.toLocaleString() ?? 0}</Text>
            <Text style={[styles.ratingLabel, { color: c.inkMuted }]}>{t('hotel.reviews_label')}</Text>
          </View>
        </View>

        {/* ─── Tabs ─── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.tabsWrap, { borderBottomColor: c.line }]}
          contentContainerStyle={styles.tabsContent}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, activeTab === tab && { borderBottomColor: c.teal }]}
            >
              <Text style={[styles.tabText, { color: c.inkMuted }, activeTab === tab && { color: c.teal, fontWeight: '700' }]}>
                {tab === 'Amenities' ? t('hotel.amenities') : tab === 'Reviews' ? t('hotel.reviews_label') : tab}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ─── Tab content ─── */}
        <View style={styles.tabBody}>
          {activeTab === 'Overview' && hotel.description && (
            <Text style={[styles.description, { color: c.inkSoft }]}>{hotel.description}</Text>
          )}

          {activeTab === 'Rooms' && (
            <View style={styles.roomsList}>
              {hotel.rooms?.length === 0 && (
                <Text style={[styles.muted, { color: c.inkMuted }]}>{t('hotel.noRooms', 'No rooms available.')}</Text>
              )}
              {hotel.rooms?.map((room: Room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  hotelName={hotel.name}
                  imageUrl={hotel.images?.[0]?.url}
                  nights={1}
                  onViewRoom={() => {
                    navigation.navigate('RoomDetail', {
                      room,
                      hotelName: hotel.name,
                      hotelId,
                      checkIn: effectiveCheckIn,
                      checkOut: effectiveCheckOut,
                      hotelImages: hotel?.images,
                      guests: { adults: parseInt(flowAdults) || 2, children: parseInt(flowChildren) || 0 },
                    });
                  }}
                  onBookRoom={() => {
                    if (!session) {
        Alert.alert(t('common.sign_in_required'), t('hotelDetail.signin_booking'), [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('common.sign_in'), onPress: () => navigation.navigate('Auth', { initialMode: 'login' }) },
                      ]);
                      return;
                    }
                    if (room.capacity < totalGuests) {
                      Alert.alert(
                        t('roomDetail.capacity_exceeded'),
                        'This room cannot accommodate the selected guests. Please reduce the guest count or select a larger room.',
                      );
                      return;
                    }
                    navigation.navigate('BookingFlow', {
                      hotelId,
                      roomId: room.id,
                      hotelName: hotel.name,
                      roomType: room.type,
                      roomCapacity: room.capacity,
                      checkIn: effectiveCheckIn,
                      checkOut: effectiveCheckOut,
                    });
                  }}
                  dark={dark}
                />
              ))}
            </View>
          )}

          {activeTab === 'Amenities' && (
            <View style={styles.amenitiesGrid}>
              {hotel.amenities?.map((a: string) => (
                <View key={a} style={[styles.amenityItem, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <Text style={[styles.amenityCheck, { color: c.teal }]}>✓</Text>
                  <Text style={[styles.amenityText, { color: c.inkSoft }]}>{a}</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'Reviews' && (
            <View>
              {reviews.length === 0 ? (
                <Text style={[styles.muted, { color: c.inkMuted }]}>{t('hotel.no_reviews')}</Text>
              ) : (
                <View style={styles.reviewsList}>
                  {reviews.slice(0, 5).map((r: any) => (
                    <View key={r.id}>
                      <ReviewCard
                        guest={r.user?.fullName ?? 'Guest'}
                        rating={r.rating}
                        date={r.createdAt}
                        comment={r.comment}
                      />
                      {session?.user && r.userId === session.user.id && (
                        <View style={styles.reviewActions}>
                          <Pressable
                            onPress={() =>
                              navigation.navigate('Review', {
                                hotelId,
                                hotelName: hotel.name,
                                mode: 'edit',
                                existingReview: r,
                              })
                            }
                          >
                            <Text style={[styles.editReview, { color: c.teal }]}>{t('hotel.edit_review')}</Text>
                          </Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'Policies' && (
            <Card style={[styles.policiesCard, { backgroundColor: c.surface }]}>
              <PolicyRow icon="🕐" label={t('hotel.checkIn', 'Check-in')} value={policies?.checkInTime ? t('hotel.from_time', { time: policies.checkInTime }) : t('hotel.from_time', { time: '14:00' })} textColor={c.ink} mutedColor={c.inkMuted} />
              <PolicyRow icon="🕛" label={t('hotel.checkOut', 'Check-out')} value={policies?.checkOutTime ? t('hotel.until_time', { time: policies.checkOutTime }) : t('hotel.until_time', { time: '11:00' })} textColor={c.ink} mutedColor={c.inkMuted} />
              {policies?.cancellationHours != null && (
                <PolicyRow icon="🚫" label={t('hotel.cancellation')} value={policies.cancellationPolicy ?? t('hotel.free_cancel_default', { hours: policies.cancellationHours })} textColor={c.ink} mutedColor={c.inkMuted} />
              )}
              {policies?.houseRules && <PolicyRow icon="📋" label={t('hotel.houseRules')} value={policies.houseRules} textColor={c.ink} mutedColor={c.inkMuted} />}
              {policies?.petPolicy && <PolicyRow icon="🐾" label={t('hotel.pets')} value={policies.petPolicy} textColor={c.ink} mutedColor={c.inkMuted} />}
              {policies?.childPolicy && <PolicyRow icon="👶" label={t('hotel.children')} value={policies.childPolicy} textColor={c.ink} mutedColor={c.inkMuted} />}
            </Card>
          )}
        </View>

        {/* ─── Location ─── */}
        {hotel.lat && hotel.lng && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: c.ink }]}>{t('hotel.location', 'Location')}</Text>
            <Pressable
              onPress={() => {
                const url =
                  Platform.OS === 'ios'
                    ? `maps:${hotel.lat},${hotel.lng}`
                    : `geo:${hotel.lat},${hotel.lng}?q=${encodeURIComponent(hotel.name)}`;
                Linking.openURL(url).catch(() =>
                  Linking.openURL(`https://www.google.com/maps?q=${hotel.lat},${hotel.lng}`),
                );
              }}
            >
              <Card style={[styles.locationCard, { backgroundColor: c.surface }]}>
                <View style={styles.flex}>
                  <Text style={[styles.locationAddr, { color: c.ink }]}>
                    {hotel.address}
                    {hotel.city?.name ? `, ${hotel.city.name}` : ''}
                  </Text>
                  <Text style={[styles.locationCoords, { color: c.inkMuted }]}>
                    {hotel.lat.toFixed(4)}, {hotel.lng.toFixed(4)}
                  </Text>
                </View>
                <Text style={[styles.locationLink, { color: c.teal }]}>{t('hotel.openInMaps')}</Text>
              </Card>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* ─── Sticky booking footer ─── */}
      <View style={[styles.stickyFooter, shadowCard, { paddingBottom: insets.bottom + 14, backgroundColor: c.surface, borderTopColor: c.line }]}>
        <View>
          <Text style={[styles.footerFrom, { color: c.inkMuted }]}>{t('hotel.from')}</Text>
          <Text style={[styles.footerPrice, { color: c.ink }]}>
            {lowestPrice != null ? `ETB ${lowestPrice}` : '—'}
            <Text style={[styles.footerPerNight, { color: c.inkMuted }]}>{' '}{t('hotel.perNight')}</Text>
          </Text>
          <View style={styles.footerRating}>
            <Stars value={hotel.averageRating ?? 0} size={11} />
            <Text style={[styles.footerRatingText, { color: c.inkMuted }]}>
              {' '}{hotel.averageRating?.toFixed(1) ?? 'New'} ({hotel.reviewCount})
            </Text>
          </View>
        </View>
        <Button
          title={t('hotel.reserve_now')}
          onPress={() => {
            if (!session) {
              navigation.navigate('Auth', { initialMode: 'login' });
              return;
            }
            if (hotel.rooms?.[0]) handleBookRoom(hotel.rooms[0]);
          }}
          size="lg"
        />
      </View>
    </View>
  );
}


function PolicyRow({ icon, label, value, textColor, mutedColor, dark }: { icon: string; label: string; value: string; textColor?: string; mutedColor?: string; dark?: boolean }) {
  const c = dark ? darkColors : colors;
  return (
    <View style={styles.policyRow}>
      <Text style={styles.policyIcon}>{icon}</Text>
      <View style={styles.flex}>
        <Text style={[styles.policyLabel, { color: textColor ?? c.ink }]}>{label}</Text>
        <Text style={[styles.policyValue, { color: mutedColor ?? c.inkMuted }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },

  /* ─── Breadcrumb ─── */
  breadcrumbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breadcrumb: { flex: 1, textAlign: 'center', marginHorizontal: 8 },

  /* ─── Gallery ─── */
  galleryWrap: { gap: 8, paddingTop: 12 },
  galleryMain: { width: '100%', borderRadius: radius.cardLg ?? 20, overflow: 'hidden' },
  galleryThumbs: { flexDirection: 'row', gap: 8 },
  thumb: { width: 64, height: 64, borderRadius: 10, borderWidth: 2 },
  thumbMore: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbMoreText: { fontSize: 13, fontWeight: '700' },

  /* ─── Hotel header ─── */
  hotelHeader: { paddingHorizontal: 20, paddingTop: 16 },
  hotelMeta: { gap: 4 },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  starAmber: { fontSize: 14 },
  starBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  starBadgeText: { fontSize: 11, fontWeight: '700' },
  hotelName: {
    fontFamily: font.display,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  hotelAddr: { fontSize: 14, marginTop: 2 },

  /* ─── Rating strip ─── */
  ratingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 14,
  },
  ratingLeft: { alignItems: 'center', minWidth: 50 },
  ratingScore: { fontFamily: font.display, fontSize: 32, fontWeight: '700' },
  ratingLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  ratingBar: { flex: 1, gap: 8 },
  ratingDesc: { fontSize: 12, lineHeight: 17 },
  ratingTrack: { height: 6, borderRadius: 3 },
  ratingFill: { height: 6, borderRadius: 3 },
  ratingRight: { alignItems: 'center', minWidth: 40 },
  reviewCount: { fontFamily: font.display, fontSize: 20, fontWeight: '700' },

  /* ─── Tabs ─── */
  tabsWrap: { marginTop: 16, borderBottomWidth: 1 },
  tabsContent: { paddingHorizontal: 20, gap: 0 },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabText: { fontSize: 14, fontWeight: '500' },
  tabBody: { padding: 20 },

  /* ─── Overview ─── */
  description: { fontSize: 14, lineHeight: 22 },

  /* ─── Rooms ─── */
  roomsList: { gap: 12 },
  roomCard: { gap: 10 },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  roomType: { fontFamily: font.display, fontSize: 17, fontWeight: '600' },
  roomMeta: { fontSize: 12, marginTop: 2 },
  roomPriceBlock: { alignItems: 'flex-end', gap: 4 },
  roomPrice: { fontSize: 16, fontWeight: '800' },
  perNight: { fontSize: 11, fontWeight: '400' },
  roomDesc: { fontSize: 13, lineHeight: 19 },
  roomAmenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roomAmenityPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  roomAmenityText: { fontSize: 11 },
  muted: { fontSize: 14 },

  /* ─── Amenities ─── */
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  amenityCheck: { fontSize: 13, fontWeight: '700' },
  amenityText: { fontSize: 13, fontWeight: '500' },

  /* ─── Reviews ─── */
  reviewsList: { gap: 10 },
  reviewActions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  editReview: { fontSize: 12, fontWeight: '600' },

  /* ─── Policies ─── */
  policiesCard: { gap: 14 },
  policyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  policyIcon: { fontSize: 18, width: 24, textAlign: 'center', marginTop: 1 },
  policyLabel: { fontSize: 13, fontWeight: '600' },
  policyValue: { fontSize: 13, marginTop: 2, lineHeight: 18 },

  /* ─── Location ─── */
  section: { paddingHorizontal: 20, paddingBottom: 8 },
  sectionTitle: {
    fontFamily: font.display,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  locationCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationAddr: { fontSize: 14, fontWeight: '600' },
  locationCoords: { fontSize: 12, marginTop: 2 },
  locationLink: { fontSize: 13, fontWeight: '600' },

  /* ─── Sticky footer ─── */
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  footerFrom: { fontSize: 11 },
  footerPrice: { fontSize: 22, fontWeight: '800' },
  footerPerNight: { fontSize: 12, fontWeight: '400' },
  footerRating: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  footerRatingText: { fontSize: 11 },
});
