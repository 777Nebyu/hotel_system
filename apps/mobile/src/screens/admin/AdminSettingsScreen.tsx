import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Switch, StyleSheet } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { useThemeColors } from '../../theme';
import { Card, Button, ErrorBox } from '../../components/Shared';
import { SkeletonKPI } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import ScreenHeader from '../../components/ScreenHeader';

interface AdminSettingsScreenProps {
  onBack: () => void;
}

interface Setting {
  key: string;
  value: any;
  label: string;
}

export default function AdminSettingsScreen({ onBack }: AdminSettingsScreenProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});

  const fetchSettings = async () => {
    try {
      setError(null);
      const res = await request<any>('/admin/settings', { method: 'GET', token });
      const settingsMap: Record<string, any> = {};
      const items = Array.isArray(res) ? res : res?.settings ?? [];
      items.forEach((s: Setting) => {
        const v = s.value;
        if (s.key === 'commissionRate' && v && typeof v === 'object' && 'rate' in v) {
          settingsMap[s.key] = v.rate;
        } else if (s.key === 'currency' && v && typeof v === 'object' && 'code' in v) {
          settingsMap[s.key] = v.code;
        } else if (s.key === 'paymentMethods' && v && typeof v === 'object' && 'methods' in v) {
          settingsMap[s.key] = v.methods;
        } else {
          settingsMap[s.key] = v;
        }
      });
      setSettings(settingsMap);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchSettings(); }, []);

  const updateSetting = async (key: string, value: any) => {
    setSaving(true);
    try {
      let wrappedValue: Record<string, unknown>;
      if (key === 'commissionRate') {
        wrappedValue = { rate: Number(value) || 0 };
      } else if (key === 'currency') {
        wrappedValue = { code: value };
      } else if (key === 'paymentMethods') {
        wrappedValue = { methods: value };
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        wrappedValue = value;
      } else {
        wrappedValue = { raw: value };
      }
      await request(`/admin/settings/${key}`, { method: 'PUT', body: { value: wrappedValue }, token });
      setSettings((prev) => ({ ...prev, [key]: value }));
      toast('success', `${key} updated`);
    } catch (err: any) {
      toast('error', err.message || 'Failed to update setting');
    } finally {
      setSaving(false);
    }
  };

  const togglePaymentMethod = (method: string) => {
    const current = settings.paymentMethods ?? [];
    const updated = current.includes(method)
      ? current.filter((m: string) => m !== method)
      : [...current, method];
    updateSetting('paymentMethods', updated);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View>
            {[1, 2, 3].map((i) => (
              <SkeletonKPI key={i} />
            ))}
          </View>
        ) : error ? (
          <ErrorBox message={error} onRetry={fetchSettings} />
        ) : (
          <>
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Commission Rate</Text>
              <Text style={styles.sectionDescription}>Platform commission percentage on each booking</Text>
              <TextInput
                style={styles.input}
                value={settings.commissionRate?.toString() ?? ''}
                onChangeText={(text) => setSettings((prev) => ({ ...prev, commissionRate: text }))}
                onBlur={() => updateSetting('commissionRate', parseFloat(settings.commissionRate) || 0)}
                keyboardType="numeric"
                placeholder="e.g. 10"
                placeholderTextColor={c.inkMuted}
              />
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Currency</Text>
              <Text style={styles.sectionDescription}>Default currency for all transactions</Text>
              <TextInput
                style={styles.input}
                value={settings.currency ?? ''}
                onChangeText={(text) => setSettings((prev) => ({ ...prev, currency: text }))}
                onBlur={() => updateSetting('currency', settings.currency)}
                placeholder="e.g. USD"
                placeholderTextColor={c.inkMuted}
              />
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Payment Methods</Text>
              <Text style={styles.sectionDescription}>Enable or disable payment methods</Text>
              {['credit_card', 'paypal', 'bank_transfer', 'cash'].map((method) => (
                <View key={method} style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>{method.replace('_', ' ')}</Text>
                  <Switch
                    value={(settings.paymentMethods ?? []).includes(method)}
                    onValueChange={() => togglePaymentMethod(method)}
                    trackColor={{ false: c.line, true: c.teal }}
                    thumbColor={c.surface}
                  />
                </View>
              ))}
            </Card>

            <Button
              title={saving ? 'Saving...' : 'Save All Settings'}
              onPress={async () => {
                setSaving(true);
                try {
                  await Promise.all([
                    request(`/admin/settings/commissionRate`, { method: 'PUT', body: { value: { rate: parseFloat(settings.commissionRate) || 0 } }, token }),
                    request(`/admin/settings/currency`, { method: 'PUT', body: { value: { code: settings.currency } }, token }),
                    request(`/admin/settings/paymentMethods`, { method: 'PUT', body: { value: { methods: settings.paymentMethods ?? [] } }, token }),
                  ]);
                  toast('success', 'All settings saved');
                } catch (err: any) {
                  toast('error', err.message || 'Failed to save settings');
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  content: { padding: 16, gap: 16 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: c.ink, marginBottom: 4 },
  sectionDescription: { fontSize: 12, color: c.inkMuted, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 12, fontSize: 14, color: c.ink, backgroundColor: c.surface },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line },
  toggleLabel: { fontSize: 14, color: c.ink, textTransform: 'capitalize' },
});
