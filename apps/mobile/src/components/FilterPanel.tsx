import React, { useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from './Shared';
import { font, radius } from '../theme';
import { useTheme } from '../hooks/useTheme';

// Must match the shared/API RoomType enum.
const ROOM_TYPES = ['STANDARD', 'DELUXE', 'SUITE', 'FAMILY', 'EXECUTIVE'];
const AMENITIES = ['Wi-Fi', 'Pool', 'Spa', 'Restaurant', 'Gym', 'Parking', 'Breakfast', 'Airport Shuttle', 'Pet Friendly', 'A/C'];
const SORT_OPTIONS = [
  { key: 'popularity', labelKey: 'filters.popularity' },
  { key: 'rating_desc', labelKey: 'filters.highest_rated' },
  { key: 'price_asc', labelKey: 'filters.price_low' },
  { key: 'price_desc', labelKey: 'filters.price_high' },
];

export interface FilterValues {
  city: string;
  country: string;
  priceMin: string;
  priceMax: string;
  minRating: string;
  roomType: string;
  amenities: string[];
  sort: string;
  guests: string;
}

export const EMPTY_FILTERS: FilterValues = {
  city: '', country: '', priceMin: '', priceMax: '', minRating: '', roomType: '', amenities: [], sort: '', guests: '',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  values: FilterValues;
  onChange: (v: FilterValues) => void;
  onApply: () => void;
};

export default function FilterPanel({ visible, onClose, values, onChange, onApply }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: 500,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const toggleAmenity = (a: string) => {
    onChange({
      ...values,
      amenities: values.amenities.includes(a)
        ? values.amenities.filter((x) => x !== a)
        : [...values.amenities, a],
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[fp.overlay, { backgroundColor: c.ink + '73' }]}>
        <Animated.View style={[fp.panel, { backgroundColor: c.surface, transform: [{ translateY }] }]} {...panResponder.panHandlers}>
          {/* Drag handle */}
          <View style={fp.dragHandleContainer}>
            <View style={[fp.dragHandle, { backgroundColor: c.lineStrong }]} />
          </View>
          <View style={fp.header}>
            <Text style={[fp.title, { color: c.ink }]}>{t('filters.title')}</Text>
            <Pressable onPress={onClose} hitSlop={8}><Text style={[fp.closeBtn, { color: c.inkMuted }]}>✕</Text></Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={fp.scrollContent}>
            {/* Sort by — horizontal scroll (OT.md §13) */}
            <View style={fp.section}>
              <Text style={[fp.sectionLabel, { color: c.inkSoft }]}>{t('filters.sort_by')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fp.chipScroll}>
                {SORT_OPTIONS.map((s) => (
                  <Pressable
                    key={s.key}
                    onPress={() => onChange({ ...values, sort: values.sort === s.key ? '' : s.key })}
                    style={[fp.chip, { borderColor: c.line, backgroundColor: c.surface }, values.sort === s.key && [fp.chipActive, { borderColor: c.teal, backgroundColor: c.tealTint }]]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: values.sort === s.key }}
                    accessibilityLabel={t(s.labelKey)}
                    >
                    <Text style={[fp.chipText, { color: c.inkSoft }, values.sort === s.key && [fp.chipTextActive, { color: c.tealDeep }]]}>{t(s.labelKey)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={fp.section}>
              <Text style={[fp.sectionLabel, { color: c.inkSoft }]}>{t('filters.country')}</Text>
              <TextInput
                value={values.country}
                onChangeText={(t2) => onChange({ ...values, country: t2 })}
                placeholder={t('filters.any_country')}
                placeholderTextColor={c.inkMuted}
                style={[fp.priceInput, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }]}
              />
            </View>

            <View style={fp.section}>
              <Text style={[fp.sectionLabel, { color: c.inkSoft }]}>{t('filters.price_night')}</Text>
              <View style={fp.priceRow}>
                <View style={fp.priceField}>
                  <Text style={[fp.fieldHint, { color: c.inkMuted }]}>{t('filters.min')}</Text>
                  <TextInput
                    value={values.priceMin}
                    onChangeText={(t2) => onChange({ ...values, priceMin: t2.replace(/\D/g, '') })}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={c.inkMuted}
                    style={[fp.priceInput, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }]}
                  />
                </View>
                <Text style={[fp.priceDash, { color: c.inkMuted }]}>–</Text>
                <View style={fp.priceField}>
                  <Text style={[fp.fieldHint, { color: c.inkMuted }]}>{t('filters.max')}</Text>
                  <TextInput
                    value={values.priceMax}
                    onChangeText={(t2) => onChange({ ...values, priceMax: t2.replace(/\D/g, '') })}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={c.inkMuted}
                    style={[fp.priceInput, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }]}
                  />
                </View>
              </View>
            </View>

            <View style={fp.section}>
              <Text style={[fp.sectionLabel, { color: c.inkSoft }]}>{t('filters.guest_rating')}</Text>
              <View style={fp.ratingRow}>
                {['4.5', '4', '3'].map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => onChange({ ...values, minRating: values.minRating === r ? '' : r })}
                    style={[fp.ratingPill, { borderColor: c.line, backgroundColor: c.surface }, values.minRating === r && [fp.ratingPillActive, { borderColor: c.teal, backgroundColor: c.tealTint }]]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: values.minRating === r }}
                    accessibilityLabel={`${r} stars and above`}
                  >
                    <Text style={[fp.ratingPillText, { color: c.inkSoft, fontFamily: font.mono }, values.minRating === r && [fp.ratingPillTextActive, { color: c.tealDeep }]]}>{r}+ ★</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Guests — horizontal scroll (OT.md §13) */}
            <View style={fp.section}>
              <Text style={[fp.sectionLabel, { color: c.inkSoft }]}>{t('filters.guests')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fp.chipScroll}>
                {['1', '2', '3', '4', '5+'].map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => onChange({ ...values, guests: values.guests === g ? '' : g })}
                    style={[fp.chip, { borderColor: c.line, backgroundColor: c.surface }, values.guests === g && [fp.chipActive, { borderColor: c.teal, backgroundColor: c.tealTint }]]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: values.guests === g }}
                    accessibilityLabel={`${g} guest${g !== '1' ? 's' : ''}`}
                  >
                    <Text style={[fp.chipText, { color: c.inkSoft }, values.guests === g && [fp.chipTextActive, { color: c.tealDeep }]]}>{g} {g === '1' ? 'guest' : 'guests'}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Room type — horizontal scroll (OT.md §13) */}
            <View style={fp.section}>
              <Text style={[fp.sectionLabel, { color: c.inkSoft }]}>{t('filters.room_type')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fp.chipScroll}>
                {ROOM_TYPES.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => onChange({ ...values, roomType: values.roomType === t ? '' : t })}
                    style={[fp.chip, { borderColor: c.line, backgroundColor: c.surface }, values.roomType === t && [fp.chipActive, { borderColor: c.teal, backgroundColor: c.tealTint }]]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: values.roomType === t }}
                    accessibilityLabel={t.charAt(0) + t.slice(1).toLowerCase()}
                  >
                    <Text style={[fp.chipText, { color: c.inkSoft }, values.roomType === t && [fp.chipTextActive, { color: c.tealDeep }]]}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={fp.section}>
              <Text style={[fp.sectionLabel, { color: c.inkSoft }]}>{t('filters.facilities')}</Text>
              {AMENITIES.map((a) => {
                const checked = values.amenities.includes(a);
                return (
                  <Pressable key={a} onPress={() => toggleAmenity(a)} style={fp.amenityRow} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={a}>
                    <View style={[fp.checkbox, { borderColor: c.lineStrong }, checked ? { backgroundColor: c.teal, borderColor: c.teal } : null]}>
                      {checked && <Text style={[fp.checkmark, { color: c.surface }]}>✓</Text>}
                    </View>
                    <Text style={[fp.amenityText, { color: c.ink }]}>{a}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          <View style={[fp.footer, { borderTopColor: c.line }]}>
            <Button variant="secondary" size="sm" title={t('filters.clear_all')} onPress={() => onChange(EMPTY_FILTERS)} />
            <View style={{ flex: 1 }} />
            <Button size="sm" title={t('filters.apply')} onPress={() => { onApply(); onClose(); }} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const fp = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  panel: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%', paddingTop: 0 },
  dragHandleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  dragHandle: { width: 36, height: 4, borderRadius: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14 },
  title: { fontFamily: font.display, fontSize: 20, fontWeight: '600' },
  closeBtn: { fontSize: 18, padding: 6 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  chipScroll: { gap: 8 },
  chip: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  chipActive: {},
  chipText: { fontSize: 13 },
  chipTextActive: { fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  priceField: { flex: 1 },
  fieldHint: { fontSize: 11, marginBottom: 4 },
  priceInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  priceDash: { fontSize: 18, paddingBottom: 6 },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingPill: { borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  ratingPillActive: {},
  ratingPillText: { fontSize: 13 },
  ratingPillTextActive: { fontWeight: '600' },
  amenityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkbox: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: {},
  checkmark: { fontSize: 14, fontWeight: '700' },
  amenityText: { fontSize: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1 },
});
