import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAppSelector } from '../../store/hooks';
import { request } from '../../api';
import { Button, Card } from '../../components/Shared';
import ScreenHeader from '../../components/ScreenHeader';
import DatePickerModal from '../../components/DatePickerModal';
import { colors, font, radius } from '../../theme';
import { useTheme } from '../../hooks/useTheme';
import { hapticSuccess, hapticError } from '../../hooks/useHaptics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash at Hotel', icon: 'cash-outline' as const },
  { value: 'CREDIT_CARD', label: 'Credit Card', icon: 'card-outline' as const },
] as const;

interface HotelPolicy {
  checkInTime?: string;
  checkOutTime?: string;
  cancellationHours?: number;
  cancellationPolicy?: string;
  houseRules?: string;
  childPolicy?: string;
  petPolicy?: string;
}

interface RoomOption {
  id: string;
  number: string;
  type: string;
  pricePerNight: number;
  capacity: number;
  beds: number;
}

export default function WalkInBookingScreen() {
  const navigation = useNavigation<Nav>();
  const token = useAppSelector((s) => s.auth.session?.accessToken ?? '');
  const hotelId = useAppSelector((s) => s.auth.session?.user?.hotelId ?? '');
  const hotelName = useAppSelector((s) => s.auth.session?.user?.hotelName ?? 'My Hotel');
  const { colors: c } = useTheme();

  // Guest info
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');

  // Guest count
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  // Booking info
  const [today] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState('');
  // roomType is derived from available rooms — NOT hardcoded to STANDARD enum
  const [roomType, setRoomType] = useState<string>('');
  const [availableRoomTypes, setAvailableRoomTypes] = useState<string[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [availableRooms, setAvailableRooms] = useState<RoomOption[]>([]);
  const allRoomsRef = useRef<RoomOption[]>([]);
  const roomTypeRef = useRef(roomType);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [totalPrice, setTotalPrice] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  // Date picker state
  const [showCheckInPicker, setShowCheckInPicker] = useState(false);
  const [showCheckOutPicker, setShowCheckOutPicker] = useState(false);

  // Hotel policies
  const [policies, setPolicies] = useState<HotelPolicy | null>(null);
  const [policiesAccepted, setPoliciesAccepted] = useState(false);

  // Fetch hotel policies
  useEffect(() => {
    if (!hotelId) return;
    setPolicies(null);
    setAvailableRooms([]);
    setAvailableRoomTypes([]);
    setSelectedRoomId('');
    setRoomType('');
    setTotalPrice(null);
    request<HotelPolicy>(`/catalog/hotels/${hotelId}/policy`, { token })
      .then((res) => setPolicies(res))
      .catch(() => {});
  }, [hotelId, token]);

  // Fetch available rooms for chosen dates (all types)
  const fetchRooms = useCallback(async () => {
    if (!hotelId || !checkIn || !checkOut || checkIn >= checkOut) return;
    setLoadingRooms(true);
    setSelectedRoomId('');
    setTotalPrice(null);
    try {
      const res = await request<any[]>(
        `/catalog/hotels/${hotelId}/rooms?checkIn=${checkIn}&checkOut=${checkOut}`,
        { token },
      );
      const list = Array.isArray(res) ? res : [];
      const all = list
        .filter((r: any) => r.status === 'AVAILABLE' && r.availableAcrossRange)
        .map((r: any) => ({
          id: r.id,
          number: r.roomNumber,
          type: r.type,
          capacity: r.capacity,
          beds: r.beds,
          pricePerNight: r.priceRange?.min ?? r.basePrice,
        }));
      allRoomsRef.current = all;
      const types = [...new Set(all.map((r) => r.type))];
      setAvailableRoomTypes(types);
      const currentTypeHasRooms = all.some((r) => r.type === roomTypeRef.current);
      const defaultType = currentTypeHasRooms ? roomTypeRef.current : (types[0] ?? '');
      setRoomType(defaultType);
      setAvailableRooms(all.filter((r) => r.type === defaultType));
    } catch {
      allRoomsRef.current = [];
      setAvailableRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  }, [hotelId, checkIn, checkOut, token]);

  useEffect(() => { void fetchRooms(); }, [fetchRooms]);

  useEffect(() => { roomTypeRef.current = roomType; }, [roomType]);

  // Filter cached rooms by type (no API call)
  useEffect(() => {
    setAvailableRooms(allRoomsRef.current.filter((r) => r.type === roomType));
    setSelectedRoomId('');
    setTotalPrice(null);
  }, [roomType]);

  // Compute total on room selection
  const totalPriceCalc = useMemo(() => {
    if (!selectedRoomId || !checkIn || !checkOut) return null;
    const room = availableRooms.find((r) => r.id === selectedRoomId);
    if (!room) return null;
    const nights = Math.ceil(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000,
    );
    return nights * room.pricePerNight;
  }, [selectedRoomId, checkIn, checkOut, availableRooms]);
  useEffect(() => { setTotalPrice(totalPriceCalc); }, [totalPriceCalc]);

  const validate = (): string | null => {
    if (!fullName.trim() || fullName.trim().length < 2) return 'Guest full name is required (min 2 characters).';
    if (!phone.trim() || phone.replace(/\s/g, '').length < 3) return 'Valid phone number is required.';
    if (!checkIn || !checkOut) return 'Both check-in and check-out dates are required.';
    if (checkIn >= checkOut) return 'Check-out must be after check-in.';
    if (!selectedRoomId) return 'Please select a room.';
    if (!policiesAccepted) return 'You must accept the hotel policies to continue.';
    return null;
  };

  const validateField = (field: string) => {
    const errs: Record<string, string | undefined> = {};
    if (field === 'fullName' && (!fullName.trim() || fullName.trim().length < 2)) errs.fullName = 'Guest full name is required (min 2 characters).';
    if (field === 'phone' && (!phone.trim() || phone.replace(/\s/g, '').length < 3)) errs.phone = 'Valid phone number is required.';
    if (field === 'checkIn' && !checkIn) errs.checkIn = 'Check-in date is required.';
    if (field === 'checkOut' && !checkOut) errs.checkOut = 'Check-out date is required.';
    else if (field === 'checkOut' && checkIn && checkOut && checkIn >= checkOut) errs.checkOut = 'Check-out must be after check-in.';
    setFieldErrors((prev) => ({ ...prev, ...errs, [field]: errs[field] || undefined }));
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      const errs: Record<string, string | undefined> = {};
      if (!fullName.trim() || fullName.trim().length < 2) errs.fullName = 'Guest full name is required (min 2 characters).';
      if (!phone.trim() || phone.replace(/\s/g, '').length < 3) errs.phone = 'Valid phone number is required.';
      if (!checkIn || !checkOut) errs.checkIn = 'Both dates are required.';
      else if (checkIn >= checkOut) errs.checkOut = 'Check-out must be after check-in.';
      setFieldErrors(errs);
      if (!policiesAccepted) return Alert.alert('Policies required', 'You must accept the hotel policies to continue.');
      return Alert.alert('Missing information', err);
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const res = await request<{ id: string; reference: string }>(
        '/bookings/walk-in',
        {
          method: 'POST',
          token,
          body: {
            hotelId: hotelId,
            roomIds: [selectedRoomId],
            checkIn,
            checkOut,
            guests: { adults, children },
            paymentMethod,
            // Walk-in payments are collected at the desk; the API uses this
            // flag to immediately confirm the booking and mark payment paid.
            paidImmediately: true,
            guestName: fullName.trim(),
            guestPhone: phone.trim() || undefined,
            guestEmail: email.trim() || undefined,
            guestIdNumber: idNumber.trim() || undefined,
          },
        },
      );
      hapticSuccess();
      Alert.alert(
        'Walk-in booked',
        `Booking confirmed.\nReference: ${res.reference ?? res.id.slice(0, 8).toUpperCase()}`,
        [{ text: 'Done', onPress: () => navigation.goBack() }],
      );
    } catch (e) {
      hapticError();
      Alert.alert('Booking failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const nights =
    checkIn && checkOut && checkOut > checkIn
      ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)
      : 0;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.paper }]}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScreenHeader
        title="Walk-in Booking"
        onBack={() => navigation.goBack()}
        subtitle={paymentMethod === 'CASH' ? 'Cash payment · immediately confirmed' : 'Card payment · immediately confirmed'}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Hotel info */}
        <Text style={[styles.sectionLabel, { color: c.ink }]}>Hotel</Text>
        <Card style={styles.card}>
          {!hotelId ? (
            <Text style={styles.noRooms}>No hotel assigned to your account.</Text>
          ) : (
            <View style={styles.hotelInfo}>
              <Ionicons name="business-outline" size={16} color={c.teal} />
              <Text style={[styles.hotelName, { color: c.ink }]}>{hotelName}</Text>
            </View>
          )}
        </Card>

        {/* Guest info */}
        <Text style={[styles.sectionLabel, { color: c.ink }]}>Guest Information</Text>
        <Card style={styles.card}>
          <Field label="Full Name *" value={fullName} onChangeText={setFullName} onBlur={() => validateField('fullName')} placeholder="Abebe Girma" autoCapitalize="words" error={fieldErrors.fullName} c={c} />
          <Field label="Phone *" value={phone} onChangeText={setPhone} onBlur={() => validateField('phone')} placeholder="0911 000 000" keyboardType="phone-pad" error={fieldErrors.phone} c={c} />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="optional" keyboardType="email-address" autoCapitalize="none" c={c} />
          <Field label="ID / Passport" value={idNumber} onChangeText={setIdNumber} placeholder="optional" c={c} />
        </Card>

        {/* Guest count */}
        <Text style={[styles.sectionLabel, { color: c.ink }]}>Guest Count</Text>
        <Card style={styles.card}>
          <View style={styles.counterRow}>
            <Text style={[styles.counterLabel, { color: c.ink }]}>Adults</Text>
            <View style={styles.counterControls}>
              <Pressable
                onPress={() => setAdults((a) => Math.max(1, a - 1))}
                style={[styles.counterBtn, { borderColor: c.lineStrong, backgroundColor: c.surface }]}
                accessibilityLabel="Decrease adults"
              >
                <Ionicons name="remove" size={18} color={c.ink} />
              </Pressable>
              <Text style={[styles.counterValue, { color: c.ink }]}>{adults}</Text>
              <Pressable
                onPress={() => setAdults((a) => Math.min(20, a + 1))}
                style={[styles.counterBtn, { borderColor: c.lineStrong, backgroundColor: c.surface }]}
                accessibilityLabel="Increase adults"
              >
                <Ionicons name="add" size={18} color={c.ink} />
              </Pressable>
            </View>
          </View>
          <View style={styles.counterRow}>
            <Text style={[styles.counterLabel, { color: c.ink }]}>Children</Text>
            <View style={styles.counterControls}>
              <Pressable
                onPress={() => setChildren((n) => Math.max(0, n - 1))}
                style={[styles.counterBtn, { borderColor: c.lineStrong, backgroundColor: c.surface }]}
                accessibilityLabel="Decrease children"
              >
                <Ionicons name="remove" size={18} color={c.ink} />
              </Pressable>
              <Text style={[styles.counterValue, { color: c.ink }]}>{children}</Text>
              <Pressable
                onPress={() => setChildren((n) => Math.min(10, n + 1))}
                style={[styles.counterBtn, { borderColor: c.lineStrong, backgroundColor: c.surface }]}
                accessibilityLabel="Increase children"
              >
                <Ionicons name="add" size={18} color={c.ink} />
              </Pressable>
            </View>
          </View>
        </Card>

        {/* Dates */}
        <Text style={[styles.sectionLabel, { color: c.ink }]}>Stay Dates</Text>
        <Card style={styles.card}>
          <Text style={[styles.fieldLabel, { color: c.inkMuted }]}>CHECK-IN *</Text>
          <Pressable onPress={() => setShowCheckInPicker(true)}>
            <View style={[styles.dateInput, { backgroundColor: c.surface, borderColor: c.lineStrong }, fieldErrors.checkIn && styles.inputError]}>
              <Ionicons name="calendar-outline" size={16} color={c.inkMuted} />
              <Text style={[styles.dateText, { color: c.ink }, !checkIn && { color: c.inkMuted }]}>
                {checkIn || 'Select check-in date'}
              </Text>
            </View>
          </Pressable>
          {fieldErrors.checkIn ? <Text style={styles.fieldError}>{fieldErrors.checkIn}</Text> : null}

          <Text style={[styles.fieldLabel, { color: c.inkMuted }]}>CHECK-OUT *</Text>
          <Pressable onPress={() => setShowCheckOutPicker(true)}>
            <View style={[styles.dateInput, { backgroundColor: c.surface, borderColor: c.lineStrong }, fieldErrors.checkOut && styles.inputError]}>
              <Ionicons name="calendar-outline" size={16} color={c.inkMuted} />
              <Text style={[styles.dateText, { color: c.ink }, !checkOut && { color: c.inkMuted }]}>
                {checkOut || 'Select check-out date'}
              </Text>
            </View>
          </Pressable>
          {fieldErrors.checkOut ? <Text style={styles.fieldError}>{fieldErrors.checkOut}</Text> : null}

          {nights > 0 && (
            <Text style={styles.nightsText}>{nights} night{nights !== 1 ? 's' : ''}</Text>
          )}
        </Card>

        <DatePickerModal
          visible={showCheckInPicker}
          onClose={() => setShowCheckInPicker(false)}
          onSelect={(date) => { setCheckIn(date); setFieldErrors((p) => ({ ...p, checkIn: undefined })); }}
          label="Select Check-in Date"
          minDate={today}
          initialDate={checkIn}
        />
        <DatePickerModal
          visible={showCheckOutPicker}
          onClose={() => setShowCheckOutPicker(false)}
          onSelect={(date) => { setCheckOut(date); setFieldErrors((p) => ({ ...p, checkOut: undefined })); }}
          label="Select Check-out Date"
          minDate={checkIn || today}
          initialDate={checkOut}
        />

        {/* Hotel Policies */}
        <Text style={[styles.sectionLabel, { color: c.ink }]}>Hotel Policies</Text>
        <Card style={styles.card}>
          <View style={styles.policyRow}>
            <Ionicons name="time-outline" size={16} color={c.teal} />
            <View style={styles.policyText}>
              <Text style={[styles.policyLabel, { color: c.ink }]}>Check-in</Text>
              <Text style={[styles.policyValue, { color: c.inkMuted }]}>From {policies?.checkInTime ?? '14:00'}</Text>
            </View>
          </View>
          <View style={styles.policyRow}>
            <Ionicons name="time-outline" size={16} color={c.teal} />
            <View style={styles.policyText}>
              <Text style={[styles.policyLabel, { color: c.ink }]}>Check-out</Text>
              <Text style={[styles.policyValue, { color: c.inkMuted }]}>Until {policies?.checkOutTime ?? '11:00'}</Text>
            </View>
          </View>
          {policies?.cancellationHours != null && policies.cancellationHours > 0 && (
            <View style={styles.policyRow}>
              <Ionicons name="alert-circle-outline" size={16} color={c.gold} />
              <View style={styles.policyText}>
                <Text style={[styles.policyLabel, { color: c.ink }]}>Cancellation</Text>
                <Text style={[styles.policyValue, { color: c.inkMuted }]}>
                  {policies.cancellationPolicy ?? `Free cancellation up to ${policies.cancellationHours}h before check-in`}
                </Text>
              </View>
            </View>
          )}
          {policies?.houseRules ? (
            <View style={styles.policyRow}>
              <Ionicons name="document-text-outline" size={16} color={c.inkMuted} />
              <View style={styles.policyText}>
                <Text style={[styles.policyLabel, { color: c.ink }]}>House Rules</Text>
                <Text style={[styles.policyValue, { color: c.inkMuted }]}>{policies.houseRules}</Text>
              </View>
            </View>
          ) : null}
          {policies?.childPolicy ? (
            <View style={styles.policyRow}>
              <Ionicons name="people-outline" size={16} color={c.inkMuted} />
              <View style={styles.policyText}>
                <Text style={[styles.policyLabel, { color: c.ink }]}>Children</Text>
                <Text style={[styles.policyValue, { color: c.inkMuted }]}>{policies.childPolicy}</Text>
              </View>
            </View>
          ) : null}
          {policies?.petPolicy ? (
            <View style={styles.policyRow}>
              <Ionicons name="paw-outline" size={16} color={c.inkMuted} />
              <View style={styles.policyText}>
                <Text style={[styles.policyLabel, { color: c.ink }]}>Pets</Text>
                <Text style={[styles.policyValue, { color: c.inkMuted }]}>{policies.petPolicy}</Text>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Policy acceptance */}
        <Pressable
          onPress={() => setPoliciesAccepted(!policiesAccepted)}
          style={styles.checkboxRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: policiesAccepted }}
        >
          <Ionicons
            name={policiesAccepted ? 'checkbox' : 'square-outline'}
            size={22}
            color={policiesAccepted ? c.teal : c.inkMuted}
          />
          <Text style={[styles.checkboxLabel, { color: c.ink }]}>I have read and accept the hotel policies</Text>
        </Pressable>

        {/* Room type */}
        <Text style={[styles.sectionLabel, { color: c.ink }]}>Room Type</Text>
        {availableRoomTypes.length === 0 && checkIn && checkOut && checkOut > checkIn && !loadingRooms ? (
          <Text style={styles.noRooms}>No rooms available for the selected dates.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeRow} contentContainerStyle={{ gap: 8 }}>
            {availableRoomTypes.map((rt) => (
              <Pressable
                key={rt}
                onPress={() => { setRoomType(rt); setSelectedRoomId(''); }}
                style={[styles.typeChip, roomType === rt && styles.typeChipActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: roomType === rt }}
                accessibilityLabel={`Room type: ${rt}`}
              >
                <Text style={[styles.typeChipText, roomType === rt && styles.typeChipTextActive]}>
                  {rt}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Payment method */}
        <Text style={[styles.sectionLabel, { color: c.ink }]}>Payment Method</Text>
        <View style={styles.paymentRow}>
          {PAYMENT_METHODS.map((pm) => (
            <Pressable
              key={pm.value}
              onPress={() => setPaymentMethod(pm.value)}
              style={[styles.paymentChip, paymentMethod === pm.value && styles.paymentChipActive]}
            >
              <Ionicons name={pm.icon} size={18} color={paymentMethod === pm.value ? '#FFFFFF' : c.inkMuted} />
              <Text style={[styles.paymentChipText, paymentMethod === pm.value && styles.paymentChipTextActive]}>
                {pm.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Room selection */}
        <Text style={[styles.sectionLabel, { color: c.ink }]}>
          {loadingRooms
            ? 'Loading rooms…'
            : availableRooms.length > 0
              ? `Available ${roomType} Rooms (${availableRooms.length})`
              : 'Select Dates to See Available Rooms'}
        </Text>
        {!loadingRooms && availableRooms.length === 0 && checkIn && checkOut && checkOut > checkIn && roomType && (
          <Text style={styles.noRooms}>
            No {roomType} rooms available for these dates. Try a different room type or dates.
          </Text>
        )}
        {!checkIn || !checkOut || checkOut <= checkIn ? (
          <View style={styles.selectDatesHint}>
            <Ionicons name="calendar-outline" size={28} color={c.inkMuted} />
            <Text style={[styles.selectDatesText, { color: c.inkMuted }]}>Select check-in and check-out dates to see available rooms.</Text>
          </View>
        ) : null}
        {availableRooms.map((room) => (
          <Pressable key={room.id} onPress={() => setSelectedRoomId(room.id)} style={styles.roomCardPressable}>
            <View style={[styles.roomCard, { backgroundColor: c.surface, borderColor: c.line }, selectedRoomId === room.id && { borderColor: c.teal, backgroundColor: c.tealTint }]}>
              <View style={styles.roomCardLeft}>
                <Text style={[styles.roomNumber, { color: c.ink }]}>Room {room.number}</Text>
                <Text style={[styles.roomMeta, { color: c.inkMuted }]}>{room.type} · Up to {room.capacity} guests · {room.beds} bed{room.beds > 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.roomCardRight}>
                <Text style={[styles.roomPrice, { color: c.tealDeep }]}>ETB {room.pricePerNight}<Text style={[styles.perNight, { color: c.inkMuted }]}>/night</Text></Text>
                {selectedRoomId === room.id && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={c.teal} />
                    <Text style={[styles.selectedCheck, { color: c.teal }]}>Selected</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}

        {/* Price summary */}
        {totalPrice != null && (
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment method</Text>
              <Text style={styles.summaryValue}>{PAYMENT_METHODS.find((pm) => pm.value === paymentMethod)?.label ?? 'Cash at Hotel'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryTotal}>ETB {totalPrice.toLocaleString()}</Text>
            </View>
          </View>
        )}

        <View style={{ marginTop: 8, marginBottom: 16 }}>
          <Button
            title={submitting ? 'Creating booking…' : 'Confirm Walk-in Booking'}
            onPress={submit}
            loading={submitting}
            disabled={submitting}
            size="lg"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  keyboardType,
  autoCapitalize,
  error,
  c,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  error?: string;
  c: any;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.inkMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={c.inkMuted}
        style={[styles.input, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }, error && styles.inputError]}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 48, gap: 0 },

  sectionLabel: {
    fontFamily: font.display,
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  card: { gap: 10, marginBottom: 4 },

  field: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  inputError: { borderColor: '#EF4444' },
  fieldError: { color: '#EF4444', fontSize: 12, marginTop: 2 },

  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dateText: { fontSize: 15, color: colors.ink },
  datePlaceholder: { color: colors.inkMuted },

  nightsText: { color: colors.teal, fontSize: 13, fontWeight: '600', textAlign: 'right' },

  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterLabel: { fontSize: 15, color: colors.ink, fontWeight: '500' },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: { fontSize: 17, fontWeight: '700', color: colors.ink, minWidth: 24, textAlign: 'center' },

  typeRow: { marginBottom: 4 },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  typeChipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  typeChipText: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  typeChipTextActive: { color: '#FFFFFF' },

  paymentRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  paymentChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  paymentChipActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  paymentChipText: { fontSize: 13, fontWeight: '600', color: colors.inkMuted },
  paymentChipTextActive: { color: '#FFFFFF' },

  noRooms: { color: colors.inkMuted, fontSize: 13, marginBottom: 12, fontStyle: 'italic' },
  hotelInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hotelName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  selectDatesHint: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 10,
    backgroundColor: colors.paperDeep,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    marginBottom: 12,
  },
  selectDatesText: {
    color: colors.inkMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 18,
  },

  roomCardPressable: {
    marginBottom: 8,
  },
  roomCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.line,
    padding: 14,
  },
  roomCardSelected: { borderColor: colors.teal, backgroundColor: '#F0FDFA' },
  roomCardLeft: { gap: 2 },
  roomNumber: { fontFamily: font.display, fontSize: 15, fontWeight: '600', color: colors.ink },
  roomMeta: { fontSize: 12, color: colors.inkMuted },
  roomCardRight: { alignItems: 'flex-end', gap: 4 },
  roomPrice: { fontSize: 16, fontWeight: '800', color: colors.tealDeep },
  perNight: { fontSize: 11, fontWeight: '400', color: colors.inkMuted },
  selectedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectedCheck: { fontSize: 12, fontWeight: '700', color: colors.teal },

  summary: {
    backgroundColor: colors.tealTint,
    borderRadius: radius.card,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
    gap: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: colors.tealDeep, fontSize: 13 },
  summaryValue: { color: colors.tealDeep, fontSize: 13, fontWeight: '600' },
  summaryTotal: { color: colors.ink, fontSize: 20, fontWeight: '800' },

  policyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  policyText: { flex: 1 },
  policyLabel: { fontSize: 13, fontWeight: '600', color: colors.ink },
  policyValue: { fontSize: 12, color: colors.inkMuted, marginTop: 2, lineHeight: 18 },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 4,
  },
  checkboxLabel: { fontSize: 14, color: colors.ink, fontWeight: '500', flex: 1 },
});
