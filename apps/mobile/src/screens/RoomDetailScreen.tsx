/**
 * RoomDetailScreen — Premium Room Detail (§9)
 *
 * Top:
 *  — Back button & Favorite toggle
 *  — Image gallery
 *  — Room name & star rating
 *  — Room specs: Bed type · Guest capacity · Room size · Bathrooms
 *  — Amenities grid
 *  — Description
 *  — Cancellation policy
 *  — Hotel policies: Check-in time (2:00 PM) · Check-out time (12:00 PM)
 *  — Pricing breakdown
 *  — Primary sticky CTA: "BOOK THIS ROOM" (never hidden behind navigation §46)
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Room } from '../types';
import { BK } from '../components/BookingComponents';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import { useAppSelector } from '../store/hooks';
import { useFavorites, useToggleFavorite } from '../hooks/useQueries';
import { hapticLight, hapticMedium, hapticSuccess } from '../hooks/useHaptics';
import { request, ApiError } from '../api';
import { useTheme } from '../hooks/useTheme';

type Props = {
  room: Room;
  hotelName: string;
  hotelId: string;
  checkIn?: string;
  checkOut?: string;
  hotelImages?: { id: string; url: string; isPrimary: boolean }[];
  guests?: { adults: number; children: number };
  onBack: () => void;
  onBook: (roomId: string, checkIn?: string, checkOut?: string, promoCode?: string) => void;
};

const FALLBACK = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&h=600&fit=crop&auto=format';

function calcNights(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (isNaN(ms) || ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 86400000));
}

function fmtDate(iso?: string | null) {
  if (!iso) return 'Select date';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RoomDetailScreen({
  room,
  hotelName,
  hotelId,
  checkIn,
  checkOut,
  hotelImages,
  guests,
  onBack,
  onBook,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const dark = colorScheme === 'dark';

  const session = useAppSelector((s) => s.auth.session);
  const token = session?.accessToken ?? '';

  const roomImages = useMemo(() => {
    const imgs = (hotelImages ?? []).map((i) => i.url);
    return imgs.length > 0 ? imgs : [FALLBACK];
  }, [hotelImages]);
  const { data: favoritesData } = useFavorites(token);
  const toggleFavorite = useToggleFavorite(token);

  const favorites: any[] = Array.isArray(favoritesData)
    ? favoritesData
    : (favoritesData as any)?.data ?? [];
  const isFavorite = favorites.some((f) => (f.hotelId ?? f.id) === hotelId);

  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Default dates if empty
  const defaultCheckIn = useMemo(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10), []);
  const defaultCheckOut = useMemo(() => new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), []);
  const initialCheckIn = checkIn && !isNaN(new Date(checkIn).getTime()) ? checkIn : defaultCheckIn;
  const initialCheckOut = checkOut && !isNaN(new Date(checkOut).getTime()) ? checkOut : defaultCheckOut;

  const [selectedCheckIn, setSelectedCheckIn] = useState<string | null>(initialCheckIn);
  const [selectedCheckOut, setSelectedCheckOut] = useState<string | null>(initialCheckOut);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Calendar room availability data
  const [availData, setAvailData] = useState<Array<{ date: string; available: boolean; price: number; seasonalLabel?: string }>>([]);
  const [availLoading, setAvailLoading] = useState(false);

  const loadAvailability = useCallback(async (year: number, month: number) => {
    setAvailLoading(true);
    try {
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const res = await request<any>(
        `/catalog/rooms/${room.id}/availability?startDate=${startStr}&endDate=${endStr}`,
        { token }
      );
      const days = res?.calendar ?? res?.data ?? [];
      setAvailData(days);
    } catch {
      setAvailData([]);
    } finally {
      setAvailLoading(false);
    }
  }, [room.id, token]);

  useEffect(() => {
    const now = new Date();
    void loadAvailability(now.getFullYear(), now.getMonth());
  }, [loadAvailability]);

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<number | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const applyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (!selectedCheckIn || !selectedCheckOut) {
      Alert.alert(t('roomDetail.select_dates_first'), t('roomDetail.promo_select_dates'));
      setShowDatePicker(true);
      return;
    }
    setPromoLoading(true);
    try {
      const data = await request<{ total: number; discount: number }>('/bookings/checkout', {
        method: 'POST',
        body: {
          hotelId,
          checkIn: selectedCheckIn,
          checkOut: selectedCheckOut,
          roomIds: [room.id],
          guests: { adults: guests?.adults ?? 2, children: guests?.children ?? 0 },
          promoCode: code,
        },
        token,
      });
      setAppliedPromo(code);
      setPromoDiscount(data.discount || 0);
      const discountText = data.discount > 0 ? ` (ETB ${Number(data.discount).toLocaleString()} off)` : '';
      Alert.alert(t('roomDetail.promo_applied'), t('roomDetail.promo_applied_msg', { code, discount: discountText }));
    } catch (err: any) {
      const msg = (err instanceof ApiError ? err.message : '') || 'This promo code is not valid or has expired.';
      Alert.alert(t('roomDetail.invalid_promo'), msg);
    } finally {
      setPromoLoading(false);
    }
  };

  const removePromo = () => {
    setAppliedPromo('');
    setPromoInput('');
    setPromoDiscount(null);
  };

  const nights = calcNights(selectedCheckIn, selectedCheckOut);
  const basePrice = Number(room.basePrice);
  // Availability returns the server-calculated nightly price, including
  // seasonal overrides. Use it for the selected stay and only fall back to
  // basePrice when the calendar has not loaded that date yet.
  const nightlyPrices = (nights > 0 && selectedCheckIn)
    ? Array.from({ length: nights }, (_, index) => {
        const date = new Date(`${selectedCheckIn}T00:00:00`);
        date.setDate(date.getDate() + index);
        const key = date.toISOString().slice(0, 10);
        const day = availData.find((entry: any) => String(entry.date).slice(0, 10) === key);
        return typeof day?.price === 'number' ? day.price : Number(day?.price ?? basePrice);
      })
    : [basePrice];
  const subtotal = nightlyPrices.reduce((sum, price) => sum + price, 0);
  const displayedNightlyPrice = nights > 0 ? subtotal / nights : basePrice;
  const total = promoDiscount !== null ? Math.max(0, subtotal - promoDiscount) : subtotal;
  const isAvailable = room.status === 'AVAILABLE';

  // Palette
  const bg      = dark ? '#0D1B2A' : BK.bg;
  const surface = dark ? '#152233' : BK.white;
  const cardBg  = dark ? '#1A2D40' : BK.white;
  const borderC = dark ? '#1F3448' : BK.border;
  const textPri = dark ? '#F0F4F8' : BK.navy;
  const textSec = dark ? '#8FA1B3' : BK.textSec;

  const handleToggleFav = () => {
    if (!session) {
      Alert.alert(t('common.sign_in_required'), t('roomDetail.signin_save'));
      return;
    }
    hapticMedium();
    toggleFavorite.mutate({ hotelId, isFavorite });
  };

  const handleBook = () => {
    if (!selectedCheckIn || !selectedCheckOut) {
      Alert.alert(t('roomDetail.select_dates'), t('roomDetail.select_dates_msg'));
      setShowDatePicker(true);
      return;
    }
    // GUEST-001: Validate guest count against room capacity
    const totalGuests = (guests?.adults ?? 2) + (guests?.children ?? 0);
    if (room.capacity && totalGuests > room.capacity) {
      Alert.alert(t('roomDetail.capacity_exceeded'), t('roomDetail.capacity_msg', { capacity: room.capacity }));
      return;
    }
    hapticSuccess();
    onBook(room.id, selectedCheckIn, selectedCheckOut, appliedPromo || promoInput.trim().toUpperCase() || undefined);
  };

  return (
    <View style={[s.root, { backgroundColor: bg }]}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} backgroundColor={surface} />

      {/* Top Navigation Bar */}
      <View style={[s.navBar, { paddingTop: insets.top + 8, backgroundColor: surface, borderBottomColor: borderC }]}>
        <Pressable onPress={onBack} style={s.iconBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.go_back_nav')}>
          <Ionicons name="arrow-back" size={20} color={textPri} />
        </Pressable>
        <View style={s.navCenter}>
          <Text style={[s.navHotel, { color: textSec }]} numberOfLines={1}>{hotelName}</Text>
          <Text style={[s.navTitle, { color: textPri }]} numberOfLines={1}>{room.type}</Text>
        </View>
        <Pressable onPress={handleToggleFav} style={s.iconBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('hotel.save_fav')}>
          <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={22} color={isFavorite ? BK.cancelled : textPri} />
        </Pressable>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Image Gallery (§9) */}
        <View style={s.galleryWrap}>
          <Image
            source={{ uri: roomImages[activeImageIdx] }}
            style={s.mainImage}
            contentFit="cover"
            transition={300}
          />
          <View style={s.statusBadgeOverlay}>
            <View style={[s.statusBadge, { backgroundColor: isAvailable ? BK.confirmedBg : BK.cancelledBg, borderColor: isAvailable ? BK.confirmedBd : BK.cancelledBd }]}>
              <Text style={[s.statusText, { color: isAvailable ? BK.confirmed : BK.cancelled }]}>
                {isAvailable ? 'Available' : 'Sold Out'}
              </Text>
            </View>
          </View>
          {/* Thumbnails */}
          <View style={s.thumbsRow}>
            {roomImages.map((img, i) => (
              <Pressable
                key={i}
                onPress={() => setActiveImageIdx(i)}
                style={[s.thumbWrap, i === activeImageIdx && { borderColor: BK.navy, borderWidth: 2 }]}
              >
                <Image source={{ uri: img }} style={s.thumbImage} contentFit="cover" />
              </Pressable>
            ))}
          </View>
        </View>

        {/* 2. Room Title & Quick Specs */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: borderC }]}>
          <View style={s.titleRow}>
            <View style={s.flex}>
              <Text style={[s.roomName, { color: textPri }]}>
                {room.type.charAt(0) + room.type.slice(1).toLowerCase()}
              </Text>
              <Text style={[s.hotelSub, { color: textSec }]}>{hotelName} · Room #{room.roomNumber}</Text>
            </View>
            <View style={s.priceTag}>
              <Text style={[s.priceMain, { color: BK.navy }]}>ETB {displayedNightlyPrice.toLocaleString()}</Text>
              <Text style={[s.priceSub, { color: textSec }]}>/ night</Text>
            </View>
          </View>

          <View style={[s.specsGrid, { borderTopColor: borderC }]}>
            <View style={s.specCell}>
              <Ionicons name="bed-outline" size={18} color={BK.navy} />
              <Text style={[s.specTitle, { color: textPri }]}>{room.beds} {room.beds !== 1 ? t('hotel.bedsPlural') : t('hotel.beds')}</Text>
              <Text style={[s.specSubtitle, { color: textSec }]}>{room.beds !== 1 ? t('hotel.bedsPlural') : t('hotel.beds')}</Text>
            </View>
            <View style={s.specCell}>
              <Ionicons name="people-outline" size={18} color={BK.navy} />
              <Text style={[s.specTitle, { color: textPri }]}>Up to {room.capacity}</Text>
              <Text style={[s.specSubtitle, { color: textSec }]}>{t('hotel.guestsPlural')}</Text>
            </View>
            <View style={s.specCell}>
              <Ionicons name="water-outline" size={18} color={BK.navy} />
              <Text style={[s.specTitle, { color: textPri }]}>{room.bathroom ?? 1}</Text>
              <Text style={[s.specSubtitle, { color: textSec }]}>{t('roomDetail.bathrooms')}</Text>
            </View>
          </View>
        </View>

        {/* 3. Description */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: borderC }]}>
          <Text style={[s.sectionTitle, { color: textPri }]}>{t('roomDetail.description')}</Text>
          <Text style={[s.descText, { color: textSec }]}>
            {room.description ||
              'Experience luxury and comfort in this thoughtfully furnished room, featuring premium linens, high-speed WiFi, modern ensuite facilities, and dedicated workspace designed for ultimate relaxation.'}
          </Text>
        </View>

        {/* 4. Amenities */}
        {room.amenities && room.amenities.length > 0 && (
          <View style={[s.card, { backgroundColor: cardBg, borderColor: borderC }]}>
            <Text style={[s.sectionTitle, { color: textPri }]}>{t('roomDetail.room_amenities')}</Text>
            <View style={s.amenitiesGrid}>
              {room.amenities.map((a) => (
                <View key={a} style={[s.amenityBadge, { backgroundColor: dark ? '#1F3448' : BK.bg }]}>
                  <Ionicons name="checkmark-circle" size={14} color={BK.confirmed} />
                  <Text style={[s.amenityLabel, { color: textPri }]}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 5. Stay Dates */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: borderC }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[s.sectionTitle, { color: textPri }]}>{t('roomDetail.your_stay')}</Text>
            <Pressable
              onPress={() => {
                hapticLight();
                setShowDatePicker(!showDatePicker);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 8,
                backgroundColor: dark ? '#1E3347' : '#E6F4F2',
              }}
            >
              <Ionicons name="calendar-outline" size={14} color={BK.navy} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: BK.navy }}>
                {showDatePicker ? t('common.done') : 'Change dates'}
              </Text>
            </Pressable>
          </View>

          <View style={s.datesRow}>
            <View style={s.dateCol}>
              <Text style={[s.dateLabel, { color: textSec }]}>{t('common.check_in')}</Text>
              <Text style={[s.dateVal, { color: textPri }]}>{fmtDate(selectedCheckIn)}</Text>
            </View>
            <View style={s.nightsBadge}>
              <Ionicons name="moon-outline" size={12} color={BK.navyMuted} />
              <Text style={s.nightsText}>{nights} night{nights !== 1 ? 's' : ''}</Text>
            </View>
            <View style={[s.dateCol, { alignItems: 'flex-end' }]}>
              <Text style={[s.dateLabel, { color: textSec }]}>{t('common.check_out')}</Text>
              <Text style={[s.dateVal, { color: textPri }]}>{fmtDate(selectedCheckOut)}</Text>
            </View>
          </View>

          {showDatePicker && (
            <View style={{ marginTop: 12 }}>
              <AvailabilityCalendar
                data={availData}
                loading={availLoading}
                value={{ checkIn: selectedCheckIn, checkOut: selectedCheckOut }}
                onChange={(range) => {
                  setSelectedCheckIn(range.checkIn);
                  setSelectedCheckOut(range.checkOut);
                }}
                onMonthChange={(y, m) => loadAvailability(y, m)}
              />
            </View>
          )}
        </View>

        {/* 5b. Promo Code */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: borderC }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="pricetag-outline" size={16} color={BK.navy} />
            <Text style={[s.sectionTitle, { color: textPri }]}>{t('roomDetail.promo_code')}</Text>
          </View>
          <View style={s.promoRow}>
            <TextInput
              value={promoInput}
              onChangeText={(text) => {
                setPromoInput(text);
                if (appliedPromo) {
                  setAppliedPromo('');
                  setPromoDiscount(null);
                }
              }}
              placeholder={t('roomDetail.promo_placeholder')}
              placeholderTextColor={textSec}
              autoCapitalize="characters"
              editable={!appliedPromo}
              style={[
                s.promoInput,
                { backgroundColor: dark ? '#152233' : BK.bg, borderColor: borderC, color: textPri },
              ]}
            />
            {appliedPromo ? (
              <Pressable
                onPress={removePromo}
                style={[s.promoBtn, { backgroundColor: dark ? '#2A1818' : '#FDE8E8' }]}
              >
                <Text style={[s.promoBtnText, { color: '#EF4444' }]}>{t('common.remove')}</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={applyPromo}
                disabled={promoLoading || !promoInput.trim()}
                style={({ pressed }) => [
                  s.promoBtn,
                  { backgroundColor: BK.navy },
                  pressed && { opacity: 0.85 },
                  (promoLoading || !promoInput.trim()) && { opacity: 0.5 },
                ]}
              >
                {promoLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[s.promoBtnText, { color: '#FFFFFF' }]}>{t('common.apply')}</Text>
                )}
              </Pressable>
            )}
          </View>
          {appliedPromo && promoDiscount !== null ? (
            <View style={[s.promoSuccessBox, { backgroundColor: dark ? '#0E3B36' : '#E6F4F2' }]}>
              <Ionicons name="checkmark-circle" size={16} color={BK.confirmed} />
              <Text style={{ fontSize: 13, color: BK.confirmed, fontWeight: '700', flex: 1 }}>
                {appliedPromo} applied {promoDiscount > 0 ? `— ETB ${Number(promoDiscount).toLocaleString()} discount` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 6. Cancellation Policy (§9, §29) */}
        <View style={[s.card, { backgroundColor: cardBg, borderColor: borderC }]}>
          <Text style={[s.sectionTitle, { color: textPri }]}>{t('roomDetail.cancellation_policy')}</Text>
          <View style={[s.cancellationBox, { backgroundColor: BK.confirmedBg, borderColor: BK.confirmedBd }]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={BK.confirmed} />
            <View style={s.flex}>
              <Text style={[s.cancelTitle, { color: BK.confirmed }]}>{t('roomDetail.free_cancel')}</Text>
              <Text style={[s.cancelDesc, { color: BK.navyMuted }]}>
                Cancel before {fmtDate(selectedCheckIn)} for a full refund. Check hotel policy for specific cancellation terms.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* 8. Sticky Bottom CTA Container (§9, §46) */}
      <View style={[s.stickyFooter, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: surface, borderTopColor: borderC }]}>
        <View style={s.footerPriceCol}>
          <Text style={[s.footerPriceLabel, { color: textSec }]}>
            {nights > 0 ? 'Total stay price' : 'Price per night'}
          </Text>
          <View style={s.priceRowInline}>
            {promoDiscount !== null && promoDiscount > 0 ? (
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[s.footerPriceVal, { color: BK.confirmed }]}>ETB {total.toLocaleString()}</Text>
                  <Text style={{ fontSize: 12, textDecorationLine: 'line-through', color: textSec }}>ETB {subtotal.toLocaleString()}</Text>
                </View>
                <Text style={[s.footerNightsSub, { color: textSec }]}> / {nights} night{nights !== 1 ? 's' : ''}</Text>
              </View>
            ) : (
              <>
                <Text style={[s.footerPriceVal, { color: BK.navy }]}>ETB {total.toLocaleString()}</Text>
                <Text style={[s.footerNightsSub, { color: textSec }]}>
                  {nights > 0 ? ` / ${nights} night${nights !== 1 ? 's' : ''}` : ' / night'}
                </Text>
              </>
            )}
          </View>
        </View>
        <Pressable
          onPress={handleBook}
          disabled={!isAvailable}
          style={({ pressed }) => [
            s.primaryCta,
            !isAvailable && s.primaryCtaDisabled,
            pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('buttons.book_this_room')}
        >
          <Text style={s.primaryCtaText}>
            {!isAvailable
              ? 'ROOM SOLD OUT'
              : !selectedCheckIn
              ? 'SELECT CHECK-IN'
              : !selectedCheckOut
              ? 'SELECT CHECK-OUT'
              : t('buttons.book_this_room')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flex: 1 },
  body:   { padding: 16, gap: 14 },
  flex:   { flex: 1 },

  // Nav
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  navCenter: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  navHotel:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  navTitle:  { fontSize: 15, fontWeight: '700', marginTop: 1 },

  // Gallery
  galleryWrap: { borderRadius: 16, overflow: 'hidden', gap: 8 },
  mainImage:   { width: '100%', height: 220, borderRadius: 16 },
  statusBadgeOverlay: { position: 'absolute', top: 12, left: 12 },
  statusBadge: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  thumbsRow:  { flexDirection: 'row', gap: 8 },
  thumbWrap:  { width: 64, height: 48, borderRadius: 8, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },

  // Card wrapper
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  roomName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  hotelSub: { fontSize: 13, marginTop: 3 },
  priceTag: { alignItems: 'flex-end' },
  priceMain: { fontSize: 19, fontWeight: '800' },
  priceSub: { fontSize: 11, fontWeight: '500' },

  // Specs grid
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  specCell: { width: '25%', alignItems: 'center', gap: 3, paddingVertical: 4 },
  specTitle: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  specSubtitle: { fontSize: 10, fontWeight: '500' },

  // Sections
  sectionTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  descText: { fontSize: 13, lineHeight: 20 },

  // Amenities
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  amenityLabel: { fontSize: 12, fontWeight: '600' },

  // Stay Dates
  datesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  dateCol: { flex: 1 },
  dateLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  dateVal: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  nightsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: BK.bg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
  nightsText: { fontSize: 11, fontWeight: '600', color: BK.navyMuted },

  // Cancellation
  cancellationBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  cancelTitle: { fontSize: 13, fontWeight: '700' },
  cancelDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },

  // Sticky Bottom Footer (§9, §46)
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    shadowColor: '#1A2B4A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
  },
  footerPriceCol: { flex: 1, marginRight: 12 },
  footerPriceLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  priceRowInline: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  footerPriceVal: { fontSize: 19, fontWeight: '800' },
  footerNightsSub: { fontSize: 12, fontWeight: '500' },
  primaryCta: {
    backgroundColor: BK.navy,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  primaryCtaDisabled: { backgroundColor: BK.border },
  primaryCtaText: { color: BK.white, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },

  // Promo Code
  promoRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  promoInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  promoBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  promoBtnText: { fontSize: 13, fontWeight: '700' },
  promoSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
});
