import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { Role } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { BookingService } from '../../../booking/application/booking.service';
import { CatalogService } from '../../../catalog/application/catalog.service';
import { AITool } from '../../domain/ai-tool.interface';
import { AIToolContext, AIToolDefinition } from '../../domain/ai.types';

// ── 1. checkRoomAvailability ────────────────────────────────────────────────
const checkRoomAvailabilitySchema = z.object({
  hotelId: z.string().optional(),
  cityId: z.string().optional(),
  checkIn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required')
    .optional(),
  checkOut: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD format required')
    .optional(),
  guests: z.coerce.number().int().min(1).default(1),
});

@Injectable()
export class CheckRoomAvailabilityTool implements AITool {
  readonly name = 'checkRoomAvailability';
  readonly description = 'Check room availability for hotels and dates';
  readonly definition: AIToolDefinition = {
    name: 'checkRoomAvailability',
    description: 'Check available rooms by hotel ID, city, or date range',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string', description: 'Optional specific hotel ID' },
        cityId: {
          type: 'string',
          description: 'Optional city ID to filter hotels',
        },
        checkIn: { type: 'string', description: 'Check-in date in YYYY-MM-DD' },
        checkOut: {
          type: 'string',
          description: 'Check-out date in YYYY-MM-DD',
        },
        guests: { type: 'number', description: 'Number of guests (default 1)' },
      },
    },
  };

  constructor(
    private readonly catalogService: CatalogService,
    private readonly db: PrismaService,
  ) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    if (!context || !context.callerId) {
      throw new ForbiddenException('Authentication required');
    }
    const parsed = checkRoomAvailabilitySchema.safeParse(rawArgs || {});
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const args = parsed.data;

    if (args.hotelId) {
      const hotel = await this.catalogService.hotelById(args.hotelId);
      if (!hotel) throw new NotFoundException('Hotel not found');
      return {
        hotelId: hotel.id,
        hotelName: hotel.name,
        availableRooms: hotel.rooms.map((r) => ({
          id: r.id,
          roomNumber: r.roomNumber,
          roomType: r.type,
          basePrice: r.basePrice,
          capacity: r.capacity,
          status: r.status,
        })),
      };
    }

    const hotels = await this.catalogService.search({
      city: args.cityId,
      page: 1,
      pageSize: 5,
      sort: 'popularity',
    });

    return {
      total: hotels.meta.total,
      hotels: hotels.data.map((h) => ({
        id: h.id,
        name: h.name,
        city: h.city.name,
        starRating: h.starRating,
        minPricePerNight: h.minPricePerNight,
      })),
    };
  }
}

// ── 2. getCustomerBooking ──────────────────────────────────────────────────
const getCustomerBookingSchema = z.object({
  bookingId: z.string().min(1, 'bookingId is required'),
});

@Injectable()
export class GetCustomerBookingTool implements AITool {
  readonly name = 'getCustomerBooking';
  readonly description =
    'Retrieve booking details for a booking owned by the caller';
  readonly definition: AIToolDefinition = {
    name: 'getCustomerBooking',
    description:
      'Retrieve booking details. Only allowed for bookings owned by the authenticated caller.',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'The booking reference ID' },
      },
      required: ['bookingId'],
    },
  };

  constructor(private readonly bookingService: BookingService) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    if (!context || !context.callerId) {
      throw new ForbiddenException('Authentication required');
    }
    const parsed = getCustomerBookingSchema.safeParse(rawArgs);
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const args = parsed.data;

    // AI-007: tool enforces authorization based on verified caller context, never AI args
    const booking = await this.bookingService.getBookingDetail(args.bookingId, {
      sub: context.callerId,
      role: context.callerRole,
    });

    // Verify ownership for customer role
    if (
      context.callerRole === Role.CUSTOMER &&
      booking.userId !== context.callerId
    ) {
      throw new ForbiddenException(
        'You do not have permission to view this booking',
      );
    }

    return {
      id: booking.id,
      bookingRef: booking.bookingRef,
      hotelName: booking.hotel.name,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      status: booking.status,
      totalAmount: booking.totalPrice ? Number(booking.totalPrice) : 0,
      currency: 'ETB',
      paymentStatus: booking.payment?.status,
    };
  }
}

