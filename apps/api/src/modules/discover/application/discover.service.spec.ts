import { NotFoundException } from '@nestjs/common';
import { DiscoverService, haversineDistanceKm } from './discover.service';

describe('DiscoverService', () => {
  const prisma = {
    place: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    emergencyContact: { findMany: jest.fn() },
    source: { findMany: jest.fn() },
  } as any;

  let service: DiscoverService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiscoverService(prisma);
  });

  it('calculates haversine distance in kilometres', () => {
    expect(haversineDistanceKm(9.0105, 38.7612, 9.0105, 38.7612)).toBe(0);
  });

  it('only queries attributed published places for nearby results', async () => {
    prisma.place.findMany.mockResolvedValue([]);

    const result = await service.getNearby({
      lat: 9.0105,
      lng: 38.7612,
      radiusKm: 5,
      limit: 10,
    });

    expect(result.data).toEqual([]);
    expect(prisma.place.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          sourceId: { not: null },
        }),
      }),
    );
  });

  it('does not return unpublished or unattributed place details', async () => {
    prisma.place.findFirst.mockResolvedValue(null);

    await expect(service.getById('place-draft')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.place.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'place-draft',
          status: 'PUBLISHED',
          sourceId: { not: null },
        },
      }),
    );
  });

  it('requires a source when creating a place', async () => {
    prisma.place.create.mockResolvedValue({ id: 'place-1' });

    await service.createPlace({
      name: 'A verified place',
      description: 'A sufficiently descriptive place record.',
      category: 'MUSEUM',
      address: 'Addis Ababa',
      lat: 9,
      lng: 38,
      sourceId: 'source-1',
    } as any);

    expect(prisma.place.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: { connect: { id: 'source-1' } },
        }),
      }),
    );
  });
});
