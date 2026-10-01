import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '../../../../generated/prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';
import { AITool } from '../../domain/ai-tool.interface';
import { AIToolContext, AIToolDefinition } from '../../domain/ai.types';

// ── 1. getStaffRoomStatus ───────────────────────────────────────────────────
@Injectable()
export class GetStaffRoomStatusTool implements AITool {
  readonly name = 'getStaffRoomStatus';
  readonly description =
    'Get operational room cleaning and occupancy status for staff at assigned hotel';
  readonly definition: AIToolDefinition = {
    name: 'getStaffRoomStatus',
    description:
      'Retrieve room availability, cleaning status, and maintenance flags for assigned hotel.',
    parameters: {
      type: 'object',
      properties: {},
    },
  };

  constructor(private readonly db: PrismaService) {}

  async execute(_rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    // AI-007 & AI-011: Staff role check and assigned hotel scope
    if (
      !context ||
      (context.callerRole !== Role.STAFF && context.callerRole !== Role.MANAGER)
    ) {
      throw new ForbiddenException(
        'Only hotel staff or managers can view operational room statuses',
      );
    }
    if (!context.callerHotelId) {
      throw new ForbiddenException('No assigned hotel found for staff context');
    }

    const rooms = await this.db.room.findMany({
      where: { hotelId: context.callerHotelId },
      select: {
        id: true,
        roomNumber: true,
        type: true,
        status: true,
      },
      orderBy: { roomNumber: 'asc' },
    });

    return {
      hotelId: context.callerHotelId,
      totalRooms: rooms.length,
      rooms,
    };
  }
}

// ── 2. getStaffTodayArrivals ────────────────────────────────────────────────
@Injectable()
export class GetStaffTodayArrivalsTool implements AITool {
  readonly name = 'getStaffTodayArrivals';
  readonly description =
    'Get list of guest arrivals scheduled for today at assigned hotel';
  readonly definition: AIToolDefinition = {
    name: 'getStaffTodayArrivals',
    description: 'Retrieve check-ins scheduled for today for assigned hotel.',
    parameters: {
      type: 'object',
      properties: {},
    },
  };

  constructor(private readonly db: PrismaService) {}

  async execute(_rawArgs: unknown, context: AIToolContext): Promise<unknown> {
    if (
      !context ||
      (context.callerRole !== Role.STAFF && context.callerRole !== Role.MANAGER)
    ) {
      throw new ForbiddenException(
        'Only hotel staff or managers can view arrivals',
      );
    }
    if (!context.callerHotelId) {
      throw new ForbiddenException('No assigned hotel found for staff context');
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const bookings = await this.db.booking.findMany({
      where: {
        hotelId: context.callerHotelId,
        checkIn: { gte: startOfToday, lte: endOfToday },
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
        deletedAt: null,
      },
      select: {
        id: true,
        bookingRef: true,
        status: true,
        checkIn: true,
        checkOut: true,
        user: { select: { fullName: true, phone: true } },
      },
      orderBy: { checkIn: 'asc' },
    });

    return {
      hotelId: context.callerHotelId,
      arrivalsCount: bookings.length,
      arrivals: bookings.map((b) => ({
        bookingId: b.id,
        bookingRef: b.bookingRef,
        guestName: b.user.fullName,
        guestPhone: b.user.phone,
        status: b.status,
      })),
    };
  }
}
