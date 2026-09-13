import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { BookingQuote } from '../types';

export type BookingStep = 'dates' | 'guests' | 'payment' | 'review' | 'done';

function generateIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface BookingFlowState {
  hotelId: string | null;
  roomId: string | null;
  hotelName: string | null;
  roomType?: string | null;
  roomCapacity?: number | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number;
  adults: string;
  childrenCount: string;
  guestFullName: string;
  guestEmail: string;
  guestPhone: string;
  guestNationality: string;
  guestIdPassport: string;
  specialRequests: string;
  promoCode: string;
  appliedPromo: string;
  houseRulesAccepted: boolean;
  paymentMethod: string;
  currentStep: BookingStep;
  bookingId: string | null;
  bookingRef: string | null;
  quoteTotal: number | null;
  quoteSubtotal: number | null;
  quoteDiscount: number | null;
  quoteData: BookingQuote | null;
  idempotencyKey: string;
  holdExpiresAt: number | null;
}

const initialState: BookingFlowState = {
  hotelId: null,
  roomId: null,
  hotelName: null,
  roomType: null,
  roomCapacity: null,
  checkIn: null,
  checkOut: null,
  nights: 0,
  adults: '1',
  childrenCount: '0',
  guestFullName: '',
  guestEmail: '',
  guestPhone: '',
  guestNationality: '',
  guestIdPassport: '',
  specialRequests: '',
  promoCode: '',
  appliedPromo: '',
  houseRulesAccepted: false,
  paymentMethod: 'CREDIT_CARD',
  currentStep: 'dates',
  bookingId: null,
  bookingRef: null,
  quoteTotal: null,
  quoteSubtotal: null,
  quoteDiscount: null,
  quoteData: null,
  idempotencyKey: generateIdempotencyKey(),
  holdExpiresAt: null,
};

const bookingFlowSlice = createSlice({
  name: 'bookingFlow',
  initialState,
  reducers: {
    initBooking(state, action: PayloadAction<{ hotelId: string; roomId: string; hotelName: string; promoCode?: string }>) {
      // Mobile.md §4: preserve idempotencyKey when the same hotel+room is re-entered
      // (e.g. navigation back/forward mid-flow, backgrounding). Only generate a new
      // key when the user switches to a different hotel or room — a genuinely new attempt.
      const sameAttempt =
        state.hotelId === action.payload.hotelId &&
        state.roomId  === action.payload.roomId;
      const key = sameAttempt ? state.idempotencyKey : generateIdempotencyKey();
      const code = action.payload.promoCode?.trim().toUpperCase() ?? '';
      return {
        ...initialState,
        hotelId:        action.payload.hotelId,
        roomId:         action.payload.roomId,
        hotelName:      action.payload.hotelName,
        promoCode:      code,
        appliedPromo:   code,
        currentStep:    'dates' as BookingStep,
        idempotencyKey: key,
      };
    },
    setDates(state, action: PayloadAction<{ checkIn: string; checkOut: string; nights: number }>) {
      if (state.checkIn !== action.payload.checkIn || state.checkOut !== action.payload.checkOut) {
        state.quoteTotal = null;
        state.quoteSubtotal = null;
        state.quoteDiscount = null;
        state.quoteData = null;
      }
      state.checkIn = action.payload.checkIn;
      state.checkOut = action.payload.checkOut;
      state.nights = action.payload.nights;
    },
    setAdults(state, action: PayloadAction<string>) {
      state.adults = action.payload;
    },
    setChildrenCount(state, action: PayloadAction<string>) {
      state.childrenCount = action.payload;
    },
    setGuestFullName(state, action: PayloadAction<string>) {
      state.guestFullName = action.payload;
    },
    setGuestEmail(state, action: PayloadAction<string>) {
      state.guestEmail = action.payload;
    },
    setGuestPhone(state, action: PayloadAction<string>) {
      state.guestPhone = action.payload;
    },
    setGuestNationality(state, action: PayloadAction<string>) {
      state.guestNationality = action.payload;
    },
    setGuestIdPassport(state, action: PayloadAction<string>) {
      state.guestIdPassport = action.payload;
    },
    setSpecialRequests(state, action: PayloadAction<string>) {
      state.specialRequests = action.payload;
    },
    setPromoCode(state, action: PayloadAction<string>) {
      state.promoCode = action.payload;
    },
    setAppliedPromo(state, action: PayloadAction<string>) {
      state.appliedPromo = action.payload;
    },
    setHouseRulesAccepted(state, action: PayloadAction<boolean>) {
      state.houseRulesAccepted = action.payload;
    },
    setPaymentMethod(state, action: PayloadAction<string>) {
      state.paymentMethod = action.payload;
    },
    setStep(state, action: PayloadAction<BookingStep>) {
      state.currentStep = action.payload;
    },
    setBookingId(state, action: PayloadAction<string>) {
      state.bookingId = action.payload;
    },
    setBookingRef(state, action: PayloadAction<string | null>) {
      state.bookingRef = action.payload;
    },
    setQuote(state, action: PayloadAction<{ total: number; subtotal: number; discount: number }>) {
      state.quoteTotal = action.payload.total;
      state.quoteSubtotal = action.payload.subtotal;
      state.quoteDiscount = action.payload.discount;
    },
    setQuoteData(state, action: PayloadAction<BookingQuote | null>) {
      state.quoteData = action.payload;
    },
    setHoldExpiresAt(state, action: PayloadAction<number | null>) {
      state.holdExpiresAt = action.payload;
    },
    setRoomDetails(state, action: PayloadAction<{ roomType?: string; roomCapacity?: number }>) {
      if (action.payload.roomType) state.roomType = action.payload.roomType;
      if (action.payload.roomCapacity !== undefined) state.roomCapacity = action.payload.roomCapacity;
    },
    resetBooking() {
      return {
        ...initialState,
        idempotencyKey: generateIdempotencyKey(),
      };
    },
  },
});

export const {
  initBooking, setDates, setAdults, setChildrenCount,
  setGuestFullName, setGuestEmail, setGuestPhone, setGuestNationality, setGuestIdPassport, setSpecialRequests,
  setPromoCode, setAppliedPromo, setHouseRulesAccepted,
  setPaymentMethod, setStep, setBookingId, setBookingRef, setQuote, setQuoteData,
  setHoldExpiresAt, setRoomDetails,
  resetBooking,
} = bookingFlowSlice.actions;
export default bookingFlowSlice.reducer;
