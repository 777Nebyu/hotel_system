import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  label: string;
  minDate?: string;
  initialDate?: string;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function today() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

export default function DatePickerModal({ visible, onClose, onSelect, label, minDate, initialDate }: Props) {
  const now = today();
  const min = minDate ? parseDate(minDate) : now;

  const init = initialDate ? parseDate(initialDate) : min;
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [day, setDay] = useState(init.day);

  const daysInMonth = getDaysInMonth(year, month);
  if (day > daysInMonth) setDay(daysInMonth);

  const years = Array.from({ length: 10 }, (_, i) => min.year + i);
  const months = MONTHS.map((name, i) => ({ name, index: i }));

  const handleConfirm = () => {
    onSelect(formatDate(year, month, day));
    onClose();
  };

  const isPast = (y: number, m: number, d: number) => {
    const ms = new Date(y, m, d).getTime();
    return ms < new Date(min.year, min.month, min.day).getTime();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{label}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.pickerRow}>
            <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
              <Text style={styles.colLabel}>Year</Text>
              {years.map((y) => (
                <Pressable key={y} onPress={() => setYear(y)} style={[styles.optBtn, year === y && styles.optActive]}>
                  <Text style={[styles.optText, year === y && styles.optTextActive]}>{y}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
              <Text style={styles.colLabel}>Month</Text>
              {months.map((m) => (
                <Pressable
                  key={m.index}
                  onPress={() => setMonth(m.index)}
                  style={[styles.optBtn, month === m.index && styles.optActive]}
                >
                  <Text style={[styles.optText, month === m.index && styles.optTextActive]}>{m.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <ScrollView style={styles.col} showsVerticalScrollIndicator={false}>
              <Text style={styles.colLabel}>Day</Text>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                const disabled = isPast(year, month, d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => { if (!disabled) setDay(d); }}
                    style={[styles.optBtn, day === d && styles.optActive, disabled && styles.optDisabled]}
                  >
                    <Text style={[styles.optText, day === d && styles.optTextActive, disabled && styles.optTextDisabled]}>{d}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Text style={styles.preview}>{formatDate(year, month, day)}</Text>

          <Pressable onPress={handleConfirm} style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.confirmText}>Select</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', color: colors.ink },
  closeBtn: { padding: 4 },
  closeText: { fontSize: 18, color: colors.inkMuted },
  pickerRow: { flexDirection: 'row', gap: 8, height: 260 },
  col: { flex: 1 },
  colLabel: { fontSize: 11, fontWeight: '700', color: colors.inkMuted, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  optBtn: { paddingVertical: 6, borderRadius: radius.pill, alignItems: 'center' },
  optActive: { backgroundColor: colors.teal },
  optText: { fontSize: 14, color: colors.ink },
  optTextActive: { color: colors.surface, fontWeight: '700' },
  optDisabled: { opacity: 0.35 },
  optTextDisabled: { color: colors.inkMuted },
  preview: { textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.teal, marginVertical: 10 },
  confirmBtn: { backgroundColor: colors.teal, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center' },
  confirmText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
});
