import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { HotelStatus, PlaceCategory, PlaceStatus } from '../../../generated/prisma/client';
import {
  CreatePlaceDto,
  EmergencyContactsQueryDto,
  HeritageQueryDto,
  NearbyPlacesQueryDto,
  SearchPlacesQueryDto,
} from '../presentation/dto/discover.dto';

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

@Injectable()
export class DiscoverService {
  constructor(private readonly prisma: PrismaService) {}

  /** Destination-first discovery. Only cities with published, attributed content are public. */
  async getDestinations(limit = 50) {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 50;
    const cities = await this.prisma.city.findMany({
      where: {
        OR: [
          { places: { some: { status: PlaceStatus.PUBLISHED, sourceId: { not: null } } } },
          { hotels: { some: { status: HotelStatus.ACTIVE } } },
        ],
      },
      include: {
        country: { select: { id: true, name: true, code: true } },
        places: {
          where: { status: PlaceStatus.PUBLISHED, sourceId: { not: null } },
          orderBy: [{ rating: 'desc' }, { lastVerifiedAt: 'desc' }],
          take: 1,
          select: { name: true, amharicName: true, description: true, images: true },
        },
        _count: {
          select: {
            places: { where: { status: PlaceStatus.PUBLISHED, sourceId: { not: null } } },
            hotels: { where: { status: HotelStatus.ACTIVE } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: safeLimit,
    });

    return cities.map((city) => ({
      id: city.id,
      name: city.name,
      country: city.country,
      description: city.places[0]?.description ?? `Explore verified stays and experiences in ${city.name}.`,
      amharicName: city.places[0]?.amharicName ?? null,
      heroImage: Array.isArray(city.places[0]?.images) && typeof city.places[0]?.images[0] === 'string' ? city.places[0]?.images[0] : null,
      placeCount: city._count.places,
      hotelCount: city._count.hotels,
    }));
  }

  async getDestination(cityId: string) {
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
      include: {
        country: { select: { id: true, name: true, code: true } },
        places: {
          where: { status: PlaceStatus.PUBLISHED, sourceId: { not: null } },
          include: { source: true, city: true },
          orderBy: [{ rating: 'desc' }, { lastVerifiedAt: 'desc' }],
          take: 50,
        },
        hotels: {
          where: { status: HotelStatus.ACTIVE },
          include: { images: { where: { isPrimary: true }, take: 1 } },
          orderBy: [{ starRating: 'desc' }, { name: 'asc' }],
          take: 30,
        },
      },
    });
    if (!city) throw new NotFoundException('Destination not found');
    return {
      id: city.id,
      name: city.name,
      country: city.country,
      places: city.places,
      hotels: city.hotels.map((hotel) => ({
        id: hotel.id,
        name: hotel.name,
        address: hotel.address,
        lat: hotel.lat,
        lng: hotel.lng,
        starRating: hotel.starRating,
        images: hotel.images.map((image) => image.url),
      })),
    };
  }

  /**
   * Search nearby places within a given radius using Haversine calculation.
   * Adheres to ROAD-001 (sources attached) and PLACE-010 (hoursVerified flag).
   */
  async getNearby(query: NearbyPlacesQueryDto) {
    const { lat, lng, radiusKm = 5, category, limit = 20 } = query;

    // Fast bounding box query in DB first
    // 1 deg lat ~ 111 km, 1 deg lng ~ 111 * cos(lat)
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(lat * (Math.PI / 180)) || 1);

    const places = await this.prisma.place.findMany({
      where: {
        status: PlaceStatus.PUBLISHED,
        sourceId: { not: null },
        ...(category ? { category: category } : {}),
        lat: {
          gte: lat - latDelta,
          lte: lat + latDelta,
        },
        lng: {
          gte: lng - lngDelta,
          lte: lng + lngDelta,
        },
      },
      include: {
        source: true,
        city: true,
      },
      take: 100, // retrieve candidate pool, then filter accurately
    });

    const withDistance = places
      .map((place) => {
        const distanceKm = haversineDistanceKm(lat, lng, place.lat, place.lng);
        return {
          ...place,
          distanceKm,
        };
      })
      .filter((p) => p.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return {
      center: { lat, lng, radiusKm },
      total: withDistance.length,
      data: withDistance,
    };
  }

  /**
   * Get verified heritage, historical sites, and museums.
   */
  async getHeritage(query: HeritageQueryDto) {
    const { cityId, limit = 20 } = query;

    const places = await this.prisma.place.findMany({
      where: {
        status: PlaceStatus.PUBLISHED,
        sourceId: { not: null },
        category: { in: [PlaceCategory.HERITAGE, PlaceCategory.MUSEUM] },
        ...(cityId ? { cityId } : {}),
      },
      include: {
        source: true,
        city: true,
      },
      orderBy: { rating: 'desc' },
      take: limit,
    });

    return {
      total: places.length,
      data: places,
    };
  }

  /**
   * Search places by text keyword across name, description, address.
   */
  async search(query: SearchPlacesQueryDto) {
    const { q, category, cityId, limit = 20 } = query;

    const places = await this.prisma.place.findMany({
      where: {
        status: PlaceStatus.PUBLISHED,
        sourceId: { not: null },
        ...(category ? { category: category } : {}),
        ...(cityId ? { cityId } : {}),
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { amharicName: { contains: q } },
          { description: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: {
        source: true,
        city: true,
      },
      take: limit,
    });

    return {
      query: q,
      total: places.length,
      data: places,
    };
  }

  /**
   * Get full details of a specific place including source attribution.
   */
  async getById(id: string) {
    const place = await this.prisma.place.findFirst({
      where: { id, status: PlaceStatus.PUBLISHED, sourceId: { not: null } },
      include: {
        source: true,
        city: true,
      },
    });

    if (!place) {
      throw new NotFoundException(`Place with ID ${id} not found`);
    }

    return place;
  }

  /**
   * Verified emergency contacts (POLICE, AMBULANCE, FIRE, HOSPITALS, EMBASSIES).
   * Strict adherence to TRIP-010 & TRIP-011.
   */
  async getEmergencyContacts(query: EmergencyContactsQueryDto) {
    const { city, hotelId } = query;

    const contacts = await this.prisma.emergencyContact.findMany({
      where: {
        status: 'PUBLISHED',
        sourceId: { not: null },
        OR: [
          { city: null }, // National contacts (991, 907, etc.)
          ...(city
            ? [{ city: { equals: city, mode: 'insensitive' as const } }]
            : []),
          ...(hotelId ? [{ hotelId }] : []),
        ],
      },
      include: {
        source: true,
        hotel: { select: { id: true, name: true, address: true } },
      },
      orderBy: [{ hotelId: 'desc' }, { kind: 'asc' }],
    });

    return {
      total: contacts.length,
      data: contacts,
    };
  }

  /**
   * List all verified content sources and licenses.
   */
  async getSources() {
    return this.prisma.source.findMany({
      include: {
        _count: {
          select: { places: true, emergencyContacts: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a new place (used for admin/manager or data seeding).
   */
  async createPlace(dto: CreatePlaceDto) {
    return this.prisma.place.create({
      data: {
        name: dto.name,
        amharicName: dto.amharicName,
        description: dto.description,
        amharicDescription: dto.amharicDescription,
        category: dto.category,
        address: dto.address,
        lat: dto.lat,
        lng: dto.lng,
        city: dto.cityId ? { connect: { id: dto.cityId } } : undefined,
        phone: dto.phone,
        website: dto.website,
        openingHours: dto.openingHours,
        hoursVerified: dto.hoursVerified ?? false,
        priceLevel: dto.priceLevel ?? 1,
        rating: dto.rating ?? 4.5,
        images: dto.images ?? [],
        source: { connect: { id: dto.sourceId } },
      },
      include: {
        source: true,
        city: true,
      },
    });
  }
}
