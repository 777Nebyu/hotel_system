import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TripService } from './trip.service';

describe('TripService', () => {
  const db = {
    trip: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tripItem: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    booking: { findFirst: jest.fn() },
    hotel: { findUnique: jest.fn() },
    place: { findFirst: jest.fn() },
  } as any;

  let service: TripService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TripService(db);
  });

  it('does not expose a trip owned by another user', async () => {
    db.trip.findFirst.mockResolvedValue(null);

    await expect(service.get('trip-1', 'user-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(db.trip.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'trip-1', userId: 'user-a', deletedAt: null } }),
    );
  });

  it('rejects reversed trip dates', async () => {
    await expect(
      service.create({ title: 'Addis weekend', startDate: '2026-10-10', endDate: '2026-10-08', timezone: 'Africa/Addis_Ababa' } as any, 'user-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.trip.create).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation for AI-created itinerary items', async () => {
    db.trip.findFirst.mockResolvedValue({
      id: 'trip-1',
      userId: 'user-a',
      startDate: new Date('2026-10-08T00:00:00.000Z'),
      endDate: new Date('2026-10-10T00:00:00.000Z'),
    });

    await expect(
      service.addItem(
        'trip-1',
        {
          dayDate: '2026-10-09',
          itemType: 'CUSTOM',
          title: 'Museum visit',
          createdBy: 'AI',
          userConfirmed: false,
        } as any,
        'user-a',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns conflict metadata for overlapping timed items', async () => {
    db.trip.findFirst.mockResolvedValue({
      id: 'trip-1',
      userId: 'user-a',
      startDate: new Date('2026-10-08T00:00:00.000Z'),
      endDate: new Date('2026-10-10T00:00:00.000Z'),
    });
    db.tripItem.findMany.mockResolvedValue([
      { id: 'existing', title: 'Lunch', startTime: '10:30', durationMin: 60 },
    ]);
    db.tripItem.create.mockResolvedValue({
      id: 'new',
      tripId: 'trip-1',
      dayDate: new Date('2026-10-09T00:00:00.000Z'),
      startTime: '10:00',
      durationMin: 60,
      itemType: 'CUSTOM',
      title: 'Museum',
      place: null,
      booking: null,
    });

    const result = await service.addItem(
      'trip-1',
      {
        dayDate: '2026-10-09',
        itemType: 'CUSTOM',
        title: 'Museum',
        startTime: '10:00',
        durationMin: 60,
        createdBy: 'USER',
        userConfirmed: false,
      } as any,
      'user-a',
    );

    expect(result.hasConflict).toBe(true);
    expect(result.conflictWith).toEqual([
      { id: 'existing', title: 'Lunch', timeWindow: '10:30 - 11:30' },
    ]);
  });
});
