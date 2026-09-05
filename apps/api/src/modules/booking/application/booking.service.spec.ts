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
});
