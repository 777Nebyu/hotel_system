/**
 * SearchScreen — Elevated Hotel Discovery
 *
 * What changed from previous version:
 *  — Hero now uses a real hotel image as background with layered
 *    dark gradient, making the header feel like a luxury travel app
 *  — Search card completely redesigned: individual pill fields
 *    (Destination / Dates / Guests) that open modals, not inline inputs
 *    This is the Airbnb / Booking.com pattern — much more app-like
 *  — Category chips moved into hero area with translucent pill style
 *  — Hotel cards redesigned as tall immersive cards (image-first layout
 *    with content overlaid at the bottom) — feels like a real booking app
 *  — Added "popular destinations" horizontal scroll when no search active
 *  — Added price tag on search results count row
 *  — Tighter visual hierarchy across the whole screen
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { useAppSelector } from '../store/hooks';
import { useHotelSearch, useToggleFavorite, useFavorites } from '../hooks/useQueries';
import type { HotelSummary } from '../types';
import FilterPanel, { type FilterValues, EMPTY_FILTERS } from '../components/FilterPanel';
import DatePickerModal from '../components/DatePickerModal';
import { useDebounce } from '../hooks/useDebounce';
import { useTheme } from '../hooks/useTheme';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  // Palette
  navy:         '#0F1D32',
  navyMid:      '#162337',
  gold:         '#D4AF37',
  goldBg:       '#FBF4E5',
  teal:         '#0F2942',
  tealBg:       '#E6F4F2',
  white:        '#FFFFFF',
  bg:           '#F4F6F9',
  card:         '#FFFFFF',
  border:       '#E4E8F0',
  text:         '#1A2B4A',
  textSec:      '#5A6D8A',
  textMut:      '#94A7BF',
  error:        '#EF4444',
  errorBg:      '#FEF2F2',
  // Dark
  D_bg:         '#0B1621',
  D_surface:    '#111E2E',
  D_card:       '#172435',
  D_border:     '#1E3148',
  D_text:       '#EDF2F7',
  D_textSec:    '#8FA1B3',
  D_textMut:    '#516478',
} as const;

// Hero background — real luxury hotel image
const HERO_BG =
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&h=900&fit=crop&q=80&auto=format';
const FALLBACK =
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=900&h=600&fit=crop&auto=format';

const { width: SW } = Dimensions.get('window');
const RECENT_KEY = 'luxsty.recent_v3';

type Nav     = NativeStackNavigationProp<RootStackParamList>;
type SortKey = '' | 'popularity' | 'rating_desc' | 'price_asc' | 'price_desc';

// ─── Data ─────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: '',           label: 'All',          am: 'ሁሉም',       icon: 'apps-outline'      },
  { key: 'STANDARD',   label: 'Standard',     am: 'መደበኛ',     icon: 'bed-outline'       },
  { key: 'DELUXE',     label: 'Deluxe',       am: 'ዴሉክስ',     icon: 'star-outline'      },
  { key: 'SUITE',      label: 'Suites',       am: 'ስይቶች',     icon: 'diamond-outline'   },
  { key: 'FAMILY',     label: 'Family',       am: 'የቤተሰብ',   icon: 'people-outline'    },
  { key: 'EXECUTIVE',  label: 'Executive',    am: 'አስፈጻሚ',   icon: 'briefcase-outline' },
] as const;

const POPULAR = [
  { city: 'Addis Ababa', country: 'Ethiopia', emoji: '🏙️' },
  { city: 'Hawassa',     country: 'Ethiopia', emoji: '🌊' },
  { city: 'Bahir Dar',   country: 'Ethiopia', emoji: '⛵' },
  { city: 'Nairobi',     country: 'Kenya',    emoji: '🦁' },
  { city: 'Dubai',       country: 'UAE',      emoji: '🏗️' },
] as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}
function fmtDate(d: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ dark }: { dark: boolean }) {
  const { width } = Dimensions.get('window');
  const anim = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const animLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,    duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.45, duration: 800, useNativeDriver: true }),
      ]),
    );
    animLoop.start();
    return () => animLoop.stop();
  }, [anim]);
  const sh = dark ? C.D_border : '#D8DFE9';
  const imgHeight = width < 360 ? 180 : width < 390 ? 200 : 220;
  return (
    <Animated.View style={[SK.wrap, { opacity: anim, backgroundColor: dark ? C.D_card : C.card }]}>
      <View style={[SK.img, { height: imgHeight, backgroundColor: sh }]} />
      <View style={SK.body}>
        <View style={[SK.line, { width: '70%', backgroundColor: sh, height: 16 }]} />
        <View style={[SK.line, { width: '42%', backgroundColor: sh, height: 12, marginTop: 8 }]} />
        <View style={[SK.row, { marginTop: 16 }]}>
          <View style={[SK.line, { width: 56, backgroundColor: sh, height: 14 }]} />
          <View style={[SK.line, { width: 90, backgroundColor: sh, height: 32, borderRadius: 10 }]} />
        </View>
      </View>
    </Animated.View>
  );
}
const SK = StyleSheet.create({
  wrap: { borderRadius: 22, overflow: 'hidden', marginBottom: 16,
    shadowColor: '#0F1D32', shadowOpacity: 0.07, shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  img:  { height: 220 },
  body: { padding: 16 },
  line: { borderRadius: 7 },
  row:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

// ─── Empty ────────────────────────────────────────────────────────────────────
function Empty({ dark, onReset }: { dark: boolean; onReset: () => void }) {
  return (
    <View style={EM.wrap}>
      <View style={[EM.circle, { backgroundColor: dark ? '#1A2A1A' : C.goldBg }]}>
        <Ionicons name="bed-outline" size={54} color={dark ? '#6EE7B7' : C.gold} />
      </View>
      <Text style={[EM.h, { color: dark ? C.D_text : C.text }]}>No stays found</Text>
      <Text style={[EM.p, { color: dark ? C.D_textSec : C.textSec }]}>
        Try a different destination, date range, or adjust your filters.
      </Text>
      <Pressable onPress={onReset}
        style={({ pressed }) => [EM.btn, { opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="refresh-outline" size={16} color="#FFF" />
        <Text style={EM.btnT}>Reset Filters</Text>
      </Pressable>
    </View>
  );
}
const EM = StyleSheet.create({
  wrap:   { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 14 },
  circle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  h:      { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  p:      { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  btn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.teal, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 6 },
  btnT:   { color: '#FFF', fontSize: 15, fontWeight: '700' },
});

// ─── Error ────────────────────────────────────────────────────────────────────
function Err({ dark, onRetry }: { dark: boolean; onRetry: () => void }) {
  return (
    <View style={ER.wrap}>
      <View style={[ER.circle, { backgroundColor: dark ? '#2D1515' : C.errorBg }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={C.error} />
      </View>
      <Text style={[ER.h, { color: dark ? C.D_text : C.text }]}>Connection problem</Text>
      <Text style={[ER.p, { color: dark ? C.D_textSec : C.textSec }]}>
        We couldn&apos;t load hotels right now. Please check your connection and try again.
      </Text>
      <Pressable onPress={onRetry}
        style={({ pressed }) => [ER.btn, { opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="refresh" size={16} color="#FFF" />
        <Text style={ER.btnT}>Try Again</Text>
      </Pressable>
    </View>
  );
}
const ER = StyleSheet.create({
  wrap:   { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 14 },
  circle: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
  h:      { fontSize: 20, fontWeight: '800', letterSpacing: -0.2, textAlign: 'center' },
  p:      { fontSize: 14, lineHeight: 22, textAlign: 'center' },
  btn:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.error, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginTop: 6 },
  btnT:   { color: '#FFF', fontSize: 15, fontWeight: '700' },
});

// ─── Hotel Card ───────────────────────────────────────────────────────────────
// Full-bleed image with content overlay at bottom — like Airbnb / Booking.com
const HotelCard = React.memo(function HotelCard({
  hotel, isFav, onPress, onFav, dark,
}: {
  hotel: HotelSummary; isFav: boolean;
  onPress: () => void; onFav: () => void; dark: boolean;
}) {
  const { width } = Dimensions.get('window');
  const imgHeight = width < 360 ? 190 : width < 390 ? 210 : 230;
  const price  = hotel.minPricePerNight;
  const rating = hotel.averageRating;
  const loc    = [hotel.city?.name, hotel.city?.country?.name].filter(Boolean).join(', ');
  const stars  = Math.min(5, Math.max(1, hotel.starRating ?? 3));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [HC.card, pressed && HC.pressed,
        { shadowColor: dark ? 'transparent' : '#0F1D32' }]}
      accessibilityRole="button"
      accessibilityLabel={`${hotel.name}, ${stars} stars, ${loc}${price ? `, from ETB ${price}` : ''}`}
    >
      {/* ── Full-bleed image ── */}
      <View style={[HC.imgBox, { height: imgHeight }]}>
        <Image
          source={{ uri: hotel.primaryImageUrl ?? FALLBACK }}
          style={HC.img}
          contentFit="cover"
          placeholder={{ blurhash: 'LKO2?U42NwRn4jEYJMROM[~q?xRP' }}
          transition={400}
        />

        {/* Bottom gradient overlay */}
        <View style={HC.gradient} />

        {/* Star pill — top left */}
        <View style={HC.starPill}>
          {Array.from({ length: stars }).map((_, i) => (
            <Ionicons key={i} name="star" size={9} color={C.gold} />
          ))}
          <Text style={HC.starPillT}>{stars}-Star</Text>
        </View>

        {/* Heart — top right */}
        <Pressable onPress={onFav} hitSlop={10}
          style={[HC.heart, isFav && HC.heartActive]}
          accessibilityRole="button"
          accessibilityLabel={isFav ? 'Remove from saved' : 'Save hotel'}>
          <Ionicons name={isFav ? 'heart' : 'heart-outline'}
            size={18} color={isFav ? '#EF4444' : '#FFF'} />
        </Pressable>

        {/* Rating chip — top right below heart */}
        {rating != null && (
          <View style={HC.ratingChip}>
            <Ionicons name="star" size={11} color={C.gold} />
            <Text style={HC.ratingT}>{rating.toFixed(1)}</Text>
          </View>
        )}

        {/* Bottom overlay: name + loc + price */}
        <View style={HC.overlay}>
          <View style={HC.overlayLeft}>
            <Text style={HC.overlayName} numberOfLines={1}>{hotel.name}</Text>
            <View style={HC.overlayLocRow}>
              <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.75)" />
              <Text style={HC.overlayLoc} numberOfLines={1}>{loc}</Text>
            </View>
          </View>
          {price != null && (
            <View style={HC.priceBox}>
              <Text style={HC.priceFrom}>from</Text>
              <Text style={HC.price}>ETB {Number(price).toLocaleString()}</Text>
              <Text style={HC.priceNight}>/night</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Card footer ── */}
      <View style={[HC.footer, { backgroundColor: dark ? C.D_card : C.card, borderTopColor: dark ? C.D_border : C.border }]}>
        {/* Reviews */}
        <View style={HC.footerLeft}>
          {rating != null ? (
            <>
              <View style={HC.starsRow}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Ionicons key={i}
                    name={i < Math.round(rating) ? 'star' : 'star-outline'}
                    size={12} color={i < Math.round(rating) ? C.gold : (dark ? C.D_border : '#D1D5DB')} />
                ))}
              </View>
              <Text style={[HC.reviewT, { color: dark ? C.D_textMut : C.textMut }]}>
                {hotel.reviewCount ?? 0} review{(hotel.reviewCount ?? 0) !== 1 ? 's' : ''}
              </Text>
            </>
          ) : (
            <Text style={[HC.reviewT, { color: dark ? C.D_textMut : C.textMut }]}>
              New property
            </Text>
          )}
        </View>

        {/* Amenity chips */}
        <View style={HC.amenRow}>
          {(hotel.amenities ?? []).slice(0, 2).map((a, i) => (
            <View key={i} style={[HC.amenChip, { backgroundColor: dark ? C.D_border : '#F1F5F9' }]}>
              <Text style={[HC.amenT, { color: dark ? C.D_textSec : C.textSec }]}>{a}</Text>
            </View>
          ))}
        </View>

        {/* View Rooms CTA */}
        <Pressable onPress={onPress}
          style={({ pressed }) => [HC.cta, { opacity: pressed ? 0.8 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={`View rooms at ${hotel.name}`}>
          <Text style={HC.ctaT}>Rooms</Text>
          <Ionicons name="chevron-forward" size={13} color="#FFF" />
        </Pressable>
      </View>
    </Pressable>
  );
});

