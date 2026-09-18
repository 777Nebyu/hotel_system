import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, RefreshControl, StyleSheet, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';

import { Card, Badge, Button, EmptyState, ErrorBox } from '../../components/Shared';
import ScreenHeader from '../../components/ScreenHeader';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { useThemeColors, font, radius, shadowCard } from '../../theme';
import type { UserRole } from '../../types';

/** All valid roles per RBAC-001: Customer, Staff, Hotel Manager, Admin */
const ALL_ROLES: UserRole[] = ['CUSTOMER', 'STAFF', 'MANAGER', 'ADMIN'];

const ROLE_LABELS: Record<UserRole, string> = {
  CUSTOMER: 'Customer',
  STAFF: 'Staff',
  MANAGER: 'Hotel Manager',
  ADMIN: 'Admin',
};

interface AdminUsersScreenProps {
  onNavigate?: (page: { screen: string } & Record<string, any>) => void;
  onBack: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AdminUsersScreen({ onNavigate: _onNavigate, onBack }: AdminUsersScreenProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const token = useAppSelector((st) => st.auth.session?.accessToken ?? '');
  const currentUserId = useAppSelector((st) => st.auth.session?.user.id);
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [rolePickerUser, setRolePickerUser] = useState<{ id: string; role: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: '', email: '', phone: '', password: '', hotelId: '' });
  const [creating, setCreating] = useState(false);
  const [staffHotels, setStaffHotels] = useState<any[]>([]);

