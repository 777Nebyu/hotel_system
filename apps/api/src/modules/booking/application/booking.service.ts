import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '../../../generated/prisma/client';
import type { Room, RoomAvailability } from '../../../generated/prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  BookingCancelledEvent,
  BookingCreatedEvent,
  BookingEventNames,
} from '../../events/booking.events';
import {
  PaymentEventNames,
  PaymentRefundedEvent,
} from '../../events/payment.events';
import {
  parseDateOnly,
  roomAvailableAcross,
} from '../../catalog/domain/availability';
import { nightlyPrices } from '../../catalog/domain/pricing';
import { canTransition } from '../domain';
import { buildQuote } from '../domain/quote';
import type { BookingQuote } from '../domain/quote';
import { CouponService } from '../../coupon/application/coupon.service';
import { InvoiceService } from '../../invoice/application/invoice.service';
import { AuditService } from '../../../common/services/audit.service';
import { applyCoupon } from '../../coupon/domain';
import type {
  CancelRoomInput,
  CheckoutInput,
  CreateBookingInput,
  CreateRoomHoldInput,
  CreateStayRequestInput,
  ModifyBookingInput,
} from '@repo/shared-types';

function generateBookingRef(): string {
  const year = new Date().getFullYear();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 5; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `YT-${year}-${suffix}`;
}

function calculateModificationRefund(
  difference: number,
  checkIn: Date,
  now: Date = new Date(),
): number {
  const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilCheckIn >= 48) return Math.round(difference * 100) / 100;
  if (hoursUntilCheckIn >= 24) return Math.round(difference * 0.5 * 100) / 100;
  return 0;
}

@Injectable()
export class BookingService {
  constructor(
    private readonly db: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly coupons: CouponService,
    private readonly invoices: InvoiceService,
    private readonly audit: AuditService,
  ) {}

  async checkout(input: CheckoutInput) {
    const hotel = await this.db.hotel.findUnique({
      where: { id: input.hotelId },
      select: { id: true, name: true, status: true },
    });
    if (!hotel || hotel.status !== 'ACTIVE') {
      throw new NotFoundException('Hotel not found');
    }

    const checkIn = parseDateOnly(input.checkIn);
    const checkOut = parseDateOnly(input.checkOut);
    const rooms = await this.loadRooms(
      input.hotelId,
      input.roomIds,
      checkIn,
      checkOut,
    );
    this.assertAllRoomsAvailable(rooms, checkIn, checkOut);

    const quote = buildQuote({
      hotelId: hotel.id,
      checkIn,
      checkOut,
      adults: input.guests.adults,
      children: input.guests.children,
      rooms: rooms.map((room) => ({
        roomId: room.id,
        roomNumber: room.roomNumber,
        nightly: nightlyPrices(
          room,
          room.seasonalPricing,
          checkIn,
          checkOut,
        ).map((night) => night.price),
      })),
    });
    await this.applyPromo(quote, input.promoCode);

    return { hotel: { id: hotel.id, name: hotel.name }, ...quote };
  }

  async createBooking(input: CreateBookingInput, userId: string) {
    const checkIn = parseDateOnly(input.checkIn);
    const checkOut = parseDateOnly(input.checkOut);

    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true, role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'CUSTOMER' && !user.emailVerifiedAt) {
      throw new BadRequestException(
        'You must verify your email address before making a booking',
      );
    }