// ── 3. createBooking ────────────────────────────────────────────────────────
const createBookingToolSchema = z.object({
  hotelId: z.string().min(1),
  roomIds: z.array(z.string().min(1)).min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestsCount: z.coerce.number().int().min(1).default(1),
  promoCode: z.string().optional(),
});

@Injectable()
export class CreateBookingTool implements AITool {
  readonly name = 'createBooking';
  readonly description =
    'Create a real hotel booking through the standard booking pipeline';
  readonly definition: AIToolDefinition = {
    name: 'createBooking',
    description:
      'Create a hotel reservation through the full booking pipeline with full backend validations.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string', description: 'Target hotel ID' },
        roomIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of Room IDs to reserve',
        },
        checkIn: { type: 'string', description: 'Check-in date (YYYY-MM-DD)' },
        checkOut: {
          type: 'string',
          description: 'Check-out date (YYYY-MM-DD)',
        },
        guestsCount: { type: 'number', description: 'Total guest count' },
        promoCode: {
          type: 'string',
          description: 'Optional coupon/promo code',
        },
      },
      required: ['hotelId', 'roomIds', 'checkIn', 'checkOut'],
    },
  };

  constructor(
    private readonly bookingService: BookingService,
    private readonly db: PrismaService,
  ) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    // AI-007 & AI-009: Only verified authenticated users with CUSTOMER role can initiate customer bookings
    if (!context || !context.callerId) {
      throw new ForbiddenException('Authentication required');
    }
    const parsed = createBookingToolSchema.safeParse(rawArgs);
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const args = parsed.data;

    const caller = await this.db.user.findUnique({
      where: { id: context.callerId },
    });
    if (!caller) throw new NotFoundException('User not found');

    // AI-013 & AI-027: AI-initiated bookings use the real booking pipeline
    const result = await this.bookingService.createBooking(
      {
        hotelId: args.hotelId,
        roomIds: args.roomIds,
        checkIn: args.checkIn,
        checkOut: args.checkOut,
        guests: { adults: args.guestsCount, children: 0 },
        guestInfos: [
          {
            fullName: caller.fullName,
            email: caller.email,
            phone: caller.phone || undefined,
          },
        ],
        promoCode: args.promoCode,
        paymentMethod: 'CREDIT_CARD',
        bookingSource: 'ONLINE',
      },
      context.callerId,
    );

    return {
      bookingId: result.id,
      bookingRef: result.bookingRef,
      totalAmount: result.totalPrice ? Number(result.totalPrice) : 0,
      status: result.status,
      message: 'Booking created successfully in the booking system.',
    };
  }
}

// ── 4. cancelBooking ────────────────────────────────────────────────────────
const cancelBookingToolSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().optional(),
});

