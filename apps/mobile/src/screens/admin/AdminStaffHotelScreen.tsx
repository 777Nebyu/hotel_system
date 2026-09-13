import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { useThemeColors } from '../../theme';
import { Card, Button, ErrorBox } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import ScreenHeader from '../../components/ScreenHeader';

interface AdminStaffHotelScreenProps {
  onBack: () => void;
}

export default function AdminStaffHotelScreen({ onBack }: AdminStaffHotelScreenProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hotels, setHotels] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedHotel, setSelectedHotel] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [assignedStaff, setAssignedStaff] = useState<any[]>([]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ action: string; userId: string; hotelId: string } | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [hotelsRes, usersRes] = await Promise.all([
        request<any>('/admin/hotels', { method: 'GET', token }),
        request<any>('/admin/users?role=STAFF', { method: 'GET', token }),
      ]);
      const h = Array.isArray(hotelsRes) ? hotelsRes : hotelsRes?.hotels ?? [];
      const u = Array.isArray(usersRes) ? usersRes : usersRes?.users ?? [];
      setHotels(h);
      setUsers(u);
      if (h.length > 0 && !selectedHotel) setSelectedHotel(h[0].id);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selectedHotel) {
      request<any>(`/admin/staff-hotels/hotel/${selectedHotel}`, { method: 'GET', token })
        .then((res) => setAssignedStaff(Array.isArray(res) ? res : res?.data ?? []))
        .catch(() => setAssignedStaff([]));
    }
  }, [selectedHotel, token]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleAssign = async () => {
    if (!selectedStaff || !selectedHotel) return;
    try {
      await request('/admin/staff-hotels', { method: 'POST', body: { userId: selectedStaff, hotelId: selectedHotel }, token });
      toast('success', 'Staff assigned');
      setSelectedStaff('');
      const res = await request<any>(`/admin/staff-hotels/hotel/${selectedHotel}`, { method: 'GET', token });
      setAssignedStaff(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err: any) {
      toast('error', err.message || 'Failed to assign');
    }
  };

  const handleRemove = (userId: string) => {
    setConfirmAction({ action: 'remove', userId, hotelId: selectedHotel });
    setConfirmVisible(true);
  };

  const doConfirm = async () => {
    if (!confirmAction) return;
    try {
      await request('/admin/staff-hotels', { method: 'DELETE', body: { userId: confirmAction.userId, hotelId: confirmAction.hotelId }, token });
      toast('success', 'Staff removed');
      setAssignedStaff((prev) => prev.filter((s: any) => s.id !== confirmAction.userId));
    } catch (err: any) {
      toast('error', err.message || 'Failed to remove');
    } finally {
      setConfirmVisible(false);
      setConfirmAction(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Staff–Hotel Assignments" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? <SkeletonList count={4} /> : error ? <ErrorBox message={error} onRetry={fetchData} /> : (
          <>
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Select Hotel</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {hotels.map((h) => (
                  <Button key={h.id} title={h.name?.slice(0, 20)} variant={selectedHotel === h.id ? 'primary' : 'secondary'} size="sm" onPress={() => setSelectedHotel(h.id)} />
                ))}
              </ScrollView>
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Assign Staff Member</Text>
              <View style={styles.pickerRow}>
                <View style={styles.picker}>
                  {users.map((u) => (
                    <Button key={u.id} title={u.fullName?.slice(0, 20)} variant={selectedStaff === u.id ? 'primary' : 'secondary'} size="sm" onPress={() => setSelectedStaff(u.id)} />
                  ))}
                </View>
                <Button title="Assign" variant="gold" size="sm" onPress={handleAssign} disabled={!selectedStaff} />
              </View>
            </Card>

            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Assigned Staff ({assignedStaff.length})</Text>
              {assignedStaff.length === 0 ? (
                <Text style={styles.emptyText}>No staff assigned to this hotel</Text>
              ) : (
                assignedStaff.map((s: any) => (
                  <View key={s.id} style={styles.staffRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName}>{s.fullName}</Text>
                      <Text style={styles.staffEmail}>{s.email}</Text>
                    </View>
                    <Button title="Remove" variant="danger" size="sm" onPress={() => handleRemove(s.id)} />
                  </View>
                ))
              )}
            </Card>
          </>
        )}
      </ScrollView>

      <ConfirmDialog open={confirmVisible} onClose={() => { setConfirmVisible(false); setConfirmAction(null); }} onConfirm={doConfirm} title="Confirm" body="Remove this staff member from the hotel?" />
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  header: { paddingBottom: 0 },
  content: { padding: 16, gap: 12 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: c.ink, marginBottom: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  picker: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  staffRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line },
  staffName: { fontSize: 14, fontWeight: '600', color: c.ink },
  staffEmail: { fontSize: 12, color: c.inkMuted, marginTop: 2 },
  emptyText: { fontSize: 12, color: c.inkMuted, textAlign: 'center', paddingVertical: 12 },
});
