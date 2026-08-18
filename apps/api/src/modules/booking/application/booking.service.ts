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
  parseDateOnly,
  roomAvailableAcross,
} from '../../catalog/domain/availability';
import { nightlyPrices } from '../../catalog/domain/pricing';
import { canTransition } from '../domain';
import { buildQuote } from '../domain/quote';
import type { CheckoutInput, CreateBookingInput } from '@repo/shared-types';

@Injectable()
export class BookingService {
  constructor(
    private readonly db: PrismaService,
    private readonly emitter: EventEmitter2,
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
              method: 'CARD',
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

    const updated = await this.db.booking.update({
      where: { id: booking.id },
      data: { status: 'CANCELLED' },
      include: {
        hotel: { select: { id: true, name: true } },
        details: { include: { room: true } },
        payment: true,
      },
    });

    this.emitter.emit(
      BookingEventNames.CANCELLED,
      new BookingCancelledEvent(booking.id, userId, booking.hotelId),
    );

    return updated;
  }

  async myBookings(userId: string) {
    const bookings = await this.db.booking.findMany({
      where: { userId },
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

  // ----- helpers -----

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
