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

describe('ManagerBookingService - Milestone 3 Features (Stay Requests, Relocations & Notifications)', () => {
  let service: ManagerBookingService;
  let db: any;
  let scope: any;
  let audit: any;
  let bookings: any;
  let notifications: any;

  beforeEach(() => {
    db = {
      hotel: {
        findMany: jest.fn(),
      },
      stayRequest: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'stay-req-1', status: 'APPROVED' }),
      },
      booking: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'booking-1' }),
      },
      bookingDetail: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'detail-1', roomId: 'room-2' }),
      },
      room: {
        findUnique: jest.fn(),
      },
      roomRelocation: {
        create: jest.fn().mockResolvedValue({ id: 'reloc-1' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'reloc-1' }]),
      },
      roomAvailability: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({}),
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
    bookings = {};
    notifications = {
      notify: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    service = new ManagerBookingService(db, scope, audit, bookings, notifications);
  });

  describe('decideStayRequest', () => {
    it('dispatches rejection notifications when manager rejects stay request', async () => {
      db.stayRequest.findUnique.mockResolvedValue({
        id: 'stay-req-1',
        bookingId: 'booking-1',
        type: 'EARLY_CHECKIN',
        fee: 50,
        status: 'PENDING',
        booking: {
          hotelId: 'hotel-1',
          userId: 'user-guest-1',
          details: [{ roomId: 'room-1' }],
          hotel: { policy: { earlyCheckInFee: 50 } },
        },
      });

      await service.decideStayRequest(
        'stay-req-1',
        { decision: 'REJECTED', decisionNote: 'No rooms ready early' },
        { sub: 'manager-1', role: 'MANAGER' },
      );

      expect(db.stayRequest.update).toHaveBeenCalledWith({
        where: { id: 'stay-req-1' },
        data: expect.objectContaining({
          status: 'REJECTED',
          decisionNote: 'No rooms ready early',
          decidedById: 'manager-1',
        }),
      });
      expect(notifications.notify).toHaveBeenCalledTimes(2);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-guest-1',
          type: 'STAY_REQUEST_DECIDED',
          channel: 'IN_APP',
          payload: expect.objectContaining({
            decision: 'REJECTED',
            decisionNote: 'No rooms ready early',
          }),
        }),
      );
    });

    it('updates booking fee and dispatches approval notifications when approved', async () => {
      db.stayRequest.findUnique.mockResolvedValue({
        id: 'stay-req-2',
        bookingId: 'booking-1',
        type: 'EARLY_CHECKIN',
        fee: 35,
        status: 'PENDING',
        booking: {
          hotelId: 'hotel-1',
          userId: 'user-guest-1',
          details: [{ roomId: 'room-1' }],
          hotel: { policy: { earlyCheckInFee: 35 } },
        },
      });

      await service.decideStayRequest(
        'stay-req-2',
        { decision: 'APPROVED' },
        { sub: 'manager-1', role: 'MANAGER' },
      );

      expect(db.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          earlyCheckIn: true,
          earlyCheckInFee: 35,
        }),
      });
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-guest-1',
          type: 'STAY_REQUEST_DECIDED',
          channel: 'IN_APP',
          payload: expect.objectContaining({
            decision: 'APPROVED',
            fee: 35,
          }),
        }),
      );
    });
  });

  describe('directEarlyCheckIn and directLateCheckOut', () => {
    it('applies early check-in and dispatches live notification to guest', async () => {
      db.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-guest-1',
        hotelId: 'hotel-1',
        status: 'CONFIRMED',
        hotel: { policy: { earlyCheckInFee: 40 } },
      });

      await service.directEarlyCheckIn(
        'booking-1',
        { earlyCheckInFee: 40 },
        { sub: 'staff-1', role: 'STAFF' },
      );

      expect(db.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          status: 'CHECKED_IN',
          earlyCheckIn: true,
          earlyCheckInFee: 40,
        }),
      });
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-guest-1',
          type: 'EARLY_CHECKIN_APPROVED',
          channel: 'IN_APP',
          payload: expect.objectContaining({ fee: 40 }),
        }),
      );
    });

    it('applies late check-out and dispatches live notification to guest', async () => {
      db.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-guest-1',
        hotelId: 'hotel-1',
        status: 'CHECKED_IN',
        details: [{ roomId: 'room-1' }],
        checkOut: new Date('2026-09-12'),
        hotel: { policy: { lateCheckOutFee: 30 } },
      });

      await service.directLateCheckOut(
        'booking-1',
        { lateCheckOutFee: 30 },
        { sub: 'staff-1', role: 'STAFF' },
      );

      expect(db.booking.update).toHaveBeenCalledWith({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          status: 'CHECKED_OUT',
          lateCheckOut: true,
          lateCheckOutFee: 30,
        }),
      });
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-guest-1',
          type: 'LATE_CHECKOUT_APPROVED',
          channel: 'IN_APP',
          payload: expect.objectContaining({ fee: 30 }),
        }),
      );
    });
  });

  describe('relocateRoom and getRelocations', () => {
    it('relocates room atomically, updates availability, inserts RoomRelocation & BookingStatusHistory, and notifies guest', async () => {
      const checkIn = new Date('2026-09-10');
      const checkOut = new Date('2026-09-13');

      db.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        hotelId: 'hotel-1',
        userId: 'user-guest-1',
        status: 'CHECKED_IN',
        checkIn,
        checkOut,
        details: [
          {
            id: 'detail-1',
            roomId: 'room-1',
            room: { id: 'room-1', roomNumber: '101', basePrice: { toNumber: () => 100 } },
          },
        ],
      });

      db.room.findUnique.mockResolvedValue({
        id: 'room-2',
        roomNumber: '201',
        hotelId: 'hotel-1',
        status: 'AVAILABLE',
        basePrice: { toNumber: () => 120 },
      });

      const result = await service.relocateRoom(
        'booking-1',
        { oldRoomId: 'room-1', newRoomId: 'room-2', reason: 'AC malfunction' },
        { sub: 'manager-1', role: 'MANAGER' },
      );

      expect(result.id).toBe('detail-1');
      expect(db.bookingDetail.update).toHaveBeenCalledWith({
        where: { id: 'detail-1' },
        data: expect.objectContaining({
          roomId: 'room-2',
          relocatedFrom: '101',
          relocationReason: 'AC malfunction',
          relocatedBy: 'manager-1',
        }),
        include: { room: true },
      });
      expect(db.roomRelocation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          bookingDetailId: 'detail-1',
          oldRoomId: 'room-1',
          newRoomId: 'room-2',
          reason: 'AC malfunction',
          relocatedById: 'manager-1',
        }),
      });
      expect(db.roomAvailability.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          roomId: 'room-1',
          status: 'UNAVAILABLE',
        }),
      });
      expect(db.bookingStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'booking-1',
          status: 'CHECKED_IN',
          reason: expect.stringContaining('Room relocated from 101 to 201'),
        }),
      });
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-guest-1',
          type: 'ROOM_RELOCATED',
          payload: expect.objectContaining({
            oldRoomNumber: '101',
            newRoomNumber: '201',
            reason: 'AC malfunction',
          }),
        }),
      );
    });

    it('returns relocations list for managed booking', async () => {
      db.booking.findUnique.mockResolvedValue({ id: 'booking-1', hotelId: 'hotel-1' });
      db.roomRelocation.findMany.mockResolvedValue([
        {
          id: 'reloc-1',
          bookingId: 'booking-1',
          reason: 'AC malfunction',
          oldRoom: { id: 'room-1', roomNumber: '101' },
          newRoom: { id: 'room-2', roomNumber: '201' },
        },
      ]);

      const relocations = await service.getRelocations('booking-1', {
        sub: 'manager-1',
        role: 'MANAGER',
      });

      expect(scope.assertManagerOwnsHotel).toHaveBeenCalledWith('manager-1', 'MANAGER', 'hotel-1');
      expect(relocations).toHaveLength(1);
      expect(relocations[0].reason).toBe('AC malfunction');
    });
  });
});

