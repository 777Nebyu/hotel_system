/**
 * AdminHotelsScreen
 * Policy 16-hotel-onboarding-approval:
 *   DRAFT → PENDING → ACTIVE → SUSPENDED / REJECTED
 * Fixes:
 *  - Status comparisons now use UPPERCASE (API returns uppercase)
 *  - Added manager assignment button (PATCH /admin/hotels/:id/manager)
 *  - Added search filter
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { request, requestFormData } from '../../api';
import { useThemeColors, shadowCard } from '../../theme';
import { Badge, Button, Card, EmptyState, ErrorBox } from '../../components/Shared';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import ScreenHeader from '../../components/ScreenHeader';

interface Props {
  onNavigate?: (page: { screen: string } & Record<string, any>) => void;
  onBack: () => void;
}

// API returns UPPERCASE statuses — policy lifecycle:
// PENDING_APPROVAL → ACTIVE → SUSPENDED | REJECTED
const STATUS_ACTIONS: Record<string, { next: string; label: string; variant: any }[]> = {
  PENDING_APPROVAL: [
    { next: 'ACTIVE',   label: 'Approve', variant: 'gold'    },
    { next: 'REJECTED', label: 'Reject',  variant: 'danger'  },
  ],
  ACTIVE:    [{ next: 'SUSPENDED', label: 'Suspend', variant: 'danger' }],
  SUSPENDED: [{ next: 'ACTIVE',    label: 'Reinstate', variant: 'gold' }],
  REJECTED:  [{ next: 'PENDING_APPROVAL', label: 'Re-review', variant: 'secondary' }],
};

export default function AdminHotelsScreen({ onNavigate, onBack }: Props) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const c = useThemeColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const token = useAppSelector((st) => st.auth.session?.accessToken ?? '');
  const toast = useToast();

  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [hotels,     setHotels]     = useState<any[]>([]);
  const [search,     setSearch]     = useState('');

  // Status confirm
  const [confirmOpen,   setConfirmOpen]   = useState(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; status: string; label: string } | null>(null);

  // Reason modal (replaces Alert.prompt for Android compat)
  const [reasonOpen,    setReasonOpen]    = useState(false);
  const [reasonValue,   setReasonValue]   = useState('');
  const [reasonBusy,    setReasonBusy]    = useState(false);

  // Manager assign modal
  const [assignOpen,    setAssignOpen]    = useState(false);
  const [assignHotelId, setAssignHotelId] = useState('');
  const [managers,      setManagers]      = useState<any[]>([]);
  const [selManager,    setSelManager]    = useState('');
  const [assigning,     setAssigning]     = useState(false);
  const [importOpen,    setImportOpen]    = useState(false);
  const [importHotelId, setImportHotelId] = useState('');
  const [roomCsv,       setRoomCsv]       = useState('');
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState<any>(null);

  const fetchHotels = useCallback(async () => {
    setError(null);
    try {
      const res = await request<any>('/admin/hotels', { method: 'GET', token });
      setHotels(Array.isArray(res) ? res : res?.data ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load hotels');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void fetchHotels(); }, [fetchHotels]);

  // Status transition
  const triggerAction = (hotelId: string, nextStatus: string, label: string) => {
    setPendingAction({ id: hotelId, status: nextStatus, label });
    const requiresReason = nextStatus === 'REJECTED' || nextStatus === 'SUSPENDED';
    if (requiresReason) {
      setReasonValue('');
      setReasonOpen(true);
    } else {
      setConfirmOpen(true);
    }
  };

  const submitWithReason = async () => {
    if (!pendingAction) return;
    const trimmed = reasonValue.trim();
    if (!trimmed) { toast('error', 'Reason is required'); return; }
    if (trimmed.length < 10) { toast('error', 'Reason must be at least 10 characters'); return; }
    setReasonBusy(true);
    try {
      await request(`/admin/hotels/${pendingAction.id}/status`, {
        method: 'PATCH',
        body: { status: pendingAction.status, rejectionReason: reasonValue.trim() },
        token,
      });
      setHotels((prev) =>
        prev.map((h) => h.id === pendingAction.id ? { ...h, status: pendingAction.status } : h),
      );
      toast('success', `Hotel ${pendingAction.label.toLowerCase()}d`);
      setReasonOpen(false);
      setPendingAction(null);
    } catch (err: any) {
      toast('error', err.message || 'Failed');
    } finally {
      setReasonBusy(false);
    }
  };

  const confirmStatus = async () => {
    if (!pendingAction) return;
    try {
      await request(`/admin/hotels/${pendingAction.id}/status`, {
        method: 'PATCH',
        body: { status: pendingAction.status },
        token,
      });
      setHotels((prev) =>
        prev.map((h) => h.id === pendingAction.id ? { ...h, status: pendingAction.status } : h),
      );
      toast('success', `Hotel ${pendingAction.label.toLowerCase()}d`);
    } catch (err: any) {
      toast('error', err.message || 'Failed');
    } finally {
      setConfirmOpen(false);
      setPendingAction(null);
    }
  };

  // Open manager assign modal
  const openAssign = async (hotelId: string) => {
    setAssignHotelId(hotelId);
    setSelManager('');
    try {
      const res = await request<any>('/admin/users?role=MANAGER', { method: 'GET', token });
      const all = Array.isArray(res) ? res : res?.data ?? [];
      setManagers(all);
      setAssignOpen(true);
    } catch (err: any) {
      toast('error', err.message || 'Failed to load managers');
    }
  };

  const confirmAssign = async () => {
    if (!selManager) { toast('error', 'Select a manager'); return; }
    setAssigning(true);
    try {
      await request(`/admin/hotels/${assignHotelId}/manager`, {
        method: 'PATCH',
        body: { managerId: selManager },
        token,
      });
      setHotels((prev) =>
        prev.map((h) => h.id === assignHotelId ? { ...h, managerId: selManager } : h),
      );
      toast('success', 'Manager assigned');
      setAssignOpen(false);
    } catch (err: any) {
      toast('error', err.message || 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  const openImport = (hotelId: string) => {
    setImportHotelId(hotelId);
    setRoomCsv('');
    setImportResult(null);
    setImportOpen(true);
  };

  // IMPexp-005: Dry-run first, then confirm to import
  const validateImport = async () => {
    if (!roomCsv.trim()) { toast('error', 'Paste CSV room data first'); return; }
    setImporting(true);
    try {
      const { File, Paths } = await import('expo-file-system');
      const file = new File(Paths.document, 'rooms_import.csv');
      file.write(roomCsv);
      const form = new FormData();
      form.append('file', { uri: file.uri, name: 'rooms.csv', type: 'text/csv' } as any);
      const result = await requestFormData<any>(`/admin/import/hotels/${importHotelId}/rooms?dryRun=true`, form, token);
      setImportResult(result);
      if (result.errors?.length > 0) {
        toast('error', `${result.failedCount} row(s) have errors. Review below.`);
      } else {
        toast('success', `Validation passed: ${result.importedCount} room(s) ready to import`);
      }
    } catch (err: any) {
      toast('error', err.message || 'Validation failed');
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const { File, Paths } = await import('expo-file-system');
      const file = new File(Paths.document, 'rooms_import.csv');
      file.write(roomCsv);
      const form = new FormData();
      form.append('file', { uri: file.uri, name: 'rooms.csv', type: 'text/csv' } as any);
      const result = await requestFormData<any>(`/admin/import/hotels/${importHotelId}/rooms`, form, token);
      toast('success', `Imported ${result.importedCount} room(s)`);
      setImportOpen(false);
      setImportResult(null);
      await fetchHotels();
    } catch (err: any) {
      toast('error', err.message || 'Failed to import rooms');
    } finally {
      setImporting(false);
    }
  };

  const filtered = useMemo(() => hotels.filter((h) =>
    !search || h.name?.toLowerCase().includes(search.toLowerCase()) ||
    h.city?.name?.toLowerCase().includes(search.toLowerCase()),
  ), [hotels, search]);

  const pending = useMemo(() => filtered.filter((h) => h.status === 'PENDING_APPROVAL').length, [filtered]);

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Hotels"
        onBack={onBack}
        subtitle={pending > 0 ? `${pending} pending approval` : 'Manage all hotels'}
      />

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color={c.inkMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name or city…"
          placeholderTextColor={c.inkMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {loading ? (
        <SkeletonList count={5} />
      ) : error ? (
        <ErrorBox message={error} onRetry={fetchHotels} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No hotels found" />
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item: hotel }) => {
            const actions = STATUS_ACTIONS[hotel.status] ?? [];
            return (
              <Card style={s.card}>
                <View style={s.cardHeader}>
                  <View style={s.flex}>
                    <Text style={s.hotelName} numberOfLines={1}>{hotel.name}</Text>
                    <Text style={s.hotelMeta}>
                      {hotel.city?.name ?? hotel.cityId ?? ''}
                      {hotel.starRating ? ` · ${'★'.repeat(hotel.starRating)}` : ''}
                    </Text>
                    {hotel.manager && (
                      <Text style={s.managerName}>
                        Manager: {hotel.manager.fullName ?? hotel.manager.email}
                      </Text>
                    )}
                  </View>
                  {/* Status badge — uppercase matches API */}
                  <Badge status={hotel.status} />
                </View>

                {/* Stats row */}
                <View style={s.statsRow}>
                  <View style={s.stat}>
                    <Text style={s.statValue}>{hotel._count?.rooms ?? 0}</Text>
                    <Text style={s.statLabel}>Rooms</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statValue}>{hotel._count?.bookings ?? hotel.reviewCount ?? 0}</Text>
                    <Text style={s.statLabel}>Bookings</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statValue}>{hotel.avgRating?.toFixed(1) ?? '—'}</Text>
                    <Text style={s.statLabel}>Rating</Text>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={s.actions}>
                  {actions.map((act) => (
                    <Button
                      key={act.next}
                      title={act.label}
                      variant={act.variant}
                      size="sm"
                      onPress={() => triggerAction(hotel.id, act.next, act.label)}
                    />
                  ))}
                  <Button
                    title={hotel.managerId ? 'Reassign Mgr' : 'Assign Mgr'}
                    variant="secondary"
                    size="sm"
                    onPress={() => openAssign(hotel.id)}
                  />
                  <Button
                    title="Import rooms"
                    variant="secondary"
                    size="sm"
                    onPress={() => openImport(hotel.id)}
                  />
                </View>
              </Card>
            );
          }}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void fetchHotels(); }} tintColor={c.teal} />
          }
        />
      )}

      {/* Status confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { setConfirmOpen(false); setPendingAction(null); }}
        onConfirm={confirmStatus}
        title={`${pendingAction?.label} Hotel`}
        body={`Are you sure you want to ${pendingAction?.label?.toLowerCase()} this hotel? This will be logged in the audit trail.`}
      />

      {/* Import rooms modal */}
      <Modal visible={importOpen} transparent animationType="slide" onRequestClose={() => setImportOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setImportOpen(false)}>
          <View style={s.sheet} onStartShouldSetResponder={() => true}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Import Rooms</Text>
            <Text style={s.sheetSub}>Paste CSV data with columns such as room number, type, capacity, and price.</Text>
            <TextInput
              value={roomCsv}
              onChangeText={(t) => { setRoomCsv(t); setImportResult(null); }}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              placeholder="roomNumber,roomType,capacity,price\n101,DELUXE,2,2500"
              placeholderTextColor={c.inkMuted}
              style={[s.csvInput, { color: c.ink }]}
            />
            {/* IMPexp-005: Show dry-run validation results */}
            {importResult && (
              <View style={{ marginTop: 8, gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: c.ink }}>
                  Validation Results
                </Text>
                <Text style={{ fontSize: 12, color: c.inkMuted }}>
                  Total: {importResult.totalRows} | Valid: {importResult.importedCount} | Errors: {importResult.failedCount}
                </Text>
                {importResult.errors?.map((e: any, i: number) => (
                  <Text key={i} style={{ fontSize: 11, color: c.danger }}>
                    Row {e.row}: {e.error}{e.roomNumber ? ` (${e.roomNumber})` : ''}
                  </Text>
                ))}
              </View>
            )}
            <View style={s.sheetActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setImportOpen(false)} />
              {!importResult ? (
                <Button
                  title={importing ? 'Validating…' : 'Validate'}
                  onPress={validateImport}
                  loading={importing}
                  disabled={importing || !roomCsv.trim()}
                />
              ) : importResult.failedCount === 0 ? (
                <Button
                  title={importing ? 'Importing…' : 'Confirm Import'}
                  onPress={confirmImport}
                  loading={importing}
                  disabled={importing}
                />
              ) : (
                <Button title="Fix Errors" variant="secondary" onPress={() => setImportResult(null)} />
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Manager assign modal */}
      <Modal visible={assignOpen} transparent animationType="slide" onRequestClose={() => setAssignOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setAssignOpen(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Assign Hotel Manager</Text>
            <Text style={s.sheetSub}>Select the manager who will oversee this hotel.</Text>
            <ScrollView style={s.pickerList} nestedScrollEnabled>
              {managers.map((m) => (
                <Pressable
                  key={m.id}
                  style={[s.pickerRow, selManager === m.id && s.pickerRowActive]}
                  onPress={() => setSelManager(m.id)}
                >
                  <Text style={[s.pickerText, selManager === m.id && s.pickerTextActive]}>
                    {m.fullName ?? m.email}
                  </Text>
                  {selManager === m.id && <Ionicons name="checkmark-circle" size={18} color={c.teal} />}
                </Pressable>
              ))}
              {managers.length === 0 && <Text style={s.pickerEmpty}>No manager accounts found</Text>}
            </ScrollView>
            <View style={s.sheetActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setAssignOpen(false)} />
              <Button title={assigning ? 'Assigning…' : 'Assign'} onPress={confirmAssign} disabled={assigning || !selManager} />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Reason input modal (for Reject / Suspend — replaces Alert.prompt for Android) */}
      <Modal visible={reasonOpen} transparent animationType="slide" onRequestClose={() => setReasonOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setReasonOpen(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>{pendingAction?.label} Hotel</Text>
            <Text style={s.sheetSub}>Provide a reason (required for audit trail).</Text>
            <TextInput
              style={s.csvInput}
              value={reasonValue}
              onChangeText={setReasonValue}
              placeholder="Enter reason…"
              placeholderTextColor={c.inkMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={s.sheetActions}>
              <Button title="Cancel" variant="secondary" onPress={() => { setReasonOpen(false); setPendingAction(null); }} />
              <Button
                title={reasonBusy ? 'Working…' : pendingAction?.label ?? 'Confirm'}
                variant={pendingAction?.status === 'REJECTED' ? 'danger' : 'danger'}
                onPress={submitWithReason}
                disabled={reasonBusy || !reasonValue.trim()}
                loading={reasonBusy}
              />
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  root:  { flex: 1, backgroundColor: c.paper },
  list:  { padding: 16, gap: 12, paddingBottom: 48 },
  flex:  { flex: 1 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 0, borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, height: 42, backgroundColor: c.surface },
  searchInput:{ flex: 1, fontSize: 14, color: c.ink },
  card:       { padding: 14, ...shadowCard },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  hotelName:  { fontSize: 15, fontWeight: '700', color: c.ink },
  hotelMeta:  { fontSize: 12, color: c.inkMuted, marginTop: 2 },
  managerName:{ fontSize: 12, color: c.teal, fontWeight: '600', marginTop: 2 },
  statsRow:   { flexDirection: 'row', gap: 16, marginBottom: 12 },
  stat:       { alignItems: 'center' },
  statValue:  { fontSize: 16, fontWeight: '800', color: c.ink },
  statLabel:  { fontSize: 10, color: c.inkMuted, marginTop: 1 },
  actions:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  sheetHandle:{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.line, alignSelf: 'center' },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: c.ink },
  sheetSub:   { fontSize: 13, color: c.inkMuted },
  pickerList: { maxHeight: 220, borderWidth: 1, borderColor: c.line, borderRadius: 10, marginTop: 4 },
  pickerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line },
  pickerRowActive:{ backgroundColor: c.tealTint },
  pickerText: { fontSize: 14, color: c.ink },
  pickerTextActive:{ fontWeight: '700', color: c.teal },
  pickerEmpty:{ padding: 14, fontSize: 13, color: c.inkMuted, textAlign: 'center' },
  sheetActions:{ flexDirection: 'row', gap: 10 },
  csvInput: { minHeight: 150, borderWidth: 1, borderColor: c.line, borderRadius: 10, padding: 12, fontSize: 13, backgroundColor: c.paper },
});
