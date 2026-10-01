import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreatedByOrigin,
  PlaceStatus,
  Prisma,
  TripItemStatus,
  TripItemType,
} from '../../../generated/prisma/client';
import {
  BuildDayDto,
  CreateTripDto,
  CreateTripItemDto,
  UpdateTripDto,
  UpdateTripItemDto,
} from '../presentation/dto/trip.dto';

type AuthedUser = { sub: string };

const tripInclude = {
  hotel: { select: { id: true, name: true, address: true } },
  booking: { select: { id: true, bookingRef: true, checkIn: true, checkOut: true, hotelId: true } },
  items: {
    orderBy: [{ dayDate: 'asc' as const }, { position: 'asc' as const }, { startTime: 'asc' as const }],
    include: {
      place: { include: { source: true } },
      booking: { select: { id: true, bookingRef: true, checkIn: true, checkOut: true } },
    },
  },
} satisfies Prisma.TripInclude;

@Injectable()
export class TripService {
  constructor(private readonly db: PrismaService) {}

  private date(value: string): Date {
    const parsed = new Date(value + 'T00:00:00.000Z');
    if (Number.isNaN(parsed.getTime())) throw new BadRequestException('Invalid date');
    return parsed;
  }

  private assertDateRange(startDate: Date, endDate: Date) {
    if (startDate.getTime() > endDate.getTime()) {
      throw new BadRequestException('startDate must be on or before endDate');
    }
  }

  private assertWithinTrip(dayDate: Date, startDate: Date, endDate: Date) {
    if (dayDate < startDate || dayDate > endDate) {
      throw new BadRequestException('Itinerary date must be within the trip date range');
    }
  }