    const booking = await this.db.$transaction(async (tx) => {
      const hotel = await tx.hotel.findUnique({
        where: { id: input.hotelId },
        select: { id: true, name: true, status: true },
      });
      if (!hotel || hotel.status !== 'ACTIVE') {
        throw new NotFoundException('Hotel not found');
      }

      const rooms = await this.loadRooms(
        input.hotelId,
        input.roomIds,
        checkIn,
        checkOut,
        tx,
      );
      this.assertAllRoomsAvailable(rooms, checkIn, checkOut);
      await this.acquireRoomDateLocks(
        tx,
        rooms.map((room) => room.id),
        checkIn,
        checkOut,
      );
      await this.assertNoOverlappingStays(
        tx,
        rooms.map((room) => room.id),
        checkIn,
        checkOut,
        userId,
      );

      const quote = buildQuote({
        hotelId: hotel.id,
        checkIn,
        checkOut,
        adults: input.guests.adults,
        children: input.guests.children,
        rooms: rooms.map((room) => ({
          roomId: room.id,
          roomNumber: room.roomNumber,
          nightly: nightlyPrices(
            room,
            room.seasonalPricing,
            checkIn,
            checkOut,
          ).map((night) => night.price),
        })),
      });
      await this.applyPromo(quote, input.promoCode, tx);
      if (input.promoCode) {
        await this.coupons.claim(input.promoCode, tx);
      }

      const guestCount = input.guests.adults + input.guests.children;

      let bookingRef: string;
      for (let attempt = 0; attempt < 5; attempt++) {
        bookingRef = generateBookingRef();
        const exists = await tx.booking.findUnique({
          where: { bookingRef },
          select: { id: true },
        });
        if (!exists) break;
        if (attempt === 4) {
          throw new ConflictException(
            'Could not generate a unique booking reference. Please try again.',
          );
        }
      }

      await tx.roomHold.updateMany({
        where: {
          userId,
          roomId: { in: rooms.map((r) => r.id) },
          status: 'ACTIVE',
        },
        data: {
          status: 'CONVERTED',
        },
      });

      return tx.booking.create({
        data: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          bookingRef: bookingRef!,
          userId,
          hotelId: hotel.id,
          checkIn,
          checkOut,
          status: 'PENDING',
          totalPrice: quote.total,
          bookingSource: input.bookingSource ?? 'ONLINE',
          details: {
            create: quote.rooms.map((line) => ({
              roomId: line.roomId,
              guestCount,
              guestInfo: {
                adults: input.guests.adults,
                children: input.guests.children,
                guests: input.guestInfos,
              },
            })),
          },
          payment: {
            create: {
              method: input.paymentMethod ?? 'CREDIT_CARD',
              amount: quote.total,
              status: 'PENDING',
            },
          },
        },
        include: {
          hotel: { select: { id: true, name: true } },
          details: { include: { room: true } },
          payment: true,
        },
      });
    });

    this.emitter.emit(
      BookingEventNames.CREATED,
      new BookingCreatedEvent(
        booking.id,
        userId,
        booking.hotelId,
        booking.totalPrice.toNumber(),
      ),
    );

    await this.audit.record(userId, 'CREATE_BOOKING', 'Booking', booking.id, {
      bookingRef: booking.bookingRef,
      hotelId: booking.hotelId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      totalPrice: booking.totalPrice.toNumber(),
      bookingSource: booking.bookingSource,
    });

    return booking;
  }

  async cancelBooking(bookingId: string, userId: string) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You cannot cancel this booking');
    }
    if (!canTransition(booking.status, 'CANCELLED')) {
      throw new ConflictException(
        `Booking in "${booking.status}" state cannot be cancelled`,
      );
    }
    const shouldRefund = booking.payment?.status === 'SUCCEEDED';

    const updated = await this.db.$transaction(async (tx) => {
      const cancelled = await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
        include: {
          hotel: { select: { id: true, name: true } },
          details: { include: { room: true } },
          payment: true,
        },
      });
      if (shouldRefund) {
        await tx.payment.update({
          where: { bookingId: booking.id },
          data: { status: 'REFUNDED' },
        });
        cancelled.payment = {
          ...cancelled.payment!,
          status: 'REFUNDED',
        };
      }
      return cancelled;
    });

    this.emitter.emit(
      BookingEventNames.CANCELLED,
      new BookingCancelledEvent(booking.id, userId, booking.hotelId),
    );
    if (shouldRefund && booking.payment) {
      this.emitter.emit(
        PaymentEventNames.REFUNDED,
        new PaymentRefundedEvent(
          booking.payment.id,
          booking.id,
          userId,
          booking.payment.amount.toNumber(),
          booking.payment.method,
        ),
      );
    }

    await this.audit.record(userId, 'CANCEL_BOOKING', 'Booking', bookingId, {
      previousStatus: booking.status,
      refunded: shouldRefund,
    });

    return updated;
  }

  async cancelRooms(
    bookingId: string,
    input: CancelRoomInput,
    userId: string,
  ) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        details: true,
        payment: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You cannot cancel rooms in this booking');
    }
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new ConflictException(
        `Cannot cancel rooms from a booking in "${booking.status}" state`,
      );
    }

    const bookingRoomIds = new Set(booking.details.map((d) => d.roomId));
    const invalidIds = input.roomIds.filter((id) => !bookingRoomIds.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Room(s) not part of this booking: ${invalidIds.join(', ')}`,
      );
    }

    const allRoomsCount = booking.details.length;
    const cancelledCount = input.roomIds.length;
    const isFullCancel = cancelledCount >= allRoomsCount;

    const refundFraction = cancelledCount / allRoomsCount;
    const paymentSucceeded = booking.payment?.status === 'SUCCEEDED';
    const refundAmount = paymentSucceeded
      ? Math.round(
          booking.totalPrice.toNumber() * refundFraction * 100,
        ) / 100
      : 0;

    await this.db.$transaction(async (tx) => {
      await tx.bookingDetail.deleteMany({
        where: { bookingId, roomId: { in: input.roomIds } },
      });

      if (isFullCancel) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'CANCELLED' },
        });
        if (paymentSucceeded && booking.payment) {
          await tx.payment.update({
            where: { bookingId },
            data: {
              status: 'REFUNDED',
              refundAmount,
              refundedAt: new Date(),
            },
          });
        }
      } else if (paymentSucceeded && booking.payment && refundAmount > 0) {
        await tx.payment.update({
          where: { bookingId },
          data: {
            refundAmount,
            refundedAt: new Date(),
          },
        });
      }
    });

    if (isFullCancel) {
      this.emitter.emit(
        BookingEventNames.CANCELLED,
        new BookingCancelledEvent(bookingId, userId, booking.hotelId),
      );
      if (paymentSucceeded && booking.payment) {
        this.emitter.emit(
          PaymentEventNames.REFUNDED,
          new PaymentRefundedEvent(
            booking.payment.id,
            bookingId,
            userId,
            refundAmount,
            booking.payment.method,
          ),
        );
      }
    }

    await this.audit.record(userId, 'CANCEL_ROOMS', 'Booking', bookingId, {
      cancelledRoomIds: input.roomIds,
      fullyCancel: isFullCancel,
      refundAmount,
    });

    return {
      bookingId,
      cancelledRoomIds: input.roomIds,
      fullyCancel: isFullCancel,
      refundAmount,
    };
  }

  async myBookings(userId: string, scope?: 'upcoming' | 'past') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const where: Prisma.BookingWhereInput = { userId };
    if (scope === 'upcoming') {
      where.status = { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] };
      where.checkOut = { gte: startOfToday };
    } else if (scope === 'past') {
      where.OR = [
        { checkOut: { lt: startOfToday } },
        { status: { in: ['CHECKED_OUT', 'CANCELLED', 'REJECTED'] } },
      ];
    }
    const bookings = await this.db.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            address: true,
            images: { take: 1, orderBy: { isPrimary: 'desc' } },
          },
        },
        details: { include: { room: true } },
        payment: true,
      },
    });
    return { data: bookings };
  }

  async getInvoice(bookingId: string, userId: string): Promise<Buffer> {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You cannot download this invoice');
    }
    return this.invoices.generate(bookingId);
  }

  async createHold(input: CreateRoomHoldInput, userId: string) {
    const checkIn = parseDateOnly(input.checkIn);
    const checkOut = parseDateOnly(input.checkOut);
    const room = await this.db.room.findUnique({
      where: { id: input.roomId },
      include: {
        availability: { where: { date: { gte: checkIn, lt: checkOut } } },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (!roomAvailableAcross(room.status, room.availability, checkIn, checkOut)) {
      throw new ConflictException('Room is not available for requested dates');
    }

    const overlappingBooking = await this.db.bookingDetail.findFirst({
      where: {
        roomId: input.roomId,
        booking: {
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      },
    });
    if (overlappingBooking) {
      throw new ConflictException('Room already booked for these dates');
    }

    const otherHold = await this.db.roomHold.findFirst({
      where: {
        roomId: input.roomId,
        status: 'ACTIVE',
        holdEnd: { gt: new Date() },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        userId: { not: userId },
      },
    });
    if (otherHold) {
      throw new ConflictException('Room is temporarily held by another customer');
    }

    const holdEnd = new Date(Date.now() + 15 * 60 * 1000);
    const hold = await this.db.roomHold.create({
      data: {
        roomId: input.roomId,
        userId,
        checkIn,
        checkOut,
        holdEnd,
        status: 'ACTIVE',
      },
      include: {
        room: { select: { id: true, roomNumber: true, hotelId: true } },
      },
    });

    await this.audit.record(userId, 'ROOM_HOLD_CREATED', 'RoomHold', hold.id, {
      roomId: input.roomId,
      holdEnd,
    });

    return {
      holdId: hold.id,
      roomId: hold.roomId,
      holdEnd: hold.holdEnd,
      expiresInSeconds: Math.floor((hold.holdEnd.getTime() - Date.now()) / 1000),
    };
  }

  async releaseHold(holdId: string, userId: string) {
    const hold = await this.db.roomHold.findUnique({
      where: { id: holdId },
    });
    if (!hold) throw new NotFoundException('Hold not found');
    if (hold.userId !== userId) {
      throw new ForbiddenException('You cannot cancel this hold');
    }
    await this.db.roomHold.update({
      where: { id: holdId },
      data: { status: 'CANCELLED' },
    });
    await this.audit.record(userId, 'ROOM_HOLD_CANCELLED', 'RoomHold', holdId, {});
    return { cancelled: true };
  }

  async createStayRequest(
    bookingId: string,
    dto: CreateStayRequestInput,
    userId: string,
  ) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        hotel: { include: { policy: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only request for your own booking');
    }
    if (dto.type === 'EARLY_CHECKIN') {
      if (!['CONFIRMED'].includes(booking.status)) {
        throw new BadRequestException('Early check-in can only be requested for confirmed bookings');
      }
      if (booking.hotel.policy && !booking.hotel.policy.allowEarlyCheckIn) {
        throw new BadRequestException('Early check-in is not permitted by hotel policy');
      }
    } else if (dto.type === 'LATE_CHECKOUT') {
      if (!['CONFIRMED', 'CHECKED_IN'].includes(booking.status)) {
        throw new BadRequestException('Late check-out can only be requested for confirmed or checked-in bookings');
      }
      if (booking.hotel.policy && !booking.hotel.policy.allowLateCheckOut) {
        throw new BadRequestException('Late check-out is not permitted by hotel policy');
      }
    }

    const fee =
      dto.type === 'EARLY_CHECKIN'
        ? (booking.hotel.policy?.earlyCheckInFee ?? 0)
        : (booking.hotel.policy?.lateCheckOutFee ?? 0);

    const request = await this.db.stayRequest.create({
      data: {
        bookingId,
        type: dto.type,
        requestedTime: dto.requestedTime,
        fee,
        guestConsent: dto.guestConsent,
        status: 'PENDING',
      },
    });

    await this.audit.record(userId, 'STAY_REQUEST_CREATED', 'StayRequest', request.id, {
      bookingId,
      type: dto.type,
      fee: Number(fee),
    });

    return request;
  }

  async getStayRequests(bookingId: string, userId: string) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      select: { userId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return this.db.stayRequest.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async modifyBookingQuote(
    bookingId: string,
    dto: ModifyBookingInput,
    userId: string,
  ) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        details: { include: { room: true } },
        hotel: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only modify your own booking');
    }
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Only CONFIRMED bookings can be modified');
    }

    const checkIn = dto.checkIn ? parseDateOnly(dto.checkIn) : booking.checkIn;
    const checkOut = dto.checkOut ? parseDateOnly(dto.checkOut) : booking.checkOut;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkIn < today) {
      throw new BadRequestException('New check-in date must be today or in the future');
    }
    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const roomIds = dto.roomIds && dto.roomIds.length > 0
      ? dto.roomIds
      : booking.details.map((d) => d.roomId);

    const rooms = await this.loadRooms(booking.hotelId, roomIds, checkIn, checkOut);
    if (rooms.length !== roomIds.length) {
      throw new NotFoundException('One or more rooms were not found in this hotel');
    }

    const overlaps = await this.db.bookingDetail.findMany({
      where: {
        roomId: { in: roomIds },
        bookingId: { not: bookingId },
        booking: {
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      },
      select: { roomId: true },
    });
    const blocked = Array.from(new Set(overlaps.map((o) => o.roomId)));
    if (blocked.length > 0) {
      throw new ConflictException(
        `Room(s) unavailable for requested dates: ${blocked.join(', ')}`,
      );
    }

    const quote = buildQuote({
      hotelId: booking.hotelId,
      checkIn,
      checkOut,
      adults: 1,
      children: 0,
      rooms: rooms.map((room) => ({
        roomId: room.id,
        roomNumber: room.roomNumber,
        nightly: nightlyPrices(
          room,
          room.seasonalPricing,
          checkIn,
          checkOut,
        ).map((night) => night.price),
      })),
    });

    const oldTotal = booking.totalPrice.toNumber();
    const newTotal = quote.total;
    const rawDiff = Math.abs(newTotal - oldTotal);
    const refundAmount = newTotal < oldTotal ? calculateModificationRefund(rawDiff, booking.checkIn) : 0;
    const additionalCharge = newTotal > oldTotal ? newTotal - oldTotal : 0;

    return {
      oldTotal,
      newTotal,
      additionalCharge,
      refundAmount,
      checkIn,
      checkOut,
      roomIds,
    };
  }

  async modifyBooking(
    bookingId: string,
    dto: ModifyBookingInput,
    userId: string,
  ) {
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId },
      include: {
        details: { include: { room: true } },
        payment: true,
        hotel: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) {
      throw new ForbiddenException('You can only modify your own booking');
    }
    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Only CONFIRMED bookings can be modified');
    }

    const checkIn = dto.checkIn ? parseDateOnly(dto.checkIn) : booking.checkIn;
    const checkOut = dto.checkOut ? parseDateOnly(dto.checkOut) : booking.checkOut;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkIn < today) {
      throw new BadRequestException('New check-in date must be today or in the future');
    }
    if (checkOut <= checkIn) {
      throw new BadRequestException('checkOut must be after checkIn');
    }

    const roomIds = dto.roomIds && dto.roomIds.length > 0
      ? dto.roomIds
      : booking.details.map((d) => d.roomId);

    return this.db.$transaction(async (tx) => {
      const rooms = await this.loadRooms(booking.hotelId, roomIds, checkIn, checkOut, tx);
      if (rooms.length !== roomIds.length) {
        throw new NotFoundException('One or more rooms were not found in this hotel');
      }

      const overlaps = await tx.bookingDetail.findMany({
        where: {
          roomId: { in: roomIds },
          bookingId: { not: bookingId },
          booking: {
            status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        },
        select: { roomId: true },
      });
      const blocked = Array.from(new Set(overlaps.map((o) => o.roomId)));
      if (blocked.length > 0) {
        throw new ConflictException(
          `Room(s) unavailable for requested dates: ${blocked.join(', ')}`,
        );
      }

      const activeHolds = await tx.roomHold.findMany({
        where: {
          roomId: { in: roomIds },
          status: 'ACTIVE',
          holdEnd: { gt: new Date() },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
          userId: { not: userId },
        },
        select: { roomId: true },
      });
      const held = Array.from(new Set(activeHolds.map((h) => h.roomId)));
      if (held.length > 0) {
        throw new ConflictException(
          `Room(s) temporarily held by another customer: ${held.join(', ')}`,
        );
      }

      const quote = buildQuote({
        hotelId: booking.hotelId,
        checkIn,
        checkOut,
        adults: 1,
        children: 0,
        rooms: rooms.map((room) => ({
          roomId: room.id,
          roomNumber: room.roomNumber,
          nightly: nightlyPrices(
            room,
            room.seasonalPricing,
            checkIn,
            checkOut,
          ).map((night) => night.price),
        })),
      });

      const oldTotal = booking.totalPrice.toNumber();
      const newTotal = quote.total;
      let refundAmount = 0;

      if (newTotal < oldTotal) {
        const rawDiff = oldTotal - newTotal;
        refundAmount = calculateModificationRefund(rawDiff, booking.checkIn);
        if (booking.payment && refundAmount > 0) {
          await tx.payment.update({
            where: { bookingId },
            data: {
              amount: newTotal,
              refundAmount: { increment: refundAmount },
            },
          });
        }
      } else if (newTotal > oldTotal && booking.payment) {
        await tx.payment.update({
          where: { bookingId },
          data: {
            amount: newTotal,
          },
        });
      }

      await tx.bookingDetail.deleteMany({
        where: { bookingId },
      });

      const firstGuestInfo = booking.details[0]?.guestInfo ?? { adults: 1, children: 0 };
      const guestCount = booking.details[0]?.guestCount ?? 1;

      await tx.bookingDetail.createMany({
        data: roomIds.map((roomId) => ({
          bookingId,
          roomId,
          guestCount,
          guestInfo: dto.guestInfos ? (dto.guestInfos as unknown as Prisma.InputJsonValue) : firstGuestInfo,
        })),
      });

      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          checkIn,
          checkOut,
          totalPrice: newTotal,
        },
        include: {
          details: { include: { room: true } },
          payment: true,
          hotel: { select: { id: true, name: true } },
        },
      });

      await this.audit.record(userId, 'BOOKING_MODIFIED', 'Booking', bookingId, {
        previousCheckIn: booking.checkIn,
        newCheckIn: checkIn,
        previousCheckOut: booking.checkOut,
        newCheckOut: checkOut,
        oldTotal,
        newTotal,
        refundAmount,
        additionalCharge: newTotal > oldTotal ? newTotal - oldTotal : 0,
      });

      return {
        booking: updated,
        oldTotal,
        newTotal,
        additionalCharge: newTotal > oldTotal ? newTotal - oldTotal : 0,
        refundAmount,
      };
    });
  }

  private async applyPromo(
    quote: BookingQuote,
    promoCode?: string,
    client: Prisma.TransactionClient | PrismaService = this.db,
  ) {
    if (!promoCode) return;
    const coupon = await this.coupons.validate(promoCode, client);
    const applied = applyCoupon(quote.total, coupon);
    quote.discount = applied.discount;
    quote.total = applied.total;
    quote.couponCode = coupon.code;
  }

  private async loadRooms(
    hotelId: string,
    roomIds: string[],
    checkIn: Date,
    checkOut: Date,
    client: Prisma.TransactionClient | PrismaService = this.db,
  ) {
    return client.room.findMany({
      where: { id: { in: roomIds }, hotelId },
      include: {
        seasonalPricing: true,
        availability: { where: { date: { gte: checkIn, lt: checkOut } } },
      },
    });
  }

  private async acquireRoomDateLocks(
    client: Prisma.TransactionClient,
    roomIds: string[],
    checkIn: Date,
    checkOut: Date,
  ): Promise<void> {
    for (const roomId of roomIds) {
      for (let d = checkIn.getTime(); d < checkOut.getTime(); d += 86_400_000) {
        const dateStr = new Date(d).toISOString().slice(0, 10);
        await client.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_advisory_xact_lock(hashtext(${roomId}), hashtext(${dateStr})) IS NULL AS locked
        `;
      }
    }
  }

  private async assertNoOverlappingStays(
    client: Prisma.TransactionClient,
    roomIds: string[],
    checkIn: Date,
    checkOut: Date,
    currentUserId?: string,
  ): Promise<void> {
    const overlaps = await client.bookingDetail.findMany({
      where: {
        roomId: { in: roomIds },
        booking: {
          status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          checkIn: { lt: checkOut },
          checkOut: { gt: checkIn },
        },
      },
      select: { roomId: true },
    });
    const blocked = Array.from(new Set(overlaps.map((o) => o.roomId)));
    if (blocked.length > 0) {
      throw new ConflictException(
        `Room(s) already booked for this stay: ${blocked.join(', ')}`,
      );
    }

    const activeHolds = await client.roomHold.findMany({
      where: {
        roomId: { in: roomIds },
        status: 'ACTIVE',
        holdEnd: { gt: new Date() },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
        ...(currentUserId ? { userId: { not: currentUserId } } : {}),
      },
      select: { roomId: true },
    });
    const held = Array.from(new Set(activeHolds.map((h) => h.roomId)));
    if (held.length > 0) {
      throw new ConflictException(
        `Room(s) temporarily held by another customer: ${held.join(', ')}`,
      );
    }
  }

  private assertAllRoomsAvailable(
    rooms: {
      id: string;
      status: Room['status'];
      availability: { date: Date; status: RoomAvailability['status'] }[];
    }[],
    checkIn: Date,
    checkOut: Date,
  ): void {
    for (const room of rooms) {
      if (
        !roomAvailableAcross(room.status, room.availability, checkIn, checkOut)
      ) {
        throw new ConflictException(
          `Room ${room.id} is not available for the requested stay`,
        );
      }
    }
  }
}
