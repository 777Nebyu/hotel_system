import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, TextInput, RefreshControl, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { useThemeColors } from '../../theme';
import { Card, Badge, Button, ErrorBox } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import ScreenHeader from '../../components/ScreenHeader';

interface AdminEmergencyScreenProps {
  onBack: () => void;
}

export default function AdminEmergencyScreen({ onBack }: AdminEmergencyScreenProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hotels, setHotels] = useState<any[]>([]);
  const [selectedHotel, setSelectedHotel] = useState('');
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmType, setConfirmType] = useState<'suspend' | 'activate'>('suspend');

  const fetchData = async () => {
    try {
      setError(null);
      const res = await request<any>('/admin/hotels', { method: 'GET', token });
      setHotels(Array.isArray(res) ? res : res?.hotels ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load hotels');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadAuditLog = async (hotelId: string) => {
    try {
      const res = await request<any>(`/admin/hotels/${hotelId}/emergency-log`, { method: 'GET', token });
      setAuditLog(Array.isArray(res) ? res : res?.data ?? []);
    } catch { setAuditLog([]); }
  };

  useEffect(() => {
    if (selectedHotel) loadAuditLog(selectedHotel);
  }, [selectedHotel, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleEmergency = async () => {
    if (confirmText !== 'CONFIRM') {
      return toast('error', 'Type CONFIRM to proceed');
    }
    const newStatus = confirmType === 'suspend' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await request(`/admin/hotels/${selectedHotel}/emergency`, {
        method: 'PATCH',
        body: { status: newStatus, reason: reason || 'Emergency action', confirmText: 'CONFIRM' },
        token,
      });
      toast('success', newStatus === 'SUSPENDED' ? 'Hotel suspended' : 'Hotel reactivated');
      setReason('');
      setConfirmText('');
      fetchData();
      loadAuditLog(selectedHotel);
    } catch (err: any) {
      toast('error', err.message || 'Failed');
    }
  };

  const triggerAction = (type: 'suspend' | 'activate') => {
    setConfirmType(type);
    setConfirmVisible(true);
  };

  const doConfirmAction = () => {
    setConfirmVisible(false);
    handleEmergency();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Emergency Suspend" onBack={onBack} />

      {loading ? (
        <View style={styles.content}>
          <SkeletonList count={4} />
        </View>
      ) : error ? (
        <View style={styles.content}>
          <ErrorBox message={error} onRetry={fetchData} />
        </View>
      ) : (
        <FlashList
          data={hotels}
          keyExtractor={(item) => item.id}
          renderItem={({ item: h }) => (
            <View style={styles.hotelRow}>
              <Text style={styles.hotelName}>{h.name}</Text>
              <Badge status={h.status} />
              <Button title={h.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'} variant={h.status === 'SUSPENDED' ? 'gold' : 'danger'} size="sm" onPress={() => { setSelectedHotel(h.id); triggerAction(h.status === 'SUSPENDED' ? 'activate' : 'suspend'); }} />
            </View>
          )}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Select Hotel</Text>
            </Card>
          }
          ListEmptyComponent={
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Select Hotel</Text>
              <Text style={styles.emptyText}>No hotels available</Text>
            </Card>
          }
          ListFooterComponent={
            selectedHotel ? (
              <>
                <Card style={styles.section}>
                  <Text style={styles.sectionTitle}>Emergency Action</Text>
                  <Text style={styles.label}>Reason</Text>
                   <TextInput value={reason} onChangeText={setReason} placeholder="Reason for emergency action" placeholderTextColor={c.inkMuted} style={styles.input} />
                   <Text style={styles.label}>Type CONFIRM to proceed</Text>
                   <TextInput value={confirmText} onChangeText={setConfirmText} placeholder="CONFIRM" placeholderTextColor={c.inkMuted} style={styles.input} autoCapitalize="characters" />
                </Card>

                {auditLog.length === 0 ? (
                  <Card style={styles.section}>
                    <Text style={styles.sectionTitle}>Emergency Audit Log</Text>
                    <Text style={styles.emptyText}>No emergency actions recorded</Text>
                  </Card>
                ) : (
                  <Card style={styles.section}>
                    <Text style={styles.sectionTitle}>Emergency Audit Log</Text>
                    <FlashList
                      data={auditLog}
                      keyExtractor={(item, index) => `${index}`}
                      renderItem={({ item: log }) => (
                        <View style={styles.logRow}>
                          <Text style={styles.logAction}>{log.action}</Text>
                          <Text style={styles.logDetail}>{log.details}</Text>
                          <Text style={styles.logDate}>{new Date(log.createdAt).toLocaleString()}</Text>
                        </View>
                      )}
                      scrollEnabled={false}
                    />
                  </Card>
                )}
              </>
            ) : null
          }
        />
      )}

      <ConfirmDialog open={confirmVisible} onClose={() => setConfirmVisible(false)} onConfirm={doConfirmAction} title={confirmType === 'suspend' ? 'Emergency Suspend' : 'Reactivate'} body={`Are you sure you want to ${confirmType} this hotel? All active bookings will be cancelled.`} />
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  content: { padding: 16, gap: 12 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: c.ink, marginBottom: 12 },
  label: { fontSize: 12, color: c.inkMuted, marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 12, fontSize: 14, color: c.ink, backgroundColor: c.surface },
  hotelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line, gap: 8 },
  hotelName: { flex: 1, fontSize: 14, fontWeight: '600', color: c.ink },
  logRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line },
  logAction: { fontSize: 12, fontWeight: '700', color: c.brick },
  logDetail: { fontSize: 12, color: c.inkMuted, marginTop: 2 },
  logDate: { fontSize: 12, color: c.inkMuted, marginTop: 2 },
  emptyText: { fontSize: 12, color: c.inkMuted, textAlign: 'center', paddingVertical: 12 },
});
