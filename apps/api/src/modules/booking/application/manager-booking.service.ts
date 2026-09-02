import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceScopeHelper } from '../../../common/guards/resource-scope.helper';
import { AuditService } from '../../../common/services/audit.service';
import { canTransition } from '../domain';
import type { ManageBookingsQuery } from '@repo/shared-types';

export interface BookingActor {
  sub: string;
  role: string;
}

@Injectable()
export class ManagerBookingService {
  constructor(
    private readonly db: PrismaService,
    private readonly scope: ResourceScopeHelper,
    private readonly audit: AuditService,
  ) {}

  async listBookings(query: ManageBookingsQuery, actor: BookingActor) {
    const hotelIds = await this.managedHotelIds(actor);
    const where: Prisma.BookingWhereInput = {
      hotelId: { in: hotelIds },
      ...(query.status ? { status: query.status as BookingStatus } : {}),
      ...(query.hotelId ? { hotelId: query.hotelId } : {}),
    };
    const [total, bookings] = await this.db.$transaction([
      this.db.booking.count({ where }),
      this.db.booking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
          hotel: { select: { id: true, name: true } },
          details: { include: { room: true } },
          payment: true,
        },
      }),
    ]);
    return {
      data: bookings,
      meta: {
        total,
        page: query.page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  async dashboardStats(actor: BookingActor) {
    const hotelIds = await this.managedHotelIds(actor);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const [pendingApprovals, todaysCheckIns, todaysCheckOuts, activeGuests] =
      await Promise.all([
        this.db.booking.count({
          where: { hotelId: { in: hotelIds }, status: 'PENDING' },
        }),
        this.db.booking.count({
          where: {
            hotelId: { in: hotelIds },
            status: 'CONFIRMED',
            checkIn: { lte: today },
          },
        }),
        this.db.booking.count({
          where: {
            hotelId: { in: hotelIds },
            status: 'CHECKED_IN',
            checkOut: { lte: today },
          },
        }),
        this.db.booking.count({
          where: {
            hotelId: { in: hotelIds },
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          },
        }),
      ]);

    return {
      pendingApprovals,
      todaysCheckIns,
      todaysCheckOuts,
      activeGuests,
    };
  }

  async confirm(bookingId: string, actor: BookingActor) {
    return this.transition(bookingId, 'CONFIRMED', actor);
  }

  async reject(bookingId: string, actor: BookingActor) {
    return this.transition(bookingId, 'REJECTED', actor);
  }

  async checkIn(bookingId: string, actor: BookingActor) {
    return this.transition(bookingId, 'CHECKED_IN', actor);
  }

  async checkOut(bookingId: string, actor: BookingActor) {
    return this.transition(bookingId, 'CHECKED_OUT', actor);
  }

  // ----- helpers -----

  private async transition(
    bookingId: string,
    to: BookingStatus,
    actor: BookingActor,
  ) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.assertCanManage(booking.hotelId, actor);
    if (!canTransition(booking.status, to)) {
      throw new ConflictException(
        `Cannot move booking from "${booking.status}" to "${to}"`,
      );
    }
    const updated = await this.db.booking.update({
      where: { id: booking.id },
      data: { status: to },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        hotel: { select: { id: true, name: true } },
        details: { include: { room: true } },
        payment: true,
      },
    });
    await this.audit.record(actor.sub, `BOOKING_${to}`, 'Booking', bookingId, {
      from: booking.status,
      to,
    });
    return updated;
  }

  private async managedHotelIds(actor: BookingActor): Promise<string[]> {
    if (actor.role === 'ADMIN') {
      return (await this.db.hotel.findMany({ select: { id: true } })).map(
        (hotel) => hotel.id,
      );
    }
    if (actor.role === 'MANAGER') {
      return (
        await this.db.hotel.findMany({
          where: { managerId: actor.sub },
          select: { id: true },
        })
      ).map((hotel) => hotel.id);
    }
    if (actor.role === 'STAFF') {
      return this.scope.getStaffHotelIds(actor.sub);
    }
    throw new ForbiddenException(
      'Insufficient role permissions for booking management',
    );
  }

  private async assertCanManage(
    hotelId: string,
    actor: BookingActor,
  ): Promise<void> {
    await this.scope.assertManagerOwnsHotel(actor.sub, actor.role, hotelId);
  }
}
