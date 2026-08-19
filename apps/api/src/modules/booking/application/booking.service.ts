import {
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
import { applyCoupon } from '../../coupon/domain';
import type { CheckoutInput, CreateBookingInput } from '@repo/shared-types';

@Injectable()
export class BookingService {
  constructor(
    private readonly db: PrismaService,
    private readonly emitter: EventEmitter2,
    private readonly coupons: CouponService,
    private readonly invoices: InvoiceService,
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
      return tx.booking.create({
        data: {
          userId,
          hotelId: hotel.id,
          checkIn,
          checkOut,
          status: 'PENDING',
          totalPrice: quote.total,
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
              method: 'CREDIT_CARD',
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

    return updated;
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

  // ----- helpers -----

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

  /**
   * Serializes concurrent bookers per (room, night) using Postgres advisory
   * locks so the overlap check below is race-free.
   */
  private async acquireRoomDateLocks(
    client: Prisma.TransactionClient,
    roomIds: string[],
    checkIn: Date,
    checkOut: Date,
  ): Promise<void> {
    for (const roomId of roomIds) {
      for (let d = checkIn.getTime(); d < checkOut.getTime(); d += 86_400_000) {
        const dateStr = new Date(d).toISOString().slice(0, 10);
        // pg_advisory_xact_lock returns PostgreSQL `void`, which Prisma 7's
        // driver cannot deserialize. Evaluate it as a boolean expression so
        // the lock is acquired while the result has a supported type.
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
  ): Promise<void> {
    const overlaps = await client.bookingDetail.findMany({
      where: {
        roomId: { in: roomIds },
        booking: {
          status: { in: ['CONFIRMED', 'CHECKED_IN'] },
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
