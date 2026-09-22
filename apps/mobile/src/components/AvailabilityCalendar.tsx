import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, radius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { hapticLight, hapticSelection } from '../hooks/useHaptics';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface AvailabilityDay {
  date: string;
  available: boolean;
  price?: number;
  seasonalLabel?: string;
}

interface Range {
  checkIn: string | null;
  checkOut: string | null;
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function today(): string {
  return formatDateISO(new Date());
}

function nightsBetween(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

function fmtShort(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return `${dt.toLocaleString('default', { month: 'short' })} ${dt.getDate()}`;
}

function pick(range: Range, date: string): Range {
  const t = today();
  // Strictly prevent past dates from being selected
  if (date < t) return range;

  // If no check-in yet, or both check-in and check-out are already selected, start a fresh range
  if (!range.checkIn || (range.checkIn && range.checkOut)) {
    return { checkIn: date, checkOut: null };
  }

  // If user taps the same date or an earlier date, reset check-in to this date
  if (date <= range.checkIn) {
    return { checkIn: date, checkOut: null };
  }

  // Set check-out date
  return { checkIn: range.checkIn, checkOut: date };
}

type Props = {
  data: AvailabilityDay[];
  loading?: boolean;
  value: Range;
  onChange: (range: Range) => void;
  onMonthChange?: (year: number, month: number) => void;
};

export default function AvailabilityCalendar({
  data,
  loading,
  value,
  onChange,
  onMonthChange,
}: Props) {
  const { colors: c, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';

  const { width: screenW } = useWindowDimensions();
  // 7 columns with safe margins
  const cellSize = Math.max(36, Math.floor((screenW - 56) / 7));
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const nav = (delta: number) => {
    hapticSelection();
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    onMonthChange?.(y, m);
  };

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const t = today();
  const nights = value.checkIn && value.checkOut ? nightsBetween(value.checkIn, value.checkOut) : 0;

  // Quick Preset Handlers
  const applyPreset = (daysOffsetStart: number, stayNights: number) => {
    hapticLight();
    const start = new Date();
    start.setDate(start.getDate() + daysOffsetStart);
    const end = new Date(start);
    end.setDate(end.getDate() + stayNights);
    onChange({
      checkIn: formatDateISO(start),
      checkOut: formatDateISO(end),
    });
  };

  const applyWeekendPreset = () => {
    hapticLight();
    const d = new Date();
    const dayOfWeek = d.getDay(); // 0 Sun, 5 Fri, 6 Sat
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const friday = new Date(d);
    friday.setDate(d.getDate() + daysUntilFriday);
    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);
    onChange({
      checkIn: formatDateISO(friday),
      checkOut: formatDateISO(sunday),
    });
  };

  const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth());

  return (
    <View style={[styles.container, { backgroundColor: c.surface, borderColor: c.line }]}>
      {/* ── Quick Date Presets ── */}
      <View style={styles.presetsWrap}>
        <Text style={[styles.presetHeader, { color: c.inkSoft }]}>Quick dates:</Text>
        <View style={styles.presetsRow}>
          <Pressable
            onPress={() => applyPreset(0, 1)}
            style={({ pressed }) => [
              styles.presetChip,
              { backgroundColor: dark ? '#16243A' : '#F1F5F9', borderColor: c.line },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.presetChipText, { color: c.teal }]}>Tonight (1 night)</Text>
          </Pressable>

          <Pressable
            onPress={() => applyPreset(1, 1)}
            style={({ pressed }) => [
              styles.presetChip,
              { backgroundColor: dark ? '#16243A' : '#F1F5F9', borderColor: c.line },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.presetChipText, { color: c.ink }]}>Tomorrow (1 night)</Text>
          </Pressable>

          <Pressable
            onPress={() => applyPreset(0, 2)}
            style={({ pressed }) => [
              styles.presetChip,
              { backgroundColor: dark ? '#16243A' : '#F1F5F9', borderColor: c.line },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.presetChipText, { color: c.ink }]}>2 Nights</Text>
          </Pressable>

          <Pressable
            onPress={applyWeekendPreset}
            style={({ pressed }) => [
              styles.presetChip,
              { backgroundColor: dark ? '#16243A' : '#F1F5F9', borderColor: c.line },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.presetChipText, { color: c.goldDeep }]}>Weekend</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Month Navigation ── */}
      <View style={styles.navRow}>
        <Pressable
          onPress={() => nav(-1)}
          disabled={isPastMonth}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={[styles.navBtn, isPastMonth && { opacity: 0.3 }]}
        >
          <Ionicons name="chevron-back" size={20} color={c.ink} />
        </Pressable>

        <Text style={[styles.monthLabel, { color: c.ink }]}>
          {MONTH_NAMES[month]} {year}
        </Text>

        <Pressable
          onPress={() => nav(1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={styles.navBtn}
        >
          <Ionicons name="chevron-forward" size={20} color={c.ink} />
        </Pressable>
      </View>

      {/* ── Day of Week Headers ── */}
      <View style={styles.dayHeaderRow}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={[styles.dayHeader, { width: cellSize, color: c.inkMuted }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* ── Calendar Days Grid ── */}
      <View style={styles.grid}>
        {Array.from({ length: firstDow }).map((_, i) => (
          <View key={`pad-${i}`} style={[styles.cell, { width: cellSize, height: cellSize + 4 }]} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dd = String(i + 1).padStart(2, '0');
          const mm = String(month + 1).padStart(2, '0');
          const date = `${year}-${mm}-${dd}`;
          const day = data.find((d) => d.date === date);
          const past = date < t;
          // Only mark unavailable if past OR explicitly false in backend overrides
          const unavailable = past || (day ? !day.available : false);
          const inRange = Boolean(
            value.checkIn && value.checkOut && date >= value.checkIn && date <= value.checkOut,
          );
          const isCheckIn = date === value.checkIn;
          const isCheckOut = date === value.checkOut;
          const isEdge = isCheckIn || isCheckOut;

          return (
            <Pressable
              key={date}
              disabled={unavailable}
              onPress={() => {
                hapticLight();
                onChange(pick(value, date));
              }}
              accessibilityRole="button"
              accessibilityLabel={`${date}${unavailable ? ', unavailable' : ''}${isEdge ? ', selected' : ''}`}
              style={[
                styles.cell,
                { width: cellSize, height: cellSize + 4 },
                isEdge && { backgroundColor: c.teal, borderColor: c.teal },
                inRange && !isEdge && {
                  backgroundColor: dark ? '#0E3B36' : '#E6F4F2',
                  borderColor: c.teal + '30',
                },
                unavailable && styles.cellUnavailable,
              ]}
            >
              <Text
                style={[
                  styles.dayNum,
                  { color: c.ink },
                  isEdge && styles.dayNumEdge,
                  unavailable && { color: c.inkMuted },
                ]}
              >
                {i + 1}
              </Text>
              {day && !unavailable && day.price ? (
                <Text
                  style={[
                    styles.price,
                    isEdge && styles.priceEdge,
                    day.seasonalLabel ? styles.priceSeasonal : { color: c.inkMuted },
                  ]}
                  numberOfLines={1}
                >
                  {(day.price / 1000).toFixed(1)}k
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {/* ── Selection Summary & Actions ── */}
      <View style={[styles.legend, { borderTopColor: c.line }]}>
        <View style={styles.selectedDatesBox}>
          <Ionicons name="calendar-outline" size={16} color={c.teal} />
          <Text style={[styles.rangeText, { color: c.ink }]}>
            {value.checkIn
              ? value.checkOut
                ? `${fmtShort(value.checkIn)} → ${fmtShort(value.checkOut)} (${nights} night${nights !== 1 ? 's' : ''})`
                : `${fmtShort(value.checkIn)} → (Select check-out)`
              : 'Tap a date to select check-in'}
          </Text>
        </View>

        {value.checkIn && (
          <Pressable
            onPress={() => {
              hapticLight();
              onChange({ checkIn: null, checkOut: null });
            }}
            hitSlop={8}
            style={styles.clearBtn}
          >
            <Text style={[styles.clearBtnText, { color: c.brick }]}>Reset</Text>
          </Pressable>
        )}
      </View>

      {loading && (
        <View pointerEvents="none" style={[styles.loadingOverlay, { backgroundColor: c.surface + '99' }]}>
          <Text style={[styles.loadingText, { color: c.inkSoft }]}>Checking room availability…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: 12,
  },
  presetsWrap: {
    marginBottom: 10,
  },
  presetHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '700',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  dayHeader: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    marginVertical: 2,
  },
  cellUnavailable: {
    opacity: 0.25,
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '700',
  },
  dayNumEdge: {
    color: '#FFFFFF',
  },
  price: {
    fontSize: 9,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  priceEdge: {
    color: '#FFFFFF',
  },
  priceSeasonal: {
    color: '#D4AF37',
    fontWeight: '800',
  },
  legend: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedDatesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  rangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
