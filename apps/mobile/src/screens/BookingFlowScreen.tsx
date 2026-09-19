import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import type { RootStackParamList } from '../navigation/types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  initBooking, setDates, setAdults, setChildrenCount,
  setGuestFullName, setGuestEmail, setGuestPhone, setGuestNationality, setGuestIdPassport, setSpecialRequests,
  setPromoCode, setAppliedPromo, setHouseRulesAccepted,
  setPaymentMethod, setStep, setBookingId, setBookingRef, setQuote, setQuoteData,
  setHoldExpiresAt, setRoomDetails,
  resetBooking,
} from '../store/bookingFlowSlice';
import { request, requestBlob, ApiError } from '../api';
import { classifyAndAnnounce } from '../errors';
import { Button, Card } from '../components/Shared';
import { textProps } from '../components/ScaledText';
import BookingStepper from '../components/BookingStepper';
import AvailabilityCalendar from '../components/AvailabilityCalendar';
import PaymentMethodSelector, { type PaymentMethod } from '../components/PaymentMethodSelector';
import {
  BK,
  HoldTimer,
  AvailabilityAlert,
  PriceChangeAlert,
  QRCodeCard,
  QRCodeModal,
  PrimaryButton,
} from '../components/BookingComponents';
import BookingReviewCard from '../components/BookingReviewCard';
import type { BookingQuote } from '../types';
import { font, radius } from '../theme';
import { useTheme } from '../hooks/useTheme';
import { hapticSuccess, hapticError } from '../hooks/useHaptics';
import { guestInfoSchema } from '../lib/schemas';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useResponsivePadding } from '../hooks/useResponsivePadding';
import { addBookingToCalendar } from '../lib/calendar';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'BookingFlow'>;

const FLOW_STEPS = ['Dates', 'Guests', 'Payment', 'Review', 'Confirmed'] as const;

const CHAPA_METHODS = new Set(['TELEBIRR', 'CBE_BIRR', 'AWASH_BANK', 'ENAT_BANK', 'AMHARA_BANK', 'COOP_BANK']);

