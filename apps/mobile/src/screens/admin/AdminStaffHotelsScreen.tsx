/**
 * AdminStaffHotelsScreen
 * Policy: 27-staff-management.md — Admin assigns Staff to hotels via StaffHotel table.
 * - List all current staff–hotel assignments
 * - Assign a staff member to a hotel
 * - Remove a staff–hotel assignment
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { useThemeColors, shadowCard } from '../../theme';
import { Badge, Button, Card, EmptyState, ErrorBox } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import ScreenHeader from '../../components/ScreenHeader';

interface Props {
  onBack: () => void;
}

export default function AdminStaffHotelsScreen({ onBack }: Props) {
  const c = useThemeColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const token        = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const toast        = useToast();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Assignments list (StaffHotel rows with user + hotel nested)
  const [assignments, setAssignments] = useState<any[]>([]);

  // For assign modal
  const [showAssign, setShowAssign]   = useState(false);
  const [staffUsers, setStaffUsers]   = useState<any[]>([]);
  const [hotels,     setHotels]       = useState<any[]>([]);
  const [selUser,    setSelUser]       = useState<string>('');
  const [selHotel,   setSelHotel]     = useState<string>('');
  const [assigning,  setAssigning]    = useState(false);

  // For remove confirm
  const [removeId,   setRemoveId]     = useState<string | null>(null);
  const [confirmOpen,setConfirmOpen]  = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const hotelRes = await request<any>('/admin/hotels', { method: 'GET', token });
      const hts = Array.isArray(hotelRes) ? hotelRes : hotelRes?.data ?? [];
      const allAssignments: any[] = [];
      await Promise.all(
        hts.map(async (hotel: any) => {
          try {
            const staffRes = await request<any[]>(`/admin/hotels/${hotel.id}/staff`, { method: 'GET', token });
            const staffList = Array.isArray(staffRes) ? staffRes : (staffRes as any)?.data ?? [];
            for (const s of staffList) {
              allAssignments.push({ id: `${s.id}-${hotel.id}`, userId: s.id, hotelId: hotel.id, user: s, hotel });
            }
          } catch { /* skip hotels with no staff */ }
        }),
      );
      setAssignments(allAssignments);
    } catch (err: any) {
      setError(err.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const openAssignModal = async () => {
    try {
      const [usersRes, hotelRes] = await Promise.all([
        request<any>('/admin/users', { method: 'GET', token }),
        request<any>('/admin/hotels', { method: 'GET', token }),
      ]);
      const allUsers = Array.isArray(usersRes) ? usersRes : usersRes?.users ?? [];
      const hts = Array.isArray(hotelRes) ? hotelRes : hotelRes?.data ?? [];
      setStaffUsers(allUsers.filter((u: any) => u.role === 'STAFF' || u.role === 'MANAGER'));
      setHotels(hts);
      setSelUser(''); setSelHotel('');
      setShowAssign(true);
    } catch (err: any) {
      toast('error', err.message || 'Failed to load data');
    }
  };

  const handleAssign = async () => {
    if (!selUser || !selHotel) {
      toast('error', 'Select both a staff member and a hotel');
      return;
    }
    setAssigning(true);
    try {
      await request(`/admin/hotels/${selHotel}/staff`, {
        method: 'POST',
        body: { userId: selUser },
        token,
      });
      toast('success', 'Staff assigned to hotel');
      setShowAssign(false);
      void load();
    } catch (err: any) {
      toast('error', err.message || 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  const confirmRemove = (id: string) => {
    setRemoveId(id);
    setConfirmOpen(true);
  };

  const handleRemove = async () => {
    if (!removeId) return;
    const assignment = assignments.find((a) => a.id === removeId);
    if (!assignment) return;
    try {
      await request(`/admin/hotels/${assignment.hotelId}/staff/${assignment.userId}`, {
        method: 'DELETE',
        token,
      });
      setAssignments((prev) => prev.filter((a) => a.id !== removeId));
      toast('success', 'Assignment removed');
    } catch (err: any) {
      toast('error', err.message || 'Failed to remove');
    } finally {
      setConfirmOpen(false);
      setRemoveId(null);
    }
  };

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Staff–Hotel Assignments"
        onBack={onBack}
        subtitle={`${assignments.length} active assignment${assignments.length !== 1 ? 's' : ''}`}
        rightElement={
          <Pressable
            onPress={openAssignModal}
            hitSlop={8}
            style={s.addBtn}
            accessibilityRole="button"
            accessibilityLabel="Assign staff to hotel"
          >
            <Ionicons name="add-circle" size={28} color={c.teal} />
          </Pressable>
        }
      />

      {loading ? (
        <SkeletonList count={5} />
      ) : error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : assignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          subtitle="Tap + to assign staff members to hotels."
        />
      ) : (
        <FlashList
          data={assignments}
          keyExtractor={(item) => item.id}
          renderItem={({ item: a }) => (
            <Card style={s.card}>
              <View style={s.cardRow}>
                <View style={[s.avatar, { backgroundColor: c.tealTint }]}>
                  <Text style={s.avatarText}>
                    {(a.user?.fullName ?? a.user?.email ?? '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.staffName} numberOfLines={1}>
                    {a.user?.fullName ?? a.user?.email ?? 'Staff'}
                  </Text>
                  <Text style={s.staffEmail} numberOfLines={1}>
                    {a.user?.email ?? ''}
                  </Text>
                  <View style={s.badgeRow}>
                    <Badge status={a.user?.role ?? 'STAFF'} label={a.user?.role ?? 'STAFF'} />
                  </View>
                </View>

                <Ionicons name="arrow-forward" size={16} color={c.inkMuted} style={s.arrow} />

                <View style={s.hotelInfo}>
                  <Text style={s.hotelName} numberOfLines={2}>
                    {a.hotel?.name ?? 'Hotel'}
                  </Text>
                  <Badge status={a.hotel?.status ?? 'ACTIVE'} label={a.hotel?.status ?? 'ACTIVE'} />
                </View>

                <Pressable
                  onPress={() => confirmRemove(a.id)}
                  hitSlop={8}
                  style={s.removeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Remove assignment"
                >
                  <Ionicons name="trash-outline" size={20} color={c.brick} />
                </Pressable>
              </View>
              <Text style={s.assignedOn}>
                Assigned {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </Card>
          )}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={c.teal} />
          }
        />
      )}

      {/* ── Assign Modal ────────────────────────────────────────────────────── */}
      <Modal
        visible={showAssign}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAssign(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setShowAssign(false)}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Assign Staff to Hotel</Text>
            <Text style={s.modalSub}>
              Select a staff member and hotel. Per policy, one staff member can be assigned to multiple hotels.
            </Text>

            {/* Staff picker */}
            <Text style={s.pickerLabel}>Staff Member</Text>
            <ScrollView style={s.pickerList} nestedScrollEnabled>
              {staffUsers.map((u) => (
                <Pressable
                  key={u.id}
                  style={[s.pickerItem, selUser === u.id && s.pickerItemActive]}
                  onPress={() => setSelUser(u.id)}
                >
                  <Text style={[s.pickerItemText, selUser === u.id && s.pickerItemTextActive]}>
                    {u.fullName ?? u.email}
                  </Text>
                  <Badge status={u.role} label={u.role} />
                </Pressable>
              ))}
              {staffUsers.length === 0 && (
                <Text style={s.pickerEmpty}>No staff or manager accounts found</Text>
              )}
            </ScrollView>

            {/* Hotel picker */}
            <Text style={s.pickerLabel}>Hotel</Text>
            <ScrollView style={s.pickerList} nestedScrollEnabled>
              {hotels.map((h) => (
                <Pressable
                  key={h.id}
                  style={[s.pickerItem, selHotel === h.id && s.pickerItemActive]}
                  onPress={() => setSelHotel(h.id)}
                >
                  <Text style={[s.pickerItemText, selHotel === h.id && s.pickerItemTextActive]}>
                    {h.name}
                  </Text>
                  <Badge status={h.status} />
                </Pressable>
              ))}
            </ScrollView>

            <View style={s.modalActions}>
              <Button title="Cancel"  variant="secondary" onPress={() => setShowAssign(false)} />
              <Button
                title={assigning ? 'Assigning…' : 'Assign'}
                onPress={handleAssign}
                disabled={assigning || !selUser || !selHotel}
              />
            </View>
          </View>
        </Pressable>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setRemoveId(null); }}
        onConfirm={handleRemove}
        title="Remove Assignment"
        body="Remove this staff–hotel assignment? The staff member will lose access to this hotel."
      />
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  root:   { flex: 1, backgroundColor: c.paper },
  list:   { padding: 16, gap: 12, paddingBottom: 48 },
  addBtn: { padding: 4 },

  // ── Card
  card:       { padding: 14, ...shadowCard },
  cardRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:     { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '800', color: c.teal },
  cardInfo:   { flex: 1.2 },
  staffName:  { fontSize: 14, fontWeight: '700', color: c.ink },
  staffEmail: { fontSize: 11, color: c.inkMuted, marginTop: 1 },
  badgeRow:   { marginTop: 4 },
  arrow:      { marginHorizontal: 2 },
  hotelInfo:  { flex: 1, alignItems: 'flex-end', gap: 4 },
  hotelName:  { fontSize: 13, fontWeight: '600', color: c.ink, textAlign: 'right' },
  removeBtn:  { padding: 6, marginLeft: 4 },
  assignedOn: { fontSize: 11, color: c.inkMuted, marginTop: 8 },

  // ── Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, maxHeight: '85%',
  },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: c.line, alignSelf: 'center', marginBottom: 16 },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: c.ink, marginBottom: 4 },
  modalSub:      { fontSize: 13, color: c.inkMuted, marginBottom: 16, lineHeight: 18 },
  pickerLabel:   { fontSize: 12, fontWeight: '700', color: c.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  pickerList:    { maxHeight: 140, borderWidth: 1, borderColor: c.line, borderRadius: 10, marginBottom: 16 },
  pickerItem:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  pickerItemActive:     { backgroundColor: c.tealTint },
  pickerItemText:       { fontSize: 14, color: c.ink, flex: 1 },
  pickerItemTextActive: { fontWeight: '700', color: c.teal },
  pickerEmpty:   { padding: 12, fontSize: 13, color: c.inkMuted, textAlign: 'center' },
  modalActions:  { flexDirection: 'row', gap: 10, marginTop: 8 },
});
