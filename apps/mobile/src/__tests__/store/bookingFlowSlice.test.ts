import bookingFlowReducer, {
  initBooking, setDates, setGuestFullName, setGuestEmail, setGuestPhone, setSpecialRequests,
  setPromoCode, setPaymentMethod, setStep, setBookingId, resetBooking,
} from '../../store/bookingFlowSlice';

describe('bookingFlowSlice', () => {
  it('should return the initial state', () => {
    const state = bookingFlowReducer(undefined, { type: 'unknown' });
    expect(state.hotelId).toBeNull();
    expect(state.currentStep).toBe('dates');
    expect(state.adults).toBe('1');
  });

  it('initBooking sets hotel, room, and resets to dates step', () => {
    const state = bookingFlowReducer(undefined, initBooking({ hotelId: 'h1', roomId: 'r1', hotelName: 'Test Hotel', promoCode: 'save20' }));
    expect(state.hotelId).toBe('h1');
    expect(state.roomId).toBe('r1');
    expect(state.hotelName).toBe('Test Hotel');
    expect(state.promoCode).toBe('SAVE20');
    expect(state.appliedPromo).toBe('SAVE20');
    expect(state.currentStep).toBe('dates');
  });

  it('setDates updates dates and nights and resets stale quote', () => {
    const stateWithQuote = {
      ...bookingFlowReducer(undefined, { type: 'unknown' }),
      quoteTotal: 1000,
      quoteSubtotal: 900,
      quoteDiscount: 100,
      quoteData: {} as any,
    };
    const state = bookingFlowReducer(stateWithQuote, setDates({ checkIn: '2026-01-15', checkOut: '2026-01-18', nights: 3 }));
    expect(state.checkIn).toBe('2026-01-15');
    expect(state.checkOut).toBe('2026-01-18');
    expect(state.nights).toBe(3);
    expect(state.quoteTotal).toBeNull();
    expect(state.quoteSubtotal).toBeNull();
    expect(state.quoteDiscount).toBeNull();
    expect(state.quoteData).toBeNull();
  });

  it('setGuestFullName updates guest name', () => {
    const state = bookingFlowReducer(undefined, setGuestFullName('John Doe'));
    expect(state.guestFullName).toBe('John Doe');
  });

  it('setGuestEmail updates guest email', () => {
    const state = bookingFlowReducer(undefined, setGuestEmail('john@test.com'));
    expect(state.guestEmail).toBe('john@test.com');
  });

  it('setGuestPhone updates guest phone', () => {
    const state = bookingFlowReducer(undefined, setGuestPhone('+1234567890'));
    expect(state.guestPhone).toBe('+1234567890');
  });

  it('setSpecialRequests updates special requests', () => {
    const state = bookingFlowReducer(undefined, setSpecialRequests('Late check-in'));
    expect(state.specialRequests).toBe('Late check-in');
  });

  it('setPromoCode updates promo code', () => {
    const state = bookingFlowReducer(undefined, setPromoCode('SAVE20'));
    expect(state.promoCode).toBe('SAVE20');
  });

  it('setPaymentMethod updates payment method', () => {
    const state = bookingFlowReducer(undefined, setPaymentMethod('TELEBIRR'));
    expect(state.paymentMethod).toBe('TELEBIRR');
  });

  it('setStep updates current step', () => {
    let state = bookingFlowReducer(undefined, setStep('guests'));
    expect(state.currentStep).toBe('guests');
    state = bookingFlowReducer(state, setStep('payment'));
    expect(state.currentStep).toBe('payment');
    state = bookingFlowReducer(state, setStep('done'));
    expect(state.currentStep).toBe('done');
  });

  it('setBookingId updates booking id', () => {
    const state = bookingFlowReducer(undefined, setBookingId('b123'));
    expect(state.bookingId).toBe('b123');
  });

  it('resetBooking returns to initial state', () => {
    const prev = bookingFlowReducer(undefined, initBooking({ hotelId: 'h1', roomId: 'r1', hotelName: 'Test' }));
    const state = bookingFlowReducer(prev, resetBooking());
    expect(state.hotelId).toBeNull();
    expect(state.currentStep).toBe('dates');
  });
});
