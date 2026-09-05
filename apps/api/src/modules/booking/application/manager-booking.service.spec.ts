import { ManagerBookingService } from './manager-booking.service';
import { ForbiddenException } from '@nestjs/common';

describe('ManagerBookingService - Walk-In Bookings', () => {
  let service: ManagerBookingService;
  let db: any;
  let scope: any;
  let audit: any;
  let bookings: any;

  beforeEach(() => {
    db = {
      hotel: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      booking: {
        update: jest.fn().mockResolvedValue({}),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'booking-1',
          bookingRef: 'YT-2026-ABC12',
          status: 'CONFIRMED',
          hotel: { id: 'hotel-1', name: 'Grand Hotel' },
          details: [],
          payment: { id: 'payment-1', status: 'SUCCEEDED' },
          user: { id: 'guest-1', fullName: 'John Doe', email: 'john@example.com' },
        }),
      },
      payment: {
        update: jest.fn().mockResolvedValue({}),
      },
      paymentAttempt: {
        create: jest.fn().mockResolvedValue({}),
      },
      bookingStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(db)),
    };
    scope = {
      assertManagerOwnsHotel: jest.fn().mockResolvedValue(true),
    };
    audit = {
      record: jest.fn().mockResolvedValue({}),
    };
    bookings = {
      createBooking: jest.fn().mockResolvedValue({
        id: 'booking-1',
        bookingRef: 'YT-2026-ABC12',
        payment: { id: 'payment-1', status: 'PENDING' },
      }),
    };
    service = new ManagerBookingService(db, scope, audit, bookings);
  });

  it('verifies manager permission before creating walk-in booking', async () => {
    scope.assertManagerOwnsHotel.mockRejectedValueOnce(
      new ForbiddenException('You do not manage this hotel'),
    );

    const dto = {
      hotelId: 'hotel-1',
      roomIds: ['room-1'],
      checkIn: '2026-09-10',
      checkOut: '2026-09-12',
      guests: { adults: 2, children: 0 },
      guestName: 'Jane Smith',
      guestPhone: '+251911223344',
      paymentMethod: 'CASH' as const,
      paidImmediately: true,
    };

    await expect(
      service.createWalkInBooking(dto, { sub: 'manager-1', role: 'MANAGER' }),
    ).rejects.toThrow(ForbiddenException);

    expect(scope.assertManagerOwnsHotel).toHaveBeenCalledWith('manager-1', 'MANAGER', 'hotel-1');
  });

  it('creates walk-in booking with new guest account, confirms booking and creates payment records', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({
      id: 'guest-new',
      email: 'walkin@hotel.local',
      fullName: 'Walkin Guest',
    });

    const dto = {
      hotelId: 'hotel-1',
      roomIds: ['room-1'],
      checkIn: '2026-09-10',
      checkOut: '2026-09-12',
      guests: { adults: 1, children: 0 },
      guestName: 'Walkin Guest',
      guestPhone: '+251922334455',
      paymentMethod: 'CASH' as const,
      paidImmediately: true,
    };

    const result = await service.createWalkInBooking(dto, { sub: 'staff-1', role: 'STAFF' });

    expect(result.id).toBe('booking-1');
    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fullName: 'Walkin Guest',
        phone: '+251922334455',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      }),
    });
    expect(bookings.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        hotelId: 'hotel-1',
        bookingSource: 'WALK_IN',
        paymentMethod: 'CASH',
      }),
      'guest-new',
    );
    expect(db.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'CONFIRMED' },
    });
    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: 'SUCCEEDED' },
    });
    expect(db.paymentAttempt.create).toHaveBeenCalledWith({
      data: {
        paymentId: 'payment-1',
        method: 'CASH',
        outcome: 'SUCCESS',
      },
    });
    expect(db.bookingStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'booking-1',
        status: 'CONFIRMED',
        changedBy: 'staff-1',
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      'staff-1',
      'WALK_IN_BOOKING_CREATED',
      'Booking',
      'booking-1',
      expect.objectContaining({ hotelId: 'hotel-1', guestName: 'Walkin Guest' }),
    );
  });
});
