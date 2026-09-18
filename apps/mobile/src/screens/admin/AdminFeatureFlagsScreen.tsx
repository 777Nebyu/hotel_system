import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, RefreshControl, StyleSheet } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { useThemeColors } from '../../theme';
import { Card, ErrorBox } from '../../components/Shared';
import { SkeletonKPI } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import ScreenHeader from '../../components/ScreenHeader';

interface AdminFeatureFlagsScreenProps {
  onBack: () => void;
}

export default function AdminFeatureFlagsScreen({ onBack }: AdminFeatureFlagsScreenProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setError(null);
      const res = await request<any>('/admin/feature-flags', { method: 'GET', token });
      const settingsMap: Record<string, any> = {};
      const items = Array.isArray(res) ? res : res?.settings ?? [];
      items.forEach((s: any) => { settingsMap[s.key] = s.enabled ?? s.value; });
      setSettings(settingsMap);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchSettings(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onRefresh = () => { setRefreshing(true); fetchSettings(); };

  const toggleFlag = async (key: string, enabled: boolean) => {
    setSavingKey(key);
    try {
      // The API always expects value to be an object: { enabled: boolean }.
      // When a flag key doesn't exist in local state yet (settings[key] is
      // undefined), typeof undefined === 'object' is false, so we must
      // always wrap the value — never send a bare boolean.
      await request(`/admin/feature-flags/${key}`, { method: 'PATCH', body: { enabled, reason: 'Updated from Admin mobile' }, token });
      setSettings((prev) => ({ ...prev, [key]: enabled }));
      toast('success', 'Feature flag updated');
    } catch (err: any) {
      toast('error', err.message || 'Failed to update');
    } finally {
      setSavingKey(null);
    }
  };

  const getFlagEnabled = (key: string): boolean => {
    const val = settings[key];
    if (typeof val === 'boolean') return val;
    if (typeof val === 'object' && val !== null) return val.enabled === true;
    return false;
  };

  const knownFlags = [
    { key: 'MAINTENANCE_MODE', label: 'Maintenance Mode', desc: 'When enabled, customers see a maintenance screen and cannot book.' },
    { key: 'ENABLE_WALK_IN_BOOKINGS', label: 'Walk-in Bookings', desc: 'Allow front-desk walk-in reservations.' },
    { key: 'ENABLE_EARLY_CHECKIN_LATE_CHECKOUT', label: 'Early/Late Checkout', desc: 'Allow staff to approve early check-in and late checkout.' },
    { key: 'ENABLE_ROOM_RELOCATION', label: 'Room Relocation', desc: 'Allow staff to move guests to another room.' },
    { key: 'ENABLE_COUPONS', label: 'Coupons', desc: 'Enable promotional coupon codes.' },
    { key: 'ENABLE_DISPUTES', label: 'Disputes', desc: 'Allow customers to open disputes.' },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader title="Feature Flags" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <View>{[1, 2, 3].map((i) => <SkeletonKPI key={i} />)}</View>
        ) : error ? (
          <ErrorBox message={error} onRetry={fetchSettings} />
        ) : (
          <>
            <Card style={[styles.section, styles.maintenanceCard]}>
              <Text style={styles.sectionTitle}>Maintenance Mode</Text>
              <Text style={styles.sectionDesc}>When enabled, customers see a maintenance screen and cannot book. Admin/Manager/Staff are unaffected.</Text>
              <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{getFlagEnabled('MAINTENANCE_MODE') ? 'ON' : 'OFF'}</Text>
                 <Switch value={getFlagEnabled('MAINTENANCE_MODE')} onValueChange={(v) => toggleFlag('MAINTENANCE_MODE', v)} disabled={savingKey === 'MAINTENANCE_MODE'} trackColor={{ false: c.line, true: c.brick }} thumbColor={c.surface} />
              </View>
            </Card>

            {knownFlags.filter((f) => f.key !== 'MAINTENANCE_MODE').map((flag) => (
              <Card key={flag.key} style={styles.section}>
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>{flag.label}</Text>
                    <Text style={styles.sectionDesc}>{flag.desc}</Text>
                  </View>
                    <Switch value={getFlagEnabled(flag.key)} onValueChange={(v) => toggleFlag(flag.key, v)} disabled={savingKey === flag.key} trackColor={{ false: c.line, true: c.teal }} thumbColor={c.surface} />
                </View>
              </Card>
            ))}

            {Object.keys(settings).filter((k) => !knownFlags.some((f) => f.key === k) && typeof settings[k] !== 'object').map((key) => (
              <Card key={key} style={styles.section}>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{key.replace(/_/g, ' ')}</Text>
                    <Switch value={!!settings[key]} onValueChange={(v) => toggleFlag(key, v)} disabled={savingKey === key} trackColor={{ false: c.line, true: c.teal }} thumbColor={c.surface} />
                </View>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  header: { paddingBottom: 0 },
  content: { padding: 16, gap: 12 },
  section: { padding: 16 },
  maintenanceCard: { borderWidth: 2, borderColor: c.brick },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: c.ink, marginBottom: 4 },
  sectionDesc: { fontSize: 12, color: c.inkMuted, marginBottom: 8 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: c.ink, textTransform: 'capitalize' },
});