  private minutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private async ownedTrip(tripId: string, userId: string) {
    const trip = await this.db.trip.findFirst({
      where: { id: tripId, userId, deletedAt: null },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  private async assertBookingOwned(bookingId: string, userId: string) {
    const booking = await this.db.booking.findFirst({
      where: { id: bookingId, userId, deletedAt: null },
      select: { id: true, hotelId: true, checkIn: true, checkOut: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private async conflicts(
    tripId: string,
    dayDate: Date,
    startTime: string | null,
    durationMin: number | null,
    excludedItemId?: string,
  ) {
    if (!startTime || !durationMin) return [];
    const start = this.minutes(startTime);
    const end = start + durationMin;
    const existing = await this.db.tripItem.findMany({
      where: {
        tripId,
        dayDate,
        startTime: { not: null },
        ...(excludedItemId ? { id: { not: excludedItemId } } : {}),
      },
      select: { id: true, title: true, startTime: true, durationMin: true },
    });

    return existing
      .filter((item) => {
        if (!item.startTime || !item.durationMin) return false;
        const otherStart = this.minutes(item.startTime);
        return Math.max(start, otherStart) < Math.min(end, otherStart + item.durationMin);
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        timeWindow: item.startTime! + ' - ' + this.timeWindowEnd(item.startTime!, item.durationMin!),
      }));
  }

  private timeWindowEnd(startTime: string, durationMin: number) {
    const total = this.minutes(startTime) + durationMin;
    return String(Math.floor(total / 60) % 24).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }

  private async withConflict<T extends { id: string; tripId: string; dayDate: Date; startTime: string | null; durationMin: number | null }>(item: T) {
    const conflictWith = await this.conflicts(item.tripId, item.dayDate, item.startTime, item.durationMin, item.id);
    return { item, hasConflict: conflictWith.length > 0, conflictWith };
  }

  async list(userId: string) {
    const trips = await this.db.trip.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
      include: tripInclude,
    });
    return { data: trips, total: trips.length };
  }

  async get(tripId: string, userId: string) {
    const trip = await this.db.trip.findFirst({
      where: { id: tripId, userId, deletedAt: null },
      include: tripInclude,
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async create(dto: CreateTripDto, userId: string) {
    const startDate = this.date(dto.startDate);
    const endDate = this.date(dto.endDate);
    this.assertDateRange(startDate, endDate);

    let hotelId = dto.hotelId;
    if (dto.bookingId) {
      const booking = await this.assertBookingOwned(dto.bookingId, userId);
      if (hotelId && hotelId !== booking.hotelId) {
        throw new ConflictException('The selected hotel does not match the booking');
      }
      hotelId ??= booking.hotelId;
    }

    if (hotelId) {
      const hotel = await this.db.hotel.findUnique({ where: { id: hotelId }, select: { id: true } });
      if (!hotel) throw new NotFoundException('Hotel not found');
    }

    return this.db.trip.create({
      data: {
        userId,
        title: dto.title,
        startDate,
        endDate,
        timezone: dto.timezone,
        hotelId,
        bookingId: dto.bookingId,
      },
      include: tripInclude,
    });
  }

  async update(tripId: string, dto: UpdateTripDto, userId: string) {
    const current = await this.ownedTrip(tripId, userId);
    const startDate = dto.startDate ? this.date(dto.startDate) : current.startDate;
    const endDate = dto.endDate ? this.date(dto.endDate) : current.endDate;
    this.assertDateRange(startDate, endDate);

    const outside = await this.db.tripItem.findFirst({
      where: { tripId, OR: [{ dayDate: { lt: startDate } }, { dayDate: { gt: endDate } }] },
      select: { id: true },
    });
    if (outside) throw new ConflictException('Trip dates cannot exclude existing itinerary items');

    return this.db.trip.update({
      where: { id: current.id },
      data: {
        title: dto.title,
        startDate,
        endDate,
        timezone: dto.timezone,
        hotelId: dto.hotelId === undefined ? undefined : dto.hotelId,
      },
      include: tripInclude,
    });
  }

  async remove(tripId: string, userId: string) {
    await this.ownedTrip(tripId, userId);
    await this.db.trip.update({ where: { id: tripId }, data: { deletedAt: new Date() } });
    return { deleted: true };
  }

  async addItem(tripId: string, dto: CreateTripItemDto, userId: string) {
    const trip = await this.ownedTrip(tripId, userId);
    const dayDate = this.date(dto.dayDate);
    this.assertWithinTrip(dayDate, trip.startDate, trip.endDate);

    if (dto.createdBy === 'AI' && !dto.userConfirmed) {
      throw new BadRequestException('AI itinerary suggestions require explicit confirmation');
    }

    let placeId: string | undefined;
    let bookingId: string | undefined;
    if (dto.itemType === 'PLACE') {
      if (!dto.placeId) throw new BadRequestException('placeId is required for PLACE items');
      const place = await this.db.place.findFirst({
        where: { id: dto.placeId, status: PlaceStatus.PUBLISHED, sourceId: { not: null } },
        select: { id: true },
      });
      if (!place) throw new NotFoundException('Published place not found');
      placeId = place.id;
    } else if (dto.itemType === 'BOOKING') {
      if (!dto.bookingId) throw new BadRequestException('bookingId is required for BOOKING items');
      const booking = await this.assertBookingOwned(dto.bookingId, userId);
      bookingId = booking.id;
    } else if (dto.placeId || dto.bookingId) {
      throw new BadRequestException('CUSTOM items cannot reference a place or booking');
    }

    const item = await this.db.tripItem.create({
      data: {
        tripId,
        dayDate,
        startTime: dto.startTime,
        durationMin: dto.durationMin,
        itemType: dto.itemType as TripItemType,
        placeId,
        bookingId,
        title: dto.title,
        notes: dto.notes,
        costAmount: dto.costAmount,
        currency: dto.currency,
        position: dto.position,
        createdBy: dto.createdBy as CreatedByOrigin,
      },
      include: {
        place: { include: { source: true } },
        booking: { select: { id: true, bookingRef: true, checkIn: true, checkOut: true } },
      },
    });
    return this.withConflict(item);
  }

  async updateItem(tripId: string, itemId: string, dto: UpdateTripItemDto, userId: string) {
    const trip = await this.ownedTrip(tripId, userId);
    const current = await this.db.tripItem.findFirst({ where: { id: itemId, tripId } });
    if (!current) throw new NotFoundException('Itinerary item not found');

    const dayDate = dto.dayDate ? this.date(dto.dayDate) : current.dayDate;
    this.assertWithinTrip(dayDate, trip.startDate, trip.endDate);

    const item = await this.db.tripItem.update({
      where: { id: current.id },
      data: {
        dayDate,
        startTime: dto.startTime === undefined ? undefined : dto.startTime,
        durationMin: dto.durationMin === undefined ? undefined : dto.durationMin,
        title: dto.title,
        notes: dto.notes === undefined ? undefined : dto.notes,
        costAmount: dto.costAmount === undefined ? undefined : dto.costAmount,
        currency: dto.currency,
        status: dto.status as TripItemStatus | undefined,
        position: dto.position,
      },
      include: {
        place: { include: { source: true } },
        booking: { select: { id: true, bookingRef: true, checkIn: true, checkOut: true } },
      },
    });
    return this.withConflict(item);
  }

  async removeItem(tripId: string, itemId: string, userId: string) {
    await this.ownedTrip(tripId, userId);
    const item = await this.db.tripItem.findFirst({ where: { id: itemId, tripId }, select: { id: true } });
    if (!item) throw new NotFoundException('Itinerary item not found');
    await this.db.tripItem.delete({ where: { id: itemId } });
    return { deleted: true };
  }

  async buildDay(tripId: string, dto: BuildDayDto, userId: string) {
    const trip = await this.ownedTrip(tripId, userId);
    const dayDate = this.date(dto.dayDate);
    this.assertWithinTrip(dayDate, trip.startDate, trip.endDate);

    // Query published places near this destination
    const candidatePlaces = await this.db.place.findMany({
      where: {
        status: PlaceStatus.PUBLISHED,
        sourceId: { not: null },
      },
      include: { source: true },
      orderBy: [{ rating: 'desc' }, { lastVerifiedAt: 'desc' }],
      take: 20,
    });

    const numItems = dto.duration === '2_HOURS' ? 2 : dto.duration === 'HALF_DAY' ? 3 : 5;
    const selected = candidatePlaces.slice(0, numItems);

    let currentStartMin = this.minutes(dto.startTime || '09:00');
    const proposedItems = selected.map((place) => {
      const durationMin = place.category === 'CAFE' || place.category === 'RESTAURANT' ? 60 : 90;
      const startTimeStr =
        String(Math.floor(currentStartMin / 60) % 24).padStart(2, '0') +
        ':' +
        String(currentStartMin % 60).padStart(2, '0');
      currentStartMin += durationMin + 15;

      return {
        placeId: place.id,
        title: `Explore ${place.name}`,
        dayDate: dto.dayDate,
        startTime: startTimeStr,
        durationMin,
        category: place.category,
        notes: place.description?.slice(0, 180) || `Curated visit to ${place.name}`,
        estimatedCostEtb: (place.priceLevel || 1) * 200,
        place: {
          id: place.id,
          name: place.name,
          amharicName: place.amharicName,
          category: place.category,
          address: place.address,
          images: place.images,
        },
      };
    });

    const totalDurationMin = proposedItems.reduce((sum, item) => sum + item.durationMin, 0);
    const estimatedBudgetEtb = proposedItems.reduce((sum, item) => sum + item.estimatedCostEtb, 0);

    return {
      tripId,
      dayDate: dto.dayDate,
      duration: dto.duration,
      proposal: proposedItems,
      totalDurationMin,
      estimatedBudgetEtb,
    };
  }
}

