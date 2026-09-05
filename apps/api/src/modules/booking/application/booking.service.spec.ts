import { BookingService } from './booking.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('BookingService - Milestone 3 Features (Modifications & Relocations)', () => {
  let service: BookingService;
  let db: any;
  let emitter: any;
  let coupons: any;
  let invoices: any;
  let audit: any;

  beforeEach(() => {
    db = {
      booking: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      bookingModification: {
        create: jest.fn().mockResolvedValue({ id: 'mod-1' }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mod-1',
            bookingId: 'booking-1',
            changes: { oldCheckIn: '2026-09-10', newCheckIn: '2026-09-11' },
            reason: 'Flight delayed',
            requestedById: 'user-1',
          },
        ]),
      },
      roomRelocation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'reloc-1',
            bookingId: 'booking-1',
            reason: 'AC repair',
            oldRoom: { id: 'room-1', roomNumber: '101' },
            newRoom: { id: 'room-2', roomNumber: '201' },
          },
        ]),
      },
    };
    emitter = { emit: jest.fn() };
    coupons = {};
    invoices = {};
    audit = { record: jest.fn().mockResolvedValue({}) };

    service = new BookingService(db, emitter, coupons, invoices, audit);
  });

  describe('getModifications', () => {
    it('throws NotFoundException if booking does not exist', async () => {
      db.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.getModifications('booking-nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user does not own booking', async () => {
      db.booking.findUnique.mockResolvedValue({ userId: 'other-user' });
      await expect(
        service.getModifications('booking-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns modification history for the booking owner', async () => {
      db.booking.findUnique.mockResolvedValue({ userId: 'user-1' });
      const mods = await service.getModifications('booking-1', 'user-1');
      expect(mods).toHaveLength(1);
      expect(mods[0].id).toBe('mod-1');
      expect(db.bookingModification.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
    });
  });

  describe('getRelocations', () => {
    it('throws NotFoundException if booking does not exist', async () => {
      db.booking.findUnique.mockResolvedValue(null);
      await expect(
        service.getRelocations('booking-nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if user does not own booking', async () => {
      db.booking.findUnique.mockResolvedValue({ userId: 'other-user' });
      await expect(
        service.getRelocations('booking-1', 'user-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('returns relocation history for the booking owner', async () => {
      db.booking.findUnique.mockResolvedValue({ userId: 'user-1' });
      const relocs = await service.getRelocations('booking-1', 'user-1');
      expect(relocs).toHaveLength(1);
      expect(relocs[0].id).toBe('reloc-1');
      expect(db.roomRelocation.findMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        orderBy: { relocatedAt: 'desc' },
        include: {
          oldRoom: {
            select: { id: true, roomNumber: true, type: true, basePrice: true },
          },
          newRoom: {
            select: { id: true, roomNumber: true, type: true, basePrice: true },
          },
          relocatedBy: {
            select: { id: true, fullName: true, email: true },
          },
        },
      });
    });
  });

  describe('cancelBooking', () => {
    beforeEach(() => {
      db.$transaction = jest.fn((cb) => cb(db));
      db.roomAvailability = { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) };
      db.payment = { update: jest.fn().mockResolvedValue({}) };
      db.bookingStatusHistory = { create: jest.fn().mockResolvedValue({}) };
    });

    it('throws ConflictException if booking is already CANCELLED', async () => {
      db.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        status: 'CANCELLED',
        details: [],
      });

      await expect(service.cancelBooking('booking-1', 'user-1')).rejects.toThrow(
        'Booking in "CANCELLED" state cannot be cancelled',
      );
    });

    it('throws ForbiddenException if non-owner attempts cancellation', async () => {
      db.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'other-user',
        status: 'CONFIRMED',
        details: [],
      });

      await expect(service.cancelBooking('booking-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('grants 100% refund when cancelled >48h before check-in and releases rooms', async () => {
      const futureCheckIn = new Date(Date.now() + 72 * 3600 * 1000); // 72 hours away
      const futureCheckOut = new Date(futureCheckIn.getTime() + 48 * 3600 * 1000);
      db.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        userId: 'user-1',
        hotelId: 'hotel-1',
        status: 'CONFIRMED',
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        totalPrice: { toNumber: () => 300 },
        details: [{ roomId: 'room-1' }, { roomId: 'room-2' }],
        payment: {
          id: 'pay-1',
          status: 'SUCCEEDED',
          amount: { toNumber: () => 300 },
        },
      });

      const res = await service.cancelBooking('booking-1', 'user-1');
      expect(res.refundTier).toBe('100%');
      expect(res.refundAmount).toBe(300);

      // Verify availability release
      expect(db.roomAvailability.deleteMany).toHaveBeenCalledWith({
        where: {
          roomId: { in: ['room-1', 'room-2'] },
          date: { gte: futureCheckIn, lt: futureCheckOut },
          status: 'UNAVAILABLE',
        },
      });

      // Verify payment update
      expect(db.payment.update).toHaveBeenCalledWith({
        where: { bookingId: 'booking-1' },
        data: expect.objectContaining({
          status: 'REFUNDED',
          refundAmount: 300,
        }),
      });

      // Verify event emission
      expect(emitter.emit).toHaveBeenCalledWith(
        'booking.cancelled',
        expect.objectContaining({
          bookingId: 'booking-1',
          userId: 'user-1',
          hotelId: 'hotel-1',
        }),
      );
    });

    it('grants 50% refund when cancelled between 24h and 48h before check-in', async () => {
      const futureCheckIn = new Date(Date.now() + 30 * 3600 * 1000); // 30 hours away
      const futureCheckOut = new Date(futureCheckIn.getTime() + 24 * 3600 * 1000);
      db.booking.findUnique.mockResolvedValue({
        id: 'booking-2',
        userId: 'user-1',
        hotelId: 'hotel-1',
        status: 'CONFIRMED',
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        totalPrice: { toNumber: () => 200 },
        details: [{ roomId: 'room-1' }],
        payment: {
          id: 'pay-2',
          status: 'SUCCEEDED',
          amount: { toNumber: () => 200 },
        },
      });

      const res = await service.cancelBooking('booking-2', 'user-1');
      expect(res.refundTier).toBe('50%');
      expect(res.refundAmount).toBe(100);
    });

    it('grants 0% refund when cancelled less than 24h before check-in', async () => {
      const futureCheckIn = new Date(Date.now() + 10 * 3600 * 1000); // 10 hours away
      const futureCheckOut = new Date(futureCheckIn.getTime() + 24 * 3600 * 1000);
      db.booking.findUnique.mockResolvedValue({
        id: 'booking-3',
        userId: 'user-1',
        hotelId: 'hotel-1',
        status: 'CONFIRMED',
        checkIn: futureCheckIn,
        checkOut: futureCheckOut,
        totalPrice: { toNumber: () => 200 },
        details: [{ roomId: 'room-1' }],
        payment: {
          id: 'pay-3',
          status: 'SUCCEEDED',
          amount: { toNumber: () => 200 },
        },
      });

      const res = await service.cancelBooking('booking-3', 'user-1');
      expect(res.refundTier).toBe('0%');
      expect(res.refundAmount).toBe(0);
    });
  });
});