  const [deactUser, setDeactUser] = useState<{ id: string; name: string } | null>(null);
  const [deactReason, setDeactReason] = useState('');
  const [deactBusy, setDeactBusy] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setError(null);
      const res = await request<any>('/admin/users', { method: 'GET', token });
      setUsers(Array.isArray(res) ? res : res?.users ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (createOpen && token) {
      request<any>('/admin/hotels', { method: 'GET', token })
        .then((res) => { const h = Array.isArray(res) ? res : res?.data ?? []; setStaffHotels(h); })
        .catch(() => setStaffHotels([]));
    }
  }, [createOpen, token]);

  const onRefresh = () => { setRefreshing(true); fetchUsers(); };

  /**
   * Per RBAC-001: Roles are parallel, not hierarchical. Admin can assign
   * any of the 4 roles. Per RBAC-006: Admin cannot demote themselves.
   */
  const changeRole = useCallback(async (userId: string, newRole: UserRole) => {
    // RBAC-006: Prevent self-demotion
    if (userId === currentUserId && newRole !== 'ADMIN') {
      toast('error', 'Cannot change your own role. Another Admin must do this.');
      setRolePickerUser(null);
      return;
    }
    try {
      await request(`/admin/users/${userId}/role`, { method: 'PATCH', body: { role: newRole }, token });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast('success', `Role updated to ${ROLE_LABELS[newRole]}`);
    } catch (err: any) {
      toast('error', err.message || 'Failed to update role');
    }
    setRolePickerUser(null);
  }, [currentUserId, toast, token]);

  const toggleActive = useCallback(async (userId: string, currentActive: boolean, userName?: string) => {
    // RBAC-006: Admin cannot deactivate themselves
    if (userId === currentUserId) {
      toast('error', 'Cannot deactivate your own account.');
      return;
    }
    if (currentActive) {
      setDeactReason('');
      setDeactUser({ id: userId, name: userName || 'User' });
    } else {
      try {
        await request(`/admin/users/${userId}/active`, { method: 'PATCH', body: { isActive: true }, token });
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isActive: true } : u)));
        toast('success', 'User activated');
      } catch (err: any) {
        toast('error', err.message || 'Failed to activate user');
      }
    }
  }, [currentUserId, toast, token]);

  const confirmDeactivate = useCallback(async () => {
    if (!deactUser) return;
    setDeactBusy(true);
    try {
      await request(`/admin/users/${deactUser.id}/active`, {
        method: 'PATCH',
        body: { isActive: false, reason: deactReason.trim() || undefined },
        token,
      });
      setUsers((prev) => prev.map((u) => (u.id === deactUser.id ? { ...u, isActive: false } : u)));
      toast('success', 'User deactivated');
      setDeactUser(null);
    } catch (err: any) {
      toast('error', err.message || 'Failed to deactivate user');
    } finally {
      setDeactBusy(false);
    }
  }, [deactUser, deactReason, token, toast]);

  const createStaff = useCallback(async () => {
    if (!staffForm.fullName.trim() || !staffForm.email.trim() || staffForm.password.length < 8) {
      toast('error', 'Name, valid email, and an 8-character password are required.');
      return;
    }
    if (!staffForm.hotelId) {
      toast('error', 'Select a hotel to assign the staff member.');
      return;
    }
    setCreating(true);
    try {
      // Step 1: Register the user account
      const regRes = await request<any>('/auth/register', {
        method: 'POST',
        body: { fullName: staffForm.fullName.trim(), email: staffForm.email.trim(), phone: staffForm.phone.trim() || undefined, password: staffForm.password },
      });
      const newUserId = regRes?.user?.id;
      if (!newUserId) throw new Error('User created but ID not returned');
      // Step 2: Set role to STAFF
      await request(`/admin/users/${newUserId}/role`, { method: 'PATCH', body: { role: 'STAFF' }, token });
      // Step 3: Assign to hotel
      await request(`/admin/hotels/${staffForm.hotelId}/staff`, { method: 'POST', body: { userId: newUserId }, token });
      toast('success', 'Staff account created and assigned to hotel');
      setStaffForm({ fullName: '', email: '', phone: '', password: '', hotelId: '' });
      setCreateOpen(false);
      await fetchUsers();
    } catch (err: any) {
      toast('error', err.message || 'Failed to create staff account');
    } finally {
      setCreating(false);
    }
  }, [fetchUsers, staffForm, toast, token]);

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Manage Users"
        onBack={onBack}
        subtitle="Roles, permissions & account activation"
        rightElement={(
          <Pressable onPress={() => setCreateOpen(true)} accessibilityRole="button" accessibilityLabel="Add staff">
            <Text style={{ color: c.teal, fontWeight: '700', fontSize: 13 }}>Add staff</Text>
          </Pressable>
        )}
      />

      {loading ? (
        <SkeletonList count={6} />
      ) : error ? (
        <ErrorBox message={error} />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" />
      ) : (
        <FlashList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item: user }) => (
            <Card style={styles.userCard}>
              <View style={styles.userHeader}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name ?? user.email}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
                <Badge label={user.role ?? 'user'} status={user.role ?? 'user'} />
              </View>
              <View style={styles.actions}>
                <Button
                  title="Change Role"
                  variant="secondary"
                  size="sm"
                  onPress={() => setRolePickerUser({ id: user.id, role: user.role })}
                />
                <Button
                  title={user.isActive ? 'Deactivate' : 'Activate'}
                  variant={user.isActive ? 'danger' : 'gold'}
                  size="sm"
                  onPress={() => toggleActive(user.id, user.isActive, user.name ?? user.email)}
                />
              </View>
            </Card>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.teal} colors={[c.teal]} />}
          contentContainerStyle={styles.content}
        />
      )}

      {/* ─── Role Picker Modal ─── */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCreateOpen(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Create Staff Account</Text>
            <Text style={styles.modalSubtitle}>The new user will be created with the STAFF role and assigned to a hotel.</Text>
            {([
              ['fullName', 'Full name'], ['email', 'Email'], ['phone', 'Phone (optional)'], ['password', 'Temporary password (8+ characters)'],
            ] as const).map(([key, placeholder]) => (
              <TextInput
                key={key}
                value={staffForm[key]}
                onChangeText={(value) => setStaffForm((prev) => ({ ...prev, [key]: value }))}
                placeholder={placeholder}
                placeholderTextColor={c.inkMuted}
                style={styles.formInput}
                secureTextEntry={key === 'password'}
                autoCapitalize={key === 'email' ? 'none' : 'sentences'}
                keyboardType={key === 'email' ? 'email-address' : key === 'phone' ? 'phone-pad' : 'default'}
              />
            ))}
            <Text style={{ fontSize: 13, fontWeight: '600', color: c.ink, marginTop: 8, marginBottom: 4 }}>Assign to hotel</Text>
            <ScrollView style={{ maxHeight: 120, borderWidth: 1, borderColor: c.line, borderRadius: 8, marginBottom: 12 }}>
              {staffHotels.map((h: any) => (
                <Pressable
                  key={h.id}
                  onPress={() => setStaffForm((prev) => ({ ...prev, hotelId: h.id }))}
                  style={[{ padding: 10, borderBottomWidth: 1, borderBottomColor: c.line }, staffForm.hotelId === h.id && { backgroundColor: c.tealTint }]}
                >
                  <Text style={{ color: staffForm.hotelId === h.id ? c.teal : c.ink }}>{h.name}</Text>
                </Pressable>
              ))}
              {staffHotels.length === 0 && <Text style={{ padding: 10, color: c.inkMuted }}>Loading hotels…</Text>}
            </ScrollView>
            <View style={styles.actions}>
              <Button title="Cancel" variant="secondary" onPress={() => setCreateOpen(false)} />
              <Button title={creating ? 'Creating…' : 'Create staff'} onPress={createStaff} loading={creating} />
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={!!rolePickerUser}
        transparent
        animationType="fade"
        onRequestClose={() => setRolePickerUser(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setRolePickerUser(null)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Role</Text>
            <Text style={styles.modalSubtitle}>
              Select a role for this user. Roles are parallel, not hierarchical.
            </Text>
            {ALL_ROLES.map((r) => {
              const isCurrentRole = r === rolePickerUser?.role;
              return (
                <Pressable
                  key={r}
                  style={[styles.roleOption, isCurrentRole && styles.roleOptionActive]}
                  onPress={() => {
                    if (!isCurrentRole && rolePickerUser) changeRole(rolePickerUser.id, r);
                  }}
                  disabled={isCurrentRole}
                >
                  <View style={styles.roleOptionRow}>
                    <View style={[styles.roleRadio, isCurrentRole && styles.roleRadioActive]} />
                    <View style={styles.roleOptionInfo}>
                      <Text style={[styles.roleOptionLabel, isCurrentRole && styles.roleOptionLabelActive]}>
                        {ROLE_LABELS[r]}
                      </Text>
                      <Text style={styles.roleOptionHint}>
                        {r === 'CUSTOMER' && 'Booking and profile management'}
                        {r === 'STAFF' && 'Hotel operations (check-in/out, bookings) — scoped to assigned hotel(s)'}
                        {r === 'MANAGER' && 'Hotel management (rooms, pricing, reports) — scoped to owned hotel(s)'}
                        {r === 'ADMIN' && 'Full platform access, no resource scoping'}
                      </Text>
                    </View>
                  </View>
                  {isCurrentRole && <Text style={styles.currentBadge}>Current</Text>}
                </Pressable>
              );
            })}
            <Button title="Cancel" variant="secondary" onPress={() => setRolePickerUser(null)} />
          </View>
        </Pressable>
      </Modal>

      {/* ─── Deactivation Modal ─── */}
      <Modal
        visible={!!deactUser}
        transparent
        animationType="fade"
        onRequestClose={() => setDeactUser(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDeactUser(null)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Deactivate User</Text>
            <Text style={styles.modalSubtitle}>
              Are you sure you want to deactivate {deactUser?.name}? Provide a reason for the audit trail.
            </Text>
            <TextInput
              style={[styles.formInput, { minHeight: 80, textAlignVertical: 'top' }]}
              value={deactReason}
              onChangeText={setDeactReason}
              placeholder="Reason for deactivation (optional)…"
              placeholderTextColor={c.inkMuted}
              multiline
              numberOfLines={3}
            />
            <View style={styles.actions}>
              <Button title="Cancel" variant="secondary" onPress={() => setDeactUser(null)} />
              <Button
                title={deactBusy ? 'Deactivating…' : 'Deactivate'}
                variant="danger"
                onPress={confirmDeactivate}
                loading={deactBusy}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.paper },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  userCard: { padding: 16, borderRadius: radius.card, ...shadowCard },
  userHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  userInfo: { flex: 1 },
  userName: { fontFamily: font.display, fontSize: 16, fontWeight: '700', color: c.ink },
  userEmail: { fontSize: 13, color: c.inkMuted, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  /* ─── Role Picker Modal ─── */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: c.surface, borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, gap: 12, ...shadowCard },
  modalTitle: { fontFamily: font.display, fontSize: 20, fontWeight: '700', color: c.ink },
  modalSubtitle: { fontSize: 13, color: c.inkMuted, marginBottom: 4 },
  roleOption: { borderWidth: 1, borderColor: c.line, borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roleOptionActive: { borderColor: c.teal, backgroundColor: c.tealTint },
  roleOptionRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  roleRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: c.lineStrong },
  roleRadioActive: { borderColor: c.teal, backgroundColor: c.teal },
  roleOptionInfo: { flex: 1 },
  roleOptionLabel: { fontSize: 15, fontWeight: '700', color: c.ink },
  roleOptionLabelActive: { color: c.tealDeep },
  roleOptionHint: { fontSize: 12, color: c.inkMuted, marginTop: 2, lineHeight: 16 },
  currentBadge: { fontSize: 11, fontWeight: '700', color: c.tealDeep, backgroundColor: c.tealTint, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  formInput: { borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: c.ink, backgroundColor: c.paper },
});
