import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  AvailabilityWindow,
  Paginated,
  SearchHotelsQuery,
} from '@repo/shared-types';
import type {
  HotelDetail,
  HotelSummary,
  RoomPayload,
  RoomWithAvailability,
} from '../domain';
import {
  availableNights,
  parseDateOnly,
  roomAvailableAcross,
} from '../domain/availability';
import { minNightlyPrice, priceRange, roundCurrency } from '../domain/pricing';

const hotelQueryInclude = {
  city: { include: { country: true } },
  images: true,
  amenities: { include: { amenity: true } },
  reviews: { select: { rating: true } },
  rooms: { include: { seasonalPricing: true } },
} satisfies Prisma.HotelInclude;

type HotelQueryRow = Prisma.HotelGetPayload<{
  include: typeof hotelQueryInclude;
}>;

const hotelDetailInclude = {
  city: { include: { country: true } },
  images: true,
  amenities: { include: { amenity: true } },
  reviews: { select: { rating: true } },
  rooms: {
    include: { images: true, amenities: { include: { amenity: true } } },
  },
} satisfies Prisma.HotelInclude;

type HotelDetailRow = Prisma.HotelGetPayload<{
  include: typeof hotelDetailInclude;
}>;

const roomDetailInclude = {
  hotel: { select: { id: true, name: true } },
  images: true,
  amenities: { include: { amenity: true } },
  seasonalPricing: true,
} satisfies Prisma.RoomInclude;

@Injectable()
export class CatalogService {
  constructor(private readonly db: PrismaService) {}

