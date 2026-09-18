import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useMockMode } from './MockModeBanner';

const STORAGE_KEY = 'mock_payment_scenario';

export type MockScenario = 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING' | 'TIMEOUT' | 'EXPIRED' | 'DUPLICATE';

export const MOCK_SCENARIOS: { id: MockScenario; label: string; icon: string; color: string }[] = [
  { id: 'SUCCESS', label: 'Success', icon: 'checkmark-circle', color: '#16A34A' },
  { id: 'FAILED', label: 'Failed', icon: 'close-circle', color: '#EF4444' },
  { id: 'CANCELLED', label: 'Cancelled', icon: 'ban', color: '#F59E0B' },
  { id: 'PENDING', label: 'Pending (10s delay)', icon: 'time', color: '#3B82F6' },
  { id: 'TIMEOUT', label: 'Timeout (no response)', icon: 'hourglass', color: '#8B5CF6' },
  { id: 'EXPIRED', label: 'Expired', icon: 'calendar', color: '#6B7280' },
  { id: 'DUPLICATE', label: 'Duplicate Request', icon: 'repeat', color: '#EC4899' },
];

export async function getMockScenario(): Promise<MockScenario> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored && MOCK_SCENARIOS.some((s) => s.id === stored)) return stored as MockScenario;
  } catch { /* ignore */ }
  return 'SUCCESS';
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect?: (scenario: MockScenario) => void;
};

export default function MockScenarioSelector({ visible, onClose, onSelect }: Props) {
  const { colors: c } = useTheme();
  const isDev = useMockMode();
  const [selected, setSelected] = useState<MockScenario>('SUCCESS');

  useEffect(() => {
    getMockScenario().then(setSelected);
  }, [visible]);

  if (!isDev || !visible) return null;

  const select = async (id: MockScenario) => {
    setSelected(id);
    await AsyncStorage.setItem(STORAGE_KEY, id);
    onSelect?.(id);
  };

  return (
    <View style={styles.overlay}>
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: c.ink }]}>{'Test Scenario'}</Text>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={c.inkMuted} />
          </Pressable>
        </View>

        <View style={styles.scenarios}>
          {MOCK_SCENARIOS.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => select(s.id)}
              style={[styles.option, { borderColor: c.line }, selected === s.id && { borderColor: c.teal, backgroundColor: c.tealTint }]}
            >
              <Ionicons name={s.icon as any} size={20} color={selected === s.id ? c.teal : s.color} />
              <Text style={[styles.optionText, { color: selected === s.id ? c.teal : c.ink }]}>{s.label}</Text>
              {selected === s.id && <Ionicons name="checkmark" size={16} color={c.teal} />}
            </Pressable>
          ))}
        </View>

        <View style={[styles.footer, { borderTopColor: c.line }]}>
          <Ionicons name="lock-closed" size={12} color={c.inkMuted} />
          <Text style={[styles.footerText, { color: c.inkMuted }]}>Persisted across app restarts</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  sheet: { width: '85%', borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  scenarios: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  optionText: { flex: 1, fontSize: 14, fontWeight: '600' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  footerText: { fontSize: 11 },
});