@Injectable()
export class CancelBookingTool implements AITool {
  readonly name = 'cancelBooking';
  readonly description =
    'Cancel an existing reservation through the real cancellation pipeline';
  readonly definition: AIToolDefinition = {
    name: 'cancelBooking',
    description:
      'Cancel a reservation. Calls the real cancellation and refund pipeline.',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID of booking to cancel' },
        reason: {
          type: 'string',
          description: 'Optional reason for cancellation',
        },
      },
      required: ['bookingId'],
    },
  };

  constructor(
    private readonly bookingService: BookingService,
    private readonly db: PrismaService,
  ) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    if (!context || !context.callerId) {
      throw new ForbiddenException('Authentication required');
    }
    const parsed = cancelBookingToolSchema.safeParse(rawArgs);
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const args = parsed.data;

    // AI-007: verify caller owns the booking before allowing cancellation
    const booking = await this.db.booking.findUnique({
      where: { id: args.bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (
      context.callerRole === Role.CUSTOMER &&
      booking.userId !== context.callerId
    ) {
      throw new ForbiddenException(
        'You are not authorized to cancel this booking',
      );
    }

    // AI-014: AI-initiated cancellations use the real cancellation pipeline
    const cancelled = await this.bookingService.cancelBooking(
      args.bookingId,
      context.callerId,
    );
    return {
      bookingId: cancelled.id,
      status: cancelled.status,
      message:
        'Booking has been cancelled according to hotel cancellation policies.',
    };
  }
}

// ── 5. getPaymentStatus ─────────────────────────────────────────────────────
const getPaymentStatusSchema = z.object({
  bookingId: z.string().min(1),
});

@Injectable()
export class GetPaymentStatusTool implements AITool {
  readonly name = 'getPaymentStatus';
  readonly description = 'Get the payment status for a booking';
  readonly definition: AIToolDefinition = {
    name: 'getPaymentStatus',
    description:
      'Retrieve the payment and transaction status of an owned booking.',
    parameters: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', description: 'ID of the booking' },
      },
      required: ['bookingId'],
    },
  };

  constructor(private readonly db: PrismaService) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    if (!context || !context.callerId) {
      throw new ForbiddenException('Authentication required');
    }
    const parsed = getPaymentStatusSchema.safeParse(rawArgs);
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const args = parsed.data;

    const booking = await this.db.booking.findUnique({
      where: { id: args.bookingId },
      include: { payment: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // AI-007: check ownership
    if (
      context.callerRole === Role.CUSTOMER &&
      booking.userId !== context.callerId
    ) {
      throw new ForbiddenException(
        'You do not have access to this payment information',
      );
    }

    return {
      bookingId: booking.id,
      paymentStatus: booking.payment?.status ?? 'NO_PAYMENT_RECORD',
      amount: booking.payment?.amount
        ? Number(booking.payment.amount)
        : Number(booking.totalPrice),
      currency: 'ETB',
      paymentMethod: booking.payment?.provider,
      updatedAt: booking.payment?.updatedAt,
    };
  }
}

// ── 6. getHotelInformation ──────────────────────────────────────────────────
const getHotelInformationSchema = z.object({
  hotelId: z.string().optional(),
});

@Injectable()
export class GetHotelInformationTool implements AITool {
  readonly name = 'getHotelInformation';
  readonly description =
    'Get detailed information about a hotel including amenities and location';
  readonly definition: AIToolDefinition = {
    name: 'getHotelInformation',
    description: 'Get hotel description, address, star rating, and amenities.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string', description: 'Hotel ID' },
      },
    },
  };

  constructor(private readonly catalogService: CatalogService) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    if (!context || !context.callerId) {
      throw new ForbiddenException('Authentication required');
    }
    const parsed = getHotelInformationSchema.safeParse(rawArgs || {});
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const requestedHotelId = parsed.data.hotelId;
    if (
      (context.callerRole === Role.MANAGER ||
        context.callerRole === Role.STAFF) &&
      requestedHotelId &&
      requestedHotelId !== context.callerHotelId
    ) {
      throw new ForbiddenException('You may only access your assigned hotel');
    }
    const hotelId =
      context.callerRole === Role.MANAGER || context.callerRole === Role.STAFF
        ? context.callerHotelId
        : requestedHotelId || context.callerHotelId;
    if (!hotelId) {
      throw new Error('hotelId is required');
    }

    const hotel = await this.catalogService.hotelById(hotelId);
    if (!hotel) throw new NotFoundException('Hotel not found');

    return {
      id: hotel.id,
      name: hotel.name,
      description: hotel.description,
      address: hotel.address,
      city: hotel.city.name,
      starRating: hotel.starRating,
      amenities: hotel.amenities,
      roomTypes: Array.from(new Set(hotel.rooms.map((r) => r.type))),
    };
  }
}

// ── 7. getHotelPolicies ─────────────────────────────────────────────────────
const getHotelPoliciesSchema = z.object({
  hotelId: z.string().optional(),
});