export default function BookingFlowScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const dispatch = useAppDispatch();
  const { colors: c, colorScheme } = useTheme();
  const dark = colorScheme === 'dark';
  const pad = useResponsivePadding();
  const { isOffline } = useNetworkStatus();

  const session = useAppSelector((s) => s.auth.session);
  const currentStep = useAppSelector((s) => s.bookingFlow.currentStep);
  const flowHotelId = useAppSelector((s) => s.bookingFlow.hotelId);
  const flowRoomId = useAppSelector((s) => s.bookingFlow.roomId);
  const checkIn = useAppSelector((s) => s.bookingFlow.checkIn);
  const checkOut = useAppSelector((s) => s.bookingFlow.checkOut);
  const adults = useAppSelector((s) => s.bookingFlow.adults);
  const childrenCount = useAppSelector((s) => s.bookingFlow.childrenCount);
  const guestFullName = useAppSelector((s) => s.bookingFlow.guestFullName);
  const guestEmail = useAppSelector((s) => s.bookingFlow.guestEmail);
  const guestPhone = useAppSelector((s) => s.bookingFlow.guestPhone);
  const guestNationality = useAppSelector((s) => s.bookingFlow.guestNationality);
  const guestIdPassport = useAppSelector((s) => s.bookingFlow.guestIdPassport);
  const specialRequests = useAppSelector((s) => s.bookingFlow.specialRequests);
  const promoCode = useAppSelector((s) => s.bookingFlow.promoCode);
  const appliedPromo = useAppSelector((s) => s.bookingFlow.appliedPromo);
  const houseRulesAccepted = useAppSelector((s) => s.bookingFlow.houseRulesAccepted);
  const paymentMethod = useAppSelector((s) => s.bookingFlow.paymentMethod);
  const quoteData = useAppSelector((s) => s.bookingFlow.quoteData);
  const quoteTotal = useAppSelector((s) => s.bookingFlow.quoteTotal);
  const bookingId = useAppSelector((s) => s.bookingFlow.bookingId);
  const bookingRef = useAppSelector((s) => s.bookingFlow.bookingRef);
  const hotelName = useAppSelector((s) => s.bookingFlow.hotelName) || route.params.hotelName || 'Hotel';
  const idempotencyKey = useAppSelector((s) => s.bookingFlow.idempotencyKey);
  const holdExpiresAt = useAppSelector((s) => s.bookingFlow.holdExpiresAt);
  const token = session?.accessToken ?? '';

  const { hotelId, roomId, roomType, roomCapacity: routeCapacity, checkIn: routeCheckIn, checkOut: routeCheckOut, promoCode: routePromoCode } = route.params;
  const roomCapacity = routeCapacity ?? 2;

  const [loading, setLoading] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [securingRoom, setSecuringRoom] = useState(false);
  const [availData, setAvailData] = useState<Array<{ date: string; available: boolean; price: number; seasonalLabel?: string }>>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [priceLockToken, setPriceLockToken] = useState<string | null>(null);

  const fetchAndStoreBookingRef = useCallback(async (id: string) => {
    try {
      const b = await request<{ reference?: string }>(`/bookings/${id}`, { token });
      if (b.reference) dispatch(setBookingRef(b.reference));
    } catch { /* non-critical */ }
  }, [token, dispatch]);

  // Modals & alerts (§15, §16, §40)
  const [showAvailabilityAlert, setShowAvailabilityAlert] = useState(false);
  const [showPriceChangeAlert, setShowPriceChangeAlert] = useState(false);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [newPrice, setNewPrice] = useState<number | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const appState = useRef(AppState.currentState);
  const initializedRoomRef = useRef<string | null>(null);
  const pendingMockAuthBookingId = useRef<string | null>(null);

  // Detect return from MockAuthorizationScreen: check server-side payment status
  useFocusEffect(
    useCallback(() => {
      const pendingId = pendingMockAuthBookingId.current;
      if (!pendingId || !token) return;

      // Clear the ref immediately so we don't re-trigger
      pendingMockAuthBookingId.current = null;

      (async () => {
        try {
          const serverBooking = await request<{ status: string; payment?: { status: string } }>(
            `/bookings/${pendingId}`, { token },
          );
          if (serverBooking.status === 'CONFIRMED' || serverBooking.payment?.status === 'SUCCEEDED') {
            dispatch(setBookingId(pendingId));
            fetchAndStoreBookingRef(pendingId);
            hapticSuccess();
            dispatch(setStep('done'));
          } else {
            // Payment was rejected or still pending
            setPaymentFailed(true);
            setPaymentError('Payment was not approved.');
            dispatch(setBookingId(pendingId));
            fetchAndStoreBookingRef(pendingId);
            hapticError();
            Alert.alert(t('bookingFlow.paymentFailed'), 'Payment was not approved.', [
              { text: t('bookingFlow.retryPayment'), onPress: () => retryPayment(pendingId) },
              { text: t('bookingFlow.changeMethod'), onPress: () => { setPaymentFailed(false); dispatch(setStep('payment')); } },
              { text: t('bookingFlow.cancel'), style: 'cancel' },
            ]);
          }
        } catch {
          // Couldn't reach server — show generic failure
          setPaymentFailed(true);
          setPaymentError('Could not verify payment status.');
        } finally {
          setLoading(false);
          setPaymentProcessing(false);
        }
      })();
    }, [token, dispatch, fetchAndStoreBookingRef, t]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Initialize booking flow on mount or route params change
  useEffect(() => {
    const roomKey = `${hotelId}_${roomId}`;
    const isNewRoom = flowHotelId !== hotelId || flowRoomId !== roomId;
    const isFreshMount = initializedRoomRef.current !== roomKey;

    if (isFreshMount) {
      initializedRoomRef.current = roomKey;
      if (isNewRoom || currentStep === 'done' || !checkIn || !checkOut) {
        const initialPromo = (routePromoCode ?? promoCode ?? '').trim().toUpperCase();
        dispatch(initBooking({ hotelId, roomId, hotelName: route.params.hotelName ?? '', promoCode: initialPromo }));
        if (roomType || routeCapacity) {
          dispatch(setRoomDetails({ roomType, roomCapacity: routeCapacity }));
        }
        if (routeCheckIn && routeCheckOut) {
          const n = Math.max(1, Math.round((new Date(routeCheckOut).getTime() - new Date(routeCheckIn).getTime()) / 86400000));
          dispatch(setDates({ checkIn: routeCheckIn, checkOut: routeCheckOut, nights: n }));
        }
      }
    }
  }, [hotelId, roomId, route.params.hotelName, flowHotelId, flowRoomId, roomType, routeCapacity, routeCheckIn, routeCheckOut, routePromoCode, promoCode, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-validate quote on app resume
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if ((currentStep === 'payment' || currentStep === 'review') && checkIn && checkOut) {
          getQuote(true);
        }
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [currentStep, checkIn, checkOut]); // eslint-disable-line react-hooks/exhaustive-deps

  const [promoLoading, setPromoLoading] = useState(false);

  const applyPromoCode = useCallback(async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    if (!checkIn || !checkOut) {
      Alert.alert(t('bookingFlow.missingDates'), t('bookingFlow.missingDatesMsg'));
      return;
    }
    setPromoLoading(true);
    try {
      const data = await request<BookingQuote>('/bookings/checkout', {
        method: 'POST',
        body: {
          hotelId, checkIn, checkOut, roomIds: [roomId],
          guests: { adults: parseInt(adults) || 1, children: parseInt(childrenCount) || 0 },
          promoCode: code,
        },
        token,
      });
      dispatch(setPromoCode(code));
      dispatch(setAppliedPromo(code));
      dispatch(setQuoteData(data));
      dispatch(setQuote({ total: data.total, subtotal: data.subtotal, discount: data.discount }));
      const discountPct = data.discount > 0 ? ` — ETB ${Number(data.discount).toLocaleString()} off` : '';
      Alert.alert(t('bookingFlow.applied'), `${code} applied${discountPct}. Total: ETB ${Number(data.total).toLocaleString()}`);
    } catch (err: any) {
      const classified = classifyAndAnnounce(err);
      const msg = (err instanceof ApiError ? err.message : '') || classified.title || 'This promo code is not valid or has expired.';
      Alert.alert('Invalid Promo Code', msg);
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, checkIn, checkOut, hotelId, roomId, adults, childrenCount, token, dispatch, t]);

  const removePromoCode = useCallback(async () => {
    dispatch(setPromoCode(''));
    dispatch(setAppliedPromo(''));
    if (checkIn && checkOut) {
      try {
        const data = await request<BookingQuote>('/bookings/checkout', {
          method: 'POST',
          body: {
            hotelId, checkIn, checkOut, roomIds: [roomId],
            guests: { adults: parseInt(adults) || 1, children: parseInt(childrenCount) || 0 },
          },
          token,
        });
        dispatch(setQuoteData(data));
        dispatch(setQuote({ total: data.total, subtotal: data.subtotal, discount: data.discount }));
      } catch { /* non-critical */ }
    }
  }, [hotelId, roomId, checkIn, checkOut, adults, childrenCount, token, dispatch]);

  // Step index
  const stepNum = { dates: 0, guests: 1, payment: 2, review: 3, done: 4 }[currentStep];

  // Load calendar availability
  const loadAvailability = useCallback(async (year: number, month: number) => {
    setAvailLoading(true);
    try {
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const res = await request<any>(
        `/catalog/rooms/${roomId}/availability?startDate=${startStr}&endDate=${endStr}`,
        { token }
      );
      const days = res?.calendar ?? res?.data ?? [];
      setAvailData(days);
    } catch {
      setAvailData([]);
    } finally {
      setAvailLoading(false);
    }
  }, [roomId, token]);

  useEffect(() => {
    const now = new Date();
    void loadAvailability(now.getFullYear(), now.getMonth());
  }, [loadAvailability]);

  // Price Lock & Room Hold (§10, §11)
  const startRoomHold = useCallback(async () => {
    setSecuringRoom(true);
    const expires = Date.now() + 15 * 60 * 1000;
    dispatch(setHoldExpiresAt(expires));

    if (!checkIn || !checkOut) { setSecuringRoom(false); return; }
    try {
      const promoToLock = (appliedPromo || promoCode).trim().toUpperCase();
      const body: Record<string, unknown> = {
        hotelId, checkIn, checkOut, roomIds: [roomId],
        guests: { adults: parseInt(adults) || 1, children: parseInt(childrenCount) || 0 },
      };
      if (promoToLock) body.promoCode = promoToLock;
      const res = await request<{ priceLockToken: string }>('/bookings/price-lock', { method: 'POST', body, token });
      setPriceLockToken(res.priceLockToken);
    } catch {
      setPriceLockToken(null);
    } finally {
      setSecuringRoom(false);
    }
  }, [checkIn, checkOut, hotelId, roomId, adults, childrenCount, appliedPromo, promoCode, token, dispatch]);

  // Fetch Quote with Price Change detection (§16)
  const getQuote = useCallback(async (silent = false) => {
    if (!checkIn || !checkOut) {
      if (!silent) Alert.alert(t('bookingFlow.missingDates'), t('bookingFlow.missingDatesMsg'));
      return;
    }

    // Capacity validation (§7)
    const totalGuests = (parseInt(adults) || 1) + (parseInt(childrenCount) || 0);
    if (roomCapacity > 0 && totalGuests > roomCapacity) {
      Alert.alert(
        'Capacity Exceeded',
        `This room cannot accommodate the selected guests (${totalGuests} guests for a room capacity of ${roomCapacity}). Please reduce the guest count.`,
      );
      return;
    }

    if (!silent) setLoading(true);
    try {
      const promoToApply = (appliedPromo || promoCode).trim().toUpperCase();
      const body: Record<string, unknown> = {
        hotelId, checkIn, checkOut, roomIds: [roomId],
        guests: { adults: parseInt(adults) || 1, children: parseInt(childrenCount) || 0 },
      };
      if (promoToApply) body.promoCode = promoToApply;
      const data = await request<BookingQuote>('/bookings/checkout', { method: 'POST', body, token });

      if (promoToApply) {
        dispatch(setPromoCode(promoToApply));
        dispatch(setAppliedPromo(promoToApply));
      }

      // Detect price change if user already had an active quote (§16)
      if (quoteTotal !== null && data.total !== quoteTotal) {
        setPreviousPrice(quoteTotal);
        setNewPrice(data.total);
        setShowPriceChangeAlert(true);
      }

      dispatch(setQuoteData(data));
      dispatch(setQuote({ total: data.total, subtotal: data.subtotal, discount: data.discount }));

      if (!silent) {
        hapticSuccess();
        dispatch(setStep('guests'));
      }
    } catch (err: any) {
      if (!silent) {
        hapticError();
        const classified = classifyAndAnnounce(err);
        const msg = (err instanceof ApiError ? err.message : '') || classified.title;
        Alert.alert(t('bookingFlow.quoteFailed'), msg);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [checkIn, checkOut, adults, childrenCount, roomCapacity, hotelId, roomId, appliedPromo, promoCode, token, quoteTotal, dispatch, t]);

  // Advance from Guest Info to Payment & Start Room Hold
  const continueToPayment = () => {
    if (session?.user && !session.user.emailVerifiedAt) {
      return Alert.alert(
        'Verify your email first',
        'Please verify your email address before making a booking.',
      );
    }
    try {
      guestInfoSchema.parse({
        guestFullName: guestFullName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim() || undefined,
      });
      setFieldErrors({});
    } catch (err: any) {
      const errors: Record<string, string | undefined> = {};
      err.errors?.forEach((e: any) => { errors[e.path?.[0]] = e.message; });
      setFieldErrors(errors);
      const msg = err.errors?.[0]?.message ?? 'Please fill in all required fields.';
      return Alert.alert(t('bookingFlow.guestRequired'), msg);
    }

    const totalGuests = (parseInt(adults) || 1) + (parseInt(childrenCount) || 0);
    if (roomCapacity > 0 && totalGuests > roomCapacity) {
      return Alert.alert(
        'Capacity Exceeded',
        'This room cannot accommodate the selected guests. Please reduce the guest count.',
      );
    }

    if (!houseRulesAccepted) {
      return Alert.alert(t('bookingFlow.houseRulesRequired'), t('bookingFlow.houseRulesRequiredMsg'));
    }

    // Start room hold and advance to payment
    void startRoomHold();
    hapticSuccess();
    dispatch(setStep('payment'));
  };

  // Create Booking with Concurrency & Cash-at-Hotel handling (§13, §14, §15)
  const createBooking = async () => {
    if (isOffline) {
      return Alert.alert('Offline', 'Cannot complete booking while offline. Please connect to the internet.');
    }
    if (!session?.user) {
      return Alert.alert('Sign In Required', 'Please sign in to complete your booking.');
    }

    setLoading(true);
    setPaymentProcessing(false);
    setPaymentFailed(false);

    try {
      let createdBookingId: string;
      const promoToConfirm = (appliedPromo || promoCode).trim().toUpperCase();

      if (priceLockToken) {
        const body: Record<string, unknown> = {
          priceLockToken, hotelId, checkIn, checkOut, roomIds: [roomId],
          guests: { adults: parseInt(adults) || 1, children: parseInt(childrenCount) || 0 },
          guestInfos: [{
            fullName: guestFullName.trim(),
            email: guestEmail.trim() || undefined,
            phone: guestPhone.trim() || undefined,
            nationality: guestNationality.trim() || undefined,
            idPassport: guestIdPassport.trim() || undefined,
          }],
          paymentMethod,
          idempotencyKey,
        };
        if (promoToConfirm) body.promoCode = promoToConfirm;
        const data = await request<{ id: string }>('/bookings/confirm', { method: 'POST', body, token });
        createdBookingId = data.id;
      } else {
        const body: Record<string, unknown> = {
          hotelId, checkIn, checkOut, roomIds: [roomId],
          guests: { adults: parseInt(adults) || 1, children: parseInt(childrenCount) || 0 },
          guestInfos: [{
            fullName: guestFullName.trim(),
            email: guestEmail.trim() || undefined,
            phone: guestPhone.trim() || undefined,
            nationality: guestNationality.trim() || undefined,
            idPassport: guestIdPassport.trim() || undefined,
          }],
          paymentMethod,
          idempotencyKey,
        };
        if (promoToConfirm) body.promoCode = promoToConfirm;
        const data = await request<{ id: string }>('/bookings', { method: 'POST', body, token });
        createdBookingId = data.id;
      }

      // Cash-at-Hotel exception (§13): No pending state created, skips payment intent
      if (paymentMethod === 'CASH_AT_HOTEL') {
        dispatch(setBookingId(createdBookingId));
        fetchAndStoreBookingRef(createdBookingId);
        hapticSuccess();
        dispatch(setStep('done'));
        return;
      }

      // Online payment processing (§14) — navigate to Chapa checkout or mock auth
      setPaymentProcessing(true);
      try {
        await request(`/payments/${createdBookingId}/intent`, { method: 'POST', body: { method: paymentMethod }, token });

        // Store the booking ID so the focus listener detects the result on return
        pendingMockAuthBookingId.current = createdBookingId;

        // Navigate to the appropriate payment screen
        if (CHAPA_METHODS.has(paymentMethod)) {
          navigation.navigate('ChapaCheckout', {
            bookingId: createdBookingId,
            method: paymentMethod,
            amount: quoteTotal ?? (quoteData?.total ?? 0),
            currency: 'ETB',
            hotelName,
            roomType: roomType || undefined,
            phone: guestPhone || undefined,
          });
        } else {
          navigation.navigate('MockAuth', {
            bookingId: createdBookingId,
            method: paymentMethod,
            amount: quoteTotal ?? (quoteData?.total ?? 0),
            hotelName,
            reference: bookingRef || createdBookingId.slice(0, 8),
          });
        }
      } catch (payErr) {
        // Mobile.md §4 edge case: connectivity was lost exactly between payment submission
        // and response. Before showing a failure UI, verify the actual server-side status —
        // the payment may have succeeded even though we got a network error client-side.
        // This prevents the user from double-submitting a payment that already went through.
        try {
          const serverBooking = await request<{ status: string; payment?: { status: string } }>(
            `/bookings/${createdBookingId}`, { token },
          );
          if (serverBooking.status === 'CONFIRMED' || serverBooking.payment?.status === 'SUCCEEDED') {
            // Payment already succeeded — treat as success, don't show failure UI
            dispatch(setBookingId(createdBookingId));
            fetchAndStoreBookingRef(createdBookingId);
            hapticSuccess();
            dispatch(setStep('done'));
            return;
          }
        } catch {
          // Server check also failed (still offline) — proceed to show payment failed UI
        }
        const reason = payErr instanceof ApiError ? payErr.message : t('bookingFlow.paymentFailedReason');
        setPaymentFailed(true);
        setPaymentError(reason);
        dispatch(setBookingId(createdBookingId));
        fetchAndStoreBookingRef(createdBookingId);
        hapticError();
        Alert.alert(t('bookingFlow.paymentFailed'), reason, [
          { text: t('bookingFlow.retryPayment'), onPress: () => retryPayment(createdBookingId) },
          { text: t('bookingFlow.changeMethod'), onPress: () => { setPaymentFailed(false); dispatch(setStep('payment')); } },
          { text: t('bookingFlow.cancel'), style: 'cancel' },
        ]);
        return;
      }
    } catch (err) {
      hapticError();
      const message = err instanceof Error ? err.message : '';
      const isConflict = message.toLowerCase().includes('conflict') ||
                         message.toLowerCase().includes('already booked') ||
                         message.toLowerCase().includes('not available') ||
                         message.toLowerCase().includes('unavailable') ||
                         (err instanceof ApiError && err.status === 409);

      // Concurrency failure (§15)
      if (isConflict) {
        setShowAvailabilityAlert(true);
        return;
      }

      const classified = classifyAndAnnounce(err);
      const errorMsg = (err instanceof ApiError ? err.message : '') || classified.title || 'Could not complete booking. Please try again.';
      setPaymentFailed(true);
      setPaymentError(errorMsg);
      Alert.alert(t('bookingFlow.bookingFailed'), errorMsg);
    } finally {
      setLoading(false);
      setPaymentProcessing(false);
    }
  };

  const retryPayment = async (targetBookingId: string) => {
    setPaymentProcessing(true);
    setPaymentFailed(false);
    try {
      try {
        const booking = await request<{ status?: string; paymentStatus?: string }>(`/bookings/${targetBookingId}`, { token });
        if (booking.status === 'CONFIRMED' || booking.paymentStatus === 'PAID' || booking.paymentStatus === 'SUCCEEDED') {
          dispatch(setBookingId(targetBookingId));
          fetchAndStoreBookingRef(targetBookingId);
          hapticSuccess();
          dispatch(setStep('done'));
          return;
        }
      } catch { /* non-critical */ }

      await request(`/payments/${targetBookingId}/intent`, { method: 'POST', body: { method: paymentMethod }, token });

      // Store the booking ID so the focus listener detects the result on return
      pendingMockAuthBookingId.current = targetBookingId;

      // Navigate to the appropriate payment screen
      if (CHAPA_METHODS.has(paymentMethod)) {
        navigation.navigate('ChapaCheckout', {
          bookingId: targetBookingId,
          method: paymentMethod,
          amount: quoteTotal ?? (quoteData?.total ?? 0),
          currency: 'ETB',
          hotelName,
          roomType: roomType || undefined,
          phone: guestPhone || undefined,
        });
      } else {
        navigation.navigate('MockAuth', {
          bookingId: targetBookingId,
          method: paymentMethod,
          amount: quoteTotal ?? (quoteData?.total ?? 0),
          hotelName,
          reference: bookingRef || targetBookingId.slice(0, 8),
        });
      }
    } catch (payErr) {
      const reason = payErr instanceof ApiError ? payErr.message : t('bookingFlow.paymentFailedReason');
      setPaymentFailed(true);
      setPaymentError(reason);
      hapticError();
      Alert.alert(t('bookingFlow.paymentFailed'), reason, [
        { text: t('bookingFlow.retryPayment'), onPress: () => retryPayment(targetBookingId) },
        { text: t('bookingFlow.changeMethod'), onPress: () => { setPaymentFailed(false); dispatch(setStep('payment')); } },
        { text: t('bookingFlow.cancel'), style: 'cancel' },
      ]);
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Download Invoice PDF (§18)
  const downloadInvoice = async () => {
    if (!bookingId) return;
    setDownloadingInvoice(true);
    try {
      const blob = await requestBlob(`/bookings/${bookingId}/invoice`, { token });
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const { File, Paths } = await import('expo-file-system');
        const file = new File(Paths.document, `invoice-${bookingId.slice(0, 8)}.pdf`);
        file.write(base64);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Download Invoice',
          });
        } else {
          Alert.alert('Invoice Saved', `Saved to ${file.uri}`);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not download invoice.');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const addToCalendar = async () => {
    hapticSuccess();
    const start = new Date(checkIn ?? Date.now());
    const end = new Date(checkOut ?? Date.now());
    end.setDate(end.getDate() + 1);
    const ok = await addBookingToCalendar({
      title: `LuxSty: ${hotelName}`,
      startDate: start,
      endDate: end,
      location: hotelName,
      notes: `Booking reference: ${bookingRef ?? bookingId ?? ''}\nRoom: ${roomType ?? ''}`,
    });
    if (ok) {
      Alert.alert('Added to Calendar', 'Reservation has been added to your calendar.');
    } else {
      Alert.alert(
        'Added to Calendar',
        `Reservation added:\nHotel: ${hotelName}\nCheck-in: ${checkIn}\nCheck-out: ${checkOut}`,
      );
    }
  };

  const navigateBack = () => {
    if (currentStep === 'done' || currentStep === 'dates') {
      dispatch(resetBooking());
      navigation.goBack();
      return;
    }
    if (currentStep === 'guests') {
      dispatch(setStep('dates'));
      return;
    }
    if (currentStep === 'payment') {
      dispatch(setStep('guests'));
      return;
    }
    if (currentStep === 'review') {
      dispatch(setStep('payment'));
      return;
    }
    navigation.goBack();
  };

  const totalGuests = (parseInt(adults) || 1) + (parseInt(childrenCount) || 0);
  const isOverCapacity = roomCapacity > 0 && totalGuests > roomCapacity;

  return (
    <View style={[styles.container, { backgroundColor: c.paper }]}> 
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, { paddingHorizontal: pad }]}
    >
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <Pressable onPress={navigateBack} style={styles.backTouch} hitSlop={8}>
        <Text style={[styles.backText, { color: c.teal }]}>{'< Back'}</Text>
      </Pressable>

      <Text {...textProps} style={[styles.title, { color: c.ink }]}>{t('bookingFlow.title')}</Text>

      <View style={styles.stepperWrap}>
        <BookingStepper current={stepNum} steps={FLOW_STEPS} />
      </View>

      {/* ── STEP 0: DATES ─────────────────────────────────────────────────── */}
      {currentStep === 'dates' && (
        <Card style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.sectionTitle, { color: c.ink }]}>{t('bookingFlow.selectDates')}</Text>
          <AvailabilityCalendar
            data={availData}
            loading={availLoading}
            value={{ checkIn: checkIn || null, checkOut: checkOut || null }}
            onChange={(range) => {
              const n = range.checkIn && range.checkOut
                ? Math.max(1, Math.round((new Date(range.checkOut).getTime() - new Date(range.checkIn).getTime()) / 86400000))
                : 0;
              dispatch(setDates({ checkIn: range.checkIn ?? '', checkOut: range.checkOut ?? '', nights: n }));
            }}
            onMonthChange={(y, m) => loadAvailability(y, m)}
          />

          <View style={styles.guestsRow}>
            <View style={styles.flex}>
              <Text style={[styles.label, { color: c.inkSoft }]}>{t('bookingFlow.adults')}</Text>
              <TextInput
                value={adults}
                onChangeText={(v) => dispatch(setAdults(v))}
                keyboardType="numeric"
                style={[styles.input, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }]}
              />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.label, { color: c.inkSoft }]}>{t('bookingFlow.children')}</Text>
              <TextInput
                value={childrenCount}
                onChangeText={(v) => dispatch(setChildrenCount(v))}
                keyboardType="numeric"
                style={[styles.input, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }]}
              />
            </View>
          </View>

          {/* Occupancy validation alert (§7) */}
          {isOverCapacity && (
            <View style={styles.capacityWarning}>
              <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
              <Text style={styles.capacityWarningText}>
                This room cannot accommodate the selected guests (max capacity: {roomCapacity}). Please adjust guests.
              </Text>
            </View>
          )}

          <Text style={[styles.label, { color: c.inkSoft }]}>{t('bookingFlow.promoCode')}</Text>
          <View style={styles.promoRow}>
            <TextInput
              value={promoCode}
              onChangeText={(v) => dispatch(setPromoCode(v))}
              placeholder="e.g. YAYE10"
              placeholderTextColor={c.inkMuted}
              style={[styles.input, styles.promoInput, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }]}
              autoCapitalize="characters"
            />
            <Pressable
              onPress={applyPromoCode}
              disabled={promoLoading || !promoCode.trim()}
              style={({ pressed }) => [styles.promoBtn, pressed && { opacity: 0.85 }, (promoLoading || !promoCode.trim()) && { opacity: 0.5 }]}
            >
              {promoLoading ? (
                <ActivityIndicator size="small" color={BK.white} />
              ) : (
                <Text style={styles.promoBtnText}>{t('bookingFlow.apply')}</Text>
              )}
            </Pressable>
          </View>

          {appliedPromo ? (
            <View style={[styles.promoApplied, { backgroundColor: c.tealTint }]}>
              <Text style={[styles.promoAppliedText, { color: c.goldDeep }]}>{appliedPromo} ✓</Text>
              <Pressable onPress={removePromoCode}>
                <Text style={[styles.promoRemove, { color: c.brick }]}>{t('bookingFlow.remove')}</Text>
              </Pressable>
            </View>
          ) : null}

          <Button
            title={t('bookingFlow.getPrice')}
            onPress={() => getQuote()}
            loading={loading}
            disabled={loading || isOffline || !checkIn || !checkOut || isOverCapacity}
          />
        </Card>
      )}

      {/* ── STEP 1: GUESTS ────────────────────────────────────────────────── */}
      {currentStep === 'guests' && (
        <Card style={[styles.card, { backgroundColor: c.surface }]}>
          <Text style={[styles.sectionTitle, { color: c.ink }]}>{t('bookingFlow.guestInfo')}</Text>

          <Text style={[styles.label, { color: c.inkSoft }]}>{t('bookingFlow.fullName')} *</Text>
          <TextInput
            value={guestFullName}
            onChangeText={(v) => { dispatch(setGuestFullName(v)); setFieldErrors((p) => ({ ...p, guestFullName: undefined })); }}
            placeholder="John Doe"
            placeholderTextColor={c.inkMuted}
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }, fieldErrors.guestFullName && styles.inputError]}
          />
          {fieldErrors.guestFullName ? <Text style={styles.fieldError}>{fieldErrors.guestFullName}</Text> : null}

          <Text style={[styles.label, { color: c.inkSoft }]}>{t('bookingFlow.phoneNumber')}</Text>
          <TextInput
            value={guestPhone}
            onChangeText={(v) => { dispatch(setGuestPhone(v)); setFieldErrors((p) => ({ ...p, guestPhone: undefined })); }}
            placeholder="+251 9XX XXX XXX"
            placeholderTextColor={c.inkMuted}
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }, fieldErrors.guestPhone && styles.inputError]}
            keyboardType="phone-pad"
          />
          {fieldErrors.guestPhone ? <Text style={styles.fieldError}>{fieldErrors.guestPhone}</Text> : null}
          <Text style={[styles.hint, { color: c.inkMuted }]}>{t('bookingFlow.smsHint')}</Text>

          <Text style={[styles.label, { color: c.inkSoft }]}>{t('bookingFlow.email')} *</Text>
          <TextInput
            value={guestEmail}
            onChangeText={(v) => { dispatch(setGuestEmail(v)); setFieldErrors((p) => ({ ...p, guestEmail: undefined })); }}
            placeholder="john@example.com"
            placeholderTextColor={c.inkMuted}
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }, fieldErrors.guestEmail && styles.inputError]}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {fieldErrors.guestEmail ? <Text style={styles.fieldError}>{fieldErrors.guestEmail}</Text> : null}

          <Text style={[styles.label, { color: c.inkSoft }]}>{t('bookingFlow.nationality')}</Text>
          <TextInput
            value={guestNationality}
            onChangeText={(v) => dispatch(setGuestNationality(v))}
            placeholder="Ethiopian"
            placeholderTextColor={c.inkMuted}
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }]}
          />

          <Text style={[styles.label, { color: c.inkSoft }]}>{t('bookingFlow.idPassport')}</Text>
          <TextInput
            value={guestIdPassport}
            onChangeText={(v) => dispatch(setGuestIdPassport(v))}
            placeholder="Passport or National ID"
            placeholderTextColor={c.inkMuted}
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink }]}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { color: c.inkSoft }]}>{t('bookingFlow.specialRequests')}</Text>
          <TextInput
            value={specialRequests}
            onChangeText={(v) => dispatch(setSpecialRequests(v))}
            placeholder="Quiet room, extra pillow, late arrival..."
            placeholderTextColor={c.inkMuted}
            style={[styles.input, { backgroundColor: c.surface, borderColor: c.lineStrong, color: c.ink, minHeight: 70 }]}
            multiline
            textAlignVertical="top"
          />

          <Pressable onPress={() => dispatch(setHouseRulesAccepted(!houseRulesAccepted))} style={styles.checkboxRow}>
            <View style={[styles.checkbox, { borderColor: c.lineStrong }, houseRulesAccepted && styles.checkboxChecked]}>
              {houseRulesAccepted && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.checkboxLabel, { color: c.inkSoft }]}>{t('bookingFlow.acceptRules')}</Text>
          </Pressable>

          <Button
            title="Continue to Payment"
            onPress={continueToPayment}
            disabled={!houseRulesAccepted || isOffline}
          />
          <Button
            variant="secondary"
            title="Back to Dates"
            onPress={() => dispatch(setStep('dates'))}
          />
        </Card>
      )}

      {/* ── STEP 2: PAYMENT METHOD ─────────────────────────────────────────── */}
      {currentStep === 'payment' && quoteData && (
        <View style={styles.stepContainer}>
          {/* Room Hold Securing (§10) */}
          {securingRoom ? (
            <View style={[styles.securingBanner, { backgroundColor: BK.pendingBg, borderColor: BK.pendingBd }]}>
              <ActivityIndicator size="small" color={BK.pending} />
              <View style={styles.securingContent}>
                <Text style={[styles.securingTitle, { color: BK.pending }]}>Securing your room...</Text>
                <Text style={[styles.securingSub, { color: BK.textSec }]}>Please wait while we reserve your room.</Text>
              </View>
            </View>
          ) : holdExpiresAt ? (
            <HoldTimer
              expiresAt={holdExpiresAt}
              onSearchAgain={() => {
                dispatch(resetBooking());
                navigation.navigate('Search');
              }}
            />
          ) : null}

          <Card style={[styles.card, { backgroundColor: c.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={[styles.sectionTitle, { color: c.ink, marginBottom: 0 }]}>Select Payment Method</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: c.teal }}>
                Total: ETB {Number(quoteTotal ?? quoteData.total).toLocaleString()}
              </Text>
            </View>
            <PaymentMethodSelector
              value={paymentMethod as PaymentMethod}
              onChange={(v) => dispatch(setPaymentMethod(v))}
            />
          </Card>

          {paymentFailed && (
            <Card style={[styles.paymentErrorCard, { backgroundColor: BK.cancelledBg, borderColor: BK.cancelledBd }]}>
              <Text style={[styles.paymentErrorTitle, { color: BK.cancelled }]}>⚠️ Payment Unsuccessful</Text>
              <Text style={[styles.paymentErrorDesc, { color: BK.cancelled }]}>
                {paymentError || t('bookingFlow.paymentFailedReason')}
              </Text>
            </Card>
          )}

          <View style={styles.ctaGroup}>
            <Button
              title="Review Reservation"
              onPress={() => dispatch(setStep('review'))}
              disabled={isOffline}
            />
            <Button
              variant="secondary"
              title="Back to Guest Details"
              onPress={() => dispatch(setStep('guests'))}
            />
          </View>
        </View>
      )}

      {/* ── STEP 3: FINAL REVIEW (§17) ────────────────────────────────────── */}
      {currentStep === 'review' && quoteData && (
        <View style={styles.stepContainer}>
          {/* Room Hold Active Header */}
          {holdExpiresAt && (
            <HoldTimer
              expiresAt={holdExpiresAt}
              onSearchAgain={() => {
                dispatch(resetBooking());
                navigation.navigate('Search');
              }}
            />
          )}

          {paymentFailed && (
            <Card style={[styles.paymentErrorCard, { backgroundColor: BK.cancelledBg, borderColor: BK.cancelledBd }]}>
              <Text style={[styles.paymentErrorTitle, { color: BK.cancelled }]}>⚠️ Booking / Payment Unsuccessful</Text>
              <Text style={[styles.paymentErrorDesc, { color: BK.cancelled }]}>
                {paymentError || t('bookingFlow.paymentFailedReason')}
              </Text>
            </Card>
          )}

          <BookingReviewCard
            hotelName={hotelName}
            roomName={roomType ?? 'Selected Room'}
            roomType={roomType ?? 'Selected Room'}
            roomImage={undefined}
            guests={parseInt(adults) || 1 + (parseInt(childrenCount) || 0)}
            checkIn={checkIn ?? ''}
            checkOut={checkOut ?? ''}
            nights={quoteData.nights || (checkIn && checkOut ? Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)) : 1)}
            subtotal={quoteData.subtotal}
            discount={quoteData.discount}
            promoCode={appliedPromo}
            total={quoteData.total}
            paymentMethod={paymentMethod}
            leadGuestName={guestFullName}
            leadGuestEmail={guestEmail}
            leadGuestPhone={guestPhone}
          />
        </View>
      )}

      {/* ── STEP 4: CONFIRMATION (§18, §19, §40) ──────────────────────────── */}
      {currentStep === 'done' && (
        <Card style={[styles.card, { backgroundColor: c.surface }]}>
          <View style={[styles.doneIcon, { backgroundColor: BK.confirmed }]}>
            <Text style={styles.doneCheck}>✓</Text>
          </View>
          <Text {...textProps} style={[styles.doneTitle, { color: c.ink }]}>
            Booking Confirmed
          </Text>
          <Text style={[styles.doneSubtitle, { color: c.inkMuted }]}>
            {paymentMethod === 'CASH_AT_HOTEL'
              ? 'Your reservation is ready. Settle the full amount at hotel reception during check-in.'
              : 'Your payment was successfully completed. We look forward to welcoming you.'}
          </Text>

          {/* Details summary */}
          <View style={styles.doneDetails}>
            <View style={styles.doneRow}>
              <Text style={[styles.doneLabel, { color: c.inkMuted }]}>Booking Reference</Text>
              <Text style={[styles.doneValueBold, { color: BK.navy }]}>{bookingRef || bookingId?.slice(0, 8).toUpperCase() || ''}</Text>
            </View>
            <View style={styles.doneRow}>
              <Text style={[styles.doneLabel, { color: c.inkMuted }]}>Hotel</Text>
              <Text style={[styles.doneValue, { color: c.ink }]}>{hotelName}</Text>
            </View>
            <View style={styles.doneRow}>
              <Text style={[styles.doneLabel, { color: c.inkMuted }]}>Check-in</Text>
              <Text style={[styles.doneValue, { color: c.ink }]}>{checkIn}</Text>
            </View>
            <View style={styles.doneRow}>
              <Text style={[styles.doneLabel, { color: c.inkMuted }]}>Check-out</Text>
              <Text style={[styles.doneValue, { color: c.ink }]}>{checkOut}</Text>
            </View>
            <View style={styles.doneRow}>
              <Text style={[styles.doneLabel, { color: c.inkMuted }]}>Lead Guest</Text>
              <Text style={[styles.doneValue, { color: c.ink }]}>{guestFullName}</Text>
            </View>
            <View style={styles.doneRow}>
              <Text style={[styles.doneLabel, { color: c.inkMuted }]}>Total (Locked Price)</Text>
              <Text style={[styles.doneValueBold, { color: BK.confirmed }]}>
                ETB {quoteTotal != null ? Number(quoteTotal).toLocaleString() : '0'}
              </Text>
            </View>
            <View style={styles.doneRow}>
              <Text style={[styles.doneLabel, { color: c.inkMuted }]}>Payment Status</Text>
              <Text style={[styles.doneValueBold, { color: paymentMethod === 'CASH_AT_HOTEL' ? BK.navy : BK.confirmed }]}>
                {paymentMethod === 'CASH_AT_HOTEL' ? 'Pay at Hotel' : 'Paid'}
              </Text>
            </View>
          </View>

          {/* Check-in QR Code Component (§18, §40) */}
          <View style={styles.qrSection}>
            <QRCodeCard
              bookingRef={bookingRef || bookingId?.slice(0, 8).toUpperCase() || ''}
              guestName={guestFullName}
            />
          </View>

          {/* Actions (§18) */}
          <View style={styles.doneActions}>
            <Button
              title="View Booking"
              onPress={() => {
                dispatch(resetBooking());
                navigation.navigate('BookingDetail', { bookingId: bookingId ?? '' });
              }}
            />
            <Button
              variant="secondary"
              title="Show Full QR Code"
              onPress={() => setShowQRModal(true)}
            />
            <Button
              variant="secondary"
              title="Add to Calendar"
              onPress={addToCalendar}
            />
            <Button
              variant="secondary"
              title={downloadingInvoice ? 'Downloading…' : 'Download Invoice'}
              onPress={downloadInvoice}
              loading={downloadingInvoice}
            />
          </View>

          <Pressable
            onPress={() => {
              dispatch(resetBooking());
              navigation.goBack();
            }}
            style={styles.keepExploringBtn}
          >
            <Text style={[styles.keepExploring, { color: c.teal }]}>Keep Exploring</Text>
          </Pressable>
        </Card>
      )}

      {/* ── MODALS & ALERTS (§15, §16, §40) ───────────────────────────────── */}
      <AvailabilityAlert
        visible={showAvailabilityAlert}
        onViewOtherRooms={() => {
          setShowAvailabilityAlert(false);
          navigation.navigate('HotelDetail', { hotelId });
        }}
        onModifySearch={() => {
          setShowAvailabilityAlert(false);
          dispatch(resetBooking());
          navigation.navigate('Search');
        }}
      />

      <PriceChangeAlert
        visible={showPriceChangeAlert}
        previousPrice={previousPrice ?? 0}
        newPrice={newPrice ?? 0}
        updatedTotal={quoteTotal ?? 0}
        onAccept={() => setShowPriceChangeAlert(false)}
        onGoBack={() => {
          setShowPriceChangeAlert(false);
          dispatch(setStep('dates'));
        }}
      />

      <QRCodeModal
        visible={showQRModal}
        bookingRef={bookingRef || bookingId?.slice(0, 8).toUpperCase() || ''}
        guestName={guestFullName}
        hotelName={hotelName}
        checkIn={checkIn ?? ''}
        checkOut={checkOut ?? ''}
        onClose={() => setShowQRModal(false)}
      />
    </ScrollView>

      {/* ── STICKY BOTTOM BAR (Review step only) ─────────────────── */}
      {currentStep === 'review' && quoteData && (
        <View style={stickyStyles.bar}>
          <View style={stickyStyles.inner}>
            <View style={stickyStyles.priceInfo}>
              <Text style={stickyStyles.totalLabel}>Total</Text>
              <Text style={stickyStyles.totalValue}>
                ETB {quoteTotal != null ? Number(quoteTotal).toLocaleString() : '0'}
              </Text>
            </View>
            <PrimaryButton
              label={
                paymentProcessing
                  ? 'Processing…'
                  : loading
                  ? 'Confirming…'
                  : paymentMethod === 'CASH_AT_HOTEL'
                  ? 'Confirm Booking'
                  : `Confirm & Pay ETB ${quoteTotal != null ? Number(quoteTotal).toLocaleString() : '0'}`
              }
              onPress={createBooking}
              loading={loading || paymentProcessing}
              disabled={loading || paymentProcessing || isOffline}
              style={stickyStyles.payBtn}
            />
          </View>
          <Pressable
            onPress={() => dispatch(setStep('payment'))}
            disabled={loading || paymentProcessing}
            style={stickyStyles.changeMethod}
          >
            <Text style={stickyStyles.changeMethodText}>Change Payment Method</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingVertical: 20, paddingBottom: 160 },
  backTouch: { alignSelf: 'flex-start' },
  backText: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  title: { fontFamily: font.display, fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  stepperWrap: { marginTop: 14, marginBottom: 18 },
  stepContainer: { gap: 14 },
  reviewSubtitle: { fontSize: 13, marginBottom: 8, lineHeight: 18 },
  card: { gap: 12, borderRadius: 18, padding: 18, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  sectionTitle: { fontFamily: font.display, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  hint: { fontSize: 11, marginTop: 2 },
  input: { borderRadius: radius.card, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  inputError: { borderColor: '#EF4444' },
  fieldError: { color: '#EF4444', fontSize: 12, marginTop: 2 },
  guestsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  flex: { flex: 1 },
  capacityWarning: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
  capacityWarningText: { color: '#DC2626', fontSize: 12, flex: 1, lineHeight: 17, fontWeight: '600' },
  promoRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  promoInput: { flex: 1 },
  promoBtn: { backgroundColor: BK.gold, borderRadius: radius.card, paddingHorizontal: 16, paddingVertical: 11 },
  promoBtnText: { color: BK.white, fontWeight: '700', fontSize: 13 },
  promoApplied: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  promoAppliedText: { fontSize: 13, fontWeight: '600' },
  promoRemove: { fontSize: 12, fontWeight: '600' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  checkbox: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: BK.navy, borderColor: BK.navy },
  checkmark: { color: BK.white, fontSize: 14, fontWeight: '700' },
  checkboxLabel: { fontSize: 14 },
  ctaGroup: { marginTop: 8, gap: 10 },
  paymentErrorCard: { gap: 6, borderWidth: 1, borderRadius: 12, padding: 14 },
  paymentErrorTitle: { fontFamily: font.display, fontSize: 15, fontWeight: '700' },
  paymentErrorDesc: { fontSize: 13, lineHeight: 18 },
  doneIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  doneCheck: { color: BK.white, fontSize: 32, fontWeight: '800' },
  doneTitle: { fontFamily: font.display, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  doneSubtitle: { fontSize: 14, textAlign: 'center', marginTop: 4, lineHeight: 20 },
  doneDetails: { marginTop: 16, gap: 6, backgroundColor: BK.bg, borderRadius: 14, padding: 14 },
  doneRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  doneLabel: { fontSize: 13 },
  doneValue: { fontSize: 13, fontWeight: '600' },
  doneValueBold: { fontSize: 14, fontWeight: '800' },
  qrSection: { alignItems: 'center', marginVertical: 12 },
  doneActions: { gap: 10, marginTop: 8 },
  keepExploringBtn: { marginTop: 14, alignItems: 'center', paddingVertical: 8 },
  keepExploring: { fontWeight: '700', fontSize: 14 },
  securingBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  securingContent: { flex: 1, gap: 2 },
  securingTitle: { fontSize: 14, fontWeight: '700' },
  securingSub: { fontSize: 12, lineHeight: 17 },
});

const stickyStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    paddingBottom: 34,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 16 },
      default: {},
    }),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInfo: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  payBtn: {
    flex: 1,
  },
  changeMethod: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  changeMethodText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
});
