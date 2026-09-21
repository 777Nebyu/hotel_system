import { AdminReportingService } from './admin-reporting.service';
import { ManagerReportingController } from '../presentation/manager-reporting.controller';
import { ForbiddenException } from '@nestjs/common';

describe('Manager Reporting & Hotel-Scoped Analytics', () => {
  let service: AdminReportingService;
  let controller: ManagerReportingController;
  let db: any;
  let cache: any;
  let scope: any;

  beforeEach(() => {
    db = {
      hotel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'hotel-1',
          name: 'Grand Haile',
          starRating: 5,
          status: 'ACTIVE',
          _count: { rooms: 20, bookings: 45, reviews: 10 },
        }),
      },
      room: {
        count: jest.fn().mockResolvedValue(20),
      },
      booking: {
        count: jest.fn().mockResolvedValue(45),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([
          { status: 'CONFIRMED', _count: { _all: 30 } },
          { status: 'CANCELLED', _count: { _all: 15 } },
        ]),
      },
      payment: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: { toNumber: () => 2000 } },
        }),
        findMany: jest.fn().mockResolvedValue([
          { amount: { toNumber: () => 1500 }, createdAt: new Date() },
          { amount: { toNumber: () => 500 }, createdAt: new Date() },
        ]),
      },
    };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    scope = {
      assertManagerOwnsHotel: jest.fn().mockResolvedValue(undefined),
    };

    service = new AdminReportingService(db, cache);
    controller = new ManagerReportingController(service, scope);
  });

  describe('hotelOverview', () => {
    it('aggregates metrics strictly scoped to the specified hotelId', async () => {
      const overview = await service.hotelOverview('hotel-1');

      expect(overview.hotel.id).toBe('hotel-1');
      expect(overview.roomsCount).toBe(20);
      expect(overview.totalBookings).toBe(45);
      expect(overview.totalRevenue).toBe(2000);

      expect(db.hotel.findUnique).toHaveBeenCalledWith({
        where: { id: 'hotel-1' },
        include: {
          _count: { select: { rooms: true, bookings: true, reviews: true } },
        },
      });
      expect(db.booking.count).toHaveBeenCalledWith({
        where: { hotelId: 'hotel-1', status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
      });
    });
  });

  describe('ManagerReportingController security', () => {
    it('validates manager ownership before returning overview', async () => {
      scope.assertManagerOwnsHotel.mockRejectedValue(
        new ForbiddenException('You do not manage this hotel'),
      );

      await expect(
        controller.overview(
          { hotelId: 'hotel-other' },
          {} as any,
          { user: { sub: 'mgr-1', role: 'MANAGER' } },
          { setHeader: jest.fn() } as any,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(scope.assertManagerOwnsHotel).toHaveBeenCalledWith(
        'mgr-1',
        'MANAGER',
        'hotel-other',
      );
    });

    it('returns overview when manager ownership is valid', async () => {
      scope.assertManagerOwnsHotel.mockResolvedValue(undefined);

      const res = await controller.overview(
        { hotelId: 'hotel-1' },
        {} as any,
        { user: { sub: 'mgr-1', role: 'MANAGER' } },
        { setHeader: jest.fn() } as any,
      );

      expect(res.hotel.id).toBe('hotel-1');
      expect(res.totalRevenue).toBe(2000);
    });
  });
});
