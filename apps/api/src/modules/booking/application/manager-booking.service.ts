import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus, Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ResourceScopeHelper } from '../../../common/guards/resource-scope.helper';
import { AuditService } from '../../../common/services/audit.service';
import { BookingService } from './booking.service';
import { NotificationService } from '../../notification/application/notification.service';
import { NOTIFICATION_CHANNELS } from '../../notification/domain';
import { canTransition } from '../domain';
import {
  BookingCheckedInEvent,
  BookingCheckedOutEvent,
  BookingEventNames,
  BookingNoShowEvent,
} from '../../events/booking.events';
import type {
  CreateBookingInput,
  CreateWalkInBookingInput,
  DecideStayRequestInput,
  EarlyCheckInActionInput,
  LateCheckOutActionInput,
  ManageBookingsQuery,
  RelocateRoomInput,
} from '@repo/shared-types';

export interface BookingActor {
  sub: string;
  role: string;
}

@Injectable()
export class ManagerBookingService {
  private readonly logger = new Logger(ManagerBookingService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly scope: ResourceScopeHelper,
    private readonly audit: AuditService,
    private readonly bookings: BookingService,
    @Optional() private readonly notifications?: NotificationService,
    @Optional() private readonly emitter?: EventEmitter2,
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

      if (this.notifications) {
        try {
          const reqTypeLabel = request.type === 'EARLY_CHECKIN' ? 'early check-in' : 'late check-out';
          await this.notifications.notify({
            userId: request.booking.userId,
            type: 'STAY_REQUEST_DECIDED',
            channel: NOTIFICATION_CHANNELS.IN_APP,
            payload: {
              title: 'Stay Request Rejected',
              message: `Your request for ${reqTypeLabel} has been rejected.${dto.decisionNote ? ' Note: ' + dto.decisionNote : ''}`,
              bookingId: request.bookingId,
              stayRequestId: requestId,
              decision: 'REJECTED',
              decisionNote: dto.decisionNote,
            },
          });
          await this.notifications.notify({
            userId: request.booking.userId,
            type: 'STAY_REQUEST_DECIDED',
            channel: NOTIFICATION_CHANNELS.PUSH,
            payload: {
              title: 'Stay Request Rejected',
              body: `Your request for ${reqTypeLabel} has been rejected.`,
              bookingId: request.bookingId,
              stayRequestId: requestId,
              decision: 'REJECTED',
            },
          });
        } catch (err) {
          this.logger.warn(`Failed to dispatch stay request rejection notification: ${err}`);
        }
      }

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

    if (this.notifications) {
      try {
        const reqTypeLabel = request.type === 'EARLY_CHECKIN' ? 'Early check-in' : 'Late check-out';
        await this.notifications.notify({
          userId: request.booking.userId,
          type: 'STAY_REQUEST_DECIDED',
          channel: NOTIFICATION_CHANNELS.IN_APP,
          payload: {
            title: `${reqTypeLabel} Approved`,
            message: `Your request for ${reqTypeLabel.toLowerCase()} has been approved. Fee: $${Number(request.fee).toFixed(2)}.${dto.decisionNote ? ' Note: ' + dto.decisionNote : ''}`,
            bookingId: request.bookingId,
            stayRequestId: requestId,
            decision: 'APPROVED',
            fee: Number(request.fee),
            decisionNote: dto.decisionNote,
          },
        });
        await this.notifications.notify({
          userId: request.booking.userId,
          type: 'STAY_REQUEST_DECIDED',
          channel: NOTIFICATION_CHANNELS.PUSH,
          payload: {
            title: `${reqTypeLabel} Approved`,
            body: `Your request for ${reqTypeLabel.toLowerCase()} has been approved. Fee: $${Number(request.fee).toFixed(2)}.`,
            bookingId: request.bookingId,
            stayRequestId: requestId,
            decision: 'APPROVED',
            fee: Number(request.fee),
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch stay request approval notification: ${err}`);
      }
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
    this.emitter?.emit(
      BookingEventNames.CHECKED_IN,
      new BookingCheckedInEvent(booking.id, booking.userId, booking.hotelId),
    );

    if (this.notifications) {
      try {
        await this.notifications.notify({
          userId: booking.userId,
          type: 'EARLY_CHECKIN_APPROVED',
          channel: NOTIFICATION_CHANNELS.IN_APP,
          payload: {
            title: 'Early Check-In Approved',
            message: `Your early check-in has been approved by the front desk. Additional fee: $${fee.toFixed(2)}.`,
            bookingId: booking.id,
            fee,
          },
        });
        await this.notifications.notify({
          userId: booking.userId,
          type: 'EARLY_CHECKIN_APPROVED',
          channel: NOTIFICATION_CHANNELS.PUSH,
          payload: {
            title: 'Early Check-In Approved',
            body: `Your early check-in has been approved. Fee: $${fee.toFixed(2)}.`,
            bookingId: booking.id,
            fee,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch direct early check-in notification: ${err}`);
      }
    }

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
    this.emitter?.emit(
      BookingEventNames.CHECKED_OUT,
      new BookingCheckedOutEvent(booking.id, booking.userId, booking.hotelId),
    );

    if (this.notifications) {
      try {
        await this.notifications.notify({
          userId: booking.userId,
          type: 'LATE_CHECKOUT_APPROVED',
          channel: NOTIFICATION_CHANNELS.IN_APP,
          payload: {
            title: 'Late Check-Out Approved',
            message: `Your late check-out has been approved by the front desk. Additional fee: $${fee.toFixed(2)}.`,
            bookingId: booking.id,
            fee,
          },
        });
        await this.notifications.notify({
          userId: booking.userId,
          type: 'LATE_CHECKOUT_APPROVED',
          channel: NOTIFICATION_CHANNELS.PUSH,
          payload: {
            title: 'Late Check-Out Approved',
            body: `Your late check-out has been approved. Fee: $${fee.toFixed(2)}.`,
            bookingId: booking.id,
            fee,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch direct late check-out notification: ${err}`);
      }
    }

    return updated;
  }

  async manualNoShow(bookingId: string, actor: BookingActor) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: { details: true, hotel: true, user: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.assertCanManage(booking.hotelId, actor);
    if (booking.status !== 'CONFIRMED') {
      throw new ConflictException('Only CONFIRMED bookings can be marked as NO_SHOW');
    }

    const updated = await this.db.booking.update({
      where: { id: bookingId },
      data: { status: 'NO_SHOW' },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        hotel: { select: { id: true, name: true } },
        details: { include: { room: true } },
        payment: true,
      },
    });

    const roomIds = booking.details.map((d) => d.roomId);
    await this.db.roomAvailability.deleteMany({
      where: {
        roomId: { in: roomIds },
        date: { gte: booking.checkIn, lt: booking.checkOut },
        status: 'UNAVAILABLE',
      },
    });

    await this.db.bookingStatusHistory.create({
      data: {
        bookingId,
        status: 'NO_SHOW',
        changedBy: actor.sub,
        reason: 'Marked as no-show by staff/manager',
      },
    });

    await this.audit.record(actor.sub, 'BOOKING_NO_SHOW', 'Booking', bookingId, {
      markedBy: actor.sub,
    });
    this.emitter?.emit(
      BookingEventNames.NO_SHOW,
      new BookingNoShowEvent(booking.id, booking.userId, booking.hotelId),
    );

    return updated;
  }

  async relocateRoom(
    bookingId: string,
    dto: RelocateRoomInput,
    actor: BookingActor,
  ) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        details: { include: { room: true } },
        hotel: true,
        user: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.assertCanManage(booking.hotelId, actor);

    if (booking.status !== 'CHECKED_IN') {
      throw new ConflictException('Only CHECKED_IN bookings can have rooms relocated');
    }

    const targetDetail = booking.details.find((d) => d.roomId === dto.oldRoomId);
    if (!targetDetail) {
      throw new NotFoundException('Old room is not part of this booking');
    }

    const oldRoom = targetDetail.room;
    const newRoom = await this.db.room.findUnique({
      where: { id: dto.newRoomId },
    });
    if (!newRoom) throw new NotFoundException('New room not found');
    if (newRoom.hotelId !== booking.hotelId) {
      throw new BadRequestException('New room must be in the same hotel');
    }
    if (newRoom.status !== 'AVAILABLE') {
      throw new ConflictException('New room is currently not available');
    }
    if (newRoom.basePrice.toNumber() < oldRoom.basePrice.toNumber()) {
      throw new BadRequestException('Cannot relocate to a lower room tier');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const conflictingBooking = await this.db.bookingDetail.findFirst({
      where: {
        roomId: dto.newRoomId,
        bookingId: { not: bookingId },
        booking: {
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          checkIn: { lt: booking.checkOut },
          checkOut: { gt: today },
        },
      },
    });
    if (conflictingBooking) {
      throw new ConflictException('New room has overlapping bookings during remaining stay');
    }

    const updatedDetail = await this.db.$transaction(async (tx) => {
      const detail = await tx.bookingDetail.update({
        where: { id: targetDetail.id },
        data: {
          roomId: dto.newRoomId,
          relocatedFrom: oldRoom.roomNumber,
          relocationReason: dto.reason,
          relocatedAt: new Date(),
          relocatedBy: actor.sub,
        },
        include: {
          room: true,
        },
      });

      await tx.roomRelocation.create({
        data: {
          bookingId,
          bookingDetailId: targetDetail.id,
          oldRoomId: dto.oldRoomId,
          newRoomId: dto.newRoomId,
          reason: dto.reason,
          relocatedById: actor.sub,
        },
      });

      await tx.roomAvailability.deleteMany({
        where: {
          roomId: dto.oldRoomId,
          date: { gte: today, lt: booking.checkOut },
          status: 'UNAVAILABLE',
        },
      });

      const dates: Date[] = [];
      const cur = new Date(today);
      while (cur < booking.checkOut) {
        dates.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      for (const d of dates) {
        await tx.roomAvailability.upsert({
          where: {
            roomId_date: {
              roomId: dto.newRoomId,
              date: d,
            },
          },
          create: {
            roomId: dto.newRoomId,
            date: d,
            status: 'UNAVAILABLE',
          },
          update: {
            status: 'UNAVAILABLE',
          },
        });
      }

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          status: 'CHECKED_IN',
          changedBy: actor.sub,
          reason: `Room relocated from ${oldRoom.roomNumber} to ${newRoom.roomNumber}. Reason: ${dto.reason}`,
        },
      });

      return detail;
    });

    await this.audit.record(actor.sub, 'ROOM_RELOCATED', 'Booking', bookingId, {
      oldRoomId: dto.oldRoomId,
      oldRoomNumber: oldRoom.roomNumber,
      newRoomId: dto.newRoomId,
      newRoomNumber: newRoom.roomNumber,
      reason: dto.reason,
    });

    if (this.notifications) {
      try {
        await this.notifications.notify({
          userId: booking.userId,
          type: 'ROOM_RELOCATED',
          channel: NOTIFICATION_CHANNELS.IN_APP,
          payload: {
            title: 'Room Relocation',
            message: `Your room has been changed from Room ${oldRoom.roomNumber} to Room ${newRoom.roomNumber}.${dto.reason ? ' Reason: ' + dto.reason : ''}`,
            bookingId,
            oldRoomNumber: oldRoom.roomNumber,
            newRoomNumber: newRoom.roomNumber,
            reason: dto.reason,
          },
        });
        await this.notifications.notify({
          userId: booking.userId,
          type: 'ROOM_RELOCATED',
          channel: NOTIFICATION_CHANNELS.PUSH,
          payload: {
            title: 'Room Relocation',
            body: `Your room has been changed from Room ${oldRoom.roomNumber} to Room ${newRoom.roomNumber}.`,
            bookingId,
            oldRoomNumber: oldRoom.roomNumber,
            newRoomNumber: newRoom.roomNumber,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to dispatch room relocation notification: ${err}`);
      }
    }

    return updatedDetail;
  }

  async getRelocations(bookingId: string, actor: BookingActor) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      select: { hotelId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    await this.assertCanManage(booking.hotelId, actor);

    return this.db.roomRelocation.findMany({
      where: { bookingId },
      orderBy: { relocatedAt: 'desc' },
      include: {
        oldRoom: {
          select: { id: true, roomNumber: true, type: true, basePrice: true },
        },
        newRoom: {
          select: { id: true, roomNumber: true, type: true, basePrice: true },
        },
        relocatedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });
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
    await this.db.bookingStatusHistory.create({
      data: {
        bookingId,
        status: to,
        changedBy: actor.sub,
        reason: `Status transition from ${booking.status} to ${to}`,
      },
    });

    await this.audit.record(actor.sub, `BOOKING_${to}`, 'Booking', bookingId, {
      from: booking.status,
      to,
    });

    if (to === 'CHECKED_IN') {
      this.emitter?.emit(
        BookingEventNames.CHECKED_IN,
        new BookingCheckedInEvent(booking.id, booking.userId, booking.hotelId),
      );
    } else if (to === 'CHECKED_OUT') {
      this.emitter?.emit(
        BookingEventNames.CHECKED_OUT,
        new BookingCheckedOutEvent(booking.id, booking.userId, booking.hotelId),
      );
    } else if (to === 'NO_SHOW') {
      this.emitter?.emit(
        BookingEventNames.NO_SHOW,
        new BookingNoShowEvent(booking.id, booking.userId, booking.hotelId),
      );
    }

    return updated;
  }

  async createWalkInBooking(
    dto: CreateWalkInBookingInput,
    actor: BookingActor,
  ) {
    await this.assertCanManage(dto.hotelId, actor);

    let guest = dto.guestEmail
      ? await this.db.user.findUnique({
          where: { email: dto.guestEmail.toLowerCase() },
        })
      : null;

    if (!guest) {
      const email = dto.guestEmail
        ? dto.guestEmail.toLowerCase()
        : `walkin_${Date.now()}_${randomBytes(4).toString('hex')}@hotel.local`;
      const passwordHash = await bcrypt.hash(
        randomBytes(16).toString('hex'),
        10,
      );
      guest = await this.db.user.create({
        data: {
          email,
          fullName: dto.guestName,
          phone: dto.guestPhone,
          passwordHash,
          role: 'CUSTOMER',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
        },
      });
    }

    const bookingInput: CreateBookingInput = {
      hotelId: dto.hotelId,
      roomIds: dto.roomIds,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      guests: dto.guests,
      guestInfos: [
        {
          fullName: dto.guestName,
          email: dto.guestEmail,
          phone: dto.guestPhone,
        },
      ],
      paymentMethod: dto.paymentMethod,
      bookingSource: 'WALK_IN',
      promoCode: dto.promoCode,
    };

    const booking = await this.bookings.createBooking(bookingInput, guest.id);

    if (dto.paidImmediately) {
      await this.db.$transaction(async (tx) => {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'CONFIRMED' },
        });
        if (booking.payment) {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: { status: 'SUCCEEDED' },
          });
          await tx.paymentAttempt.create({
            data: {
              paymentId: booking.payment.id,
              method: dto.paymentMethod,
              outcome: 'SUCCESS',
            },
          });
        }
        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            status: 'CONFIRMED',
            changedBy: actor.sub,
            reason: `Walk-in booking confirmed (paid via ${dto.paymentMethod} at hotel)`,
          },
        });
      });
    }

    await this.audit.record(
      actor.sub,
      'WALK_IN_BOOKING_CREATED',
      'Booking',
      booking.id,
      {
        hotelId: dto.hotelId,
        paidImmediately: dto.paidImmediately,
        guestName: dto.guestName,
        bookingRef: booking.bookingRef,
      },
    );

    return this.db.booking.findUniqueOrThrow({
      where: { id: booking.id },
      include: {
        hotel: { select: { id: true, name: true } },
        details: { include: { room: true } },
        payment: true,
        user: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });
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
