import {
  BOOKING_TRANSITIONS,
  canTransition,
} from './index';
import { buildQuote } from './quote';

// ---------------------------------------------------------------------------
// canTransition — state machine guard
// ---------------------------------------------------------------------------

describe('canTransition', () => {
  // ── valid forward transitions ──────────────────────────────────────────
  describe('valid transitions', () => {
    it.each([
      ['PENDING', 'CONFIRMED'],
      ['PENDING', 'REJECTED'],
      ['PENDING', 'CANCELLED'],
      ['CONFIRMED', 'CHECKED_IN'],
      ['CONFIRMED', 'CANCELLED'],
      ['CONFIRMED', 'NO_SHOW'],
      ['CHECKED_IN', 'CHECKED_OUT'],
    ] as const)(
      '%s → %s is allowed',
      (from, to) => {
        expect(canTransition(from, to)).toBe(true);
      },
    );
  });

  // ── invalid / skipping transitions ────────────────────────────────────
  describe('invalid transitions', () => {
    it.each([
      ['PENDING', 'CHECKED_IN'],   // skip CONFIRMED
      ['PENDING', 'CHECKED_OUT'],  // skip two states
      ['CONFIRMED', 'CHECKED_OUT'],// skip CHECKED_IN
      ['CONFIRMED', 'PENDING'],    // backward
      ['CONFIRMED', 'REJECTED'],   // only PENDING can be rejected
      ['CHECKED_IN', 'PENDING'],   // backward
      ['CHECKED_IN', 'CONFIRMED'], // backward
      ['CHECKED_IN', 'CANCELLED'], // cannot cancel mid-stay
      ['CHECKED_IN', 'REJECTED'],  // cannot reject mid-stay
    ] as const)(
      '%s → %s is rejected',
      (from, to) => {
        expect(canTransition(from, to)).toBe(false);
      },
    );
  });

  // ── terminal states — nothing is allowed out of them ──────────────────
  describe('terminal states block every outgoing transition', () => {
    const terminals = ['CHECKED_OUT', 'CANCELLED', 'REJECTED', 'NO_SHOW'] as const;
    const allStatuses = Object.keys(BOOKING_TRANSITIONS) as (keyof typeof BOOKING_TRANSITIONS)[];

    terminals.forEach((terminal) => {
      allStatuses.forEach((to) => {
        it(`${terminal} → ${to} is blocked`, () => {
          expect(canTransition(terminal, to)).toBe(false);
        });
      });
    });
  });

  // ── BOOKING_TRANSITIONS table consistency ─────────────────────────────
  describe('BOOKING_TRANSITIONS table', () => {
    it('has an entry for every BookingStatus', () => {
      const expected = [
        'PENDING',
        'CONFIRMED',
        'CHECKED_IN',
        'CHECKED_OUT',
        'CANCELLED',
        'REJECTED',
        'NO_SHOW',
      ];
      expect(Object.keys(BOOKING_TRANSITIONS).sort()).toEqual(expected.sort());
    });

    it('terminal states have empty allowed-transitions arrays', () => {
      expect(BOOKING_TRANSITIONS.CHECKED_OUT).toHaveLength(0);
      expect(BOOKING_TRANSITIONS.CANCELLED).toHaveLength(0);
      expect(BOOKING_TRANSITIONS.REJECTED).toHaveLength(0);
      expect(BOOKING_TRANSITIONS.NO_SHOW).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// buildQuote — price quote builder
// ---------------------------------------------------------------------------

describe('buildQuote', () => {
  const baseInput = {
    hotelId: 'hotel-1',
    checkIn: new Date('2026-09-01T00:00:00.000Z'),
    checkOut: new Date('2026-09-04T00:00:00.000Z'), // 3 nights
    adults: 2,
    children: 0,
  };

  // ── nights calculation ─────────────────────────────────────────────────
  describe('nights calculation', () => {
    it('calculates 3 nights for a 3-day stay', () => {
      const quote = buildQuote({
        ...baseInput,
        rooms: [{ roomId: 'r1', roomNumber: '101', nightly: [100, 100, 100] }],
      });
      expect(quote.nights).toBe(3);
    });

    it('calculates 1 night for a single-night stay', () => {
      const quote = buildQuote({
        ...baseInput,
        checkIn: new Date('2026-09-01T00:00:00.000Z'),
        checkOut: new Date('2026-09-02T00:00:00.000Z'),
        rooms: [{ roomId: 'r1', roomNumber: '101', nightly: [100] }],
      });
      expect(quote.nights).toBe(1);
    });

    it('handles a 0-night range by clamping span to 1 for pricePerNight calc', () => {
      const quote = buildQuote({
        ...baseInput,
        checkIn: new Date('2026-09-01T00:00:00.000Z'),
        checkOut: new Date('2026-09-01T00:00:00.000Z'), // same day
        rooms: [{ roomId: 'r1', roomNumber: '101', nightly: [] }],
      });
      // nights = 0, roomTotal = 0, pricePerNight = 0/1 = 0
      expect(quote.nights).toBe(0);
      expect(quote.rooms[0].roomTotal).toBe(0);
    });
  });

  // ── single room pricing ────────────────────────────────────────────────
  describe('single room at flat rate', () => {
    it('computes roomTotal, subtotal, 5% service fee and total correctly', () => {
      const quote = buildQuote({
        ...baseInput,
        rooms: [{ roomId: 'r1', roomNumber: '101', nightly: [100, 100, 100] }],
      });

      expect(quote.rooms).toHaveLength(1);
      expect(quote.rooms[0].roomTotal).toBe(300);
      expect(quote.rooms[0].pricePerNight).toBe(100);
      expect(quote.rooms[0].nights).toBe(3);

      expect(quote.subtotal).toBe(300);
      expect(quote.serviceFee).toBe(15);   // 5% of 300
      expect(quote.discount).toBe(0);
      expect(quote.total).toBe(315);       // 300 + 15
    });
  });

  // ── two rooms ──────────────────────────────────────────────────────────
  describe('two rooms', () => {
    it('sums both room totals into subtotal and applies one service fee', () => {
      const quote = buildQuote({
        ...baseInput,
        rooms: [
          { roomId: 'r1', roomNumber: '101', nightly: [80, 80] },   // $160
          { roomId: 'r2', roomNumber: '102', nightly: [120, 120] }, // $240
        ],
        checkIn: new Date('2026-09-01T00:00:00.000Z'),
        checkOut: new Date('2026-09-03T00:00:00.000Z'), // 2 nights
      });

      expect(quote.rooms[0].roomTotal).toBe(160);
      expect(quote.rooms[1].roomTotal).toBe(240);

      expect(quote.subtotal).toBe(400);
      expect(quote.serviceFee).toBe(20);  // 5% of 400
      expect(quote.total).toBe(420);
    });
  });

  // ── seasonal pricing (variable nightly rates) ──────────────────────────
  describe('seasonal / variable nightly rates', () => {
    it('sums non-uniform nightly prices correctly', () => {
      // Night 1: $100, Night 2: $150 (seasonal), Night 3: $100
      const quote = buildQuote({
        ...baseInput,
        rooms: [{ roomId: 'r1', roomNumber: '101', nightly: [100, 150, 100] }],
      });

      expect(quote.rooms[0].roomTotal).toBe(350);
      // pricePerNight = 350 / 3 = 116.67 (rounded to 2dp)
      expect(quote.rooms[0].pricePerNight).toBe(116.67);

      expect(quote.subtotal).toBe(350);
      expect(quote.serviceFee).toBe(17.5);  // 5% of 350
      expect(quote.total).toBe(367.5);
    });
  });

  // ── discount applied ───────────────────────────────────────────────────
  describe('with a pre-applied discount', () => {
    it('subtracts the discount from total but NOT from serviceFee base', () => {
      const quote = buildQuote({
        ...baseInput,
        rooms: [{ roomId: 'r1', roomNumber: '101', nightly: [100, 100, 100] }],
        discount: 30,
        couponCode: 'SAVE30',
      });

      // subtotal = 300, fee = 15 (based on subtotal, not post-discount)
      expect(quote.subtotal).toBe(300);
      expect(quote.serviceFee).toBe(15);
      expect(quote.discount).toBe(30);
      expect(quote.total).toBe(285);        // 300 + 15 - 30
      expect(quote.couponCode).toBe('SAVE30');
    });

    it('discount of 0 (no coupon) has no effect', () => {
      const quote = buildQuote({
        ...baseInput,
        rooms: [{ roomId: 'r1', roomNumber: '101', nightly: [100, 100, 100] }],
      });
      expect(quote.discount).toBe(0);
      expect(quote.total).toBe(315);
    });
  });

  // ── output shape ───────────────────────────────────────────────────────
  describe('output shape', () => {
    it('echoes hotelId, checkIn, checkOut, and guests back', () => {
      const quote = buildQuote({
        ...baseInput,
        rooms: [{ roomId: 'r1', roomNumber: '101', nightly: [100] }],
        checkIn: new Date('2026-09-01T00:00:00.000Z'),
        checkOut: new Date('2026-09-02T00:00:00.000Z'),
      });

      expect(quote.hotelId).toBe('hotel-1');
      expect(quote.checkIn).toEqual(new Date('2026-09-01T00:00:00.000Z'));
      expect(quote.checkOut).toEqual(new Date('2026-09-02T00:00:00.000Z'));
      expect(quote.guests).toEqual({ adults: 2, children: 0 });
    });

    it('includes roomId and roomNumber on each room line', () => {
      const quote = buildQuote({
        ...baseInput,
        rooms: [{ roomId: 'room-abc', roomNumber: '201', nightly: [200, 200, 200] }],
      });

      expect(quote.rooms[0].roomId).toBe('room-abc');
      expect(quote.rooms[0].roomNumber).toBe('201');
    });

    it('couponCode is undefined when no coupon is passed', () => {
      const quote = buildQuote({
        ...baseInput,
        rooms: [{ roomId: 'r1', roomNumber: '101', nightly: [100, 100, 100] }],
      });
      expect(quote.couponCode).toBeUndefined();
    });
  });

  // ── currency rounding ──────────────────────────────────────────────────
  describe('currency rounding', () => {
    it('rounds all monetary values to 2 decimal places', () => {
      // 3 nights × $33.333… = $99.999…
      const quote = buildQuote({
        ...baseInput,
        rooms: [{ roomId: 'r1', roomNumber: '101', nightly: [33.33, 33.33, 33.34] }],
      });

      expect(quote.rooms[0].roomTotal).toBe(100);    // 33.33+33.33+33.34
      expect(quote.subtotal).toBe(100);
      expect(quote.serviceFee).toBe(5);              // 5% of 100
      expect(quote.total).toBe(105);
      // No floating-point drift — values are clean
      expect(Number.isFinite(quote.total)).toBe(true);
    });
  });
});
