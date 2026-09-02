import {
  BadRequestException,
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
import type {
  DecideStayRequestInput,
  EarlyCheckInActionInput,
  LateCheckOutActionInput,
  ManageBookingsQuery,
} from '@repo/shared-types';

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

  async listStayRequests(hotelId: string, actor: BookingActor) {
    await this.assertCanManage(hotelId, actor);
    return this.db.stayRequest.findMany({
      where: { booking: { hotelId } },
      orderBy: { createdAt: 'desc' },
      include: {
        booking: {
          select: {
            id: true,
            bookingRef: true,
            checkIn: true,
            checkOut: true,
            status: true,
            user: { select: { fullName: true, email: true, phone: true } },
          },
        },
      },
    });
  }

  async decideStayRequest(
    requestId: string,
    dto: DecideStayRequestInput,
    actor: BookingActor,
  ) {
    const request = await this.db.stayRequest.findUnique({
      where: { id: requestId },
      include: {
        booking: {
          include: {
            details: true,
            hotel: { include: { policy: true } },
          },
        },
      },
    });
    if (!request) throw new NotFoundException('Stay request not found');
    await this.assertCanManage(request.booking.hotelId, actor);

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Stay request has already been decided');
    }

    if (dto.decision === 'REJECTED') {
      const updated = await this.db.stayRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          decisionNote: dto.decisionNote,
          decidedById: actor.sub,
        },
      });
      await this.audit.record(actor.sub, 'STAY_REQUEST_REJECTED', 'StayRequest', requestId, {
        bookingId: request.bookingId,
        note: dto.decisionNote,
      });
      return updated;
    }

    if (request.type === 'EARLY_CHECKIN') {
      await this.db.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: request.bookingId },
          data: {
            earlyCheckIn: true,
            earlyCheckInFee: request.fee,
            totalPrice: { increment: request.fee },
          },
        });
        await tx.stayRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            decisionNote: dto.decisionNote,
            decidedById: actor.sub,
          },
        });
      });
      await this.audit.record(actor.sub, 'EARLY_CHECKIN_APPROVED', 'Booking', request.bookingId, {
        fee: Number(request.fee),
        stayRequestId: requestId,
      });
    } else if (request.type === 'LATE_CHECKOUT') {
      const roomIds = request.booking.details.map((d) => d.roomId);
      const nextBooking = await this.db.bookingDetail.findFirst({
        where: {
          roomId: { in: roomIds },
          booking: {
            status: 'CONFIRMED',
            checkIn: request.booking.checkOut,
          },
        },
      });
      if (nextBooking) {
        throw new BadRequestException('Room is needed for another confirmed booking starting on check-out date');
      }

      await this.db.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: request.bookingId },
          data: {
            lateCheckOut: true,
            lateCheckOutFee: request.fee,
            totalPrice: { increment: request.fee },
          },
        });
        await tx.stayRequest.update({
          where: { id: requestId },
          data: {
            status: 'APPROVED',
            decisionNote: dto.decisionNote,
            decidedById: actor.sub,
          },
        });
      });
      await this.audit.record(actor.sub, 'LATE_CHECKOUT_APPROVED', 'Booking', request.bookingId, {
        fee: Number(request.fee),
        stayRequestId: requestId,
      });
    }

    return this.db.stayRequest.findUnique({ where: { id: requestId } });
  }

  async directEarlyCheckIn(bookingId: string, dto: EarlyCheckInActionInput, actor: BookingActor) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: { hotel: { include: { policy: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.assertCanManage(booking.hotelId, actor);
    if (booking.status !== 'CONFIRMED') {
      throw new ConflictException('Only CONFIRMED bookings can be checked in early');
    }
    const fee = dto.earlyCheckInFee !== undefined ? dto.earlyCheckInFee : Number(booking.hotel.policy?.earlyCheckInFee ?? 0);
    const updated = await this.db.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CHECKED_IN',
        actualCheckIn: new Date(),
        earlyCheckIn: true,
        earlyCheckInFee: fee,
        totalPrice: { increment: fee },
      },
    });
    await this.audit.record(actor.sub, 'EARLY_CHECKIN_APPROVED', 'Booking', bookingId, { fee });
    return updated;
  }

  async directLateCheckOut(bookingId: string, dto: LateCheckOutActionInput, actor: BookingActor) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: { details: true, hotel: { include: { policy: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.assertCanManage(booking.hotelId, actor);
    if (booking.status !== 'CHECKED_IN') {
      throw new ConflictException('Only CHECKED_IN bookings can be checked out late');
    }
    const roomIds = booking.details.map((d) => d.roomId);
    const nextBooking = await this.db.bookingDetail.findFirst({
      where: {
        roomId: { in: roomIds },
        booking: {
          status: 'CONFIRMED',
          checkIn: booking.checkOut,
        },
      },
    });
    if (nextBooking) {
      throw new BadRequestException('Room is needed for another booking starting on check-out date');
    }
    const fee = dto.lateCheckOutFee !== undefined ? dto.lateCheckOutFee : Number(booking.hotel.policy?.lateCheckOutFee ?? 0);
    const updated = await this.db.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CHECKED_OUT',
        actualCheckOut: new Date(),
        lateCheckOut: true,
        lateCheckOutFee: fee,
        totalPrice: { increment: fee },
      },
    });
    await this.audit.record(actor.sub, 'LATE_CHECKOUT_APPROVED', 'Booking', bookingId, { fee });
    return updated;
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