  async search(query: SearchHotelsQuery): Promise<Paginated<HotelSummary>> {
    const page = query.page;
    const pageSize = query.pageSize;
    const where: Prisma.HotelWhereInput = { status: 'ACTIVE' };

    if (query.city || query.country) {
      where.city = {
        AND: [
          query.city
            ? { name: { contains: query.city, mode: 'insensitive' } }
            : {},
          query.country
            ? {
                country: {
                  name: { contains: query.country, mode: 'insensitive' },
                },
              }
            : {},
        ],
      };
    }
    if (query.roomType) {
      where.rooms = { some: { type: query.roomType } };
    }
    if (query.amenities?.length) {
      where.amenities = {
        some: { amenity: { name: { in: query.amenities } } },
      };
    }

    // NOTE: filtering on computed `minPricePerNight` / `averageRating` and the
    // prepared sorts are done in-memory because Prisma cannot aggregate in
    // `orderBy`/`where`. Dataset is small today; revisit with a raw aggregate
    // query if it grows (perf pass, Week 6).
    const hotels = await this.db.hotel.findMany({
      where,
      include: hotelQueryInclude,
    });

    const summaries = hotels
      .map((hotel) => this.toSummary(hotel))
      .filter((summary) => {
        if (
          query.priceMin !== undefined &&
          (summary.minPricePerNight === null ||
            summary.minPricePerNight < query.priceMin)
        ) {
          return false;
        }
        if (
          query.priceMax !== undefined &&
          (summary.minPricePerNight === null ||
            summary.minPricePerNight > query.priceMax)
        ) {
          return false;
        }
        if (
          query.minRating !== undefined &&
          (summary.averageRating === null ||
            summary.averageRating < query.minRating)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (query.sort) {
          case 'price_asc':
            return (
              (a.minPricePerNight ?? Number.POSITIVE_INFINITY) -
              (b.minPricePerNight ?? Number.POSITIVE_INFINITY)
            );
          case 'price_desc':
            return (
              (b.minPricePerNight ?? Number.NEGATIVE_INFINITY) -
              (a.minPricePerNight ?? Number.NEGATIVE_INFINITY)
            );
          case 'rating_desc':
            return (b.averageRating ?? 0) - (a.averageRating ?? 0);
          default:
            return b.reviewCount - a.reviewCount;
        }
      });

    const total = summaries.length;
    const pageCount = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    const start = (page - 1) * pageSize;
    return {
      data: summaries.slice(start, start + pageSize),
      meta: { total, page, pageSize, pageCount },
    };
  }

  async hotelById(id: string): Promise<HotelDetail> {
    const hotel = await this.db.hotel.findUnique({
      where: { id },
      include: hotelDetailInclude,
    });
    if (!hotel || hotel.status !== 'ACTIVE') {
      throw new NotFoundException('Hotel not found');
    }
    return this.toDetail(hotel);
  }

  async hotelRoomsWithAvailability(
    hotelId: string,
    window: AvailabilityWindow,
  ): Promise<RoomWithAvailability[]> {
    const hotel = await this.db.hotel.findUnique({
      where: { id: hotelId },
      select: { status: true },
    });
    if (!hotel || hotel.status !== 'ACTIVE') {
      throw new NotFoundException('Hotel not found');
    }

    const checkIn = parseDateOnly(window.checkIn);
    const checkOut = parseDateOnly(window.checkOut);
    const totalNights = Math.round(
      (checkOut.getTime() - checkIn.getTime()) / 86_400_000,
    );

    const rooms = await this.db.room.findMany({
      where: { hotelId },
      include: {
        images: true,
        amenities: { include: { amenity: true } },
        availability: { where: { date: { gte: checkIn, lt: checkOut } } },
        seasonalPricing: true,
      },
    });

    return rooms.map((room) => {
      const range = priceRange(room, room.seasonalPricing, checkIn, checkOut);
      return {
        ...this.toRoomPayload(room),
        availableAcrossRange: roomAvailableAcross(
          room.status,
          room.availability,
          checkIn,
          checkOut,
        ),
        availableNights: availableNights(
          room.status,
          room.availability,
          checkIn,
          checkOut,
        ),
        totalNights,
        priceRange: range
          ? { min: roundCurrency(range.min), max: roundCurrency(range.max) }
          : null,
      } satisfies RoomWithAvailability;
    });
  }

  async roomById(roomId: string) {
    const room = await this.db.room.findUnique({
      where: { id: roomId },
      include: roomDetailInclude,
    });
    if (!room) throw new NotFoundException('Room not found');
    return {
      ...this.toRoomPayload(room),
      hotel: room.hotel,
      seasonalPrices: room.seasonalPricing.map((pricing) => ({
        id: pricing.id,
        startDate: pricing.startDate,
        endDate: pricing.endDate,
        priceOverride: pricing.priceOverride,
      })),
    };
  }

  async listCountries() {
    return this.db.country.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        cities: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listCities(country?: string) {
    return this.db.city.findMany({
      where: country
        ? { country: { name: { contains: country, mode: 'insensitive' } } }
        : undefined,
      select: {
        id: true,
        name: true,
        country: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listAmenities() {
    return this.db.amenity.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // ----- mapping helpers -----

  private toSummary(hotel: HotelQueryRow): HotelSummary {
    const minPrice = Math.min(
      0,
      ...hotel.rooms.map((room) => minNightlyPrice(room, room.seasonalPricing)),
    );
    const ratingSum = hotel.reviews.reduce(
      (sum, review) => sum + review.rating,
      0,
    );
    const averageRating = hotel.reviews.length
      ? ratingSum / hotel.reviews.length
      : null;
    const primaryImage =
      hotel.images.find((image) => image.isPrimary)?.url ??
      hotel.images[0]?.url ??
      null;
    return {
      id: hotel.id,
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      starRating: hotel.starRating,
      city: {
        id: hotel.city.id,
        name: hotel.city.name,
        country: { name: hotel.city.country.name },
      },
      primaryImageUrl: primaryImage,
      minPricePerNight: minPrice > 0 ? roundCurrency(minPrice) : null,
      averageRating,
      reviewCount: hotel.reviews.length,
      amenities: Array.from(
        new Set(hotel.amenities.map(({ amenity }) => amenity.name)),
      ),
    };
  }

  private toDetail(hotel: HotelDetailRow): HotelDetail {
    const ratingSum = hotel.reviews.reduce(
      (sum, review) => sum + review.rating,
      0,
    );
    return {
      id: hotel.id,
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      lat: hotel.lat,
      lng: hotel.lng,
      starRating: hotel.starRating,
      status: hotel.status,
      city: {
        id: hotel.city.id,
        name: hotel.city.name,
        country: { id: hotel.city.country.id, name: hotel.city.country.name },
      },
      images: hotel.images.map((image) => ({
        id: image.id,
        url: image.url,
        isPrimary: image.isPrimary,
      })),
      amenities: Array.from(
        new Set(hotel.amenities.map(({ amenity }) => amenity.name)),
      ),
      rooms: hotel.rooms.map((room) => this.toRoomPayload(room)),
      averageRating: hotel.reviews.length
        ? ratingSum / hotel.reviews.length
        : null,
      reviewCount: hotel.reviews.length,
      createdAt: hotel.createdAt,
      updatedAt: hotel.updatedAt,
    };
  }

  private toRoomPayload(room: {
    id: string;
    roomNumber: string;
    type: string;
    capacity: number;
    beds: number;
    bathroom: number;
    basePrice: { toNumber(): number };
    status: string;
    description: string | null;
    images: { url: string; isPrimary: boolean }[];
    amenities: { amenity: { name: string } }[];
  }): RoomPayload {
    return {
      id: room.id,
      roomNumber: room.roomNumber,
      type: room.type,
      capacity: room.capacity,
      beds: room.beds,
      bathroom: room.bathroom,
      basePrice: room.basePrice.toNumber(),
      status: room.status,
      description: room.description,
      primaryImageUrl:
        room.images.find((image) => image.isPrimary)?.url ??
        room.images[0]?.url ??
        null,
      amenities: Array.from(
        new Set(room.amenities.map(({ amenity }) => amenity.name)),
      ),
    };
  }
}
