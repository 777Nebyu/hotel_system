import { ManagerCatalogService, CatalogActor } from './manager-catalog.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('ManagerCatalogService - Seasonal Pricing & Validation', () => {
  let service: ManagerCatalogService;
  let db: any;
  let scope: any;
  let audit: any;
  let storage: any;

  const actor: CatalogActor = { sub: 'manager-1', role: 'MANAGER' };

  beforeEach(() => {
    db = {
      room: {
        findUnique: jest.fn().mockResolvedValue({ id: 'room-1', hotelId: 'hotel-1' }),
      },
      seasonalPricing: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };
    scope = {
      assertManagerOwnsHotel: jest.fn().mockResolvedValue(undefined),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    storage = {
      upload: jest.fn(),
      remove: jest.fn(),
    };

    service = new ManagerCatalogService(db, scope, audit, storage);
  });

  describe('upsertSeasonalPricing', () => {
    it('throws NotFoundException if room does not exist', async () => {
      db.room.findUnique.mockResolvedValue(null);

      await expect(
        service.upsertSeasonalPricing(
          'non-existent',
          {
            startDate: new Date('2026-12-01'),
            endDate: new Date('2026-12-10'),
            priceOverride: 250,
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if startDate >= endDate', async () => {
      await expect(
        service.upsertSeasonalPricing(
          'room-1',
          {
            startDate: new Date('2026-12-10'),
            endDate: new Date('2026-12-05'),
            priceOverride: 200,
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if overlapping seasonal pricing exists for the room', async () => {
      db.seasonalPricing.findFirst.mockResolvedValue({
        id: 'season-existing',
        roomId: 'room-1',
        startDate: new Date('2026-12-05'),
        endDate: new Date('2026-12-15'),
        priceOverride: 220,
      });

      await expect(
        service.upsertSeasonalPricing(
          'room-1',
          {
            startDate: new Date('2026-12-01'),
            endDate: new Date('2026-12-10'),
            priceOverride: 250,
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);

      expect(db.seasonalPricing.findFirst).toHaveBeenCalledWith({
        where: {
          roomId: 'room-1',
          startDate: { lt: new Date('2026-12-10') },
          endDate: { gt: new Date('2026-12-01') },
        },
      });
    });

    it('creates seasonal pricing successfully when there is no overlap', async () => {
      db.seasonalPricing.findFirst.mockResolvedValue(null);
      const createdRecord = {
        id: 'season-new',
        roomId: 'room-1',
        startDate: new Date('2026-12-01'),
        endDate: new Date('2026-12-10'),
        priceOverride: 250,
      };
      db.seasonalPricing.create.mockResolvedValue(createdRecord);

      const result = await service.upsertSeasonalPricing(
        'room-1',
        {
          startDate: new Date('2026-12-01'),
          endDate: new Date('2026-12-10'),
          priceOverride: 250,
        },
        actor,
      );

      expect(result).toEqual(createdRecord);
      expect(db.seasonalPricing.create).toHaveBeenCalledWith({
        data: {
          roomId: 'room-1',
          startDate: new Date('2026-12-01'),
          endDate: new Date('2026-12-10'),
          priceOverride: 250,
        },
      });
    });
  });

  describe('removeSeasonalPricing', () => {
    it('deletes seasonal pricing rule for room', async () => {
      db.seasonalPricing.delete.mockResolvedValue({});

      const res = await service.removeSeasonalPricing('room-1', 'season-1', actor);
      expect(res).toEqual({ deleted: true });
      expect(db.seasonalPricing.delete).toHaveBeenCalledWith({
        where: { id: 'season-1', roomId: 'room-1' },
      });
    });
  });
});
