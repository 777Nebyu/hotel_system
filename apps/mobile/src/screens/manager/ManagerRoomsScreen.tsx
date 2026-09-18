import React, { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { Badge, Button, Card, EmptyState, ErrorBox } from '../../components/Shared';
import ScreenHeader from '../../components/ScreenHeader';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { useManagerRooms } from '../../hooks/useQueries';
import { colors, font, radius, shadowCard } from '../../theme';

type Props = { onBack: () => void; onNavigate?: (page: { screen: string } & Record<string, any>) => void };

interface Room {
  id: string;
  roomNumber: string;
  type: string;
  capacity: number;
  beds: number;
  basePrice: number;
  status: string;
  seasonalPricing?: { id: string; priceOverride: number; startDate: string; endDate: string }[];
}

const ROOM_TYPES = ['STANDARD', 'DELUXE', 'SUITE', 'FAMILY', 'EXECUTIVE'];

const RoomCard = React.memo(function RoomCard({
  room, editingPrice, priceValue, savingPrice,
  onStartEdit, onCancelEdit, onPriceChange, onUpdatePrice,
  onToggleStatus, onShowSeasonal, onDelete,
}: {
  room: Room;
  editingPrice: string | null;
  priceValue: string;
  savingPrice: string | null;
  onStartEdit: (room: Room) => void;
  onCancelEdit: () => void;
  onPriceChange: (v: string) => void;
  onUpdatePrice: (roomId: string) => void;
  onToggleStatus: (room: Room) => void;
  onShowSeasonal: (roomId: string) => void;
  onDelete: (room: Room) => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.flex}>
          <Text style={styles.roomNumber}>Room {room.roomNumber}</Text>
          <Text style={styles.roomType}>{room.type} · {room.capacity} guests · {room.beds} beds</Text>
        </View>
        <Badge status={room.status} />
      </View>

      {editingPrice === room.id ? (
        <View style={styles.priceEditRow}>
          <TextInput
            style={styles.priceInput}
            value={priceValue}
            onChangeText={onPriceChange}
            keyboardType="numeric"
            placeholder="Base price"
            placeholderTextColor={colors.inkMuted}
            accessibilityLabel="Base price"
          />
          <Button title="Save" size="sm" loading={savingPrice === room.id} onPress={() => onUpdatePrice(room.id)} />
          <Button title="Cancel" size="sm" variant="ghost" onPress={onCancelEdit} />
        </View>
      ) : (
        <Pressable
          style={styles.priceRow}
          onPress={() => onStartEdit(room)}
          accessibilityRole="button"
          accessibilityLabel={`Edit price for room ${room.roomNumber}, currently ETB ${room.basePrice}`}
        >
          <Text style={styles.price}>ETB {room.basePrice}</Text>
          <View style={styles.editPill}>
            <Ionicons name="pencil" size={12} color={colors.inkMuted} />
            <Text style={styles.editHint}>Edit</Text>
          </View>
        </Pressable>
      )}

      <View style={styles.actionRow}>
        <Button
          title={room.status === 'MAINTENANCE' ? 'Set Available' : 'Set Maintenance'}
          size="sm"
          variant="secondary"
          onPress={() => onToggleStatus(room)}
          accessibilityLabel={`Set room ${room.roomNumber} to ${room.status === 'MAINTENANCE' ? 'available' : 'maintenance'}`}
        />
        <Button title="Seasonal" size="sm" variant="ghost" onPress={() => onShowSeasonal(room.id)} />
        <Button title="Delete" size="sm" variant="danger" onPress={() => onDelete(room)} accessibilityLabel={`Delete room ${room.roomNumber}`} />
      </View>

      {room.seasonalPricing && room.seasonalPricing.length > 0 && (
        <View style={styles.seasonalSection}>
          <Text style={styles.seasonalTitle}>Seasonal Pricing</Text>
          {room.seasonalPricing.map((sp) => (
            <View key={sp.id} style={styles.seasonalRow}>
              <Text style={styles.seasonalPrice}>ETB {sp.priceOverride}</Text>
              <Text style={styles.seasonalDates}>
                {new Date(sp.startDate).toLocaleDateString()} – {new Date(sp.endDate).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
});

export default function ManagerRoomsScreen({ onBack, onNavigate: _ }: Props) { // eslint-disable-line @typescript-eslint/no-unused-vars
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const hotelId = useAppSelector((s) => s.auth.session?.user?.hotelId ?? '');
  const toast = useToast();

  const { data: roomsData, isLoading: roomsLoading, error: roomsError, refetch, isRefetching } = useManagerRooms(token, hotelId);
  const rooms: Room[] = (Array.isArray(roomsData) ? roomsData : []) as Room[];

  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [priceValue, setPriceValue] = useState('');
  const [savingPrice, setSavingPrice] = useState<string | null>(null);

  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ roomNumber: '', type: 'STANDARD', capacity: '2', beds: '1', basePrice: '' });
  const [savingRoom, setSavingRoom] = useState(false);

  const [showSeasonal, setShowSeasonal] = useState<string | null>(null);
  const [seasonalForm, setSeasonalForm] = useState({ priceOverride: '', startDate: '', endDate: '' });
  const [savingSeasonal, setSavingSeasonal] = useState(false);

  const onStartEdit = useCallback((room: Room) => {
    setEditingPrice(room.id);
    setPriceValue(String(room.basePrice));
  }, []);

  const onCancelEdit = useCallback(() => setEditingPrice(null), []);

  const onPriceChange = useCallback((v: string) => setPriceValue(v), []);

  const updatePrice = useCallback(async (roomId: string) => {
    if (!priceValue) return;
    const num = Number(priceValue);
    if (isNaN(num) || num <= 0) {
      toast('error', 'Invalid price', 'Price must be a positive number');
      return;
    }
    setSavingPrice(roomId);
    try {
      await request(`/catalog/rooms/${roomId}`, { method: 'PATCH', body: { basePrice: num }, token });
      toast('success', 'Price updated');
      setEditingPrice(null);
      void refetch();
    } catch (err) {
      toast('error', 'Update failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingPrice(null);
    }
  }, [token, priceValue, toast, refetch]);

  const toggleStatus = useCallback((room: Room) => {
    const newStatus = room.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    Alert.alert(
      'Change Status',
      `Set Room ${room.roomNumber} to ${newStatus}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await request(`/catalog/rooms/${room.id}`, { method: 'PATCH', body: { status: newStatus }, token });
              toast('success', `Room set to ${newStatus}`);
              void refetch();
            } catch (err) {
              toast('error', 'Failed', err instanceof Error ? err.message : 'Unknown error');
            }
          },
        },
      ],
    );
  }, [token, toast, refetch]);

  const onShowSeasonal = useCallback((roomId: string) => setShowSeasonal(roomId), []);

  const deleteRoom = useCallback((room: Room) => {
    Alert.alert('Delete Room', `Delete Room ${room.roomNumber}? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await request(`/catalog/rooms/${room.id}`, { method: 'DELETE', token });
            toast('success', 'Room deleted');
            void refetch();
          } catch (err) {
            toast('error', 'Cannot delete', err instanceof Error ? err.message : 'Room may have active bookings');
          }
        },
      },
    ]);
  }, [token, toast, refetch]);

  const addRoom = useCallback(async () => {
    if (!hotelId) return;
    if (!newRoom.roomNumber.trim() || !newRoom.basePrice) {
      return Alert.alert('Required', 'Room number and base price are required');
    }
    setSavingRoom(true);
    try {
      await request(`/catalog/hotels/${hotelId}/rooms`, {
        method: 'POST',
        body: {
          roomNumber: newRoom.roomNumber.trim(),
          type: newRoom.type,
          capacity: parseInt(newRoom.capacity) || 2,
          beds: parseInt(newRoom.beds) || 1,
          basePrice: Number(newRoom.basePrice),
        },
        token,
      });
      toast('success', 'Room added');
      setShowAddRoom(false);
      setNewRoom({ roomNumber: '', type: 'STANDARD', capacity: '2', beds: '1', basePrice: '' });
      void refetch();
    } catch (err) {
      toast('error', 'Failed to add room', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingRoom(false);
    }
  }, [hotelId, newRoom, token, toast, refetch]);

  const addSeasonal = useCallback(async (roomId: string) => {
    if (!seasonalForm.priceOverride || !seasonalForm.startDate || !seasonalForm.endDate) {
      return Alert.alert('Required', 'Price override, start date, and end date are required');
    }
    const priceNum = Number(seasonalForm.priceOverride);
    if (isNaN(priceNum) || priceNum <= 0) {
      return Alert.alert('Invalid price', 'Price override must be a positive number');
    }
    if (seasonalForm.startDate >= seasonalForm.endDate) {
      return Alert.alert('Invalid dates', 'Start date must be before end date');
    }
    if (seasonalForm.startDate < new Date().toISOString().split('T')[0]) {
      return Alert.alert('Invalid date', 'Start date must be today or in the future');
    }
    setSavingSeasonal(true);
    try {
      await request(`/catalog/rooms/${roomId}/seasonal-pricing`, {
        method: 'POST',
        body: {
          priceOverride: Number(seasonalForm.priceOverride),
          startDate: seasonalForm.startDate,
          endDate: seasonalForm.endDate,
        },
        token,
      });
      toast('success', 'Seasonal price added');
      setShowSeasonal(null);
      setSeasonalForm({ priceOverride: '', startDate: '', endDate: '' });
      void refetch();
    } catch (err) {
      toast('error', 'Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSavingSeasonal(false);
    }
  }, [seasonalForm, token, toast, refetch]);

  const deleteSeasonal = useCallback(async (roomId: string, pricingId: string) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    Alert.alert('Remove Seasonal Price', 'Remove this seasonal pricing rule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await request(`/catalog/rooms/${roomId}/seasonal-pricing/${pricingId}`, { method: 'DELETE', token });
            toast('success', 'Seasonal price removed');
            void refetch();
          } catch (err) {
            toast('error', 'Failed', err instanceof Error ? err.message : 'Unknown error');
          }
        },
      },
    ]);
  }, [token, toast, refetch]);

  const renderRoom = useCallback(({ item: room }: { item: Room }) => (
    <RoomCard
      room={room}
      editingPrice={editingPrice}
      priceValue={priceValue}
      savingPrice={savingPrice}
      onStartEdit={onStartEdit}
      onCancelEdit={onCancelEdit}
      onPriceChange={onPriceChange}
      onUpdatePrice={updatePrice}
      onToggleStatus={toggleStatus}
      onShowSeasonal={onShowSeasonal}
      onDelete={deleteRoom}
    />
  ), [editingPrice, priceValue, savingPrice, onStartEdit, onCancelEdit, onPriceChange, updatePrice, toggleStatus, onShowSeasonal, deleteRoom]);

  const isLoading = roomsLoading;
  const error = roomsError?.message ?? null;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Rooms & Pricing"
        onBack={onBack}
        subtitle="Manage inventory, prices & maintenance"
        rightElement={
          hotelId ? (
            <Button title="+ Add" size="sm" onPress={() => setShowAddRoom(true)} />
          ) : undefined
        }
      />

      {error && !isLoading && <ErrorBox message={error} onRetry={() => void refetch()} />}

      {isLoading ? (
        <SkeletonList count={4} />
      ) : rooms.length === 0 ? (
        <EmptyState title="No rooms found" subtitle="Add rooms to this hotel" />
      ) : (
        <FlashList
          data={rooms}
          renderItem={renderRoom}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.teal}
              colors={[colors.teal]}
            />
          }
        />
      )}

      {/* ─── Add Room Modal ─── */}
      <Modal visible={showAddRoom} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Room</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Room number"
              placeholderTextColor={colors.inkMuted}
              value={newRoom.roomNumber}
              onChangeText={(t) => setNewRoom((r) => ({ ...r, roomNumber: t }))}
              accessibilityLabel="Room number"
            />
            <Text style={styles.fieldLabel}>Room type</Text>
            <View style={styles.typeRow}>
              {ROOM_TYPES.map((rt) => (
                <Pressable
                  key={rt}
                  onPress={() => setNewRoom((r) => ({ ...r, type: rt }))}
                  style={[styles.typeChip, newRoom.type === rt && styles.typeChipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: newRoom.type === rt }}
                  accessibilityLabel={rt}
                >
                  <Text style={[styles.typeChipText, newRoom.type === rt && styles.typeChipTextActive]}>{rt}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <TextInput style={[styles.modalInput, styles.halfInput]} placeholder="Capacity" placeholderTextColor={colors.inkMuted} keyboardType="numeric" value={newRoom.capacity} onChangeText={(t) => setNewRoom((r) => ({ ...r, capacity: t }))} accessibilityLabel="Capacity" />
              <TextInput style={[styles.modalInput, styles.halfInput]} placeholder="Beds" placeholderTextColor={colors.inkMuted} keyboardType="numeric" value={newRoom.beds} onChangeText={(t) => setNewRoom((r) => ({ ...r, beds: t }))} accessibilityLabel="Number of beds" />
            </View>
            <TextInput style={styles.modalInput} placeholder="Base price (ETB)" placeholderTextColor={colors.inkMuted} keyboardType="numeric" value={newRoom.basePrice} onChangeText={(t) => setNewRoom((r) => ({ ...r, basePrice: t }))} accessibilityLabel="Base price in ETB" />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowAddRoom(false)} />
              <Button title="Add Room" loading={savingRoom} onPress={addRoom} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Seasonal Pricing Modal ─── */}
      <Modal visible={!!showSeasonal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Seasonal Price</Text>
            <TextInput style={styles.modalInput} placeholder="Price override (ETB)" placeholderTextColor={colors.inkMuted} keyboardType="numeric" value={seasonalForm.priceOverride} onChangeText={(t) => setSeasonalForm((s) => ({ ...s, priceOverride: t }))} accessibilityLabel="Price override in ETB" />
            <TextInput style={styles.modalInput} placeholder="Start date (YYYY-MM-DD)" placeholderTextColor={colors.inkMuted} value={seasonalForm.startDate} onChangeText={(t) => setSeasonalForm((s) => ({ ...s, startDate: t }))} accessibilityLabel="Start date" />
            <TextInput style={styles.modalInput} placeholder="End date (YYYY-MM-DD)" placeholderTextColor={colors.inkMuted} value={seasonalForm.endDate} onChangeText={(t) => setSeasonalForm((s) => ({ ...s, endDate: t }))} accessibilityLabel="End date" />
            <View style={styles.modalActions}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowSeasonal(null)} />
              <Button title="Add" loading={savingSeasonal} onPress={() => showSeasonal && addSeasonal(showSeasonal)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  card: { marginBottom: 14, gap: 10, padding: 16, borderRadius: radius.card, ...shadowCard },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  flex: { flex: 1 },
  roomNumber: { fontFamily: font.display, fontSize: 18, fontWeight: '700', color: colors.ink },
  roomType: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 17, fontWeight: '800', color: colors.tealDeep },
  editPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.paperDeep, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  editHint: { fontSize: 11, fontWeight: '600', color: colors.inkMuted },
  priceEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceInput: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.ink },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  seasonalSection: { marginTop: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  seasonalTitle: { fontFamily: font.display, fontSize: 14, fontWeight: '700', color: colors.inkSoft, marginBottom: 6 },
  seasonalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  seasonalPrice: { fontSize: 13, fontWeight: '700', color: colors.gold, marginRight: 10 },
  seasonalDates: { fontSize: 12, color: colors.inkMuted },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  modalTitle: { fontFamily: font.display, fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: 4 },
  modalInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.ink },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.inkSoft },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong },
  typeChipActive: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  typeChipText: { fontSize: 13, color: colors.inkSoft, fontWeight: '500' },
  typeChipTextActive: { color: colors.teal, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
});