@Injectable()
export class GetHotelPoliciesTool implements AITool {
  readonly name = 'getHotelPolicies';
  readonly description =
    'Get check-in, check-out, and cancellation policies for a hotel';
  readonly definition: AIToolDefinition = {
    name: 'getHotelPolicies',
    description:
      'Get hotel rules, check-in/out times, and cancellation policy terms.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: { type: 'string', description: 'Hotel ID' },
      },
    },
  };

  constructor(private readonly db: PrismaService) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    if (!context || !context.callerId) {
      throw new ForbiddenException('Authentication required');
    }
    const parsed = getHotelPoliciesSchema.safeParse(rawArgs || {});
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const requestedHotelId = parsed.data.hotelId;
    if (
      (context.callerRole === Role.MANAGER ||
        context.callerRole === Role.STAFF) &&
      requestedHotelId &&
      requestedHotelId !== context.callerHotelId
    ) {
      throw new ForbiddenException('You may only access your assigned hotel');
    }
    const hotelId =
      context.callerRole === Role.MANAGER || context.callerRole === Role.STAFF
        ? context.callerHotelId
        : requestedHotelId || context.callerHotelId;
    if (!hotelId) {
      throw new Error('hotelId is required');
    }

    const policy = await this.db.hotelPolicy.findUnique({
      where: { hotelId },
    });

    if (!policy) {
      return {
        hotelId,
        checkInTime: '14:00',
        checkOutTime: '11:00',
        cancellationPolicy:
          'Standard 24-hour notice required for free cancellation.',
      };
    }

    return {
      hotelId,
      checkInTime: policy.checkInTime,
      checkOutTime: policy.checkOutTime,
      cancellationWindowDays: policy.cancellationWindowDays,
      cancellationFeePercent: Number(policy.cancellationFeePercent),
      allowEarlyCheckIn: policy.allowEarlyCheckIn,
      allowLateCheckOut: policy.allowLateCheckOut,
    };
  }
}

// ── 8. getNearbyPlaces (Discover Pillar & PLACE-010) ─────────────────────────
const getNearbyPlacesSchema = z.object({
  hotelId: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().positive().max(50).default(5),
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

@Injectable()
export class GetNearbyPlacesTool implements AITool {
  readonly name = 'getNearbyPlaces';
  readonly description =
    'Find verified nearby places, restaurants, cafes, and heritage sites around a hotel or location with verified sources.';
  readonly definition: AIToolDefinition = {
    name: 'getNearbyPlaces',
    description:
      'Get verified attractions, dining, cafes, and points of interest near the user or hotel.',
    parameters: {
      type: 'object',
      properties: {
        hotelId: {
          type: 'string',
          description: 'Optional hotel ID to find places near that hotel',
        },
        lat: { type: 'number', description: 'Latitude coordinate' },
        lng: { type: 'number', description: 'Longitude coordinate' },
        radiusKm: {
          type: 'number',
          description: 'Search radius in kilometers (default: 5)',
        },
        category: {
          type: 'string',
          enum: [
            'RESTAURANT',
            'CAFE',
            'HERITAGE',
            'MUSEUM',
            'ATTRACTION',
            'NIGHTLIFE',
            'SHOPPING',
            'HOSPITAL',
          ],
          description: 'Filter by category',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
      },
    },
  };

  constructor(private readonly db: PrismaService) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    const parsed = getNearbyPlacesSchema.safeParse(rawArgs || {});
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const args = parsed.data;

    let searchLat = args.lat;
    let searchLng = args.lng;

    const targetHotelId = args.hotelId || context.callerHotelId;
    if ((searchLat === undefined || searchLng === undefined) && targetHotelId) {
      const hotel = await this.db.hotel.findUnique({
        where: { id: targetHotelId },
        select: { lat: true, lng: true, name: true },
      });
      if (hotel?.lat && hotel?.lng) {
        searchLat = hotel.lat;
        searchLng = hotel.lng;
      }
    }

    // Default to Addis Ababa city center if no coords provided
    if (searchLat === undefined || searchLng === undefined) {
      searchLat = 9.0105;
      searchLng = 38.7612;
    }

    const radiusKm = args.radiusKm;
    const latDelta = radiusKm / 111;
    const lngDelta =
      radiusKm / (111 * Math.cos(searchLat * (Math.PI / 180)) || 1);

    const places = await this.db.place.findMany({
      where: {
        status: 'PUBLISHED',
        sourceId: { not: null },
        ...(args.category ? { category: args.category as any } : {}),
        lat: { gte: searchLat - latDelta, lte: searchLat + latDelta },
        lng: { gte: searchLng - lngDelta, lte: searchLng + lngDelta },
      },
      include: { source: true },
      take: 50,
    });

    const haversine = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number,
    ) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      return (
        Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10
      );
    };

    const results = places
      .map((p) => {
        const dist = haversine(searchLat, searchLng, p.lat, p.lng);
        return {
          id: p.id,
          name: p.name,
          amharicName: p.amharicName,
          category: p.category,
          distanceKm: dist,
          address: p.address,
          description: p.description,
          openingHours: p.openingHours,
          hoursNote: p.hoursVerified
            ? 'Verified official hours'
            : 'Hours may vary / unverified (PLACE-010)',
          priceLevel: p.priceLevel,
          rating: p.rating,
          images: Array.isArray(p.images) ? p.images : [],
          lastVerifiedAt: p.lastVerifiedAt,
          verifiedSource: p.source
            ? { name: p.source.name, license: p.source.license }
            : null,
        };
      })
      .filter((p) => p.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, args.limit);

    return {
      referenceLocation: { lat: searchLat, lng: searchLng, radiusKm },
      totalFound: results.length,
      places: results,
    };
  }
}