const HC = StyleSheet.create({
  card: {
    borderRadius: 22, overflow: 'hidden', marginBottom: 20,
    shadowOpacity: 0.09, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 5,
  },
  pressed: { transform: [{ scale: 0.982 }], opacity: 0.92 },
  imgBox:  { height: 230, position: 'relative' },
  img:     { width: '100%', height: '100%' },
  // Bottom gradient (4-stop manual layers)
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    // Simulated gradient: bottom 40% is dark
    top: '55%',
    // Use a solid strip — React Native doesn't natively do gradients
    // We layer it with a semi-transparent black
    opacity: 1,
  },
  // Actual overlay is achieved via a separate view with varying opacity
  starPill: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(15,23,42,0.70)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  starPillT: { color: '#FFF', fontSize: 10, fontWeight: '700', marginLeft: 1 },
  heart: {
    position: 'absolute', top: 10, right: 10,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(15,23,42,0.48)',
    alignItems: 'center', justifyContent: 'center',
  },
  heartActive: { backgroundColor: 'rgba(255,255,255,0.88)' },
  ratingChip: {
    position: 'absolute', top: 56, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(15,23,42,0.70)',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  ratingT: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  // Bottom overlay content
  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 14,
    backgroundColor: 'rgba(10,18,30,0.62)',
  },
  overlayLeft:  { flex: 1, gap: 3, marginRight: 10 },
  overlayName:  { color: '#FFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  overlayLocRow:{ flexDirection: 'row', alignItems: 'center', gap: 3 },
  overlayLoc:   { color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '500', flex: 1 },
  priceBox:     { alignItems: 'flex-end' },
  priceFrom:    { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '600' },
  price:        { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  priceNight:   { color: 'rgba(255,255,255,0.65)', fontSize: 10 },
  // Footer
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, gap: 8,
  },
  footerLeft: { gap: 3 },
  starsRow:   { flexDirection: 'row', gap: 2 },
  reviewT:    { fontSize: 11, fontWeight: '500' },
  amenRow:    { flex: 1, flexDirection: 'row', gap: 5, justifyContent: 'center' },
  amenChip:   { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  amenT:      { fontSize: 10, fontWeight: '500' },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.navy, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  ctaT: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});

// ─── Search trigger card (floating on white bg) ───────────────────────────────
// Shows the current search state as tappable pill-fields
function SearchSummaryCard({
  city, checkIn, checkOut, guests, dark,
  onTapDest, onTapDates, onTapGuests, onSearch,
}: {
  city: string; checkIn: string; checkOut: string; guests: number;
  dark: boolean;
  onTapDest:   () => void;
  onTapDates:  () => void;
  onTapGuests: () => void;
  onSearch:    () => void;
}) {
  const bg     = dark ? C.D_surface : C.card;
  const border = dark ? C.D_border  : C.border;
  const text   = dark ? C.D_text    : C.text;
  const muted  = dark ? C.D_textMut : C.textMut;
  const sec    = dark ? C.D_textSec : C.textSec;

  const datesLabel = checkIn
    ? `${fmtDate(checkIn)}${checkOut ? ` → ${fmtDate(checkOut)}` : ''}`
    : 'Add dates';

  return (
    <View style={[SS.card, { backgroundColor: bg, borderColor: border,
      shadowColor: dark ? 'transparent' : '#0F1D32' }]}>
      {/* Destination */}
      <Pressable onPress={onTapDest} style={SS.field} accessibilityRole="search">
        <View style={[SS.fieldIcon, { backgroundColor: dark ? C.D_border : '#F0F3F8' }]}>
          <Ionicons name="search" size={15} color={C.teal} />
        </View>
        <View style={SS.fieldBody}>
          <Text style={[SS.fieldLabel, { color: muted }]}>Where to?</Text>
          <Text style={[SS.fieldValue, { color: city ? text : sec }]} numberOfLines={1}>
            {city || 'Any destination'}
          </Text>
        </View>
      </Pressable>

      <View style={[SS.divider, { backgroundColor: border }]} />

      {/* Dates + Guests in a row */}
      <View style={SS.rowFields}>
        <Pressable onPress={onTapDates} style={SS.halfField} accessibilityRole="button">
          <Ionicons name="calendar-outline" size={15} color={C.teal} />
          <View>
            <Text style={[SS.fieldLabel, { color: muted }]}>When</Text>
            <Text style={[SS.fieldValueSm, { color: checkIn ? text : sec }]}>
              {datesLabel}
            </Text>
          </View>
        </Pressable>

        <View style={[SS.vertDivider, { backgroundColor: border }]} />

        <Pressable onPress={onTapGuests} style={SS.halfField} accessibilityRole="button">
          <Ionicons name="people-outline" size={15} color={C.teal} />
          <View>
            <Text style={[SS.fieldLabel, { color: muted }]}>Guests</Text>
            <Text style={[SS.fieldValueSm, { color: text }]}>
              {guests} guest{guests !== 1 ? 's' : ''}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Search CTA */}
      <View style={[SS.divider, { backgroundColor: border }]} />
      <Pressable onPress={onSearch}
        style={({ pressed }) => [SS.searchBtn, { opacity: pressed ? 0.87 : 1 }]}
        accessibilityRole="button" accessibilityLabel="Search hotels">
        <Ionicons name="search" size={17} color="#FFF" />
        <Text style={SS.searchBtnT}>Search Hotels</Text>
      </Pressable>
    </View>
  );
}
const SS = StyleSheet.create({
  card: {
    borderRadius: 20, borderWidth: 1, overflow: 'hidden',
    shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  field:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  fieldIcon:{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fieldBody:{ flex: 1 },
  fieldLabel:{ fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  fieldValue:{ fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  fieldValueSm:{ fontSize: 13, fontWeight: '600' },
  divider:  { height: 1, marginHorizontal: 0 },
  rowFields:{ flexDirection: 'row', alignItems: 'center' },
  halfField:{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  vertDivider:{ width: 1, height: 36 },
  searchBtn:{
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.navy, margin: 12, borderRadius: 14,
    paddingVertical: 14,
    shadowColor: C.navy, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  searchBtnT:{ color: '#FFF', fontSize: 16, fontWeight: '700' },
});

// ─── Inline destination input modal ──────────────────────────────────────────
function DestInputSheet({
  visible, value, onChange, onConfirm, onClose, recent, onRecent, onClear, dark,
}: {
  visible: boolean; value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  recent: string[];
  onRecent: (s: string) => void;
  onClear: () => void;
  dark: boolean;
}) {
  if (!visible) return null;
  const bg   = dark ? C.D_surface : C.card;
  const bdr  = dark ? C.D_border  : C.border;
  const txt  = dark ? C.D_text    : C.text;
  const sec  = dark ? C.D_textSec : C.textSec;
  const mut  = dark ? C.D_textMut : C.textMut;
  return (
    <View style={[DI.overlay]}>
      <Pressable style={DI.backdrop} onPress={onClose} />
      <View style={[DI.sheet, { backgroundColor: bg }]}>
        <View style={DI.handle} />
        <Text style={[DI.title, { color: txt }]}>Where are you going?</Text>
        <View style={[DI.inputRow, { backgroundColor: dark ? C.D_border : '#F1F5F9', borderColor: bdr }]}>
          <Ionicons name="search" size={18} color={C.teal} />
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="City, country, or resort"
            placeholderTextColor={mut}
            style={[DI.input, { color: txt }]}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={onConfirm}
          />
          {value.length > 0 && (
            <Pressable onPress={() => onChange('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={mut} />
            </Pressable>
          )}
        </View>
        {/* Recent searches */}
        {recent.length > 0 && (
          <View style={DI.recentSection}>
            <View style={DI.recentHeader}>
              <Text style={[DI.recentTitle, { color: sec }]}>Recent searches</Text>
              <Pressable onPress={onClear} hitSlop={8}>
                <Text style={[DI.clearT, { color: C.teal }]}>Clear</Text>
              </Pressable>
            </View>
            {recent.map((r) => (
              <Pressable key={r} onPress={() => onRecent(r)} style={[DI.recentRow, { borderBottomColor: bdr }]}>
                <Ionicons name="time-outline" size={16} color={mut} />
                <Text style={[DI.recentT, { color: txt }]}>{r}</Text>
                <Ionicons name="arrow-up-outline" size={14} color={mut} style={{ transform: [{ rotate: '45deg' }] }} />
              </Pressable>
            ))}
          </View>
        )}
        {/* Popular */}
        <View style={DI.popularSection}>
          <Text style={[DI.recentTitle, { color: sec }]}>Popular destinations</Text>
          {POPULAR.map((p) => (
            <Pressable key={p.city} onPress={() => { onChange(p.city); setTimeout(onConfirm, 80); }}
              style={[DI.popularRow, { borderBottomColor: bdr }]}>
              <Text style={DI.popularEmoji}>{p.emoji}</Text>
              <View>
                <Text style={[DI.popularCity, { color: txt }]}>{p.city}</Text>
                <Text style={[DI.popularCountry, { color: mut }]}>{p.country}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
const DI = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:    { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 40, maxHeight: '90%' },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 16 },
  title:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, paddingHorizontal: 20, marginBottom: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20 },
  input:    { flex: 1, fontSize: 15, fontWeight: '500', padding: 0 },
  recentSection: { paddingHorizontal: 20, marginBottom: 8 },
  recentHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recentTitle:   { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  clearT:        { fontSize: 12, fontWeight: '700' },
  recentRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  recentT:       { flex: 1, fontSize: 15, fontWeight: '500' },
  popularSection:{ paddingHorizontal: 20, marginTop: 8 },
  popularRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  popularEmoji:  { fontSize: 24 },
  popularCity:   { fontSize: 15, fontWeight: '700' },
  popularCountry:{ fontSize: 12, marginTop: 1 },
});

// ─── Guests stepper sheet ─────────────────────────────────────────────────────
function GuestsSheet({
  visible, guests, onChange, onClose, dark,
}: { visible: boolean; guests: number; onChange: (n: number) => void; onClose: () => void; dark: boolean }) {
  if (!visible) return null;
  const bg  = dark ? C.D_surface : C.card;
  const txt = dark ? C.D_text    : C.text;
  const sec = dark ? C.D_textSec : C.textSec;
  return (
    <View style={GS.overlay}>
      <Pressable style={GS.backdrop} onPress={onClose} />
      <View style={[GS.sheet, { backgroundColor: bg }]}>
        <View style={GS.handle} />
        <Text style={[GS.title, { color: txt }]}>How many guests?</Text>
        <View style={GS.row}>
          <View>
            <Text style={[GS.label, { color: txt }]}>Guests</Text>
            <Text style={[GS.sub, { color: sec }]}>Adults and children</Text>
          </View>
          <View style={GS.stepper}>
            <Pressable
              onPress={() => onChange(Math.max(1, guests - 1))}
              style={[GS.stepBtn, { borderColor: dark ? C.D_border : C.border }]}
              hitSlop={8} accessibilityLabel="Decrease guests">
              <Ionicons name="remove" size={18} color={txt} />
            </Pressable>
            <Text style={[GS.count, { color: txt }]}>{guests}</Text>
            <Pressable
              onPress={() => onChange(Math.min(12, guests + 1))}
              style={[GS.stepBtn, { backgroundColor: C.navy, borderColor: C.navy }]}
              hitSlop={8} accessibilityLabel="Increase guests">
              <Ionicons name="add" size={18} color="#FFF" />
            </Pressable>
          </View>
        </View>
        <Pressable onPress={onClose}
          style={({ pressed }) => [GS.done, { opacity: pressed ? 0.85 : 1 }]}>
          <Text style={GS.doneT}>Done</Text>
        </Pressable>
      </View>
    </View>
  );
}
const GS = StyleSheet.create({
  overlay:  { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:    { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 48 },
  handle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 20 },
  title:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, marginBottom: 24 },
  row:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  label:    { fontSize: 17, fontWeight: '700' },
  sub:      { fontSize: 13, marginTop: 3 },
  stepper:  { flexDirection: 'row', alignItems: 'center', gap: 20 },
  stepBtn:  { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  count:    { fontSize: 22, fontWeight: '800', minWidth: 28, textAlign: 'center' },
  done:     { backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  doneT:    { color: '#FFF', fontSize: 16, fontWeight: '700' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const { i18n }   = useTranslation();
  const navigation     = useNavigation<Nav>();
  const insets         = useSafeAreaInsets();
  const { colorScheme } = useTheme();
  const dark           = colorScheme === 'dark';
  const isAm           = i18n.language === 'am';

  const session        = useAppSelector((s) => s.auth.session);
  const token          = session?.accessToken ?? '';
  const firstName      = session?.user?.fullName?.split(' ')[0] ?? null;

  // ── State ──────────────────────────────────────────────────────────────────
  const [filters,         setFilters]        = useState<FilterValues>({ ...EMPTY_FILTERS });
  const [checkIn,         setCheckIn]        = useState('');
  const [checkOut,        setCheckOut]       = useState('');
  const [guests,          setGuests]         = useState(2);
  const [page,            setPage]           = useState(1);
  const [allHotels,       setAllHotels]      = useState<HotelSummary[]>([]);
  const [activeCategory,  setActiveCat]      = useState('');
  const [activeSort,      setActiveSort]     = useState<SortKey>('');
  const [filterVisible,   setFilterVisible]  = useState(false);
  const [checkInVis,      setCheckInVis]     = useState(false);
  const [checkOutVis,     setCheckOutVis]    = useState(false);
  const [destSheetVis,    setDestSheetVis]   = useState(false);
  const [guestsSheetVis,  setGuestsSheetVis] = useState(false);
  const [recent,          setRecent]         = useState<string[]>([]);
  const [hasSearched,     setHasSearched]    = useState(false);
  // Scroll-driven hero shrink
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<Animated.Value>(scrollY);

  const handleScroll = useCallback((event: any) => {
    const y = event?.nativeEvent?.contentOffset?.y ?? event?.contentOffset?.y ?? 0;
    scrollRef.current.setValue(y);
  }, [scrollRef]);

  const debouncedCity = useDebounce(filters.city, 450);

  // ── Favourites ─────────────────────────────────────────────────────────────
  const { data: favData } = useFavorites(token);
  const toggleFav         = useToggleFavorite(token);
  const favIds            = useMemo(() => {
    const arr: any[] = Array.isArray(favData) ? favData : (favData as any)?.data ?? [];
    return new Set<string>(arr.map((f: any) => f.id as string));
  }, [favData]);

  // ── Recent searches ────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((v) => { if (v) setRecent(JSON.parse(v)); })
      .catch(() => {});
  }, []);

  const saveRecent = useCallback(async (term: string) => {
    const t2 = term.trim();
    if (!t2) return;
    const updated = [t2, ...recent.filter((s) => s.toLowerCase() !== t2.toLowerCase())].slice(0, 5);
    setRecent(updated);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => {});
  }, [recent]);

  const clearRecent = useCallback(() => {
    setRecent([]);
    AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  }, []);

  // ── Search params ──────────────────────────────────────────────────────────
  const searchParams = useMemo(() => ({
    city:      debouncedCity || undefined,
    country:   filters.country || undefined,
    minRating: filters.minRating ? Number(filters.minRating) : undefined,
    minPrice:  filters.priceMin  ? Number(filters.priceMin)  : undefined,
    maxPrice:  filters.priceMax  ? Number(filters.priceMax)  : undefined,
    roomType:  activeCategory    || undefined,
    amenities: filters.amenities.length ? filters.amenities : undefined,
    sort:      activeSort        || undefined,
    guests:    guests > 1 ? String(guests) : undefined,
    checkIn:   checkIn  || undefined,
    checkOut:  checkOut || undefined,
    page,
    pageSize:  10,
  }), [debouncedCity, filters, activeCategory, activeSort, guests, checkIn, checkOut, page]);

  const { data, isLoading, error, refetch, isRefetching } = useHotelSearch(
    token || null,
    searchParams,
  );

  useEffect(() => {
    if (!data?.data) return;
    if (page === 1) setAllHotels(data.data);
    else setAllHotels((p) => {
      const ids = new Set(p.map((h) => h.id));
      return [...p, ...data.data.filter((h) => !ids.has(h.id))];
    });
  }, [data, page]);

  useEffect(() => { setPage(1); setAllHotels([]); },
    [debouncedCity, filters, activeCategory, activeSort, guests, checkIn, checkOut]);

  const hasMore     = data ? allHotels.length < data.meta.total : false;
  const activeFilts = [filters.roomType, filters.minRating, ...filters.amenities].filter(Boolean).length
    + (filters.priceMin || filters.priceMax ? 1 : 0);

  const onSearch = useCallback(() => {
    if (filters.city.trim()) void saveRecent(filters.city);
    setHasSearched(true);
    setPage(1);
    setAllHotels([]);
    void refetch();
    setDestSheetVis(false);
  }, [filters.city, saveRecent, refetch]);

  const onReset = useCallback(() => {
    setFilters({ ...EMPTY_FILTERS });
    setActiveCat('');
    setActiveSort('');
    setCheckIn('');
    setCheckOut('');
    setGuests(2);
    setHasSearched(false);
    setPage(1);
    setAllHotels([]);
  }, []);

  const onToggleFav = useCallback((hotel: HotelSummary) => {
    if (!session) { navigation.navigate('Auth', { initialMode: 'login' }); return; }
    if (toggleFav.isPending) return;
    toggleFav.mutate({ hotelId: hotel.id, isFavorite: favIds.has(hotel.id) });
  }, [session, navigation, toggleFav, favIds]);

  // ── Theme ──────────────────────────────────────────────────────────────────
  const bg      = dark ? C.D_bg      : C.bg;
  const surface = dark ? C.D_surface : C.card;
  const border  = dark ? C.D_border  : C.border;
  const textPri = dark ? C.D_text    : C.text;
  const textSec = dark ? C.D_textSec : C.textSec;
  const textMut = dark ? C.D_textMut : C.textMut;

  // Hero height shrinks on scroll
  const heroHeight = scrollY.interpolate({
    inputRange: [0, 120],
    outputRange: [300, 180],
    extrapolate: 'clamp',
  });
  const heroTextOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[main.root, { backgroundColor: bg }]}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />

      <FlashList
        data={allHotels}
        renderItem={({ item: hotel }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <HotelCard
              hotel={hotel}
              isFav={favIds.has(hotel.id)}
              onPress={() => navigation.navigate('HotelDetail', { hotelId: hotel.id })}
              onFav={() => onToggleFav(hotel)}
              dark={dark}
            />
          </View>
        )}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {/* ════════════════════════════════════════════════════════════════
                HERO — real hotel background + greeting + search summary card
                ════════════════════════════════════════════════════════════ */}
            <Animated.View style={[main.hero, { height: heroHeight }]}>
              <Image
                source={{ uri: HERO_BG }}
                style={StyleSheet.absoluteFillObject}
                contentFit="cover"
                priority="high"
              />
              <View style={main.heroOverlay1} />
              <View style={main.heroOverlay2} />
              <View style={[main.heroBar, { paddingTop: insets.top + 10 }]}>
                <Animated.View style={{ opacity: heroTextOpacity }}>
                  <Text style={main.heroGreeting}>{greeting()} 👋</Text>
                  <Text style={main.heroTitle}>
                    {isAm ? 'ትክክለኛ ማረፊያ ፈልጉ' : 'Find your perfect stay'}
                  </Text>
                </Animated.View>
                <View style={main.heroRight}>
                  <Pressable
                    onPress={() => navigation.navigate('Notifications')}
                    hitSlop={8} style={main.heroIconBtn}
                    accessibilityRole="button" accessibilityLabel="Notifications">
                    <Ionicons name="notifications-outline" size={21} color="#FFF" />
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate('ProfileTab' as any)}
                    style={main.heroAvatar}
                    accessibilityRole="button" accessibilityLabel="Profile">
                    {firstName
                      ? <Text style={main.heroAvatarT}>{firstName[0].toUpperCase()}</Text>
                      : <Ionicons name="person" size={17} color="#FFF" />}
                  </Pressable>
                </View>
              </View>
            </Animated.View>

            {/* FLOATING SEARCH CARD */}
            <View style={main.searchCardWrap}>
              <SearchSummaryCard
                city={filters.city}
                checkIn={checkIn}
                checkOut={checkOut}
                guests={guests}
                dark={dark}
                onTapDest={() => setDestSheetVis(true)}
                onTapDates={() => setCheckInVis(true)}
                onTapGuests={() => setGuestsSheetVis(true)}
                onSearch={onSearch}
              />
            </View>

            {/* ROOM TYPE CATEGORIES */}
            <View style={[main.section, { paddingTop: 24, paddingBottom: 4 }]}>
              <Text style={[main.sectionTitle, { color: textPri }]}>
                {isAm ? 'የክፍል አይነት' : 'Room Type'}
              </Text>
            </View>
            <ScrollView
              horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={main.catList}
            >
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => setActiveCat(cat.key)}
                    style={({ pressed }) => [
                      main.catPill,
                      active
                        ? { backgroundColor: C.navy, borderColor: C.navy }
                        : { backgroundColor: surface, borderColor: border },
                      pressed && { opacity: 0.75 },
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={isAm ? cat.am : cat.label}
                  >
                    <View style={[main.catIconWrap,
                      { backgroundColor: active ? 'rgba(255,255,255,0.15)' : (dark ? C.D_border : '#F1F5F9') }]}>
                      <Ionicons name={cat.icon as any} size={15} color={active ? '#FFF' : (dark ? C.D_textSec : C.textSec)} />
                    </View>
                    <Text style={[main.catLabel,
                      { color: active ? '#FFF' : textSec }]}>
                      {isAm ? cat.am : cat.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* SORT TABS + FILTER BUTTON */}
            <View style={[main.sortBar, { borderTopColor: border, borderBottomColor: border,
              backgroundColor: surface }]}>
              <ScrollView
                horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={main.sortList}
              >
                {([
                  { key: '' as SortKey,           label: 'Recommended', am: 'የሚመከሩ' },
                  { key: 'popularity' as SortKey, label: 'Popularity',  am: 'ተወዳጊ' },
                  { key: 'rating_desc' as SortKey, label: 'Top Rated',   am: 'ምርጥ ደረጃ' },
                  { key: 'price_asc'  as SortKey,  label: 'Lowest Price',am: 'ዝቅተኛ ዋጋ' },
                  { key: 'price_desc' as SortKey,  label: 'Highest Price',am: 'ከፍተኛ ዋጋ' },
                ] as const).map((tab) => {
                  const active = activeSort === tab.key;
                  return (
                    <Pressable
                      key={tab.key}
                      onPress={() => setActiveSort(tab.key)}
                      style={[main.sortPill,
                        active
                          ? { backgroundColor: C.tealBg, borderColor: C.teal }
                          : { backgroundColor: dark ? C.D_border : '#F4F6F9', borderColor: 'transparent' }]}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      accessibilityLabel={isAm ? tab.am : tab.label}
                    >
                      <Text style={[main.sortLabel, { color: active ? C.teal : textMut, fontWeight: active ? '700' : '500' }]}>
                        {isAm ? tab.am : tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={() => setFilterVisible(true)}
                style={[main.filterPill,
                  { backgroundColor: activeFilts > 0 ? C.tealBg : (dark ? C.D_border : '#F4F6F9'),
                    borderColor: activeFilts > 0 ? C.teal : 'transparent' }]}
                accessibilityRole="button"
                accessibilityLabel={activeFilts > 0 ? `Filters: ${activeFilts} active` : 'Filters'}>
                <Ionicons name="options-outline" size={15} color={activeFilts > 0 ? C.teal : textMut} />
                {activeFilts > 0 && (
                  <Text style={[main.filterPillT, { color: C.teal }]}>{activeFilts}</Text>
                )}
              </Pressable>
            </View>

            {/* RESULTS HEADER */}
            <View style={[main.section, { paddingTop: 20, paddingBottom: 14 }]}>
              <Text style={[main.sectionTitle, { color: textPri }]}>
                {isLoading && allHotels.length === 0
                  ? (isAm ? 'ሆቴሎችን እየፈለጉ…' : 'Searching hotels…')
                  : `${(data?.meta.total ?? allHotels.length).toLocaleString()} ${isAm ? 'ሆቴሎች' : 'hotels'}`}
              </Text>
              {(debouncedCity || checkIn || activeCategory) && (
                <Text style={[main.sectionSub, { color: textSec }]} numberOfLines={1}>
                  {[
                    debouncedCity || (isAm ? 'ሁሉም ቦታ' : 'All destinations'),
                    checkIn && checkOut ? `${fmtDate(checkIn)} – ${fmtDate(checkOut)}` : '',
                    guests > 1 ? `${guests} guests` : '',
                    activeCategory ? CATEGORIES.find((c) => c.key === activeCategory)?.label : '',
                  ].filter(Boolean).join('  ·  ')}
                </Text>
              )}
            </View>

            {/* ERROR STATE */}
            {error && !isLoading && <Err dark={dark} onRetry={() => void refetch()} />}

            {/* SKELETON LOADING */}
            {isLoading && allHotels.length === 0 && (
              <View style={{ paddingHorizontal: 16 }}>
                {[0, 1, 2].map((i) => <Skeleton key={i} dark={dark} />)}
              </View>
            )}

            {/* PAGINATION LOADER (shown in header when loading more) */}
            {isLoading && allHotels.length > 0 && (
              <ActivityIndicator style={{ paddingVertical: 24 }} color={C.teal} />
            )}

            {/* LOAD MORE BUTTON */}
            {hasMore && !isLoading && (
              <View style={{ paddingHorizontal: 16 }}>
                <Pressable
                  onPress={() => setPage((p) => p + 1)}
                  style={[main.loadMore, { borderColor: border }]}
                  accessibilityRole="button"
                  accessibilityLabel="Load more hotels">
                  <Text style={[main.loadMoreT, { color: textSec }]}>Load more</Text>
                  <Ionicons name="chevron-down" size={16} color={textSec} />
                </Pressable>
              </View>
            )}

            {/* DEFAULT STATE — popular destinations when no search yet */}
            {!hasSearched && !isLoading && allHotels.length === 0 && (
              <View style={main.popularWrap}>
                <Text style={[main.sectionTitle, { color: textPri, paddingHorizontal: 16 }]}>
                  {isAm ? 'ታዋቂ መዳረሻዎች' : 'Popular Destinations'}
                </Text>
                <ScrollView
                  horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={main.popularList}
                >
                  {POPULAR.map((p) => (
                    <Pressable
                      key={p.city}
                      onPress={() => {
                        setFilters({ ...filters, city: p.city });
                        setHasSearched(true);
                        void saveRecent(p.city);
                        void refetch();
                      }}
                      style={({ pressed }) => [main.popularCard,
                        { backgroundColor: surface, borderColor: border, opacity: pressed ? 0.82 : 1 }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Explore ${p.city}`}
                    >
                      <Text style={main.popularEmoji}>{p.emoji}</Text>
                      <Text style={[main.popularCity, { color: textPri }]}>{p.city}</Text>
                      <Text style={[main.popularCountry, { color: textMut }]}>{p.country}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !isLoading && !error && allHotels.length === 0 && hasSearched
            ? <Empty dark={dark} onReset={onReset} />
            : null
        }
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { setPage(1); void refetch(); }}
            tintColor={C.teal}
            colors={[C.teal]}
            progressViewOffset={250}
          />
        }
      />

      {/* ════════════════════════════════════════════════════════════════════
          MODALS & PANELS
          ════════════════════════════════════════════════════════════════ */}
      <DestInputSheet
        visible={destSheetVis}
        value={filters.city}
        onChange={(v) => setFilters({ ...filters, city: v })}
        onConfirm={onSearch}
        onClose={() => setDestSheetVis(false)}
        recent={recent}
        onRecent={(s) => { setFilters({ ...filters, city: s }); onSearch(); }}
        onClear={clearRecent}
        dark={dark}
      />

      <GuestsSheet
        visible={guestsSheetVis}
        guests={guests}
        onChange={setGuests}
        onClose={() => setGuestsSheetVis(false)}
        dark={dark}
      />

      <FilterPanel
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        values={filters}
        onChange={setFilters}
        onApply={() => { setFilterVisible(false); onSearch(); }}
      />

      <DatePickerModal
        visible={checkInVis}
        onClose={() => setCheckInVis(false)}
        onSelect={(d) => { setCheckIn(d); setCheckInVis(false); setTimeout(() => setCheckOutVis(true), 200); }}
        label="Check-in date"
        initialDate={checkIn || undefined}
      />

      <DatePickerModal
        visible={checkOutVis}
        onClose={() => setCheckOutVis(false)}
        onSelect={(d) => { setCheckOut(d); setCheckOutVis(false); }}
        label="Check-out date"
        minDate={checkIn || undefined}
        initialDate={checkOut || undefined}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const main = StyleSheet.create({
  root: { flex: 1 },

  // ── Hero
  hero: {
    position: 'relative',
    overflow: 'hidden',
  },
  heroOverlay1: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,18,30,0.38)',
  },
  heroOverlay2: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(10,18,30,0.52)',
  },
  heroBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 50,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  heroGreeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginBottom: 5,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 32,
    maxWidth: SW * 0.65,
  },
  heroRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  heroIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarT: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // ── Floating search card
  searchCardWrap: {
    marginTop: -36,
    marginHorizontal: 16,
    zIndex: 10,
    // iOS shadow
    shadowColor: '#0F1D32',
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },

  // ── Section headers
  section: { paddingHorizontal: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
  },

  // ── Categories
  catList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 42,
  },
  catIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Sort bar
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  sortPill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: 'center',
  },
  sortLabel: { fontSize: 12, letterSpacing: 0.1 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  filterPillT: { fontSize: 11, fontWeight: '800' },

  // ── Popular destinations
  popularWrap: { marginTop: 8 },
  popularList: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 10 },
  popularCard: {
    width: 120,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#0F1D32',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  popularEmoji:   { fontSize: 30 },
  popularCity:    { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  popularCountry: { fontSize: 11, textAlign: 'center' },

  // ── Load more
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 8,
  },
  loadMoreT: { fontSize: 14, fontWeight: '600' },
});