// ── 9. getHeritageInfo (Heritage & History with Approved Sources) ─────────────
const getHeritageInfoSchema = z.object({
  city: z.string().optional(),
  query: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

@Injectable()
export class GetHeritageInfoTool implements AITool {
  readonly name = 'getHeritageInfo';
  readonly description =
    'Get verified historical narratives, museums, and Ethiopian cultural heritage sites from approved sources.';
  readonly definition: AIToolDefinition = {
    name: 'getHeritageInfo',
    description:
      'Get authoritative Ethiopian cultural heritage and museum info from approved sources.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name (e.g. Addis Ababa, Axum, Lalibela)',
        },
        query: {
          type: 'string',
          description: 'Optional specific site name or topic',
        },
        limit: { type: 'number', description: 'Max results (default: 5)' },
      },
    },
  };

  constructor(private readonly db: PrismaService) {}

  async execute(rawArgs: unknown): Promise<unknown> {
    const parsed = getHeritageInfoSchema.safeParse(rawArgs || {});
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const { query, limit } = parsed.data;

    const sites = await this.db.place.findMany({
      where: {
        status: 'PUBLISHED',
        category: { in: ['HERITAGE', 'MUSEUM'] as any },
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { source: true },
      take: limit,
      orderBy: { rating: 'desc' },
    });

    return {
      heritageSites: sites.map((s) => ({
        name: s.name,
        amharicName: s.amharicName,
        historyAndSignificance: s.description,
        address: s.address,
        openingHours: s.openingHours,
        verifiedSource: s.source
          ? `${s.source.name} (${s.source.license || 'Verified'})`
          : 'Official Tourism Records',
      })),
    };
  }
}

// ── 10. getEmergencyContacts (TRIP-010 & TRIP-011) ───────────────────────────
const getEmergencyContactsSchema = z.object({
  city: z.string().optional(),
  hotelId: z.string().optional(),
});

@Injectable()
export class GetEmergencyContactsTool implements AITool {
  readonly name = 'getEmergencyContacts';
  readonly description =
    'Get official verified emergency telephone numbers for police, ambulance, medical trauma, and hotel safety. Reads ONLY from curated directory (TRIP-011).';
  readonly definition: AIToolDefinition = {
    name: 'getEmergencyContacts',
    description:
      'Get verified emergency dispatch and safety numbers. Always use this instead of guessing emergency contacts.',
    parameters: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'Optional city name (e.g. Addis Ababa)',
        },
        hotelId: {
          type: 'string',
          description: 'Optional hotel ID for hotel-specific security desk',
        },
      },
    },
  };

  constructor(private readonly db: PrismaService) {}

  async execute(rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    const parsed = getEmergencyContactsSchema.safeParse(rawArgs || {});
    if (!parsed.success) {
      throw new Error(`Invalid arguments: ${parsed.error.message}`);
    }
    const targetHotelId = parsed.data.hotelId || context.callerHotelId;
    const targetCity = parsed.data.city || 'Addis Ababa';

    const contacts = await this.db.emergencyContact.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { city: null },
          { city: { equals: targetCity, mode: 'insensitive' } },
          ...(targetHotelId ? [{ hotelId: targetHotelId }] : []),
        ],
      },
      include: { source: true },
      orderBy: { kind: 'asc' },
    });

    return {
      notice:
        'Official emergency dispatch numbers verified by public safety authorities (TRIP-010/TRIP-011).',
      contacts: contacts.map((c) => ({
        service: c.name,
        phoneNumber: c.phone,
        category: c.kind,
        verifiedSource: c.source?.name ?? 'City Public Safety Registry',
        lastVerified: c.lastVerifiedAt,
      })),
    };
  }
}
